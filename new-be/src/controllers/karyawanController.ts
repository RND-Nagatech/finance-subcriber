import { Request, Response } from 'express';
import Karyawan from '../models/Karyawan';

const normalizeOptionalString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const str = String(value).trim();
  return str.length ? str : null;
};

const resolveUserId = (req: Request) => {
  if (req.user && typeof req.user === 'object') {
    return (req.user as any).name || (req.user as any).username || (req.user as any).id || (req.user as any)._id || 'system';
  }
  if (typeof req.user === 'string' && req.user.length > 0) return req.user;
  return 'system';
};

const generateNextKodeKaryawan = async (): Promise<string> => {
  const [lastDoc] = await Karyawan.aggregate([
    {
      $addFields: {
        kode_number: {
          $convert: {
            input: '$kode_karyawan',
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
  return String(lastNum + 1).padStart(3, '0');
};

export const listKaryawan = async (req: Request, res: Response) => {
  try {
    const { page = '1', limit = '10', search = '', all } = req.query as Record<string, string>;
    const filter: any = { status_aktv: true, delete_date: null };
    const keyword = String(search || '').trim();

    if (keyword) {
      filter.$or = [
        { kode_karyawan: { $regex: keyword, $options: 'i' } },
        { nama_karyawan: { $regex: keyword, $options: 'i' } },
        { jabatan: { $regex: keyword, $options: 'i' } },
        { divisi: { $regex: keyword, $options: 'i' } },
        { no_hp: { $regex: keyword, $options: 'i' } },
        { email: { $regex: keyword, $options: 'i' } },
      ];
    }

    if (all === 'true') {
      const data = await Karyawan.find(filter).sort({ nama_karyawan: 1 }).lean();
      return res.json(data);
    }

    const pageNum = Math.max(1, Number(page) || 1);
    const limitNum = Math.max(1, Number(limit) || 10);
    const skip = (pageNum - 1) * limitNum;
    const [data, total] = await Promise.all([
      Karyawan.find(filter).sort({ nama_karyawan: 1 }).skip(skip).limit(limitNum).lean(),
      Karyawan.countDocuments(filter),
    ]);

    return res.json({
      data,
      pagination: {
        page: pageNum,
        limit: limitNum,
        total,
        totalPages: Math.max(1, Math.ceil(total / limitNum)),
      },
    });
  } catch (error) {
    console.error('Error in listKaryawan:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};

export const listKaryawanOptions = async (req: Request, res: Response) => {
  try {
    const filter: any = { status_aktv: true, delete_date: null };

    const data = await Karyawan.find(filter)
      .sort({ nama_karyawan: 1 })
      .select('kode_karyawan nama_karyawan jabatan divisi no_hp email')
      .lean();

    return res.json(data.map((item) => ({
      ...item,
      value: item.kode_karyawan,
      label: `${item.kode_karyawan} - ${item.nama_karyawan}`,
    })));
  } catch (error) {
    console.error('Error in listKaryawanOptions:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};

export const createKaryawan = async (req: Request, res: Response) => {
  try {
    const {
      kode_karyawan,
      nama_karyawan,
      jabatan,
      divisi,
      no_hp,
      email,
    } = req.body;

    const finalNama = normalizeOptionalString(nama_karyawan);
    if (!finalNama) return res.status(400).json({ message: 'Nama karyawan wajib diisi' });

    const finalKode = normalizeOptionalString(kode_karyawan)?.toUpperCase() || await generateNextKodeKaryawan();
    const exists = await Karyawan.findOne({ kode_karyawan: finalKode, status_aktv: true, delete_date: null });
    if (exists) return res.status(400).json({ message: 'Kode karyawan sudah digunakan' });

    const deletedData = await Karyawan.findOne({
      kode_karyawan: finalKode,
      $or: [{ status_aktv: false }, { delete_date: { $ne: null } }],
    });
    if (deletedData) {
      deletedData.nama_karyawan = finalNama;
      deletedData.jabatan = normalizeOptionalString(jabatan);
      deletedData.divisi = normalizeOptionalString(divisi);
      deletedData.no_hp = normalizeOptionalString(no_hp);
      deletedData.email = normalizeOptionalString(email);
      deletedData.status_aktv = true;
      deletedData.delete_date = null;
      deletedData.delete_by = null;
      deletedData.update_date = new Date();
      deletedData.update_by = resolveUserId(req);
      await deletedData.save();

      return res.status(200).json({
        success: true,
        message: 'Karyawan lama berhasil diaktifkan kembali.',
        data: deletedData,
      });
    }

    const data = await Karyawan.create({
      kode_karyawan: finalKode,
      nama_karyawan: finalNama,
      jabatan: normalizeOptionalString(jabatan),
      divisi: normalizeOptionalString(divisi),
      no_hp: normalizeOptionalString(no_hp),
      email: normalizeOptionalString(email),
      status_aktv: true,
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: resolveUserId(req),
      update_by: null,
      delete_by: null,
    });

    return res.status(201).json({ success: true, message: 'Karyawan berhasil disimpan.', data });
  } catch (error) {
    console.error('Error in createKaryawan:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};

export const updateKaryawan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await Karyawan.findById(id);
    if (!data) return res.status(404).json({ message: 'Karyawan tidak ditemukan' });

    const finalNama = normalizeOptionalString(req.body.nama_karyawan);
    if (!finalNama) return res.status(400).json({ message: 'Nama karyawan wajib diisi' });

    data.nama_karyawan = finalNama;
    data.jabatan = normalizeOptionalString(req.body.jabatan);
    data.divisi = normalizeOptionalString(req.body.divisi);
    data.no_hp = normalizeOptionalString(req.body.no_hp);
    data.email = normalizeOptionalString(req.body.email);
    data.update_date = new Date();
    data.update_by = resolveUserId(req);
    await data.save();

    return res.json({ success: true, message: 'Karyawan berhasil disimpan.', data });
  } catch (error) {
    console.error('Error in updateKaryawan:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteKaryawan = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await Karyawan.findById(id);
    if (!data) return res.status(404).json({ message: 'Karyawan tidak ditemukan' });

    data.status_aktv = false;
    data.delete_date = new Date();
    data.delete_by = resolveUserId(req);
    await data.save();

    return res.json({ success: true, message: 'Karyawan berhasil dihapus.', data });
  } catch (error) {
    console.error('Error in deleteKaryawan:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};
