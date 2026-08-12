import { Request, Response } from 'express';
import Group from '../models/Group';

const resolveUserId = (req: Request) => {
  if (req.user && typeof req.user === 'object') {
    return (req.user as any).name || (req.user as any).username || (req.user as any).id || (req.user as any)._id || 'system';
  }
  if (typeof req.user === 'string' && req.user.length > 0) return req.user;
  return 'system';
};

const normalizeText = (value: unknown) => String(value ?? '').trim();
const normalizeOptionalText = (value: unknown) => {
  const text = normalizeText(value);
  return text || null;
};
const normalizeGender = (value: unknown): 'LAKI-LAKI' | 'PEREMPUAN' | null => {
  const text = normalizeText(value).toUpperCase();
  if (text === 'LAKI-LAKI' || text === 'PEREMPUAN') return text;
  return null;
};

const generateNextKodeGroup = async () => {
  const [lastDoc] = await Group.aggregate([
    {
      $addFields: {
        kode_number: {
          $convert: {
            input: { $replaceAll: { input: '$kode_group', find: 'GRP', replacement: '' } },
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

  const nextNumber = Number(lastDoc?.kode_number || 0) + 1;
  return `GRP${nextNumber.toString().padStart(4, '0')}`;
};

export const listGroup = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const search = normalizeText(req.query.search);
    const showAll = req.query.all === 'true';

    const filter: any = showAll ? {} : { status_aktv: true };
    if (search) {
      filter.$or = [
        { kode_group: { $regex: search, $options: 'i' } },
        { nama_group: { $regex: search, $options: 'i' } },
        { owner: { $regex: search, $options: 'i' } },
        { nama_owner: { $regex: search, $options: 'i' } },
        { no_hp: { $regex: search, $options: 'i' } },
        { no_hp_owner: { $regex: search, $options: 'i' } },
        { nama_pic: { $regex: search, $options: 'i' } },
        { no_hp_pic: { $regex: search, $options: 'i' } },
        { alamat: { $regex: search, $options: 'i' } },
      ];
    }

    if (req.query.all === 'true') {
      const data = await Group.find(filter).sort({ kode_group: 1 }).lean();
      return res.json(data);
    }

    const [data, total] = await Promise.all([
      Group.find(filter)
        .sort({ kode_group: 1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean(),
      Group.countDocuments(filter),
    ]);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.max(1, Math.ceil(total / limit)),
      },
    });
  } catch (error) {
    console.error('Error in listGroup:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const listGroupOptions = async (_req: Request, res: Response) => {
  try {
    const data = await Group.find({ status_aktv: true })
      .select('kode_group nama_group owner no_hp nama_owner no_hp_owner gender_owner nama_pic no_hp_pic gender_pic alamat')
      .sort({ kode_group: 1 })
      .lean();

    res.json(data.map((item) => ({
      ...item,
      label: `${item.kode_group} - ${item.nama_group}`,
      value: String(item._id),
    })));
  } catch (error) {
    console.error('Error in listGroupOptions:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createGroup = async (req: Request, res: Response) => {
  try {
    const kode_group = normalizeText(req.body.kode_group).toUpperCase();
    const nama_group = normalizeText(req.body.nama_group);
    const nama_owner = normalizeOptionalText(req.body.nama_owner ?? req.body.owner);
    const no_hp_owner = normalizeOptionalText(req.body.no_hp_owner ?? req.body.no_hp);
    const gender_owner = normalizeGender(req.body.gender_owner);
    const nama_pic = normalizeOptionalText(req.body.nama_pic);
    const no_hp_pic = normalizeOptionalText(req.body.no_hp_pic);
    const gender_pic = normalizeGender(req.body.gender_pic);
    const alamat = normalizeOptionalText(req.body.alamat);

    if (!kode_group || !nama_group) {
      return res.status(400).json({ message: 'Kode group dan nama group wajib diisi.' });
    }

    const exists = await Group.findOne({
      kode_group,
      status_aktv: true,
    });
    if (exists) {
      return res.status(400).json({ message: 'Kode group sudah digunakan.' });
    }

    const group = await Group.create({
      kode_group,
      nama_group,
      owner: nama_owner,
      no_hp: no_hp_owner,
      nama_owner,
      no_hp_owner,
      gender_owner,
      nama_pic,
      no_hp_pic,
      gender_pic,
      alamat,
      input_by: resolveUserId(req),
      update_by: null,
      delete_by: null,
    });

    res.status(201).json({ success: true, message: 'Group berhasil disimpan.', data: group });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Kode group sudah digunakan.' });
    }
    console.error('Error in createGroup:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group tidak ditemukan.' });

    const kode_group = normalizeText(req.body.kode_group).toUpperCase();
    if (kode_group && kode_group !== group.kode_group) {
      const exists = await Group.findOne({ _id: { $ne: id }, kode_group, status_aktv: true });
      if (exists) return res.status(400).json({ message: 'Kode group sudah digunakan.' });
      group.kode_group = kode_group;
    }

    const nama_owner = normalizeOptionalText(req.body.nama_owner ?? req.body.owner);
    const no_hp_owner = normalizeOptionalText(req.body.no_hp_owner ?? req.body.no_hp);

    group.nama_group = normalizeText(req.body.nama_group) || group.nama_group;
    group.nama_owner = req.body.nama_owner !== undefined || req.body.owner !== undefined ? nama_owner : (group.nama_owner || group.owner || null);
    group.no_hp_owner = req.body.no_hp_owner !== undefined || req.body.no_hp !== undefined ? no_hp_owner : (group.no_hp_owner || group.no_hp || null);
    group.gender_owner = req.body.gender_owner !== undefined ? normalizeGender(req.body.gender_owner) : group.gender_owner;
    group.nama_pic = req.body.nama_pic !== undefined ? normalizeOptionalText(req.body.nama_pic) : group.nama_pic;
    group.no_hp_pic = req.body.no_hp_pic !== undefined ? normalizeOptionalText(req.body.no_hp_pic) : group.no_hp_pic;
    group.gender_pic = req.body.gender_pic !== undefined ? normalizeGender(req.body.gender_pic) : group.gender_pic;
    group.owner = group.nama_owner || '';
    group.no_hp = group.no_hp_owner || '';
    group.alamat = req.body.alamat !== undefined ? normalizeOptionalText(req.body.alamat) : group.alamat;
    group.status_aktv = req.body.status_aktv ?? group.status_aktv;
    group.update_date = new Date();
    group.update_by = resolveUserId(req);

    await group.save();
    res.json({ success: true, message: 'Group berhasil disimpan.', data: group });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Kode group sudah digunakan.' });
    }
    console.error('Error in updateGroup:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteGroup = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const group = await Group.findById(id);
    if (!group) return res.status(404).json({ message: 'Group tidak ditemukan.' });

    group.status_aktv = false;
    group.delete_date = new Date();
    group.delete_by = resolveUserId(req);
    group.update_date = new Date();
    group.update_by = resolveUserId(req);

    await group.save();
    res.json({ success: true, message: 'Group berhasil dihapus.', data: group });
  } catch (error) {
    console.error('Error in deleteGroup:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
