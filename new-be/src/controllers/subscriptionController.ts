import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Subscriber from '../models/Subscriber';
import Subscription from '../models/Subscription';
import SubscriptionDetail from '../models/SubscriptionDetail';
import InvoiceCounter from '../models/InvoiceCounter';
import { addDays, getTempo, parseDateOnly, toPeriode } from '../utils/subscriptionPeriod';
import {
  createDokuCheckout,
  DokuApiError,
  getDokuTransactionStatus,
  normalizeDokuCustomer,
  verifyDokuCallbackToken,
  verifyDokuNotificationSignature,
} from '../services/dokuService';

const INVOICE_SENDER = {
  name: 'PT. NAGATECH SISTEM INTEGRATOR',
  address: 'JL.CILENGKRANG 1, BANDUNG, JAWA BARAT, INDONESIA',
  phone: '0811-2286-6660',
};

const resolveUserId = (req: Request) => {
  if (req.user && typeof req.user === 'object') {
    return (req.user as any).name || (req.user as any).username || (req.user as any).id || (req.user as any)._id || 'system';
  }
  if (typeof req.user === 'string' && req.user.length > 0) return req.user;
  return 'system';
};

const normalizeOptionalString = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  return text || null;
};

const formatDateOnly = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateKeyYYMMDD = (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
};

const getMonthKeyYYMM = (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
};

const generateMonthlyInvoiceNumber = async () => {
  const now = new Date();
  const dateKey = getDateKeyYYMMDD(now);
  const monthKey = getMonthKeyYYMM(now);
  const counter = await InvoiceCounter.findOneAndUpdate(
    { date_key: monthKey },
    { $inc: { last_seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const seq = String(counter?.last_seq || 1).padStart(4, '0');
  return `FJ${dateKey}-${seq}`;
};

const isDokuLinkStillActive = (expiredDate?: string) => {
  if (!expiredDate || !/^\d{14}$/.test(expiredDate)) return false;
  const year = Number(expiredDate.slice(0, 4));
  const month = Number(expiredDate.slice(4, 6));
  const day = Number(expiredDate.slice(6, 8));
  const hour = Number(expiredDate.slice(8, 10));
  const minute = Number(expiredDate.slice(10, 12));
  const second = Number(expiredDate.slice(12, 14));
  const expiresAt = Date.UTC(year, month - 1, day, hour - 7, minute, second);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

const getFiscalYear = (date: Date) => date.getUTCMonth() === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();

const getFiscalEndDate = (date: Date) => {
  const endYear = getFiscalYear(date);
  return new Date(Date.UTC(endYear, 11, 0, 12, 0, 0, 0));
};

const buildFiscalSchedule = (params: {
  startDate: Date;
  jumlahBulan: number;
  biayaPerBulan: number;
  firstDiskon?: number;
}) => {
  const entries: Array<{
    startDate: Date;
    tempo: Date;
    nextStart: Date;
    periode: string;
    tahun: number;
    jumlahBulan: number;
    jumlahBiaya: number;
    diskon: number;
    totalBiaya: number;
  }> = [];

  const fiscalEndDate = getFiscalEndDate(params.startDate);
  let cursorStart = params.startDate;
  let isFirst = true;

  while (cursorStart <= fiscalEndDate) {
    const tempo = getTempo(cursorStart, params.jumlahBulan);
    const nextStart = addDays(tempo, 1);
    const jumlahBiaya = params.biayaPerBulan * params.jumlahBulan;
    const diskon = isFirst ? Math.max(0, Math.min(jumlahBiaya, Number(params.firstDiskon || 0))) : 0;
    entries.push({
      startDate: cursorStart,
      tempo,
      nextStart,
      periode: toPeriode(cursorStart),
      tahun: getFiscalYear(cursorStart),
      jumlahBulan: params.jumlahBulan,
      jumlahBiaya,
      diskon,
      totalBiaya: Math.max(0, jumlahBiaya - diskon),
    });
    cursorStart = nextStart;
    isFirst = false;
  }

  return entries;
};

const recalcRekapTahun = async (tahun: number, userTag: string) => {
  void tahun;
  void userTag;
};

const recalcSubscriptionPeriode = async (periode: string, userTag: string) => {
  const [summary] = await SubscriptionDetail.aggregate([
    { $match: { periode, delete_date: null } },
    {
      $group: {
        _id: null,
        realisasi: {
          $sum: {
            $cond: [{ $eq: ['$status', 'DONE'] }, '$total_biaya', 0],
          },
        },
        total_subscriber_realisasi: {
          $sum: {
            $cond: [{ $eq: ['$status', 'DONE'] }, 1, 0],
          },
        },
      },
    },
  ]);

  await Subscription.updateOne(
    { periode },
    {
      $set: {
        realisasi: summary?.realisasi || 0,
        total_subscriber_realisasi: summary?.total_subscriber_realisasi || 0,
        updated_at: new Date(),
        update_date: new Date(),
        update_by: userTag,
      },
    }
  );
};

const addScheduleToMonthlyRekap = async (
  entries: ReturnType<typeof buildFiscalSchedule>,
  userTag: string
) => {
  for (const entry of entries) {
    await Subscription.updateOne(
      { periode: entry.periode },
      {
        $set: {
          periode: entry.periode,
          tahun: entry.tahun,
          updated_at: new Date(),
          update_date: new Date(),
          update_by: userTag,
        },
        $inc: {
          estimasi: entry.totalBiaya,
          total_subscriber_estimasi: 1,
        },
        $setOnInsert: {
          realisasi: 0,
          total_subscriber_realisasi: 0,
          input_date: new Date(),
          input_by: userTag,
          delete_date: null,
          delete_by: null,
        },
      },
      { upsert: true }
    );
  }
};

const applyScheduleDeltaToMonthlyRekap = async (
  entries: ReturnType<typeof buildFiscalSchedule>,
  multiplier: 1 | -1,
  userTag: string
) => {
  const affectedYears = new Set<number>();
  const affectedPeriodes = new Set<string>();

  for (const entry of entries) {
    affectedYears.add(entry.tahun);
    affectedPeriodes.add(entry.periode);
    await Subscription.updateOne(
      { periode: entry.periode },
      {
        $set: {
          periode: entry.periode,
          tahun: entry.tahun,
          updated_at: new Date(),
          update_date: new Date(),
          update_by: userTag,
        },
        $inc: {
          estimasi: entry.totalBiaya * multiplier,
          total_subscriber_estimasi: multiplier,
        },
        $setOnInsert: {
          realisasi: 0,
          total_subscriber_realisasi: 0,
          input_date: new Date(),
          input_by: userTag,
          delete_date: null,
          delete_by: null,
        },
      },
      { upsert: true }
    );
  }

  for (const periode of affectedPeriodes) {
    await recalcSubscriptionPeriode(periode, userTag);
  }
  for (const tahun of affectedYears) {
    await recalcRekapTahun(tahun, userTag);
  }
};

const createOpenDetail = async (
  seed: {
    chain_id: string;
    subscriber_id: any;
    kode_subscriber: string;
    toko: string;
    program: string;
    biaya_per_bulan: number;
    jumlah_bulan: number;
  },
  startDate: Date,
  userTag: string,
  options: { diskon?: number; keterangan?: string | null } = {}
) => {
  const jumlahBulan = seed.jumlah_bulan || 1;
  const tempo = getTempo(startDate, jumlahBulan);
  const nextStart = addDays(tempo, 1);
  const jumlahBiaya = seed.biaya_per_bulan * jumlahBulan;
  const diskon = Math.max(0, Math.min(jumlahBiaya, Number(options.diskon || 0)));

  const detail = await SubscriptionDetail.create({
    subscription_id: null,
    chain_id: seed.chain_id,
    subscriber_id: seed.subscriber_id,
    kode_subscriber: seed.kode_subscriber,
    toko: seed.toko,
    program: seed.program,
    periode: toPeriode(startDate),
    tahun: getFiscalYear(startDate),
    tgl_mulai_tagihan: formatDateOnly(startDate),
    jumlah_bulan: jumlahBulan,
    tgl_berakhir_langganan: formatDateOnly(tempo),
    tgl_bayar_selanjutnya: formatDateOnly(nextStart),
    biaya_per_bulan: seed.biaya_per_bulan,
    jumlah_biaya: jumlahBiaya,
    diskon,
    total_biaya: Math.max(0, jumlahBiaya - diskon),
    status: 'OPEN',
    keterangan: options.keterangan || null,
    input_by: userTag,
    update_by: userTag,
  });

  await recalcSubscriptionPeriode(toPeriode(startDate), userTag);
  await recalcRekapTahun(getFiscalYear(startDate), userTag);
  return detail;
};

const syncSubscriberPaymentDatesFromLatestDone = async (subscriberId: any, userTag: string) => {
  const latestDone: any = await SubscriptionDetail.findOne({
    subscriber_id: subscriberId,
    status: 'DONE',
    delete_date: null,
  }).sort({ tgl_mulai_tagihan: -1 });

  await Subscriber.findByIdAndUpdate(subscriberId, {
    tgl_terbayar: latestDone?.tgl_mulai_tagihan || null,
    tgl_berakhir_langganan: latestDone?.tgl_berakhir_langganan || null,
    tgl_bayar_selanjutnya: latestDone?.tgl_bayar_selanjutnya || null,
    update_date: new Date(),
    update_by: userTag,
  });
};

const markDetailLunas = async (params: {
  detail: any;
  paidDate: Date;
  userTag: string;
  metodeBayar?: string | null;
  diskon?: number;
  keterangan?: string | null;
}) => {
  const { detail, paidDate, userTag, metodeBayar, diskon, keterangan } = params;
  if (detail.status === 'DONE') {
    return { detail, nextDetail: null, alreadyPaid: true };
  }

  const previousYear = detail.tahun;
  detail.diskon = Math.max(0, Number(diskon ?? detail.diskon ?? 0));
  detail.total_biaya = Math.max(0, detail.jumlah_biaya - detail.diskon);
  detail.status = 'DONE';
  detail.tgl_lunas = formatDateOnly(paidDate);
  detail.metode_bayar = metodeBayar || detail.metode_bayar || null;
  detail.keterangan = keterangan || detail.keterangan;
  detail.update_date = new Date();
  detail.update_by = userTag;
  await detail.save();
  await syncSubscriberPaymentDatesFromLatestDone(detail.subscriber_id, userTag);

  let nextDetail = null;
  if (detail.tgl_bayar_selanjutnya <= getFiscalEndDate(detail.tgl_mulai_tagihan)) {
    const existingOpen = await SubscriptionDetail.findOne({
      chain_id: detail.chain_id,
      status: { $in: ['OPEN', 'PROCESS'] },
      delete_date: null,
    });
    if (!existingOpen) {
      nextDetail = await createOpenDetail(
        {
          chain_id: detail.chain_id,
          subscriber_id: detail.subscriber_id,
          kode_subscriber: detail.kode_subscriber,
          toko: detail.toko,
          program: detail.program,
          biaya_per_bulan: detail.biaya_per_bulan,
          jumlah_bulan: detail.jumlah_bulan,
        },
        detail.tgl_bayar_selanjutnya,
        userTag
      );
    }
  }

  await recalcSubscriptionPeriode(detail.periode, userTag);
  await recalcRekapTahun(previousYear, userTag);
  if (nextDetail && nextDetail.tahun !== previousYear) {
    await recalcRekapTahun(nextDetail.tahun, userTag);
  }

  return { detail, nextDetail, alreadyPaid: false };
};

const buildInvoiceMeta = async (detail: any, userTag: string) => {
  const subscriber = await Subscriber.findById(detail.subscriber_id).lean();
  const invoiceNumber = detail.invoice_meta?.invoice_number || await generateMonthlyInvoiceNumber();

  return {
    invoice_number: invoiceNumber,
    generated_at: new Date(),
    generated_by: userTag,
    sender: INVOICE_SENDER,
    customer: {
      name: detail.toko,
      address: subscriber?.alamat || '-',
      phone: subscriber?.no_hp_owner || subscriber?.nomor_telepon || '-',
    },
    items: [
      {
        program_name: detail.program,
        qty: detail.jumlah_bulan,
        unit_price: detail.biaya_per_bulan,
        line_total: detail.jumlah_biaya,
        start_date: formatDateOnly(detail.tgl_mulai_tagihan),
        tempo_date: formatDateOnly(detail.tgl_berakhir_langganan),
      },
    ],
    subtotal: detail.jumlah_biaya,
    discount_rp: detail.diskon,
    grand_total: detail.total_biaya,
    display_date: formatDateOnly(new Date()),
  };
};

const ensureInvoiceMeta = async (detail: any, userTag: string) => {
  detail.invoice_meta = await buildInvoiceMeta(detail, userTag);
  detail.status = 'PROCESS';
  detail.update_date = new Date();
  detail.update_by = userTag;
  await detail.save();
  await recalcRekapTahun(detail.tahun, userTag);
  return detail;
};

export const listSubscription = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const search = String(req.query.search || '').trim();
    const tahun = req.query.tahun ? Number(req.query.tahun) : null;
    const filter: any = { delete_date: null };
    if (tahun) filter.tahun = tahun;
    if (search) {
      filter.$or = [
        { periode: { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      Subscription.find(filter).sort({ periode: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Subscription.countDocuments(filter),
    ]);

    res.json({ data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    console.error('Error in listSubscription:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const listSubscriptionDetail = async (req: Request, res: Response) => {
  try {
    const { tahun, status, subscription_id } = req.query;
    const filter: any = { delete_date: null };
    if (tahun) filter.tahun = Number(tahun);
    if (status) filter.status = status;
    if (subscription_id) filter.subscription_id = subscription_id;
    const data = await SubscriptionDetail.find(filter).sort({ tgl_mulai_tagihan: 1 }).lean();
    res.json(data);
  } catch (error) {
    console.error('Error in listSubscriptionDetail:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const { subscriber_id, tgl_mulai_tagihan, jumlah_bulan = 1, biaya_per_bulan, diskon = 0, keterangan } = req.body;
    const startDate = parseDateOnly(tgl_mulai_tagihan);
    if (!subscriber_id || !startDate) {
      return res.status(400).json({ message: 'Subscriber dan tgl mulai tagihan wajib diisi.' });
    }

    const subscriber = await Subscriber.findById(subscriber_id);
    if (!subscriber) return res.status(404).json({ message: 'Subscriber tidak ditemukan.' });

    const active = await SubscriptionDetail.findOne({ subscriber_id, status: { $in: ['OPEN', 'PROCESS'] }, delete_date: null });
    if (active) return res.status(400).json({ message: 'Subscriber sudah memiliki subscription aktif.' });

    const userTag = resolveUserId(req);
    const months = Math.max(1, Number(jumlah_bulan || 1));
    const price = Math.max(0, Number(biaya_per_bulan ?? subscriber.biaya ?? 0));
    const chainId = new mongoose.Types.ObjectId().toString();
    const scheduleEntries = buildFiscalSchedule({
      startDate,
      jumlahBulan: months,
      biayaPerBulan: price,
      firstDiskon: Number(diskon || 0),
    });

    await addScheduleToMonthlyRekap(scheduleEntries, userTag);

    const detail = await createOpenDetail({
      chain_id: chainId,
      subscriber_id: subscriber._id,
      kode_subscriber: subscriber.kode,
      toko: subscriber.toko,
      program: subscriber.program,
      biaya_per_bulan: price,
      jumlah_bulan: months,
    }, startDate, userTag, {
      diskon: Number(diskon || 0),
      keterangan: normalizeOptionalString(keterangan),
    });
    for (const entry of scheduleEntries) {
      await recalcRekapTahun(entry.tahun, userTag);
    }
    res.status(201).json({ success: true, message: 'Subscription berhasil dibuat.', data: { rekap: scheduleEntries, detail } });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Detail subscription untuk periode tersebut sudah ada.' });
    }
    console.error('Error in createSubscription:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const lunasiSubscriptionDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tgl_lunas, metode_bayar, diskon = 0, keterangan } = req.body;
    const paidDate = parseDateOnly(tgl_lunas) || new Date();
    const userTag = resolveUserId(req);

    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });
    if (detail.status === 'DONE') return res.status(400).json({ message: 'Detail subscription sudah lunas.' });

    const result = await markDetailLunas({
      detail,
      paidDate,
      userTag,
      metodeBayar: metode_bayar || null,
      diskon,
      keterangan,
    });

    res.json({ success: true, message: 'Pembayaran subscription berhasil dilunasi.', data: { detail: result.detail, next_detail: result.nextDetail } });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Detail subscription berikutnya sudah ada.' });
    }
    console.error('Error in lunasiSubscriptionDetail:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateSubscriptionDetailStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, tanggalLunas } = req.body as { status?: 'OPEN' | 'PROCESS' | 'DONE'; tanggalLunas?: string };
    const userTag = resolveUserId(req);
    if (!['OPEN', 'PROCESS', 'DONE'].includes(String(status))) {
      return res.status(400).json({ message: 'Status tidak valid.' });
    }

    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });

    if (status === 'DONE') {
      const paidDate = parseDateOnly(tanggalLunas) || new Date();
      const result = await markDetailLunas({ detail, paidDate, userTag, metodeBayar: detail.metode_bayar || null });
      return res.json({ success: true, message: 'Status diperbarui.', data: { detail: result.detail, next_detail: result.nextDetail } });
    }

    const previousYear = detail.tahun;
    const previousPeriode = detail.periode;
    let removedNextDetail: any = null;
    if (detail.status === 'DONE' && status === 'PROCESS') {
      const nextDetail = await SubscriptionDetail.findOne({
        chain_id: detail.chain_id,
        tgl_mulai_tagihan: detail.tgl_bayar_selanjutnya,
        status: 'OPEN',
        delete_date: null,
      });
      if (nextDetail) {
        removedNextDetail = { periode: nextDetail.periode, tahun: nextDetail.tahun };
        await SubscriptionDetail.deleteOne({ _id: nextDetail._id });
      }
      detail.tgl_lunas = null;
      detail.metode_bayar = null;
    }

    detail.status = status as any;
    detail.tgl_lunas = null;
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();
    await syncSubscriberPaymentDatesFromLatestDone(detail.subscriber_id, userTag);

    await recalcSubscriptionPeriode(previousPeriode, userTag);
    await recalcRekapTahun(previousYear, userTag);
    if (removedNextDetail) {
      await recalcSubscriptionPeriode(removedNextDetail.periode, userTag);
      await recalcRekapTahun(removedNextDetail.tahun, userTag);
    }
    res.json({ success: true, message: 'Status diperbarui.', data: detail });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Detail subscription berikutnya sudah ada.' });
    }
    console.error('Error in updateSubscriptionDetailStatus:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateSubscriptionDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tgl_mulai_tagihan, jumlah_bulan, biaya_per_bulan, diskon = 0, keterangan } = req.body;
    const userTag = resolveUserId(req);

    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });
    if (detail.status !== 'OPEN') {
      return res.status(400).json({ message: 'Edit hanya tersedia untuk detail subscription status OPEN.' });
    }

    const oldStartDate = parseDateOnly(detail.tgl_mulai_tagihan);
    if (!oldStartDate) return res.status(400).json({ message: 'Tgl mulai tagihan lama tidak valid.' });
    const oldJumlahBulan = Number(detail.jumlah_bulan || 1);
    const oldBiayaPerBulan = Number(detail.biaya_per_bulan || 0);
    const oldDiskon = Number(detail.diskon || 0);
    const oldSchedule = buildFiscalSchedule({
      startDate: oldStartDate,
      jumlahBulan: oldJumlahBulan,
      biayaPerBulan: oldBiayaPerBulan,
      firstDiskon: oldDiskon,
    });

    const nextStartDate = tgl_mulai_tagihan ? parseDateOnly(tgl_mulai_tagihan) : oldStartDate;
    if (!nextStartDate) return res.status(400).json({ message: 'Tgl mulai tagihan tidak valid.' });
    const nextJumlahBulan = Math.max(1, Number(jumlah_bulan ?? detail.jumlah_bulan ?? 1));
    const nextBiayaPerBulan = Math.max(0, Number(biaya_per_bulan ?? detail.biaya_per_bulan ?? 0));
    const nextJumlahBiaya = nextBiayaPerBulan * nextJumlahBulan;
    const nextDiskon = Math.max(0, Math.min(nextJumlahBiaya, Number(diskon || 0)));
    const newSchedule = buildFiscalSchedule({
      startDate: nextStartDate,
      jumlahBulan: nextJumlahBulan,
      biayaPerBulan: nextBiayaPerBulan,
      firstDiskon: nextDiskon,
    });

    await applyScheduleDeltaToMonthlyRekap(oldSchedule, -1, userTag);

    const tempo = getTempo(nextStartDate, nextJumlahBulan);
    const nextPayDate = addDays(tempo, 1);
    detail.tgl_mulai_tagihan = formatDateOnly(nextStartDate);
    detail.periode = toPeriode(nextStartDate);
    detail.tahun = getFiscalYear(nextStartDate);
    detail.jumlah_bulan = nextJumlahBulan;
    detail.tgl_berakhir_langganan = formatDateOnly(tempo);
    detail.tgl_bayar_selanjutnya = formatDateOnly(nextPayDate);
    detail.biaya_per_bulan = nextBiayaPerBulan;
    detail.jumlah_biaya = nextJumlahBiaya;
    detail.diskon = nextDiskon;
    detail.total_biaya = Math.max(0, nextJumlahBiaya - nextDiskon);
    detail.keterangan = normalizeOptionalString(keterangan) || null;
    detail.invoice_meta = undefined;
    detail.doku_payment = undefined;
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();

    await applyScheduleDeltaToMonthlyRekap(newSchedule, 1, userTag);

    res.json({ success: true, message: 'Detail subscription berhasil diupdate.', data: detail });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Detail subscription untuk periode tersebut sudah ada.' });
    }
    console.error('Error in updateSubscriptionDetail:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteSubscriptionDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userTag = resolveUserId(req);
    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });
    if (detail.status !== 'OPEN') {
      return res.status(400).json({ message: 'Hapus hanya tersedia untuk detail subscription status OPEN.' });
    }

    const oldSchedule = buildFiscalSchedule({
      startDate: parseDateOnly(detail.tgl_mulai_tagihan) || new Date(),
      jumlahBulan: Number(detail.jumlah_bulan || 1),
      biayaPerBulan: Number(detail.biaya_per_bulan || 0),
      firstDiskon: Number(detail.diskon || 0),
    });

    detail.delete_date = new Date();
    detail.delete_by = userTag;
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();

    await applyScheduleDeltaToMonthlyRekap(oldSchedule, -1, userTag);

    res.json({ success: true, message: 'Detail subscription berhasil dihapus.' });
  } catch (error) {
    console.error('Error in deleteSubscriptionDetail:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const generateSubscriptionDokuPaymentLink = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userTag = resolveUserId(req);
    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });
    if (detail.status === 'DONE' || detail.status === 'BATAL') {
      return res.status(400).json({ message: 'Payment link hanya bisa dibuat untuk detail OPEN/PROCESS.' });
    }

    await ensureInvoiceMeta(detail, userTag);

    if (
      detail.doku_payment?.payment_url &&
      detail.doku_payment?.status !== 'SUCCESS' &&
      isDokuLinkStillActive(detail.doku_payment?.expired_date)
    ) {
      return res.json({ message: 'Payment link DOKU masih aktif.', reused: true, payment: detail.doku_payment });
    }

    const subscriber = await Subscriber.findById(detail.subscriber_id).lean();
    const customer = normalizeDokuCustomer({
      id: detail.kode_subscriber,
      name: detail.toko,
      phone: subscriber?.no_hp_owner || subscriber?.nomor_telepon || undefined,
      address: subscriber?.alamat || undefined,
      country: 'ID',
    });
    const amount = Math.round(Number(detail.invoice_meta?.grand_total ?? detail.total_biaya));
    const invoiceNumber = String(detail.invoice_meta?.invoice_number || '').trim();
    if (!invoiceNumber) return res.status(500).json({ message: 'Nomor invoice gagal dibuat.' });

    const dokuResult = await createDokuCheckout({
      amount,
      invoiceNumber,
      customer,
    });

    detail.doku_payment = {
      invoice_number: invoiceNumber,
      payment_url: dokuResult.paymentUrl,
      token_id: dokuResult.tokenId,
      expired_date: dokuResult.expiredDate,
      amount,
      request_id: dokuResult.requestId,
      generated_at: new Date(),
      generated_by: userTag,
      status: 'PENDING',
      customer: dokuResult.customer,
    };
    detail.status = 'PROCESS';
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();

    res.json({ message: 'Payment link DOKU berhasil dibuat.', reused: false, payment: detail.doku_payment });
  } catch (error: any) {
    if (error instanceof DokuApiError) {
      return res.status(error.status || 502).json({ message: error.message, request_id: error.requestId, details: error.details });
    }
    console.error('Error in generateSubscriptionDokuPaymentLink:', error);
    res.status(500).json({ message: error?.message || 'Server error', error });
  }
};

export const handleSubscriptionDokuNotification = async (req: Request, res: Response) => {
  try {
    const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body || {});
    const requestId = String(req.headers['request-id'] || '');
    const originalRequestId = String(req.body?.transaction?.original_request_id || req.body?.order?.request_id || '');
    const channelId = req.body?.channel?.id ? String(req.body.channel.id) : undefined;
    const invoiceNumber = String(req.body?.order?.invoice_number || '').trim();
    const amount = Math.round(Number(req.body?.order?.amount));
    const transactionStatus = String(req.body?.transaction?.status || '').toUpperCase();
    const paidAt = req.body?.transaction?.date ? new Date(req.body.transaction.date) : new Date();

    const signatureValid = verifyDokuNotificationSignature({
      clientId: String(req.headers['client-id'] || ''),
      requestId,
      requestTimestamp: String(req.headers['request-timestamp'] || ''),
      requestTarget: req.originalUrl.split('?')[0],
      requestBody: rawBody,
      signature: String(req.headers.signature || ''),
    });
    if (!signatureValid) return res.status(401).json({ message: 'Invalid DOKU signature' });
    if (!invoiceNumber || !Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid DOKU payload' });
    }
    if (transactionStatus !== 'SUCCESS') {
      return res.json({ message: 'DOKU notification ignored', status: transactionStatus || 'UNKNOWN' });
    }

    const detail = await SubscriptionDetail.findOne({ 'doku_payment.invoice_number': invoiceNumber });
    if (!detail) return res.status(404).json({ message: 'Invoice DOKU tidak ditemukan.' });
    if (Math.round(Number(detail.doku_payment?.amount)) !== amount) {
      return res.status(400).json({ message: 'Nominal DOKU tidak sesuai.' });
    }

    detail.doku_payment = {
      ...(detail.doku_payment as any),
      status: 'SUCCESS',
      paid_at: paidAt,
      notification_request_id: requestId,
      transaction_original_request_id: originalRequestId || detail.doku_payment?.transaction_original_request_id,
      channel_id: channelId || detail.doku_payment?.channel_id,
    };
    await detail.save();
    await markDetailLunas({ detail, paidDate: paidAt, userTag: 'doku', metodeBayar: 'DOKU' });
    return res.json({ message: 'OK' });
  } catch (error) {
    console.error('Error in handleSubscriptionDokuNotification:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};

export const handleSubscriptionDokuCallbackResult = async (req: Request, res: Response) => {
  const token = String(req.query.token || '');
  const payload = verifyDokuCallbackToken(token);
  const frontendBase = String(process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:8081').replace(/\/$/, '');
  const redirectTo = (status: string, message: string) => {
    const params = new URLSearchParams({ status, message });
    return res.redirect(`${frontendBase}/subscription?${params.toString()}`);
  };

  if (!payload) return redirectTo('failed', 'Token pembayaran tidak valid atau kedaluwarsa.');

  try {
    const detail = await SubscriptionDetail.findOne({ 'doku_payment.invoice_number': payload.invoiceNumber });
    if (!detail) return redirectTo('failed', 'Invoice pembayaran tidak ditemukan.');
    if (Math.round(Number(detail.doku_payment?.amount)) !== payload.amount) {
      return redirectTo('failed', 'Nominal pembayaran tidak sesuai.');
    }

    const dokuStatus = await getDokuTransactionStatus(payload.invoiceNumber);
    if (dokuStatus.status !== 'SUCCESS') {
      return redirectTo('pending', 'Pembayaran belum berhasil.');
    }

    const paidAt = dokuStatus.transactionDate ? new Date(dokuStatus.transactionDate) : new Date();
    detail.doku_payment = {
      ...(detail.doku_payment as any),
      status: 'SUCCESS',
      paid_at: paidAt,
      callback_verified_at: new Date(),
      transaction_original_request_id: dokuStatus.originalRequestId || detail.doku_payment?.transaction_original_request_id,
      channel_id: dokuStatus.channelId || detail.doku_payment?.channel_id,
    };
    await detail.save();
    await markDetailLunas({ detail, paidDate: paidAt, userTag: 'doku', metodeBayar: 'DOKU' });
    return redirectTo('success', 'Pembayaran subscription berhasil.');
  } catch (error: any) {
    console.error('Error in handleSubscriptionDokuCallbackResult:', error);
    return redirectTo('failed', error?.message || 'Gagal verifikasi pembayaran.');
  }
};

export const generateSubscriptionInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userTag = resolveUserId(req);
    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });
    if (detail.status === 'DONE' || detail.status === 'BATAL') {
      return res.status(400).json({ message: 'Invoice hanya bisa dibuat untuk detail OPEN/PROCESS.' });
    }

    await ensureInvoiceMeta(detail, userTag);

    res.json({ success: true, message: 'Invoice subscription berhasil dibuat.', data: detail });
  } catch (error) {
    console.error('Error in generateSubscriptionInvoice:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
