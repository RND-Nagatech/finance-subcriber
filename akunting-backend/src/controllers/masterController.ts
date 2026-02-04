
import { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import Kategori, { IKategori } from '../models/Kategori';
import SubKategori, { ISubKategori } from '../models/SubKategori';
import Akun, { IAkun } from '../models/Akun';
import Program, { IProgram } from '../models/Program';
import Subscriber, { ISubscriber } from '../models/Subscriber';
import CustomDashboard, { ICustomDashboard } from '../models/CustomDashboard';
import Transaksi from '../models/Transaksi';


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

// Helper function to generate next kode (increment from last active record)
const generateNextKode = async (model: any): Promise<string> => {
  const lastDoc = await model.findOne({ $or: [{ status_aktv: true }, { active: true }] }).sort({ kode: -1 });
  if (!lastDoc || !lastDoc.kode) return '001';
  const lastNum = parseInt(lastDoc.kode, 10);
  if (isNaN(lastNum)) return '001';
  const nextNum = lastNum + 1;
  return nextNum.toString().padStart(3, '0');
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
    // Cari sub kategori berdasarkan nama untuk dapatkan _id
    const subKategoriAll = await SubKategori.find({});
    const list = akunList.map((a) => {
      const subKategoriObj = subKategoriAll.find(
        (sub) => sub.sub_kategori === a.sub_kategori
      );
      return {
        ...a.toObject(),
        subkategori_id: subKategoriObj ? subKategoriObj._id : '',
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
    const { sub_kategori, akun } = req.body;
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

    const a = new Akun({
      sub_kategori: subKategoriNama,
      sub_kategori_id: subKategoriId,
      sub_kategori_kode: subKategoriKode,
      kategori: kategoriNama,
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
    const { sub_kategori, akun, kode } = req.body;
    const userId = resolveUserId(req);

    // Ambil akun lama
    const oldAkun = await Akun.findById(id);
    if (!oldAkun) return res.status(404).json({ message: 'Akun not found' });

    // sub_kategori dikirim sebagai _id, ambil nama sub kategori
    let subKategoriNama = sub_kategori;
    if (mongoose.Types.ObjectId.isValid(sub_kategori)) {
      const subKategoriDoc = await SubKategori.findById(sub_kategori);
      if (!subKategoriDoc) return res.status(400).json({ message: 'SubKategori tidak ditemukan' });
      subKategoriNama = subKategoriDoc.sub_kategori;
    }

    const a = await Akun.findByIdAndUpdate(
      id,
      { sub_kategori: subKategoriNama, akun, kode, update_date: new Date(), update_by: userId, status_aktv: req.body.status_aktv ?? true },
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

    const userId = resolveUserId(req);
    const finalKode = await generateNextKode(Program);

    const p = new Program({
      nama,
      kode: finalKode,
      internal_kode,
      biaya,
      group_program,
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

    old.nama = nama ?? old.nama;
    old.biaya = biaya ?? old.biaya;
    old.group_program = group_program ?? old.group_program;
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
    const { page = 1, limit = 10, searchField, searchValue, month, year } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = Math.min(parseInt(limit as string, 10) || 10, 100); // Max 100 per page
    const skip = (pageNum - 1) * limitNum;

    let filter: any = {};
    if (!req.query.all) {
      filter.status_aktv = true;
    }

    // Add search filter
    if (searchField && searchValue && typeof searchValue === 'string') {
      const searchRegex = new RegExp(searchValue, 'i'); // Case-insensitive
      filter[searchField as string] = searchRegex;
    }

    // Build aggregation pipeline for date filtering
    let pipeline: any[] = [];

    // Add base match conditions (without date filters first)
    let baseMatchConditions: any = {};
    if (!req.query.all) {
      baseMatchConditions.status_aktv = true;
    }

    // Add search filter
    if (searchField && searchValue && typeof searchValue === 'string') {
      const searchRegex = new RegExp(searchValue, 'i'); // Case-insensitive
      baseMatchConditions[searchField as string] = searchRegex;
    }

    pipeline.push({ $match: baseMatchConditions });

    // Add date conversion and filtering
    if (month && month !== 'ALL' && year && year !== 'ALL') {
      // Both month and year specified
      const yearNum = parseInt(year as string, 10);
      const monthNum = parseInt(month as string, 10);
      pipeline.push({
        $addFields: {
          tanggalDate: { $dateFromString: { dateString: '$tanggal', onError: null } }
        }
      });
      pipeline.push({
        $match: {
          tanggalDate: { $ne: null },
          $expr: {
            $and: [
              { $eq: [{ $year: '$tanggalDate' }, yearNum] },
              { $eq: [{ $month: '$tanggalDate' }, monthNum] }
            ]
          }
        }
      });
    } else if (month && month !== 'ALL') {
      // Only month specified
      const monthNum = parseInt(month as string, 10);
      pipeline.push({
        $addFields: {
          tanggalDate: { $dateFromString: { dateString: '$tanggal', onError: null } }
        }
      });
      pipeline.push({
        $match: {
          tanggalDate: { $ne: null },
          $expr: { $eq: [{ $month: '$tanggalDate' }, monthNum] }
        }
      });
    } else if (year && year !== 'ALL') {
      // Only year specified
      const yearNum = parseInt(year as string, 10);
      pipeline.push({
        $addFields: {
          tanggalDate: { $dateFromString: { dateString: '$tanggal', onError: null } }
        }
      });
      pipeline.push({
        $match: {
          tanggalDate: { $ne: null },
          $expr: { $eq: [{ $year: '$tanggalDate' }, yearNum] }
        }
      });
    }

    pipeline.push({ $sort: { tanggal: -1 } });
    pipeline.push({ $skip: skip });
    pipeline.push({ $limit: limitNum });

    const list = await Subscriber.aggregate(pipeline);

    // Get total count for pagination using the same pipeline logic
    let countPipeline: any[] = [{ $match: baseMatchConditions }];

    if (month && month !== 'ALL' && year && year !== 'ALL') {
      const yearNum = parseInt(year as string, 10);
      const monthNum = parseInt(month as string, 10);
      countPipeline.push({
        $addFields: {
          tanggalDate: { $dateFromString: { dateString: '$tanggal', onError: null } }
        }
      });
      countPipeline.push({
        $match: {
          tanggalDate: { $ne: null },
          $expr: {
            $and: [
              { $eq: [{ $year: '$tanggalDate' }, yearNum] },
              { $eq: [{ $month: '$tanggalDate' }, monthNum] }
            ]
          }
        }
      });
    } else if (month && month !== 'ALL') {
      const monthNum = parseInt(month as string, 10);
      countPipeline.push({
        $addFields: {
          tanggalDate: { $dateFromString: { dateString: '$tanggal', onError: null } }
        }
      });
      countPipeline.push({
        $match: {
          tanggalDate: { $ne: null },
          $expr: { $eq: [{ $month: '$tanggalDate' }, monthNum] }
        }
      });
    } else if (year && year !== 'ALL') {
      const yearNum = parseInt(year as string, 10);
      countPipeline.push({
        $addFields: {
          tanggalDate: { $dateFromString: { dateString: '$tanggal', onError: null } }
        }
      });
      countPipeline.push({
        $match: {
          tanggalDate: { $ne: null },
          $expr: { $eq: [{ $year: '$tanggalDate' }, yearNum] }
        }
      });
    }

    const totalResult = await Subscriber.aggregate([
      ...countPipeline,
      { $count: "total" }
    ]);
    const total = totalResult.length > 0 ? totalResult[0].total : 0;

    // Calculate total biaya from all matching documents using the same pipeline logic
    let biayaPipeline: any[] = [{ $match: baseMatchConditions }];

    if (month && month !== 'ALL' && year && year !== 'ALL') {
      const yearNum = parseInt(year as string, 10);
      const monthNum = parseInt(month as string, 10);
      biayaPipeline.push({
        $addFields: {
          tanggalDate: { $dateFromString: { dateString: '$tanggal', onError: null } }
        }
      });
      biayaPipeline.push({
        $match: {
          tanggalDate: { $ne: null },
          $expr: {
            $and: [
              { $eq: [{ $year: '$tanggalDate' }, yearNum] },
              { $eq: [{ $month: '$tanggalDate' }, monthNum] }
            ]
          }
        }
      });
    } else if (month && month !== 'ALL') {
      const monthNum = parseInt(month as string, 10);
      biayaPipeline.push({
        $addFields: {
          tanggalDate: { $dateFromString: { dateString: '$tanggal', onError: null } }
        }
      });
      biayaPipeline.push({
        $match: {
          tanggalDate: { $ne: null },
          $expr: { $eq: [{ $month: '$tanggalDate' }, monthNum] }
        }
      });
    } else if (year && year !== 'ALL') {
      const yearNum = parseInt(year as string, 10);
      biayaPipeline.push({
        $addFields: {
          tanggalDate: { $dateFromString: { dateString: '$tanggal', onError: null } }
        }
      });
      biayaPipeline.push({
        $match: {
          tanggalDate: { $ne: null },
          $expr: { $eq: [{ $year: '$tanggalDate' }, yearNum] }
        }
      });
    }

    const totalBiayaResult = await Subscriber.aggregate([
      ...biayaPipeline,
      { $group: { _id: null, totalBiaya: { $sum: '$biaya' } } }
    ]);
    const totalBiaya = totalBiayaResult.length > 0 ? totalBiayaResult[0].totalBiaya : 0;

    res.json({
      data: list,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.ceil(total / limitNum),
        totalBiaya,
      },
    });
  } catch (error) {
    console.error('❌ Error in listSubscriber:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getSubscriberYears = async (req: Request, res: Response) => {
  try {
    // Get distinct years from subscriber tanggal field
    const yearsResult = await Subscriber.aggregate([
      {
        $match: {
          tanggal: { $exists: true, $ne: null, },
          status_aktv: true // Only active subscribers
        }
      },
      {
        $addFields: {
          tanggalDate: {
            $dateFromString: {
              dateString: '$tanggal',
              onError: null
            }
          }
        }
      },
      {
        $match: {
          tanggalDate: { $ne: null }
        }
      },
      {
        $group: {
          _id: {
            $year: '$tanggalDate'
          }
        }
      },
      {
        $sort: { '_id': -1 }
      }
    ]);

    const years = yearsResult.map(item => item._id.toString());
    res.json(years);
  } catch (error) {
    console.error('❌ Error in getSubscriberYears:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createSubscriber = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const {
      no_ok,
      sales,
      toko,
      alamat,
      daerah,
      program: programName,
      vb_online,
      biaya: customBiaya,
      tanggal,
      implementator,
      via,
      internal_kode
    } = req.body;

    // Validate and parse tanggal
    const parsedTanggal = new Date(tanggal);
    if (isNaN(parsedTanggal.getTime())) {
      return res.status(400).json({ message: 'Format tanggal tidak valid' });
    }

    // Get program details
    const program = await Program.findOne({ nama: programName, status_aktv: true });
    if (!program) {
      return res.status(400).json({ message: 'Program tidak ditemukan atau tidak aktif' });
    }

    // Use custom biaya if provided, otherwise use program biaya
    const subscriberBiaya = customBiaya !== undefined ? customBiaya : program.biaya;

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

    const subscriber = new Subscriber({
      kode: finalKode,
      no_ok,
      sales,
      toko,
      alamat,
      daerah,
      program: program.nama,
      vb_online,
      biaya: subscriberBiaya,
      tanggal: parsedTanggal,
      implementator,
      via,
      internal_kode,
      prev_subscriber: prevSubscriber,
      current_subscriber: currentSubscriber,
      prev_biaya: prevBiaya,
      current_biaya: currentBiaya,
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
      no_ok,
      sales,
      toko,
      alamat,
      daerah,
      program: programName,
      vb_online,
      biaya: customBiaya,
      tanggal,
      implementator,
      via,
      internal_kode
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
    if (tanggal !== undefined && !tanggal) {
      return res.status(400).json({ message: 'Tanggal wajib diisi' });
    }
    if (via !== undefined && !via) {
      return res.status(400).json({ message: 'Via wajib diisi' });
    }
    if (internal_kode !== undefined && !internal_kode) {
      return res.status(400).json({ message: 'Internal Kode wajib diisi' });
    }

    // Get program details if program changed
    let programObj = null;
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

    old.no_ok = no_ok ?? old.no_ok;
    old.sales = sales ?? old.sales;
    old.toko = toko ?? old.toko;
    old.alamat = alamat ?? old.alamat;
    old.daerah = daerah ?? old.daerah;
    old.program = programName ?? old.program;
    old.vb_online = vb_online ?? old.vb_online;
    old.biaya = finalBiaya;
    old.tanggal = tanggal ? new Date(tanggal) : old.tanggal;
    old.implementator = implementator ?? old.implementator;
    old.via = via ?? old.via;
    old.internal_kode = internal_kode ?? old.internal_kode;
    old.prev_subscriber = prevSubscriber;
    old.current_subscriber = currentSubscriber;
    old.prev_biaya = prevBiaya;
    old.current_biaya = currentBiaya;
    old.update_date = new Date();
    old.update_by = userId;
    old.status_aktv = req.body.status_aktv ?? old.status_aktv;
    // Gunakan findOneAndUpdate untuk menghindari masalah _id
    const updated = await Subscriber.findOneAndUpdate(
      { kode: id },
      {
        no_ok: old.no_ok,
        sales: old.sales,
        toko: old.toko,
        alamat: old.alamat,
        daerah: old.daerah,
        program: old.program,
        vb_online: old.vb_online,
        biaya: old.biaya,
        tanggal: old.tanggal,
        implementator: old.implementator,
        via: old.via,
        internal_kode: old.internal_kode,
        prev_subscriber: old.prev_subscriber,
        current_subscriber: old.current_subscriber,
        prev_biaya: old.prev_biaya,
        current_biaya: old.current_biaya,
        update_date: old.update_date,
        update_by: old.update_by,
        status_aktv: old.status_aktv,
      },
      { new: true }
    );
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
