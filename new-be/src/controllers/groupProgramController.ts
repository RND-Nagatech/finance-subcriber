import { Request, Response } from 'express';
import GroupProgram from '../models/GroupProgram';

const resolveUserId = (req: Request) => {
  if (req.user && typeof req.user === 'object') {
    return (req.user as any).name || (req.user as any).username || (req.user as any).id || (req.user as any)._id || 'system';
  }
  if (typeof req.user === 'string' && req.user.length > 0) return req.user;
  return 'system';
};

const normalizeText = (value: unknown) => String(value ?? '').trim();

export const listGroupProgram = async (req: Request, res: Response) => {
  try {
    const showAll = req.query.all === 'true';
    const search = normalizeText(req.query.search);
    const filter: any = showAll ? {} : { status_aktv: true };

    if (search) {
      filter.group_program = { $regex: search, $options: 'i' };
    }

    const data = await GroupProgram.find(filter).sort({ group_program: 1 }).lean();
    res.json(data);
  } catch (error) {
    console.error('Error in listGroupProgram:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const listGroupProgramOptions = async (_req: Request, res: Response) => {
  try {
    const data = await GroupProgram.find({ status_aktv: true })
      .select('group_program')
      .sort({ group_program: 1 })
      .lean();

    res.json(data.map((item) => ({
      ...item,
      label: item.group_program,
      value: item.group_program,
    })));
  } catch (error) {
    console.error('Error in listGroupProgramOptions:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createGroupProgram = async (req: Request, res: Response) => {
  try {
    const group_program = normalizeText(req.body.group_program);
    if (!group_program) {
      return res.status(400).json({ message: 'Group program wajib diisi.' });
    }

    const exists = await GroupProgram.findOne({ group_program, status_aktv: true });
    if (exists) {
      return res.status(400).json({ message: 'Group program sudah digunakan.' });
    }

    const data = await GroupProgram.create({
      group_program,
      input_by: resolveUserId(req),
      update_by: null,
      delete_by: null,
    });

    res.status(201).json({ success: true, message: 'Group program berhasil disimpan.', data });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Group program sudah digunakan.' });
    }
    console.error('Error in createGroupProgram:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateGroupProgram = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await GroupProgram.findById(id);
    if (!data) return res.status(404).json({ message: 'Group program tidak ditemukan.' });

    const group_program = normalizeText(req.body.group_program);
    if (group_program && group_program !== data.group_program) {
      const exists = await GroupProgram.findOne({ _id: { $ne: id }, group_program, status_aktv: true });
      if (exists) return res.status(400).json({ message: 'Group program sudah digunakan.' });
      data.group_program = group_program;
    }

    data.status_aktv = req.body.status_aktv ?? data.status_aktv;
    data.update_date = new Date();
    data.update_by = resolveUserId(req);

    await data.save();
    res.json({ success: true, message: 'Group program berhasil disimpan.', data });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Group program sudah digunakan.' });
    }
    console.error('Error in updateGroupProgram:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteGroupProgram = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const data = await GroupProgram.findById(id);
    if (!data) return res.status(404).json({ message: 'Group program tidak ditemukan.' });

    data.status_aktv = false;
    data.delete_date = new Date();
    data.delete_by = resolveUserId(req);
    data.update_date = new Date();
    data.update_by = resolveUserId(req);

    await data.save();
    res.json({ success: true, message: 'Group program berhasil dihapus.', data });
  } catch (error) {
    console.error('Error in deleteGroupProgram:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
