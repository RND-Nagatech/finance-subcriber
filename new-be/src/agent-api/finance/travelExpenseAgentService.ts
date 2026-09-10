import mongoose from 'mongoose';
import PerjalananDinas from '../../models/PerjalananDinas';
import PerjalananDinasDetail from '../../models/PerjalananDinasDetail';
import PerjalananDinasDana from '../../models/PerjalananDinasDana';
import { AgentHttpError } from '../common/agentTypes';
import { AgentQuery, dateFilter, objectIdOrThrow } from '../common/query';

function publicDoc(row: any) {
  const { _id, __v, ...rest } = row;
  return { id: String(_id), ...rest };
}

async function summary(id: string) {
  const perjalananId = new mongoose.Types.ObjectId(objectIdOrThrow(id, 'travelExpenseId'));
  const [inject, returned, approved, spent, itemStats] = await Promise.all([
    PerjalananDinasDana.aggregate([{ $match: { perjalanan_id: perjalananId, jenis: 'INJECT', voided: { $ne: true } } }, { $group: { _id: null, amount: { $sum: '$nominal' } } }]),
    PerjalananDinasDana.aggregate([{ $match: { perjalanan_id: perjalananId, jenis: 'RETURN', voided: { $ne: true } } }, { $group: { _id: null, amount: { $sum: '$nominal' } } }]),
    PerjalananDinasDetail.aggregate([{ $match: { perjalanan_id: perjalananId, status_deleted: { $ne: true }, audit_status: 'APPROVED' } }, { $group: { _id: null, amount: { $sum: '$nominal' } } }]),
    PerjalananDinasDetail.aggregate([{ $match: { perjalanan_id: perjalananId, status_deleted: { $ne: true } } }, { $group: { _id: null, amount: { $sum: '$nominal' } } }]),
    PerjalananDinasDetail.aggregate([{ $match: { perjalanan_id: perjalananId, status_deleted: { $ne: true } } }, { $group: { _id: '$audit_status', count: { $sum: 1 } } }]),
  ]);
  const totalInject = Number(inject[0]?.amount || 0);
  const totalReturn = Number(returned[0]?.amount || 0);
  const totalSpent = Number(spent[0]?.amount || 0);
  const counts = Object.fromEntries(itemStats.map((row: any) => [String(row._id), Number(row.count || 0)]));
  return { currency: 'IDR', totalInject, totalReturn, totalApproved: Number(approved[0]?.amount || 0), totalSpent, remainingFunds: totalInject - totalReturn - totalSpent, itemCounts: { pending: counts.PENDING || 0, approved: counts.APPROVED || 0, revision: counts.REVISI || 0 }, totalItems: Object.values(counts).reduce((sum: number, value) => sum + value, 0), dataAsOf: new Date().toISOString() };
}

export async function listTravelExpenses(query: AgentQuery) {
  const filter: any = { status_deleted: { $ne: true }, ...dateFilter(query, 'tanggal_berangkat') };
  if (query.status && query.status !== 'ALL') filter.status = query.status;
  if (query.search) { const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); filter.$or = [{ kode_perjalanan: rx }, { tujuan: rx }, { user_name: rx }, { catatan: rx }]; }
  const [totalItems, rows] = await Promise.all([
    PerjalananDinas.countDocuments(filter),
    PerjalananDinas.find(filter).sort({ [query.sortBy || 'tanggal_berangkat']: query.sortOrder, _id: query.sortOrder }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
  ]);
  const items = await Promise.all(rows.map(async (row: any) => ({ ...publicDoc(row), summary: await summary(String(row._id)) })));
  return { items, totalItems };
}

export async function getTravelExpense(id: string) {
  objectIdOrThrow(id, 'travelExpenseId');
  const row = await PerjalananDinas.findOne({ _id: id, status_deleted: { $ne: true } }).lean();
  if (!row) throw new AgentHttpError(404, 'NOT_FOUND', 'Travel expense not found');
  return { travelExpense: publicDoc(row), summary: await summary(id) };
}

export async function listTravelItems(id: string, query: AgentQuery) {
  objectIdOrThrow(id, 'travelExpenseId');
  const filter: any = { perjalanan_id: id, status_deleted: { $ne: true } };
  const auditStatus = query.status ? query.status.toUpperCase() : undefined;
  if (auditStatus && ['PENDING', 'APPROVED', 'REVISI'].includes(auditStatus)) filter.audit_status = auditStatus;
  const [totalItems, rows] = await Promise.all([
    PerjalananDinasDetail.countDocuments(filter),
    PerjalananDinasDetail.find(filter).sort({ tanggal_transaksi: query.sortOrder, _id: query.sortOrder }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
  ]);
  return { items: rows.map(publicDoc).map((row: any) => ({ ...row, perjalananId: String(row.perjalanan_id), currency: 'IDR' })), totalItems };
}

export async function listTravelFunds(id: string, query: AgentQuery) {
  objectIdOrThrow(id, 'travelExpenseId');
  const filter = { perjalanan_id: id, voided: { $ne: true } };
  const [totalItems, rows] = await Promise.all([
    PerjalananDinasDana.countDocuments(filter),
    PerjalananDinasDana.find(filter).sort({ created_at: query.sortOrder, _id: query.sortOrder }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
  ]);
  return { items: rows.map(publicDoc).map((row: any) => ({ ...row, perjalananId: String(row.perjalanan_id), rekeningId: String(row.rekening_id), currency: 'IDR' })), totalItems };
}
