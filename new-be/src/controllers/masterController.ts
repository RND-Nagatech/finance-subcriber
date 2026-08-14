
import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import Kategori, { IKategori } from '../models/Kategori';
import SubKategori, { ISubKategori } from '../models/SubKategori';
import Akun, { IAkun } from '../models/Akun';
import Budget from '../models/Budget';
import Program, { IProgram } from '../models/Program';
import GroupProgram from '../models/GroupProgram';
import Subscriber, { ISubscriber } from '../models/Subscriber';
import SubscriberTahun from '../models/SubscriberTahun';
import Subscription from '../models/Subscription';
import SubscriptionDetail from '../models/SubscriptionDetail';
import Group from '../models/Group';
import Karyawan from '../models/Karyawan';
import CustomDashboard, { ICustomDashboard } from '../models/CustomDashboard';
import Transaksi from '../models/Transaksi';
import { addDays, getTempo, parseDateOnly, toPeriode } from '../utils/subscriptionPeriod';
import { rebuildSubscriberTahun } from '../services/subscriberTahunService';


// Resolve acting user from authenticated request only. Ignore client-supplied audit fields.
const resolveUserId = (req: Request) => {
  if (req.user && typeof req.user === 'object') {
    return (req.user as any).name || (req.user as any).username || (req.user as any).id || (req.user as any)._id || 'system';
  }
  if (typeof req.user === 'string' && req.user.length > 0) return req.user;
  return 'system';
};

// Return audit user id (prefer numeric/id fields). Used for deleted_by/deleted_at fields.
const getAuditUserId = (req: Request) => {
  if (req.user && typeof req.user === 'object') {
    return String((req.user as any).id || (req.user as any)._id || (req.user as any).username || (req.user as any).name);
  }
  return 'system';
};

// Helper function to generate next kode from the highest numeric kode in the collection.
const generateNextKode = async (model: any, field = 'kode'): Promise<string> => {
  const [lastDoc] = await model.aggregate([
    {
      $addFields: {
        kode_number: {
          $convert: {
            input: `$${field}`,
            to: 'int',
            onError: null,
            onNull: null,
          },
        },
      },
    },
    { $match: { kode_number: { $ne: null } } },
    { $sort: { kode_number: -1 } },
    { $limit: 1 },
    { $project: { kode_number: 1 } },
  ]);

  const lastNum = Number(lastDoc?.kode_number || 0);
  const nextNum = lastNum + 1;
  return nextNum.toString().padStart(3, '0');
};

const parseDateOnlyToNoonUtc = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === '') return null;
  const raw = String(value).trim();
  const ymd = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (ymd) {
    const year = Number(ymd[1]);
    const month = Number(ymd[2]);
    const day = Number(ymd[3]);
    const date = new Date(Date.UTC(year, month - 1, day, 12, 0, 0, 0));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ) {
      return date;
    }
    return null;
  }
  const parsed = new Date(raw);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const getFiscalYearFromDate = (date: Date) => date.getUTCMonth() === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();

const buildSubscriptionFiscalSchedule = (params: {
  startDate: Date;
  jumlahBulan: number;
  biayaPerBulan: number;
  firstDiskon?: number;
}) => {
  const entries: Array<{ periode: string; tahun: number; totalBiaya: number }> = [];
  const fiscalEndDate = new Date(Date.UTC(getFiscalYearFromDate(params.startDate), 11, 0, 12, 0, 0, 0));
  let cursorStart = params.startDate;
  let isFirst = true;

  while (cursorStart <= fiscalEndDate) {
    const tempo = getTempo(cursorStart, params.jumlahBulan);
    const nextStart = addDays(tempo, 1);
    const jumlahBiaya = params.biayaPerBulan * params.jumlahBulan;
    const diskon = isFirst ? Math.max(0, Math.min(jumlahBiaya, Number(params.firstDiskon || 0))) : 0;
    entries.push({
      periode: toPeriode(cursorStart),
      tahun: getFiscalYearFromDate(cursorStart),
      totalBiaya: Math.max(0, jumlahBiaya - diskon),
    });
    cursorStart = nextStart;
    isFirst = false;
  }

  return entries;
};

const applySubscriptionScheduleDelta = async (
  entries: ReturnType<typeof buildSubscriptionFiscalSchedule>,
  multiplier: 1 | -1,
  userTag: string
) => {
  const now = new Date();
  for (const entry of entries) {
    await Subscription.updateOne(
      { periode: entry.periode },
      {
        $set: {
          periode: entry.periode,
          tahun: entry.tahun,
          updated_at: now,
          update_date: now,
          update_by: userTag,
        },
        $inc: {
          estimasi: entry.totalBiaya * multiplier,
        },
        $setOnInsert: {
          realisasi: 0,
          total_subscriber_estimasi: 0,
          total_subscriber_realisasi: 0,
          input_date: now,
          input_by: userTag,
          delete_date: null,
          delete_by: null,
        },
      },
      { upsert: true }
    );
  }
};

const syncOpenSubscriptionDetailsFromSubscriber = async (subscriber: any, userTag: string) => {
  const openDetails: any[] = await SubscriptionDetail.find({
    subscriber_id: subscriber._id,
    status: 'OPEN',
    is_active: { $ne: false },
    delete_date: null,
  });
  const affectedYears = new Set<number>();

  for (const detail of openDetails) {
    const startDate = parseDateOnly(detail.tgl_mulai_tagihan);
    if (!startDate) continue;

    const oldSchedule = buildSubscriptionFiscalSchedule({
      startDate,
      jumlahBulan: Math.max(1, Number(detail.jumlah_bulan || 1)),
      biayaPerBulan: Math.max(0, Number(detail.biaya_per_bulan || 0)),
      firstDiskon: Number(detail.diskon || 0),
    });
    await applySubscriptionScheduleDelta(oldSchedule, -1, userTag);

    const jumlahBulan = Math.max(1, Number(detail.jumlah_bulan || 1));
    const biayaPerBulan = Math.max(0, Number(subscriber.biaya || 0));
    const jumlahBiaya = biayaPerBulan * jumlahBulan;
    const diskon = Math.max(0, Math.min(jumlahBiaya, Number(detail.diskon || 0)));

    detail.kode_subscriber = subscriber.kode;
    detail.toko = subscriber.toko;
    detail.program = subscriber.program;
    detail.daerah = subscriber.daerah || null;
    detail.biaya_per_bulan = biayaPerBulan;
    detail.jumlah_biaya = jumlahBiaya;
    detail.diskon = diskon;
    detail.total_biaya = Math.max(0, jumlahBiaya - diskon);
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();

    const newSchedule = buildSubscriptionFiscalSchedule({
      startDate,
      jumlahBulan,
      biayaPerBulan,
      firstDiskon: diskon,
    });
    await applySubscriptionScheduleDelta(newSchedule, 1, userTag);
    oldSchedule.concat(newSchedule).forEach((entry) => affectedYears.add(entry.tahun));
  }

  const existingYears = await SubscriptionDetail.distinct('tahun', {
    subscriber_id: subscriber._id,
    delete_date: null,
  });
  existingYears.forEach((year) => affectedYears.add(Number(year)));

  for (const year of affectedYears) {
    await rebuildSubscriberTahun(subscriber._id, year, userTag);
  }

  return { synced: openDetails.length, affectedYears: Array.from(affectedYears) };
};

const formatDateOnly = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const normalizeDateOnlyString = (value: unknown): string | null => {
  const parsed = parseDateOnlyToNoonUtc(value);
  return parsed ? formatDateOnly(parsed) : null;
};

const normalizeOptionalString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const trimmed = String(value).trim();
  return trimmed ? trimmed : null;
};

const normalizeOptionalDate = (value: unknown): string | null => normalizeDateOnlyString(value);

const resolveKaryawanSelection = async (
  kode: unknown,
  fallbackName: unknown
): Promise<{ kode: string | null; nama: string | null }> => {
  const normalizedKode = normalizeOptionalString(kode)?.toUpperCase() || null;
  if (!normalizedKode) {
    return { kode: null, nama: normalizeOptionalString(fallbackName) };
  }

  const karyawan = await Karyawan.findOne({
    kode_karyawan: normalizedKode,
    status_aktv: true,
    delete_date: null,
  });

  if (!karyawan) {
    throw new Error('Karyawan tidak ditemukan atau tidak aktif');
  }

  return { kode: karyawan.kode_karyawan, nama: karyawan.nama_karyawan };
};

const normalizeGender = (value: unknown): 'LAKI-LAKI' | 'PEREMPUAN' | null => {
  const normalized = normalizeOptionalString(value)?.toUpperCase();
  if (normalized === 'LAKI-LAKI' || normalized === 'PEREMPUAN') return normalized;
  return null;
};

export const createKategori = async (req: Request, res: Response) => {
  try {
    const { kategori } = req.body;
    if (!kategori) return res.status(400).json({ message: 'kategori required' });
    const userId = resolveUserId(req);
    const finalKode = await generateNextKode(Kategori);
    const k = new Kategori({
      kategori,
      kode: finalKode,
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: userId,
      update_by: null,
      delete_by: null,
    });

    await k.save();
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: k });
  } catch (error) {
    console.error('❌ Error in createKategori:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateKategori = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { kategori, kode } = req.body;
    const userId = resolveUserId(req);

    const old = await Kategori.findById(id);
    if (!old) return res.status(404).json({ message: 'Kategori not found' });

    // kode uniqueness check (exclude current)
    if (kode) {
      const existsKode = await Kategori.findOne({ _id: { $ne: id }, kode, $or: [{ status_aktv: true }, { active: true }] });
      if (existsKode) {
        return res.status(400).json({ message: 'Kode kategori tersebut sudah digunakan. Silakan gunakan kode lain.' });
      }
    }

    old.kategori = kategori ?? old.kategori;
    old.kode = kode ?? old.kode;
    old.update_date = new Date();
    old.update_by = userId;
    old.status_aktv = req.body.status_aktv ?? old.status_aktv;
    await old.save();
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: old });
  } catch (error) {
    console.error('❌ Error in updateKategori:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};


// ==================== KATEGORI ====================

export const listKategori = async (req: Request, res: Response) => {
  try {
    let filter = {};
    if (!req.query.all) {
      filter = { status_aktv: true };
    };
    const list = await Kategori.find(filter).sort({ kategori: 1 });
    res.json(list);
  } catch (error) {
    console.error('❌ Error in listKategori:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteKategori = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = resolveUserId(req);

    const kategori = await Kategori.findById(id);
    if (!kategori) return res.status(404).json({ message: 'Kategori not found' });
    // 1) Check active subkategori referencing this kategori
    const activeSubCount = await SubKategori.countDocuments({
      kategori: kategori.kategori,
      $or: [{ status_aktv: true }, { active: true }],
    });
    if (activeSubCount > 0) {
      return res.status(400).json({ message: 'Kategori tidak dapat dihapus karena masih memiliki sub kategori yang aktif.' });
    }

    // 2) Check active akun referencing this kategori (via Akun.kategori)
    const activeAkunCount = await Akun.countDocuments({
      kategori: kategori.kategori,
      $or: [{ status_aktv: true }, { active: true }],
    });
    if (activeAkunCount > 0) {
      return res.status(400).json({ message: 'Kategori tidak dapat dihapus karena masih memiliki akun aktif yang terhubung.' });
    }

    // 3) Check for transactions referencing this kategori
    const trx = await Transaksi.findOne({ kategori: { $in: [kategori.kategori, String(kategori._id)] } });
    if (trx) {
      return res.status(400).json({ message: 'Kategori tidak dapat dihapus karena masih terdapat transaksi yang mereferensikannya.' });
    }

    const auditUser = getAuditUserId(req);
    kategori.status_aktv = false;
    kategori.delete_date = new Date();
    kategori.delete_by = auditUser;
    await kategori.save();
    res.status(200).json({ success: true, message: 'Kategori berhasil dihapus.', data: kategori });
  } catch (error) {
    console.error('❌ Error in deleteKategori:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// ...existing code...

// ...existing code...

// ==================== SUBKATEGORI ====================
export const createSubKategori = async (req: Request, res: Response) => {
  try {
    const { sub_kategori, kategori } = req.body;
    if (!sub_kategori || !kategori) return res.status(400).json({ message: 'sub_kategori & kategori required' });
    const userId = resolveUserId(req);
    const finalKode = await generateNextKode(SubKategori);

    // Jika belum ada, insert baru
    const s = new SubKategori({
      sub_kategori,
      kode: finalKode,
      kategori,
      status_aktv: true,
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: userId,
      update_by: null,
      delete_by: null,
    });

    await s.save();
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: s });
  } catch (error) {
    console.error('❌ Error in createSubKategori:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const listSubKategori = async (req: Request, res: Response) => {
  try {
    const { kategori } = req.query;
    const filter: any = {};
    if (kategori) {
      filter.kategori = kategori;
    }

    const list = await SubKategori.find({ ...filter, status_aktv: true }).sort({ sub_kategori: 1 });

    const formatted = list.map((s) => ({
      _id: s._id,
      sub_kategori: s.sub_kategori,
      kode: s.kode,
      kategori: s.kategori,
      input_date: s.input_date,
      update_date: s.update_date,
      delete_date: s.delete_date,
      input_by: s.input_by,
      update_by: s.update_by,
      delete_by: s.delete_by,
    }));

    res.json(formatted);
  } catch (error) {
    console.error('❌ Error in listSubKategori:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};


export const updateSubKategori = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sub_kategori, kode, kategori } = req.body;
    const userId = resolveUserId(req);

    // Ambil sub_kategori lama
    const oldSubKategori = await SubKategori.findById(id);
    if (!oldSubKategori) return res.status(404).json({ message: 'SubKategori not found' });

    // kode uniqueness check (exclude current)
    if (kode) {
      const kodeExists = await SubKategori.findOne({ _id: { $ne: id }, kode, $or: [{ status_aktv: true }, { active: true }] });
      if (kodeExists) {
        return res.status(400).json({ message: 'Kode sub kategori tersebut sudah digunakan. Silakan gunakan kode lain.' });
      }
    }

    const s = await SubKategori.findByIdAndUpdate(
      id,
      { sub_kategori, kode, kategori, update_date: new Date(), update_by: userId, status_aktv: req.body.status_aktv ?? true },
      { new: true }
    );

    if (!s) return res.status(404).json({ message: 'SubKategori not found' });
    // Update relasi akun: ganti semua akun yang punya sub_kategori lama ke sub_kategori baru
    await Akun.updateMany({ sub_kategori: oldSubKategori.sub_kategori }, { sub_kategori });
    res.json(s);
  } catch (error) {
    console.error('❌ Error in updateSubKategori:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteSubKategori = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = resolveUserId(req);
    const subkategori = await SubKategori.findById(id);
    if (!subkategori) return res.status(404).json({ message: 'SubKategori not found' });
    // 1) Check active akun referencing this subkategori
    const activeAkunCount = await Akun.countDocuments({
      sub_kategori: subkategori.sub_kategori,
      $or: [{ status_aktv: true }, { active: true }],
    });
    if (activeAkunCount > 0) {
      return res.status(400).json({ message: 'Sub kategori tidak dapat dihapus karena masih memiliki akun aktif.' });
    }

    // 2) Check transactions referencing this subkategori
    const trx = await Transaksi.findOne({ sub_kategori: { $in: [subkategori.sub_kategori, String(subkategori._id)] } });
    if (trx) {
      return res.status(400).json({ message: 'Sub kategori tidak dapat dihapus karena masih terdapat transaksi yang mereferensikannya.' });
    }

    const auditUser = getAuditUserId(req);
    subkategori.status_aktv = false;
    subkategori.delete_date = new Date();
    subkategori.delete_by = auditUser;
    await subkategori.save();
    res.status(200).json({ success: true, message: 'Sub kategori berhasil dihapus.', data: subkategori });
  } catch (error) {
    console.error('❌ Error in deleteSubKategori:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// ==================== AKUN ====================

export const listAkun = async (req: Request, res: Response) => {
  try {
    const { sub_kategori } = req.query;
    const filter: any = {};
    if (sub_kategori) {
      filter.sub_kategori = sub_kategori;
    }

    // Ambil data akun dan join sub kategori agar dapat _id
    const akunList = await Akun.find({ ...filter, status_aktv: true }).sort({ akun: 1 });
    const budgetIds = Array.from(new Set(
      akunList
        .map((a: any) => a.budget_id ? String(a.budget_id) : '')
        .filter(Boolean)
    ));
    const budgets = budgetIds.length > 0
      ? await Budget.find({ _id: { $in: budgetIds } }).select('name year').lean()
      : [];
    // Cari sub kategori berdasarkan nama untuk dapatkan _id
    const subKategoriAll = await SubKategori.find({});
    const list = akunList.map((a) => {
      const subKategoriObj = subKategoriAll.find(
        (sub) => sub.sub_kategori === a.sub_kategori
      );
      const budgetObj = budgets.find((b: any) => String(b._id) === String((a as any).budget_id || ''));
      return {
        ...a.toObject(),
        subkategori_id: subKategoriObj ? subKategoriObj._id : '',
        budget_name: budgetObj ? `${(budgetObj as any).name} (${(budgetObj as any).year})` : '',
      };
    });
    res.json(list);
  } catch (error) {
    console.error('❌ Error in listAkun:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createAkun = async (req: Request, res: Response) => {
  try {
    const { sub_kategori, akun, budget_id } = req.body;
    if (!sub_kategori || !akun) return res.status(400).json({ message: 'sub_kategori & akun required' });
    const userId = resolveUserId(req);
    const finalKode = await generateNextKode(Akun);

    // sub_kategori dikirim sebagai _id, ambil semua relasi sub kategori
    let subKategoriNama = sub_kategori;
    let subKategoriId = null;
    let subKategoriKode = '';
    let kategoriNama = '';
    if (mongoose.Types.ObjectId.isValid(sub_kategori)) {
      const subKategoriDoc = await SubKategori.findById(sub_kategori);
      if (!subKategoriDoc) return res.status(400).json({ message: 'SubKategori tidak ditemukan' });
      subKategoriNama = subKategoriDoc.sub_kategori;
      subKategoriId = subKategoriDoc._id;
      subKategoriKode = subKategoriDoc.kode;
      kategoriNama = subKategoriDoc.kategori;
    }

    let resolvedBudgetId: mongoose.Types.ObjectId | null = null;
    if (budget_id && budget_id !== 'none') {
      if (!mongoose.Types.ObjectId.isValid(String(budget_id))) {
        return res.status(400).json({ message: 'budget_id tidak valid' });
      }
      const budgetDoc = await Budget.findOne({
        _id: String(budget_id),
        $or: [{ status_aktv: true }, { active: true }],
      });
      if (!budgetDoc) {
        return res.status(400).json({ message: 'Budget tidak ditemukan atau tidak aktif' });
      }
      resolvedBudgetId = budgetDoc._id as any;
    }

    const a = new Akun({
      sub_kategori: subKategoriNama,
      sub_kategori_id: subKategoriId,
      sub_kategori_kode: subKategoriKode,
      kategori: kategoriNama,
      budget_id: resolvedBudgetId,
      akun,
      kode: finalKode,
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: userId,
      update_by: null,
      delete_by: null,
    });

    await a.save();
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: a });
  } catch (error) {
    console.error('\u274c Error in createAkun:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateAkun = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { sub_kategori, akun, kode, budget_id } = req.body;
    const userId = resolveUserId(req);

    // Ambil akun lama
    const oldAkun = await Akun.findById(id);
    if (!oldAkun) return res.status(404).json({ message: 'Akun not found' });

    // sub_kategori dikirim sebagai _id, ambil nama sub kategori
    let subKategoriNama = oldAkun.sub_kategori;
    if (sub_kategori !== undefined) {
      subKategoriNama = sub_kategori;
      if (mongoose.Types.ObjectId.isValid(sub_kategori)) {
        const subKategoriDoc = await SubKategori.findById(sub_kategori);
        if (!subKategoriDoc) return res.status(400).json({ message: 'SubKategori tidak ditemukan' });
        subKategoriNama = subKategoriDoc.sub_kategori;
      }
    }

    let resolvedBudgetId: mongoose.Types.ObjectId | null = (oldAkun as any).budget_id || null;
    if (budget_id !== undefined) {
      if (!budget_id || budget_id === 'none') {
        resolvedBudgetId = null;
      } else {
        if (!mongoose.Types.ObjectId.isValid(String(budget_id))) {
          return res.status(400).json({ message: 'budget_id tidak valid' });
        }
        const budgetDoc = await Budget.findOne({
          _id: String(budget_id),
          $or: [{ status_aktv: true }, { active: true }],
        });
        if (!budgetDoc) {
          return res.status(400).json({ message: 'Budget tidak ditemukan atau tidak aktif' });
        }
        resolvedBudgetId = budgetDoc._id as any;
      }
    }

    const a = await Akun.findByIdAndUpdate(
      id,
      {
        sub_kategori: subKategoriNama,
        akun: akun ?? oldAkun.akun,
        kode: kode ?? oldAkun.kode,
        budget_id: resolvedBudgetId,
        update_date: new Date(),
        update_by: userId,
        status_aktv: req.body.status_aktv ?? true
      },
      { new: true }
    );

    if (!a) return res.status(404).json({ message: 'Akun not found' });
    // Update relasi transaksi: ganti semua transaksi yang punya akun lama ke akun baru
    await Transaksi.updateMany({ akun: oldAkun._id }, { akun: a._id });
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: a });
  } catch (error) {
    console.error('\u274c Error in updateAkun:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteAkun = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = resolveUserId(req);

    const akun = await Akun.findById(id);
    if (!akun) return res.status(404).json({ message: 'Akun not found' });
    // Check transactions referencing this akun (by id or by string)
    const trx = await Transaksi.findOne({ akun: { $in: [akun._id, String(akun._id), akun.akun, String(akun.akun)] } });
    if (trx) {
      return res.status(400).json({ message: 'Akun tidak dapat dihapus karena sudah digunakan di transaksi.' });
    }

    const auditUser = getAuditUserId(req);
    akun.status_aktv = false;
    akun.delete_date = new Date();
    akun.delete_by = auditUser;
    await akun.save();
    res.status(200).json({ success: true, message: 'Akun berhasil dihapus.', data: akun });
  } catch (error) {
    console.error('❌ Error in deleteAkun:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// ==================== CUSTOM DASHBOARD ====================

export const listCustomDashboard = async (req: Request, res: Response) => {
  try {
    let filter = {};
    if (!req.query.all) {
      filter = { status_aktv: true };
    };
    const list = await CustomDashboard.find(filter).sort({ title: 1 });
    res.json(list);
  } catch (error) {
    console.error('❌ Error in listCustomDashboard:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createCustomDashboard = async (req: Request, res: Response) => {
  try {
    const { title, sub_kategories } = req.body;
    if (!title || !sub_kategories || !Array.isArray(sub_kategories)) {
      return res.status(400).json({ message: 'title dan sub_kategories (array) required' });
    }
    const userId = resolveUserId(req);

    // Check title uniqueness (active records)
    const existsTitle = await CustomDashboard.findOne({ title, $or: [{ status_aktv: true }, { active: true }] });
    if (existsTitle) {
      return res.status(400).json({ message: 'Title custom dashboard tersebut sudah digunakan. Silakan gunakan title lain.' });
    }

    const cd = new CustomDashboard({
      title,
      sub_kategories,
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: userId,
      update_by: null,
      delete_by: null,
    });

    await cd.save();
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: cd });
  } catch (error) {
    console.error('❌ Error in createCustomDashboard:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateCustomDashboard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { title, sub_kategories } = req.body;
    const userId = resolveUserId(req);

    const old = await CustomDashboard.findById(id);
    if (!old) return res.status(404).json({ message: 'Custom Dashboard not found' });

    // title uniqueness check (exclude current)
    if (title) {
      const existsTitle = await CustomDashboard.findOne({ _id: { $ne: id }, title, $or: [{ status_aktv: true }, { active: true }] });
      if (existsTitle) {
        return res.status(400).json({ message: 'Title custom dashboard tersebut sudah digunakan. Silakan gunakan title lain.' });
      }
    }

    old.title = title ?? old.title;
    old.sub_kategories = sub_kategories ?? old.sub_kategories;
    old.update_date = new Date();
    old.update_by = userId;
    old.status_aktv = req.body.status_aktv ?? old.status_aktv;
    await old.save();
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: old });
  } catch (error) {
    console.error('❌ Error in updateCustomDashboard:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteCustomDashboard = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = resolveUserId(req);

    const cd = await CustomDashboard.findById(id);
    if (!cd) return res.status(404).json({ message: 'Custom Dashboard not found' });

    const auditUser = getAuditUserId(req);
    cd.status_aktv = false;
    cd.delete_date = new Date();
    cd.delete_by = auditUser;
    await cd.save();
    res.status(200).json({ success: true, message: 'Custom Dashboard berhasil dihapus.', data: cd });
  } catch (error) {
    console.error('❌ Error in deleteCustomDashboard:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// ==================== PROGRAM ====================

export const listProgram = async (req: Request, res: Response) => {
  try {
    let filter = {};
    if (!req.query.all) {
      filter = { status_aktv: true };
    };
    const list = await Program.find(filter).sort({ nama: 1 });
    res.json(list);
  } catch (error) {
    console.error('❌ Error in listProgram:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createProgram = async (req: Request, res: Response) => {
  try {
    const { nama, biaya, group_program, internal_kode } = req.body;
    if (!nama || biaya === undefined || biaya === null || !group_program || !internal_kode) {
      return res.status(400).json({ message: 'nama, biaya, group_program, dan internal_kode required' });
    }

    if (biaya < 0) {
      return res.status(400).json({ message: 'biaya tidak boleh negatif' });
    }

    const groupProgram = await GroupProgram.findOne({ group_program, status_aktv: true });
    if (!groupProgram) {
      return res.status(400).json({ message: 'Group program tidak ditemukan atau tidak aktif' });
    }

    const userId = resolveUserId(req);
    const exists = await Program.findOne({ nama, status_aktv: true, delete_date: null });
    if (exists) {
      return res.status(400).json({ message: 'Nama program tersebut sudah digunakan. Silakan gunakan nama lain.' });
    }

    const deletedProgram = await Program.findOne({
      nama,
      $or: [{ status_aktv: false }, { delete_date: { $ne: null } }],
    });
    if (deletedProgram) {
      deletedProgram.internal_kode = internal_kode;
      deletedProgram.biaya = biaya;
      deletedProgram.group_program = groupProgram.group_program;
      deletedProgram.status_aktv = true;
      deletedProgram.delete_date = null;
      deletedProgram.delete_by = null;
      deletedProgram.update_date = new Date();
      deletedProgram.update_by = userId;
      await deletedProgram.save();

      return res.status(200).json({
        success: true,
        message: 'Program lama berhasil diaktifkan kembali.',
        data: deletedProgram,
      });
    }

    const finalKode = await generateNextKode(Program);

    const p = new Program({
      nama,
      kode: finalKode,
      internal_kode,
      biaya,
      group_program: groupProgram.group_program,
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: userId,
      update_by: null,
      delete_by: null,
    });

    await p.save();
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: p });
  } catch (error) {
    console.error('❌ Error in createProgram:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateProgram = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { nama, biaya, group_program, internal_kode } = req.body;
    const userId = resolveUserId(req);

    const old = await Program.findById(id);
    if (!old) return res.status(404).json({ message: 'Program not found' });

    // nama uniqueness check (exclude current)
    if (nama) {
      const existsNama = await Program.findOne({ _id: { $ne: id }, nama, $or: [{ status_aktv: true }, { active: true }] });
      if (existsNama) {
        return res.status(400).json({ message: 'Nama program tersebut sudah digunakan. Silakan gunakan nama lain.' });
      }
    }

    let finalGroupProgram = old.group_program;
    if (group_program !== undefined) {
      const groupProgram = await GroupProgram.findOne({ group_program, status_aktv: true });
      if (!groupProgram) {
        return res.status(400).json({ message: 'Group program tidak ditemukan atau tidak aktif' });
      }
      finalGroupProgram = groupProgram.group_program;
    }

    old.nama = nama ?? old.nama;
    old.biaya = biaya ?? old.biaya;
    old.group_program = finalGroupProgram;
    old.internal_kode = internal_kode ?? old.internal_kode;
    old.update_date = new Date();
    old.update_by = userId;
    old.status_aktv = req.body.status_aktv ?? old.status_aktv;
    await old.save();
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: old });
  } catch (error) {
    console.error('❌ Error in updateProgram:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteProgram = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = resolveUserId(req);

    const program = await Program.findById(id);
    if (!program) return res.status(404).json({ message: 'Program not found' });

    // TODO: Add validation for related data (subscriptions, etc.) if needed

    const auditUser = getAuditUserId(req);
    program.status_aktv = false;
    program.delete_date = new Date();
    program.delete_by = auditUser;
    await program.save();
    res.status(200).json({ success: true, message: 'Program berhasil dihapus.', data: program });
  } catch (error) {
    console.error('❌ Error in deleteProgram:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// ==================== SUBSCRIBER ====================

export const listSubscriber = async (req: Request, res: Response) => {
  try {
    const {
      page = 1,
      limit = 10,
      searchField,
      searchValue,
      month,
      year,
      all,
      kode_group,
      status_subscriber,
      active_only
    } = req.query;

    const pageNum = Number(page) || 1;
    const maxLimit = all ? 10000 : 100;
    const limitNum = Math.min(Number(limit) || 10, maxLimit);
    const skip = (pageNum - 1) * limitNum;
    const summaryYear = year && String(year) !== 'ALL'
      ? Number(year)
      : getFiscalYearFromDate(new Date());

    // ===============================
    // BASE MATCH
    // ===============================
    const baseMatch: any = {};
    if (!all || String(active_only || '') === '1') baseMatch.status_aktv = true;
    if (kode_group && String(kode_group) !== 'ALL') {
      baseMatch.kode_group = String(kode_group);
    }

    const statusSubscriber = String(status_subscriber || 'AKTIF').toUpperCase();
    if (statusSubscriber === 'OUTSTAND') {
      baseMatch.status_subscriber = 'OUTSTAND';
    } else if (statusSubscriber === 'NON_AKTIF') {
      baseMatch.status_subscriber = 'NON_AKTIF';
    } else if (statusSubscriber === 'ALL') {
      baseMatch.$or = [
        { status_subscriber: 'AKTIF' },
        { status_subscriber: 'NON_AKTIF' },
        { status_subscriber: { $exists: false } },
        { status_subscriber: null },
      ];
    } else {
      baseMatch.$or = [
        { status_subscriber: 'AKTIF' },
        { status_subscriber: { $exists: false } },
        { status_subscriber: null },
      ];
    }

    if (searchField && searchValue && typeof searchValue === "string") {
      baseMatch[searchField as string] = new RegExp(searchValue, "i");
    }

    // ===============================
    // PIPELINE LIST
    // ===============================
    const listPipeline = [
      { $match: baseMatch },
      ...buildTanggalPipeline(month as string, year as string),
      { $sort: { tanggalDate: -1, tanggal: -1 } },
      { $skip: skip },
      { $limit: limitNum },
      {
        $lookup: {
          from: SubscriberTahun.collection.name,
          let: { subscriberId: '$_id' },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ['$subscriber_id', '$$subscriberId'] },
                    { $eq: ['$tahun', summaryYear] },
                    { $eq: ['$delete_date', null] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: 'summary_tahun',
        },
      },
      { $unwind: { path: '$summary_tahun', preserveNullAndEmptyArrays: true } },
      {
        $addFields: {
          summary_tahun: {
            tahun: summaryYear,
            total_rencana_tagihan: { $ifNull: ['$summary_tahun.total_rencana_tagihan', 0] },
            tagihan_terbayar: { $ifNull: ['$summary_tahun.tagihan_terbayar', 0] },
            sisa_tagihan: { $ifNull: ['$summary_tahun.sisa_tagihan', 0] },
            last_rebuild_at: '$summary_tahun.last_rebuild_at',
          },
        },
      },
    ];

    const data = await Subscriber.aggregate(listPipeline);

    // ===============================
    // PIPELINE COUNT
    // ===============================
    const countPipeline = [
      { $match: baseMatch },
      ...buildTanggalPipeline(month as string, year as string),
      { $count: "total" }
    ];

    const countResult = await Subscriber.aggregate(countPipeline);
    const total = countResult[0]?.total || 0;

    // ===============================
    // PIPELINE TOTAL BIAYA
    // ===============================
    const biayaPipeline = [
      { $match: baseMatch },
      ...buildTanggalPipeline(month as string, year as string),
      {
        $group: {
          _id: null,
          totalBiaya: { $sum: "$biaya" }
        }
      }
    ];

    const biayaResult = await Subscriber.aggregate(biayaPipeline);
    const totalBiaya = biayaResult[0]?.totalBiaya || 0;

    // ===============================
    // RESPONSE
    // ===============================
    res.json({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        totalBiaya
      }
    });
  } catch (error) {
    console.error("❌ Error in listSubscriber:", error);
    res.status(500).json({ message: "Server error", error });
  }
};


export const getSubscriberYears = async (req: Request, res: Response) => {
  try {
    const tz = 'Asia/Jakarta';
    // Get distinct years from subscriber tanggal field
    const yearsResult = await Subscriber.aggregate([
  {
    $match: {
      tanggal: { $exists: true, $ne: null },
      status_aktv: true
    }
  },
  {
    $addFields: {
      tanggalDate: {
        $cond: [
          { $eq: [{ $type: "$tanggal" }, "string"] },
          {
            $dateFromString: {
              dateString: "$tanggal",
              onError: null
            }
          },
          "$tanggal"
        ]
      }
    }
  },
  {
    $match: {
      tanggalDate: { $type: "date" }
    }
  },
  {
    $group: {
      _id: { $year: { date: "$tanggalDate", timezone: tz } }
    }
  },
  {
    $sort: { _id: -1 }
  }
]
);

    const years = yearsResult.map(item => item._id.toString());
    res.json(years);
  } catch (error) {
    console.error('❌ Error in getSubscriberYears:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

const buildTanggalPipeline = (month?: string, year?: string) => {
  const pipeline: any[] = [];
  const tz = 'Asia/Jakarta';

  if (
    (month && month !== 'ALL') ||
    (year && year !== 'ALL')
  ) {
    pipeline.push({
      $addFields: {
        tanggalDate: {
          $cond: [
            { $eq: [{ $type: "$tanggal" }, "string"] },
            {
              $dateFromString: {
                dateString: "$tanggal",
                onError: null
              }
            },
            "$tanggal"
          ]
        }
      }
    });

    const expr: any[] = [];

    if (year && year !== 'ALL') {
      expr.push({
        $eq: [
          { $year: { date: "$tanggalDate", timezone: tz } },
          parseInt(year, 10)
        ]
      });
    }

    if (month && month !== 'ALL') {
      expr.push({
        $eq: [
          { $month: { date: "$tanggalDate", timezone: tz } },
          parseInt(month, 10)
        ]
      });
    }

    pipeline.push({
      $match: {
        tanggalDate: { $type: "date" },
        ...(expr.length ? { $expr: { $and: expr } } : {})
      }
    });
  }

  return pipeline;
};


export const createSubscriber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      group_id,
      no_ok,
      nomor_telepon,
      kode_sales,
      sales,
      nama_owner,
      no_hp_owner,
      gender_owner,
      nama_pic,
      no_hp_pic,
      gender_pic,
      toko,
      grup,
      domain,
      server_location,
      alamat,
      daerah,
      program: programName,
      vb_online,
      biaya: customBiaya,
      tanggal,
      tgl_implementasi,
      tgl_dijalankan,
      tgl_terbayar,
      tgl_berakhir_langganan,
      tgl_bayar_selanjutnya,
      kode_implementator,
      implementator,
      via,
      internal_kode,
      status_subscriber
    } = req.body;

    const isOutstandSubscriber = status_subscriber === 'OUTSTAND';
    const group = group_id ? await Group.findOne({ _id: group_id, status_aktv: true }) : null;
    if (group_id && !group) {
      return res.status(400).json({ message: 'Group tidak ditemukan atau tidak aktif' });
    }

    // Validate and parse tanggal. Field lama `tanggal` tetap diisi dari tgl_implementasi.
    const parsedTanggal = normalizeDateOnlyString(tgl_implementasi || tanggal);
    if (!isOutstandSubscriber && !parsedTanggal) {
      return res.status(400).json({ message: 'Format tgl implementasi tidak valid' });
    }

    // Get program details
    const program = await Program.findOne({ nama: programName, status_aktv: true });
    if (!program) {
      return res.status(400).json({ message: 'Program tidak ditemukan atau tidak aktif' });
    }

    // Use custom biaya if provided, otherwise use program biaya
    const subscriberBiaya = customBiaya !== undefined ? customBiaya : program.biaya;
    const selectedSales = await resolveKaryawanSelection(kode_sales, sales);
    const selectedImplementator = await resolveKaryawanSelection(kode_implementator, implementator);

    // Calculate prev_subscriber, current_subscriber, prev_biaya, and current_biaya
    const lastSubscriber = await Subscriber.findOne({
      program: program.nama,
      status_aktv: true
    }).sort({ input_date: -1 }).limit(1);

    const prevSubscriber = lastSubscriber ? lastSubscriber.current_subscriber : 0;
    const currentSubscriber = prevSubscriber + 1;
    const prevBiaya = lastSubscriber ? lastSubscriber.current_biaya : 0;
    const currentBiaya = subscriberBiaya;

    const userId = resolveUserId(req);
    const finalKode = await generateNextKode(Subscriber);
    const requestedInternalKode = normalizeOptionalString(internal_kode);
    const internalKodeExists = requestedInternalKode
      ? await Subscriber.exists({ internal_kode: requestedInternalKode })
      : null;
    const finalInternalKode = !requestedInternalKode || internalKodeExists
      ? await generateNextKode(Subscriber, 'internal_kode')
      : requestedInternalKode;

    const subscriber = new Subscriber({
      kode: finalKode,
      group_id: group?._id || null,
      kode_group: group?.kode_group || normalizeOptionalString(req.body.kode_group),
      nama_group: group?.nama_group || normalizeOptionalString(req.body.nama_group),
      no_ok,
      nomor_telepon,
      kode_sales: selectedSales.kode,
      sales: selectedSales.nama,
      nama_owner: normalizeOptionalString(nama_owner) || group?.nama_owner || group?.owner || null,
      no_hp_owner: normalizeOptionalString(no_hp_owner) || group?.no_hp_owner || group?.no_hp || null,
      gender_owner: normalizeGender(gender_owner) || group?.gender_owner || null,
      nama_pic: normalizeOptionalString(nama_pic) || group?.nama_pic || null,
      no_hp_pic: normalizeOptionalString(no_hp_pic) || group?.no_hp_pic || null,
      gender_pic: normalizeGender(gender_pic) || group?.gender_pic || null,
      toko,
      grup: normalizeOptionalString(grup) || program.group_program || null,
      domain: domain || null,
      server_location: normalizeOptionalString(server_location),
      alamat: normalizeOptionalString(alamat) || group?.alamat || null,
      daerah,
      program: program.nama,
      vb_online,
      biaya: subscriberBiaya,
      tanggal: parsedTanggal,
      tgl_implementasi: parsedTanggal,
      tgl_dijalankan: normalizeOptionalDate(tgl_dijalankan),
      tgl_terbayar: normalizeOptionalDate(tgl_terbayar),
      tgl_berakhir_langganan: normalizeOptionalDate(tgl_berakhir_langganan),
      tgl_bayar_selanjutnya: normalizeOptionalDate(tgl_bayar_selanjutnya),
      kode_implementator: selectedImplementator.kode,
      implementator: selectedImplementator.nama,
      via,
      internal_kode: finalInternalKode,
      prev_subscriber: prevSubscriber,
      current_subscriber: currentSubscriber,
      prev_biaya: prevBiaya,
      current_biaya: currentBiaya,
      status_subscriber: isOutstandSubscriber ? 'OUTSTAND' : 'AKTIF',
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: userId,
      update_by: null,
      delete_by: null,
    });

    await subscriber.save();
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: subscriber });
  } catch (error) {
    console.error('❌ Error in createSubscriber:', error);
    next(error);
  }
};

export const updateSubscriber = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const {
      group_id,
      no_ok,
      nomor_telepon,
      kode_sales,
      sales,
      nama_owner,
      no_hp_owner,
      gender_owner,
      nama_pic,
      no_hp_pic,
      gender_pic,
      toko,
      grup,
      domain,
      server_location,
      alamat,
      daerah,
      program: programName,
      vb_online,
      biaya: customBiaya,
      tanggal,
      tgl_implementasi,
      tgl_dijalankan,
      tgl_terbayar,
      tgl_berakhir_langganan,
      tgl_bayar_selanjutnya,
      kode_implementator,
      implementator,
      via,
      internal_kode,
      status_subscriber
    } = req.body;

    const userId = resolveUserId(req);

    // Cari berdasarkan kode (karena kode unik), bukan _id
    const old = await Subscriber.findOne({ kode: id });
    if (!old) return res.status(404).json({ message: 'Subscriber not found' });

    // Validate required fields only if they are being updated
    if (toko !== undefined && !toko) {
      return res.status(400).json({ message: 'Toko wajib diisi' });
    }
    if (daerah !== undefined && !daerah) {
      return res.status(400).json({ message: 'Daerah wajib diisi' });
    }
    if (programName !== undefined && !programName) {
      return res.status(400).json({ message: 'Program wajib diisi' });
    }
    if ((tanggal !== undefined || tgl_implementasi !== undefined) && !(tgl_implementasi || tanggal)) {
      return res.status(400).json({ message: 'Tgl implementasi wajib diisi' });
    }
    if (via !== undefined && !via) {
      return res.status(400).json({ message: 'Via wajib diisi' });
    }
    if (internal_kode !== undefined && !internal_kode) {
      return res.status(400).json({ message: 'Internal Kode wajib diisi' });
    }

    // Get program details if program changed
    let programObj = null;
    let selectedProgramGroupProgram: string | null = null;
    let programBiaya = old.biaya;
    let prevSubscriber = old.prev_subscriber;
    let currentSubscriber = old.current_subscriber;
    let prevBiaya = old.prev_biaya;
    let currentBiaya = old.current_biaya;

    if (programName && programName !== old.program) {
      const program = await Program.findOne({ nama: programName, status_aktv: true });
      if (!program) {
        return res.status(400).json({ message: 'Program tidak ditemukan atau tidak aktif' });
      }
      programObj = program;
      selectedProgramGroupProgram = program.group_program || null;
      programBiaya = program.biaya;

      // Recalculate prev_subscriber, current_subscriber, prev_biaya, and current_biaya for new program
      const lastSubscriberForNewProgram = await Subscriber.findOne({
        program: program.nama,
        status_aktv: true,
        kode: { $ne: id } // Exclude current subscriber
      }).sort({ input_date: -1 }).limit(1);

      prevSubscriber = lastSubscriberForNewProgram ? lastSubscriberForNewProgram.current_subscriber : 0;
      currentSubscriber = prevSubscriber + 1;
      prevBiaya = lastSubscriberForNewProgram ? lastSubscriberForNewProgram.current_biaya : 0;
      currentBiaya = program.biaya;
    }

    // Use custom biaya if provided, otherwise keep existing or use program biaya
    const finalBiaya = customBiaya !== undefined ? customBiaya : programBiaya;

    const group = group_id ? await Group.findOne({ _id: group_id, status_aktv: true }) : null;
    if (group_id && !group) {
      return res.status(400).json({ message: 'Group tidak ditemukan atau tidak aktif' });
    }

    const parsedTanggal = (tanggal !== undefined || tgl_implementasi !== undefined)
      ? normalizeDateOnlyString(tgl_implementasi || tanggal)
      : null;
    if ((tanggal !== undefined || tgl_implementasi !== undefined) && !parsedTanggal) {
      return res.status(400).json({ message: 'Format tgl implementasi tidak valid' });
    }
    if ((status_subscriber === 'AKTIF' || status_subscriber === 'NON_AKTIF') && !(parsedTanggal || old.tgl_implementasi || old.tanggal)) {
      return res.status(400).json({ message: 'Tgl implementasi wajib diisi sebelum subscriber divalidasi aktif' });
    }

    old.group_id = group_id !== undefined ? (group?._id || null) : old.group_id;
    old.kode_group = group_id !== undefined ? (group?.kode_group || null) : old.kode_group;
    old.nama_group = group_id !== undefined ? (group?.nama_group || null) : old.nama_group;
    old.no_ok = no_ok ?? old.no_ok;
    old.nomor_telepon = nomor_telepon ?? old.nomor_telepon;
    if (kode_sales !== undefined) {
      const selectedSales = await resolveKaryawanSelection(kode_sales, sales);
      old.kode_sales = selectedSales.kode;
      old.sales = selectedSales.nama;
    } else {
      old.sales = sales ?? old.sales;
    }
    old.nama_owner = nama_owner !== undefined ? normalizeOptionalString(nama_owner) : (group?.nama_owner || group?.owner || old.nama_owner);
    old.no_hp_owner = no_hp_owner !== undefined ? normalizeOptionalString(no_hp_owner) : (group?.no_hp_owner || group?.no_hp || old.no_hp_owner);
    old.gender_owner = gender_owner !== undefined ? normalizeGender(gender_owner) : (group?.gender_owner || old.gender_owner);
    old.nama_pic = nama_pic !== undefined ? normalizeOptionalString(nama_pic) : (group?.nama_pic || old.nama_pic);
    old.no_hp_pic = no_hp_pic !== undefined ? normalizeOptionalString(no_hp_pic) : (group?.no_hp_pic || old.no_hp_pic);
    old.gender_pic = gender_pic !== undefined ? normalizeGender(gender_pic) : (group?.gender_pic || old.gender_pic);
    old.toko = toko ?? old.toko;
    old.grup = grup !== undefined
      ? normalizeOptionalString(grup)
      : (selectedProgramGroupProgram || old.grup);
    old.domain = domain ?? old.domain;
    old.server_location = server_location !== undefined ? normalizeOptionalString(server_location) : old.server_location;
    old.alamat = alamat !== undefined ? normalizeOptionalString(alamat) : (group?.alamat || old.alamat);
    old.daerah = daerah ?? old.daerah;
    old.program = programName ?? old.program;
    old.vb_online = vb_online ?? old.vb_online;
    old.biaya = finalBiaya;
    old.tanggal = parsedTanggal || old.tanggal;
    old.tgl_implementasi = parsedTanggal || old.tgl_implementasi || old.tanggal;
    old.tgl_dijalankan = tgl_dijalankan !== undefined ? normalizeOptionalDate(tgl_dijalankan) : old.tgl_dijalankan;
    old.tgl_terbayar = tgl_terbayar !== undefined ? normalizeOptionalDate(tgl_terbayar) : old.tgl_terbayar;
    old.tgl_berakhir_langganan = tgl_berakhir_langganan !== undefined ? normalizeOptionalDate(tgl_berakhir_langganan) : old.tgl_berakhir_langganan;
    old.tgl_bayar_selanjutnya = tgl_bayar_selanjutnya !== undefined ? normalizeOptionalDate(tgl_bayar_selanjutnya) : old.tgl_bayar_selanjutnya;
    if (kode_implementator !== undefined) {
      const selectedImplementator = await resolveKaryawanSelection(kode_implementator, implementator);
      old.kode_implementator = selectedImplementator.kode;
      old.implementator = selectedImplementator.nama;
    } else {
      old.implementator = implementator ?? old.implementator;
    }
    old.via = via ?? old.via;
    old.internal_kode = internal_kode ?? old.internal_kode;
    old.prev_subscriber = prevSubscriber;
    old.current_subscriber = currentSubscriber;
    old.prev_biaya = prevBiaya;
    old.current_biaya = currentBiaya;
    old.status_subscriber = status_subscriber === 'OUTSTAND' || status_subscriber === 'AKTIF' || status_subscriber === 'NON_AKTIF'
      ? status_subscriber
      : (old.status_subscriber || 'AKTIF');
    if (old.status_subscriber === 'AKTIF') {
      old.tgl_non_aktif = null;
      old.alasan_non_aktif = null;
    }
    old.update_date = new Date();
    old.update_by = userId;
    old.status_aktv = req.body.status_aktv ?? old.status_aktv;
    // Gunakan findOneAndUpdate untuk menghindari masalah _id
    const updated = await Subscriber.findOneAndUpdate(
      { kode: id },
      {
        group_id: old.group_id,
        kode_group: old.kode_group,
        nama_group: old.nama_group,
        no_ok: old.no_ok,
        nomor_telepon: old.nomor_telepon,
        kode_sales: old.kode_sales,
        sales: old.sales,
        nama_owner: old.nama_owner,
        no_hp_owner: old.no_hp_owner,
        gender_owner: old.gender_owner,
        nama_pic: old.nama_pic,
        no_hp_pic: old.no_hp_pic,
        gender_pic: old.gender_pic,
        toko: old.toko,
        grup: old.grup,
        domain: old.domain,
        server_location: old.server_location,
        alamat: old.alamat,
        daerah: old.daerah,
        program: old.program,
        vb_online: old.vb_online,
        biaya: old.biaya,
        tanggal: old.tanggal,
        tgl_implementasi: old.tgl_implementasi,
        tgl_dijalankan: old.tgl_dijalankan,
        tgl_terbayar: old.tgl_terbayar,
        tgl_berakhir_langganan: old.tgl_berakhir_langganan,
        tgl_bayar_selanjutnya: old.tgl_bayar_selanjutnya,
        kode_implementator: old.kode_implementator,
        implementator: old.implementator,
        via: old.via,
        internal_kode: old.internal_kode,
        prev_subscriber: old.prev_subscriber,
        current_subscriber: old.current_subscriber,
        prev_biaya: old.prev_biaya,
        current_biaya: old.current_biaya,
        status_subscriber: old.status_subscriber,
        tgl_non_aktif: old.tgl_non_aktif,
        alasan_non_aktif: old.alasan_non_aktif,
        update_date: old.update_date,
        update_by: old.update_by,
        status_aktv: old.status_aktv,
      },
      { new: true }
    );
    if (updated && updated.status_subscriber !== 'OUTSTAND') {
      await syncOpenSubscriptionDetailsFromSubscriber(updated, userId);
    }
    res.status(200).json({ success: true, message: 'Data berhasil disimpan.', data: updated });
  } catch (error) {
    console.error('❌ Error in updateSubscriber:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteSubscriber = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = resolveUserId(req);

    // Cari berdasarkan kode (karena kode unik), bukan _id
    const subscriber = await Subscriber.findOne({ kode: id });
    if (!subscriber) return res.status(404).json({ message: 'Subscriber not found' });

    const auditUser = getAuditUserId(req);
    subscriber.status_aktv = false;
    subscriber.delete_date = new Date();
    subscriber.delete_by = auditUser;
    await subscriber.save();
    res.status(200).json({ success: true, message: 'Subscriber berhasil dihapus.', data: subscriber });
  } catch (error) {
    console.error('❌ Error in deleteSubscriber:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
