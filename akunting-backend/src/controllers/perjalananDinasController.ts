import { Request, Response, NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import mongoose from 'mongoose';
import PerjalananDinas from '../models/PerjalananDinas';
import PerjalananDinasDetail from '../models/PerjalananDinasDetail';
import PerjalananDinasDana from '../models/PerjalananDinasDana';
import Rekening from '../models/Rekening';
import { mutateRekeningForPerjalananLedger } from '../services/rekeningMutationService';
import { postPerjalananSummaryToTtFinance } from '../services/financeAggregationService';

type ReqUser = {
  id?: string;
  _id?: string;
  username?: string;
  name?: string;
  role?: string;
};

const OFFICE_ROLES = new Set(['admin', 'finance', 'corsec', 'superuser']);
const AUDIT_ROLES = new Set(['corsec', 'superuser']);
const POST_ROLES = new Set(['finance', 'corsec', 'superuser']);

function httpError(message: string, statusCode: number) {
  const err: any = new Error(message);
  err.statusCode = statusCode;
  return err;
}

function getReqUser(req: Request): ReqUser {
  return ((req as any).user || {}) as ReqUser;
}

function getRole(req: Request): string {
  return String(getReqUser(req).role || 'user');
}

function getActorName(req: Request): string {
  const u = getReqUser(req);
  return String(u.name || u.username || u.id || u._id || 'system');
}

function getActorId(req: Request): string {
  const u = getReqUser(req);
  return String(u.id || u._id || u.username || '');
}

function isOfficeRole(req: Request): boolean {
  return OFFICE_ROLES.has(getRole(req));
}

function isAuditRole(req: Request): boolean {
  return AUDIT_ROLES.has(getRole(req));
}

function isPostingRole(req: Request): boolean {
  return POST_ROLES.has(getRole(req));
}

function ensureObjectId(id: string, field = 'id') {
  if (!mongoose.Types.ObjectId.isValid(id)) {
    throw httpError(`${field} tidak valid`, 400);
  }
}

async function getHeaderOrThrow(id: string) {
  ensureObjectId(id, 'perjalanan_id');
  const header = await PerjalananDinas.findOne({ _id: id, status_deleted: { $ne: true } });
  if (!header) throw httpError('Perjalanan tidak ditemukan', 404);
  return header;
}

async function ensureHeaderAccess(req: Request, header: any, mode: 'read' | 'user-edit' | 'office') {
  const role = getRole(req);
  if (mode === 'office') {
    if (!isOfficeRole(req)) throw httpError('Unauthorized', 403);
    return;
  }
  if (role !== 'user') return;
  const actorId = getActorId(req);
  const actorUsername = String(getReqUser(req).username || '');
  const matchesUserId = actorId && String(header.user_id) === actorId;
  const matchesUsername = actorUsername && String(header.user_username || '') === actorUsername;
  if (!(matchesUserId || matchesUsername)) throw httpError('Unauthorized', 403);
  if (mode === 'user-edit' && !['BERJALAN', 'SEDANG_DIAUDIT'].includes(String(header.status))) {
    throw httpError('Perjalanan tidak dapat diedit', 400);
  }
}

function generateKodePerjalanan() {
  const d = new Date();
  const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const rand = Math.floor(Math.random() * 9000) + 1000;
  return `PD-${stamp}-${rand}`;
}

async function computePerjalananSummary(perjalananId: string) {
  const [injectAgg, returnAgg, approvedAgg, transaksiAgg, itemStats] = await Promise.all([
    PerjalananDinasDana.aggregate([
      { $match: { perjalanan_id: new mongoose.Types.ObjectId(perjalananId), jenis: 'INJECT', voided: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$nominal' } } },
    ]),
    PerjalananDinasDana.aggregate([
      { $match: { perjalanan_id: new mongoose.Types.ObjectId(perjalananId), jenis: 'RETURN', voided: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$nominal' } } },
    ]),
    PerjalananDinasDetail.aggregate([
      { $match: { perjalanan_id: new mongoose.Types.ObjectId(perjalananId), status_deleted: { $ne: true }, audit_status: 'APPROVED' } },
      { $group: { _id: null, total: { $sum: '$nominal' } } },
    ]),
    PerjalananDinasDetail.aggregate([
      { $match: { perjalanan_id: new mongoose.Types.ObjectId(perjalananId), status_deleted: { $ne: true } } },
      { $group: { _id: null, total: { $sum: '$nominal' } } },
    ]),
    PerjalananDinasDetail.aggregate([
      { $match: { perjalanan_id: new mongoose.Types.ObjectId(perjalananId), status_deleted: { $ne: true } } },
      { $group: { _id: '$audit_status', count: { $sum: 1 } } },
    ]),
  ]);

  const total_inject = injectAgg[0]?.total || 0;
  const total_return = returnAgg[0]?.total || 0;
  const total_approved = approvedAgg[0]?.total || 0;
  const total_transaksi = transaksiAgg[0]?.total || 0;
  // Sisa dana perjalanan harus berkurang saat transaksi dibuat (bukan menunggu audit approve)
  const sisa_dana = total_inject - total_return - total_transaksi;

  const counts = itemStats.reduce<Record<string, number>>((acc, row: any) => {
    acc[String(row._id)] = row.count || 0;
    return acc;
  }, {});

  return {
    total_inject,
    total_return,
    total_approved,
    total_transaksi,
    sisa_dana,
    item_counts: {
      PENDING: counts.PENDING || 0,
      APPROVED: counts.APPROVED || 0,
      REVISI: counts.REVISI || 0,
    },
    total_items: (counts.PENDING || 0) + (counts.APPROVED || 0) + (counts.REVISI || 0),
  };
}

async function syncHeaderSummary(headerId: string) {
  const summary = await computePerjalananSummary(headerId);
  await PerjalananDinas.findByIdAndUpdate(headerId, {
    total_inject: summary.total_inject,
    total_return: summary.total_return,
    total_approved: summary.total_approved,
    sisa_dana: summary.sisa_dana,
  });
  return summary;
}

function canUserEditItem(headerStatus: string, _itemAuditStatus: string) {
  // Setelah user submit perjalanan ke audit, user tidak boleh edit lagi.
  return headerStatus === 'BERJALAN';
}

export const listPerjalananDinas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { status, user_id, from, to, q, page = '1', limit = '10' } = req.query as Record<string, string>;
    const pageNum = Math.max(1, parseInt(page || '1', 10) || 1);
    const limitNum = Math.max(1, Math.min(100, parseInt(limit || '10', 10) || 10));
    const filter: any = { status_deleted: { $ne: true } };

    if (status && status !== 'ALL') filter.status = status;
    if (user_id && user_id !== 'ALL') filter.user_id = user_id;
    if (from || to) {
      filter.tanggal_berangkat = {};
      if (from) filter.tanggal_berangkat.$gte = from;
      if (to) filter.tanggal_berangkat.$lte = to;
    }
    if (q && q.trim()) {
      const rx = new RegExp(q.trim(), 'i');
      filter.$or = [{ kode_perjalanan: rx }, { tujuan: rx }, { user_name: rx }, { catatan: rx }];
    }

    if (getRole(req) === 'user') {
      const actorId = getActorId(req);
      const actorUsername = String(getReqUser(req).username || '');
      const userScopeOr: any[] = [
        ...(actorId ? [{ user_id: actorId }] : []),
        ...(actorUsername ? [{ user_username: actorUsername }] : []),
      ];
      if (userScopeOr.length === 0) {
        return res.status(403).json({ message: 'Unauthorized' });
      }
      filter.$and = filter.$and || [];
      filter.$and.push({ $or: userScopeOr });
    }

    const total = await PerjalananDinas.countDocuments(filter);
    const rows = await PerjalananDinas.find(filter)
      .sort({ tanggal_berangkat: -1, created_at: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum)
      .lean();

    const data = await Promise.all(
      rows.map(async (row: any) => ({
        ...row,
        summary: await computePerjalananSummary(String(row._id)),
      }))
    );

    res.json({ data, page: pageNum, total, totalPages: Math.max(1, Math.ceil(total / limitNum)) });
  } catch (error) {
    next(error);
  }
};

export const createPerjalananDinas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isOfficeRole(req)) return res.status(403).json({ message: 'Unauthorized' });
    const { user_id, user_name, user_username, tujuan, tanggal_berangkat, tanggal_pulang, catatan } = req.body || {};
    if (!user_id || !user_name || !tujuan || !tanggal_berangkat || !tanggal_pulang) {
      return res.status(400).json({ message: 'user_id, user_name, tujuan, tanggal_berangkat, tanggal_pulang wajib diisi' });
    }

    let kode_perjalanan = generateKodePerjalanan();
    while (await PerjalananDinas.exists({ kode_perjalanan })) {
      kode_perjalanan = generateKodePerjalanan();
    }

    const doc = await PerjalananDinas.create({
      kode_perjalanan,
      user_id: String(user_id),
      user_name: String(user_name),
      user_username: user_username ? String(user_username) : undefined,
      tujuan: String(tujuan),
      tanggal_berangkat: String(tanggal_berangkat),
      tanggal_pulang: String(tanggal_pulang),
      catatan: catatan ? String(catatan) : '',
      status: 'BERJALAN',
      created_by: getActorName(req),
      created_at: new Date(),
    });
    res.status(201).json(doc);
  } catch (error) {
    next(error);
  }
};

export const getPerjalananDinasDetail = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = await getHeaderOrThrow(req.params.id);
    await ensureHeaderAccess(req, header, 'read');
    const summary = await syncHeaderSummary(String(header._id));
    res.json({ header: await PerjalananDinas.findById(header._id), summary });
  } catch (error) {
    next(error);
  }
};

export const updatePerjalananDinas = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isOfficeRole(req)) return res.status(403).json({ message: 'Unauthorized' });
    const header = await getHeaderOrThrow(req.params.id);
    if (String(header.status) === 'SELESAI') {
      return res.status(400).json({ message: 'Perjalanan selesai tidak dapat diedit' });
    }
    const allowed = ['tujuan', 'tanggal_berangkat', 'tanggal_pulang', 'catatan', 'user_id', 'user_name', 'user_username'] as const;
    for (const key of allowed) {
      if (req.body[key] !== undefined) (header as any)[key] = req.body[key];
    }
    header.updated_by = getActorName(req);
    header.updated_at = new Date();
    await header.save();
    res.json(header);
  } catch (error) {
    next(error);
  }
};

export const submitPerjalananAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = await getHeaderOrThrow(req.params.id);
    await ensureHeaderAccess(req, header, 'user-edit');
    if (String(header.status) !== 'BERJALAN') {
      return res.status(400).json({ message: 'Hanya perjalanan BERJALAN yang bisa disubmit ke audit' });
    }
    const itemCount = await PerjalananDinasDetail.countDocuments({ perjalanan_id: header._id, status_deleted: { $ne: true } });
    if (itemCount < 1) return res.status(400).json({ message: 'Minimal 1 transaksi item diperlukan' });
    header.status = 'SEDANG_DIAUDIT';
    header.updated_by = getActorName(req);
    header.updated_at = new Date();
    await header.save();
    res.json({ success: true, header });
  } catch (error) {
    next(error);
  }
};

export const finalizePerjalananAudit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isAuditRole(req)) return res.status(403).json({ message: 'Unauthorized' });
    const header = await getHeaderOrThrow(req.params.id);
    if (String(header.status) !== 'SEDANG_DIAUDIT') {
      return res.status(400).json({ message: 'Status perjalanan harus SEDANG_DIAUDIT' });
    }
    if (req.body?.audit_catatan_header !== undefined) {
      header.audit_catatan_header = String(req.body.audit_catatan_header || '');
    }
    const summary = await syncHeaderSummary(String(header._id));
    if (summary.total_items < 1) return res.status(400).json({ message: 'Minimal 1 item aktif diperlukan' });
    if (summary.item_counts.PENDING > 0 || summary.item_counts.REVISI > 0) {
      return res.status(400).json({ message: 'Semua item harus APPROVED sebelum finalisasi' });
    }
    header.status = 'SELESAI';
    header.audit_by = getActorName(req);
    header.audit_at = new Date();
    header.selesai_by = getActorName(req);
    header.selesai_at = new Date();
    header.updated_by = getActorName(req);
    header.updated_at = new Date();
    await header.save();
    res.json({ success: true, header, summary });
  } catch (error) {
    next(error);
  }
};

export const getPerjalananSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = await getHeaderOrThrow(req.params.id);
    await ensureHeaderAccess(req, header, 'read');
    const summary = await syncHeaderSummary(String(header._id));
    res.json(summary);
  } catch (error) {
    next(error);
  }
};

export const listPerjalananItems = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = await getHeaderOrThrow(req.params.id);
    await ensureHeaderAccess(req, header, 'read');
    const { audit_status } = req.query as Record<string, string>;
    const filter: any = { perjalanan_id: header._id, status_deleted: { $ne: true } };
    if (audit_status && audit_status !== 'ALL') filter.audit_status = audit_status;
    const items = await PerjalananDinasDetail.find(filter).sort({ tanggal_transaksi: 1, created_at: 1 });
    res.json(items);
  } catch (error) {
    next(error);
  }
};

export const createPerjalananItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = await getHeaderOrThrow(req.params.id);
    await ensureHeaderAccess(req, header, getRole(req) === 'user' ? 'user-edit' : 'read');
    if (getRole(req) !== 'user' && !isOfficeRole(req)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    if (String(header.status) !== 'BERJALAN') {
      return res.status(400).json({ message: 'Tambah item hanya saat status BERJALAN' });
    }

    const { tanggal_transaksi, nominal, keterangan } = req.body || {};
    if (!tanggal_transaksi || nominal === undefined || !keterangan) {
      return res.status(400).json({ message: 'tanggal_transaksi, nominal, keterangan wajib diisi' });
    }

    const item = await PerjalananDinasDetail.create({
      perjalanan_id: header._id,
      user_id: header.user_id,
      user_username: (header as any).user_username || '',
      user_name: header.user_name,
      tanggal_transaksi: String(tanggal_transaksi),
      nominal: Number(nominal),
      keterangan: String(keterangan),
      audit_status: 'PENDING',
      created_by: getActorName(req),
      created_at: new Date(),
      attachments: [],
    });

    await syncHeaderSummary(String(header._id));
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const updatePerjalananItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.itemId, 'itemId');
    const header = await getHeaderOrThrow(req.params.id);
    const item = await PerjalananDinasDetail.findOne({ _id: req.params.itemId, perjalanan_id: header._id, status_deleted: { $ne: true } });
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });

    if (getRole(req) === 'user') {
      await ensureHeaderAccess(req, header, 'user-edit');
      if (!canUserEditItem(String(header.status), String(item.audit_status))) {
        return res.status(400).json({ message: 'Item tidak dapat diedit pada status saat ini' });
      }
    } else if (!isOfficeRole(req)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    if (req.body.tanggal_transaksi !== undefined) item.tanggal_transaksi = String(req.body.tanggal_transaksi);
    if (req.body.nominal !== undefined) item.nominal = Number(req.body.nominal);
    if (req.body.keterangan !== undefined) item.keterangan = String(req.body.keterangan);

    // Auditor dapat melakukan adjustment item langsung saat audit tanpa meminta revisi user.
    // Jika item diubah saat audit, kembalikan ke PENDING agar perlu review/approve ulang.
    if (isAuditRole(req) && String(header.status) === 'SEDANG_DIAUDIT') {
      item.audit_status = 'PENDING';
    }

    item.updated_by = getActorName(req);
    item.updated_at = new Date();
    await item.save();
    await syncHeaderSummary(String(header._id));
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deletePerjalananItem = async (req: Request, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.itemId, 'itemId');
    const header = await getHeaderOrThrow(req.params.id);
    const item = await PerjalananDinasDetail.findOne({ _id: req.params.itemId, perjalanan_id: header._id, status_deleted: { $ne: true } });
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });

    if (getRole(req) === 'user') {
      await ensureHeaderAccess(req, header, 'user-edit');
      if (!canUserEditItem(String(header.status), String(item.audit_status))) {
        return res.status(400).json({ message: 'Item tidak dapat dihapus pada status saat ini' });
      }
    } else if (!isOfficeRole(req)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    item.status_deleted = true;
    item.deleted_by = getActorName(req);
    item.deleted_at = new Date();
    await item.save();
    await syncHeaderSummary(String(header._id));
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
};

export const uploadPerjalananItemAttachments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.itemId, 'itemId');
    const header = await getHeaderOrThrow(req.params.id);
    const item = await PerjalananDinasDetail.findOne({ _id: req.params.itemId, perjalanan_id: header._id, status_deleted: { $ne: true } });
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });
    const role = getRole(req);
    if (role === 'user') {
      await ensureHeaderAccess(req, header, 'user-edit');
      if (!canUserEditItem(String(header.status), String(item.audit_status))) {
        return res.status(400).json({ message: 'Item tidak dapat diupload bukti pada status saat ini' });
      }
    } else if (!isOfficeRole(req)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    const files = (req.files || []) as Express.Multer.File[];
    if (!files.length) return res.status(400).json({ message: 'No files uploaded' });

    const attachments = files.map((file) => ({
      path: `/uploads/perjalanan-dinas/${file.filename}`,
      original_name: file.originalname,
      mime_type: file.mimetype,
      size: file.size,
    }));
    item.attachments = [...(item.attachments || []), ...(attachments as any)];
    item.updated_by = getActorName(req);
    item.updated_at = new Date();
    await item.save();
    res.json({ success: true, attachments: item.attachments });
  } catch (error) {
    next(error);
  }
};

export const deletePerjalananItemAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    ensureObjectId(req.params.itemId, 'itemId');
    const { filename } = req.params;
    const header = await getHeaderOrThrow(req.params.id);
    const item = await PerjalananDinasDetail.findOne({ _id: req.params.itemId, perjalanan_id: header._id, status_deleted: { $ne: true } });
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });
    if (getRole(req) === 'user') {
      await ensureHeaderAccess(req, header, 'user-edit');
      if (!canUserEditItem(String(header.status), String(item.audit_status))) {
        return res.status(400).json({ message: 'Item tidak dapat diubah pada status saat ini' });
      }
    } else if (!isOfficeRole(req)) {
      return res.status(403).json({ message: 'Unauthorized' });
    }

    item.attachments = (item.attachments || []).filter((att) => !att.path.includes(filename));
    item.updated_by = getActorName(req);
    item.updated_at = new Date();
    await item.save();

    const diskPath = path.join(process.cwd(), 'uploads', 'perjalanan-dinas', filename);
    if (fs.existsSync(diskPath)) fs.unlinkSync(diskPath);
    res.json({ success: true, attachments: item.attachments });
  } catch (error) {
    next(error);
  }
};

export const updatePerjalananItemAuditStatus = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isAuditRole(req)) return res.status(403).json({ message: 'Unauthorized' });
    ensureObjectId(req.params.itemId, 'itemId');
    const header = await getHeaderOrThrow(req.params.id);
    if (String(header.status) !== 'SEDANG_DIAUDIT') {
      return res.status(400).json({ message: 'Audit item hanya saat status SEDANG_DIAUDIT' });
    }
    const item = await PerjalananDinasDetail.findOne({ _id: req.params.itemId, perjalanan_id: header._id, status_deleted: { $ne: true } });
    if (!item) return res.status(404).json({ message: 'Item tidak ditemukan' });

    const { audit_status, audit_catatan_item } = req.body || {};
    if (!['PENDING', 'APPROVED', 'REVISI'].includes(String(audit_status))) {
      return res.status(400).json({ message: 'audit_status tidak valid' });
    }
    item.audit_status = String(audit_status) as any;
    item.audit_catatan_item = audit_catatan_item ? String(audit_catatan_item) : '';
    item.audit_by = getActorName(req);
    item.audit_at = new Date();
    item.updated_by = getActorName(req);
    item.updated_at = new Date();
    await item.save();

    const summary = await syncHeaderSummary(String(header._id));
    res.json({ success: true, item, summary });
  } catch (error) {
    next(error);
  }
};

export const listPerjalananDana = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const header = await getHeaderOrThrow(req.params.id);
    await ensureHeaderAccess(req, header, 'read');
    const rows = await PerjalananDinasDana.find({ perjalanan_id: header._id, voided: { $ne: true } }).sort({ created_at: -1 });
    res.json(rows);
  } catch (error) {
    next(error);
  }
};

async function createDanaLedger(req: Request, res: Response, jenis: 'INJECT' | 'RETURN') {
  if (!isOfficeRole(req)) return res.status(403).json({ message: 'Unauthorized' });
  const header = await getHeaderOrThrow(req.params.id);
  if (jenis === 'INJECT' && String(header.status) !== 'BERJALAN') {
    return res.status(400).json({ message: 'Inject hanya bisa saat status BERJALAN' });
  }
  if (jenis === 'RETURN' && String(header.status) !== 'SELESAI') {
    return res.status(400).json({ message: 'Return hanya bisa saat status SELESAI' });
  }

  const { nominal, rekening_id, keterangan } = req.body || {};
  if (!nominal || !rekening_id) {
    return res.status(400).json({ message: 'nominal dan rekening_id wajib diisi' });
  }
  ensureObjectId(String(rekening_id), 'rekening_id');
  const rekening = await Rekening.findById(rekening_id);
  if (!rekening) return res.status(404).json({ message: 'Rekening tidak ditemukan' });

  const summaryBefore = await syncHeaderSummary(String(header._id));
  if (jenis === 'RETURN') {
    if (header.return_done) return res.status(400).json({ message: 'Return sudah pernah dilakukan' });
    const expected = Math.max(summaryBefore.sisa_dana, 0);
    if (expected <= 0) return res.status(400).json({ message: 'Tidak ada sisa dana untuk direturn' });
    if (Number(nominal) !== Number(expected)) {
      return res.status(400).json({ message: `Nominal return harus sama dengan sisa dana (${expected})` });
    }
  }

  const ledger = await PerjalananDinasDana.create({
    perjalanan_id: header._id,
    jenis,
    nominal: Number(nominal),
    rekening_id: rekening._id,
    kode_bank: rekening.kode_bank,
    no_rekening: rekening.no_rekening,
    nama_rekening_snapshot: rekening.nama_rekening,
    keterangan: keterangan ? String(keterangan) : '',
    created_by: getActorName(req),
    created_at: new Date(),
    voided: false,
  });

  try {
    await mutateRekeningForPerjalananLedger({
      rekening_id: String(rekening._id),
      nominal: Number(nominal),
      jenis,
      tanggal: new Date(),
      keterangan: `[PERJALANAN ${jenis}] ${header.kode_perjalanan} - ${header.tujuan} - ${header.user_name}`,
      refId: ledger._id as mongoose.Types.ObjectId,
    });
  } catch (err) {
    await PerjalananDinasDana.findByIdAndDelete(ledger._id);
    throw err;
  }

  if (jenis === 'RETURN') {
    header.return_done = true;
    header.return_meta = {
      ledger_dana_id: ledger._id as mongoose.Types.ObjectId,
      return_amount: Number(nominal),
      return_at: new Date(),
      return_by: getActorName(req),
    };
    header.updated_by = getActorName(req);
    header.updated_at = new Date();
    await header.save();
  }

  const summary = await syncHeaderSummary(String(header._id));
  res.status(201).json({ ledger, summary });
}

export const injectPerjalananDana = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await createDanaLedger(req, res, 'INJECT');
  } catch (error) {
    next(error);
  }
};

export const returnPerjalananDana = async (req: Request, res: Response, next: NextFunction) => {
  try {
    await createDanaLedger(req, res, 'RETURN');
  } catch (error) {
    next(error);
  }
};

export const postPerjalananToTtFinance = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!isPostingRole(req)) return res.status(403).json({ message: 'Unauthorized' });
    const header = await getHeaderOrThrow(req.params.id);
    if (String(header.status) !== 'SELESAI') {
      return res.status(400).json({ message: 'Posting hanya bisa setelah status SELESAI' });
    }
    if (header.posted_to_tt_finance) {
      return res.status(400).json({ message: 'Perjalanan sudah diposting ke tt_finance' });
    }
    const { kategori, sub_kategori, akun, tanggal_posting, bulan, tahun_fiskal } = req.body || {};
    if (!kategori || !sub_kategori || !akun || !tanggal_posting || !bulan) {
      return res.status(400).json({ message: 'kategori, sub_kategori, akun, tanggal_posting, bulan wajib diisi' });
    }

    const summary = await syncHeaderSummary(String(header._id));
    if (summary.total_approved <= 0) {
      return res.status(400).json({ message: 'Tidak ada nilai APPROVED untuk diposting' });
    }

    const keterangan = `PERJALANAN DINAS ${header.kode_perjalanan} - ${header.tujuan} - ${header.user_name}`.toUpperCase();
    const detail = await postPerjalananSummaryToTtFinance({
      tanggal: String(tanggal_posting),
      bulan: String(bulan),
      tahun_fiskal: tahun_fiskal ? String(tahun_fiskal) : undefined,
      kategori: String(kategori),
      sub_kategori: String(sub_kategori),
      akun: String(akun),
      nilai: summary.total_approved,
      created_by: getActorName(req),
      keterangan,
    });

    header.posted_to_tt_finance = true;
    header.posting_meta = {
      posted_at: new Date(),
      posted_by: getActorName(req),
      tt_finance_detail_id: detail._id as mongoose.Types.ObjectId,
      kategori: String(kategori),
      sub_kategori: String(sub_kategori),
      akun: String(akun),
      bulan: String(bulan),
      tanggal_posting: String(tanggal_posting),
      tahun_fiskal: tahun_fiskal ? String(tahun_fiskal) : (detail as any).tahun_fiskal,
      nilai_posting: summary.total_approved,
    };
    header.updated_by = getActorName(req);
    header.updated_at = new Date();
    await header.save();

    res.json({ success: true, header, tt_finance_detail: detail });
  } catch (error) {
    next(error);
  }
};
