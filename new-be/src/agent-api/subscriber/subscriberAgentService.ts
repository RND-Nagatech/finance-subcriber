import Subscriber from '../../models/Subscriber';
import SubscriberTahun from '../../models/SubscriberTahun';
import Program from '../../models/Program';
import { AgentHttpError } from '../common/agentTypes';
import { AgentQuery } from '../common/query';

const FISCAL_ORDER = ['DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV'];
const MONTH_BY_NUMBER: Record<string, string> = { '12': 'DEC', '01': 'JAN', '02': 'FEB', '03': 'MAR', '04': 'APR', '05': 'MAY', '06': 'JUN', '07': 'JUL', '08': 'AUG', '09': 'SEP', '10': 'OCT', '11': 'NOV' };

function escapeRegex(value: string) { return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function scalar(query: Record<string, unknown>, key: string) {
  const value = query[key];
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) throw new AgentHttpError(400, 'VALIDATION_ERROR', `${key} must be scalar`);
  return String(value).trim();
}
export function parseSubscriberYear(value: unknown, fallback = new Date().getFullYear()) {
  const raw = value === undefined || value === null || value === '' ? String(fallback) : String(value);
  if (!/^\d{4}$/.test(raw)) throw new AgentHttpError(400, 'VALIDATION_ERROR', 'year must use YYYY');
  return Number(raw);
}
function subscriberYear(query: Record<string, unknown>) {
  const value = scalar(query, 'year');
  if (!value) return undefined;
  return parseSubscriberYear(value);
}
function subscriberMonth(query: Record<string, unknown>) {
  const value = scalar(query, 'month');
  if (!value || value === 'ALL') return undefined;
  const month = Number(value);
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new AgentHttpError(400, 'VALIDATION_ERROR', 'month must be between 1 and 12');
  return month;
}
function parseSubscriberFilters(query: Record<string, unknown>, agentQuery: AgentQuery) {
  const status = (agentQuery.status || 'AKTIF').toUpperCase();
  if (!['AKTIF', 'OUTSTAND', 'NON_AKTIF', 'ALL'].includes(status)) throw new AgentHttpError(400, 'VALIDATION_ERROR', 'status must be AKTIF, OUTSTAND, NON_AKTIF, or ALL');
  const filter: any = {};
  if (scalar(query, 'includeInactive') !== 'true' && scalar(query, 'includeInactive') !== '1') filter.status_aktv = true;
  if (status !== 'ALL') filter.status_subscriber = status;
  else filter.status_subscriber = { $in: ['AKTIF', 'OUTSTAND', 'NON_AKTIF', null] };
  const groupCode = scalar(query, 'groupCode');
  if (groupCode && groupCode !== 'ALL') filter.kode_group = groupCode;
  if (agentQuery.search) {
    const rx = new RegExp(escapeRegex(agentQuery.search), 'i');
    filter.$or = [{ kode: rx }, { toko: rx }, { program: rx }, { kode_group: rx }, { nama_group: rx }, { daerah: rx }, { domain: rx }, { nama_owner: rx }];
  }
  const filterYear = subscriberYear(query);
  return { filter, filterYear, summaryYear: filterYear || new Date().getFullYear(), month: subscriberMonth(query) };
}
function dateStages(year?: number, month?: number) {
  if (!year && !month) return [];
  const expressions: any[] = [];
  if (year) expressions.push({ $eq: [{ $year: { date: '$tanggalDate', timezone: 'Asia/Jakarta' } }, year] });
  if (month) expressions.push({ $eq: [{ $month: { date: '$tanggalDate', timezone: 'Asia/Jakarta' } }, month] });
  return [{ $addFields: { tanggalSource: { $ifNull: ['$tanggal', '$tgl_implementasi'] } } }, { $addFields: { tanggalDate: { $dateFromString: { dateString: '$tanggalSource', onError: null, onNull: null } } } }, { $match: { tanggalDate: { $type: 'date' }, $expr: { $and: expressions } } }];
}
function publicSubscriber(row: any) {
  return {
    id: String(row._id), code: row.kode, groupCode: row.kode_group || null, groupName: row.nama_group || null,
    outletName: row.toko, orderNumber: row.no_ok || null, phone: row.nomor_telepon || null, salesCode: row.kode_sales || null, salesName: row.sales || null,
    ownerName: row.nama_owner || null, ownerPhone: row.no_hp_owner || null, picName: row.nama_pic || null, picPhone: row.no_hp_pic || null,
    genderOwner: row.gender_owner || null, genderPic: row.gender_pic || null, group: row.grup || null, domain: row.domain || null, serverLocation: row.server_location || null, address: row.alamat || null,
    region: row.daerah, program: row.program, onlineMode: row.vb_online || null, fee: Number(row.biaya || 0), currency: 'IDR', registeredDate: row.tanggal || null,
    implementationDate: row.tgl_implementasi || null, runningDate: row.tgl_dijalankan || null, paidDate: row.tgl_terbayar || null, subscriptionEndDate: row.tgl_berakhir_langganan || null, nextPaymentDate: row.tgl_bayar_selanjutnya || null,
    implementerCode: row.kode_implementator || null, implementerName: row.implementator || null, deliveryMethod: row.via, status: row.status_subscriber || 'AKTIF', active: row.status_aktv !== false,
    inactiveDate: row.tgl_non_aktif || null, inactiveReason: row.alasan_non_aktif || null, inputDate: row.input_date, updatedDate: row.update_date,
    annualSummary: row.summary_tahun ? { year: row.summary_tahun.tahun, plannedBilling: Number(row.summary_tahun.total_rencana_tagihan || 0), paidBilling: Number(row.summary_tahun.tagihan_terbayar || 0), outstandingBilling: Number(row.summary_tahun.sisa_tagihan || 0), lastRebuildAt: row.summary_tahun.last_rebuild_at || null, currency: 'IDR' } : null,
  };
}
function annualSummaryStages(year: number) {
  return [{ $lookup: { from: SubscriberTahun.collection.name, let: { subscriberId: '$_id' }, pipeline: [{ $match: { $expr: { $and: [{ $eq: ['$subscriber_id', '$$subscriberId'] }, { $eq: ['$tahun', year] }, { $eq: ['$delete_date', null] }] } } }, { $limit: 1 }], as: 'summary_tahun' } }, { $unwind: { path: '$summary_tahun', preserveNullAndEmptyArrays: true } }, { $addFields: { summary_tahun: { tahun: year, total_rencana_tagihan: { $ifNull: ['$summary_tahun.total_rencana_tagihan', 0] }, tagihan_terbayar: { $ifNull: ['$summary_tahun.tagihan_terbayar', 0] }, sisa_tagihan: { $ifNull: ['$summary_tahun.sisa_tagihan', 0] }, last_rebuild_at: '$summary_tahun.last_rebuild_at' } } }];
}
export async function listSubscribers(query: AgentQuery, rawQuery: Record<string, unknown>) {
  const { filter, filterYear, summaryYear, month } = parseSubscriberFilters(rawQuery, query);
  const sortField = query.sortBy === 'fee' ? 'biaya' : query.sortBy === 'code' ? 'kode' : query.sortBy === 'status' ? 'status_subscriber' : 'tanggal';
  const pipeline: any[] = [{ $match: filter }, ...dateStages(filterYear, month), { $sort: { [sortField]: query.sortOrder, _id: query.sortOrder } }, { $skip: (query.page - 1) * query.limit }, { $limit: query.limit }, ...annualSummaryStages(summaryYear)];
  const countPipeline: any[] = [{ $match: filter }, ...dateStages(filterYear, month), { $count: 'total' }];
  const [rows, countRows] = await Promise.all([Subscriber.aggregate(pipeline), Subscriber.aggregate(countPipeline)]);
  return { items: rows.map(publicSubscriber), totalItems: Number(countRows[0]?.total || 0) };
}
export async function getSubscriber(id: string, year: number) {
  const lookup = /^[a-f\d]{24}$/i.test(id) ? { _id: id } : { kode: id };
  const rows = await Subscriber.aggregate([{ $match: { ...lookup, status_aktv: true } }, ...annualSummaryStages(year)]);
  if (!rows[0]) throw new AgentHttpError(404, 'NOT_FOUND', 'Subscriber not found');
  return publicSubscriber(rows[0]);
}
export async function subscriberYears() {
  const rows = await Subscriber.aggregate([{ $match: { tanggal: { $exists: true, $ne: null }, status_aktv: true } }, { $addFields: { tanggalDate: { $dateFromString: { dateString: '$tanggal', onError: null, onNull: null } } } }, { $match: { tanggalDate: { $type: 'date' } } }, { $group: { _id: { $year: { date: '$tanggalDate', timezone: 'Asia/Jakarta' } } } }, { $sort: { _id: -1 } }]);
  return rows.map((row: any) => String(row._id));
}
function activeMatch() { return { status_aktv: true, $or: [{ status_subscriber: 'AKTIF' }, { status_subscriber: { $exists: false } }, { status_subscriber: null }] }; }
function fiscalBounds(year: number) { return { start: new Date(Date.UTC(year - 1, 11, 1)), endExclusive: new Date(Date.UTC(year, 11, 1)) }; }
function subscriberDateStages() { return [{ $addFields: { tanggalSource: { $ifNull: ['$tanggal', '$tgl_implementasi'] } } }, { $addFields: { tanggalDate: { $dateFromString: { dateString: '$tanggalSource', onError: null, onNull: null } } } }]; }
export async function subscriberGrowth(year: number) {
  const { start, endExclusive } = fiscalBounds(year);
  const [rows, totalRows] = await Promise.all([Subscriber.aggregate([{ $match: activeMatch() }, ...subscriberDateStages(), { $match: { tanggalDate: { $type: 'date', $gte: start, $lt: endExclusive } } }, { $group: { _id: { $dateToString: { format: '%m', date: '$tanggalDate', timezone: 'Asia/Jakarta' } }, count: { $sum: 1 } } }]), Subscriber.aggregate([{ $match: activeMatch() }, ...subscriberDateStages(), { $match: { tanggalDate: { $type: 'date', $lt: endExclusive } } }, { $count: 'total' }])]);
  const counts = Object.fromEntries(rows.map((row: any) => [MONTH_BY_NUMBER[String(row._id).padStart(2, '0')], Number(row.count || 0)]));
  return { fiscalYear: String(year), totalSubscribers: Number(totalRows[0]?.total || 0), items: FISCAL_ORDER.map((month, index) => ({ month, count: counts[month] || 0, year: index === 0 ? year - 1 : year })) };
}
export async function subscriberCumulative(year: number) {
  const { start, endExclusive } = fiscalBounds(year);
  const [openingRows, rows] = await Promise.all([Subscriber.aggregate([{ $match: activeMatch() }, ...subscriberDateStages(), { $match: { tanggalDate: { $type: 'date', $lt: start } } }, { $count: 'total' }]), Subscriber.aggregate([{ $match: activeMatch() }, ...subscriberDateStages(), { $match: { tanggalDate: { $type: 'date', $gte: start, $lt: endExclusive } } }, { $group: { _id: { $dateToString: { format: '%m', date: '$tanggalDate', timezone: 'Asia/Jakarta' } }, count: { $sum: 1 } } }])]);
  const counts = Object.fromEntries(rows.map((row: any) => [MONTH_BY_NUMBER[String(row._id).padStart(2, '0')], Number(row.count || 0)]));
  let total = Number(openingRows[0]?.total || 0);
  const items = FISCAL_ORDER.map((month, index) => { total += counts[month] || 0; return { month, total, year: index === 0 ? year - 1 : year }; });
  return { fiscalYear: String(year), openingBalance: Number(openingRows[0]?.total || 0), totalSubscribers: total, items };
}
export async function subscriberByProgram(year: number, monthName: string) {
  const month = monthName === 'ANNUAL' ? 'NOV' : monthName;
  const monthIndex: Record<string, number> = { JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5, JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11 };
  if (!(month in monthIndex)) throw new AgentHttpError(400, 'VALIDATION_ERROR', 'month must be JAN-DEC or ANNUAL');
  const endYear = month === 'DEC' ? year - 1 : year;
  const endDate = new Date(Date.UTC(endYear, monthIndex[month] + 1, 0, 23, 59, 59, 999));
  const rows = await Subscriber.aggregate([{ $match: activeMatch() }, ...subscriberDateStages(), { $match: { tanggalDate: { $type: 'date', $lte: endDate } } }, { $lookup: { from: Program.collection.name, localField: 'program', foreignField: 'nama', as: 'program_info' } }, { $unwind: { path: '$program_info', preserveNullAndEmptyArrays: true } }, { $project: { program: 1, biaya: 1, group_program: { $ifNull: ['$program_info.group_program', '$program'] } } }, { $group: { _id: '$group_program', programs: { $addToSet: '$program' }, total_subscriber: { $sum: 1 }, total_biaya: { $sum: '$biaya' } } }, { $project: { _id: 0, program: '$_id', programs: 1, totalSubscribers: '$total_subscriber', totalFee: '$total_biaya', averageFeePerSubscriber: { $cond: [{ $eq: ['$total_subscriber', 0] }, 0, { $divide: ['$total_biaya', '$total_subscriber'] }] }, currency: { $literal: 'IDR' } } }, { $sort: { totalSubscribers: -1 } }]);
  return { fiscalYear: String(year), month, items: rows };
}
export async function subscriberSummary() {
  const rows = await Subscriber.aggregate([{ $match: { status_aktv: true } }, { $group: { _id: '$status_subscriber', count: { $sum: 1 }, totalFee: { $sum: '$biaya' } } }, { $sort: { _id: 1 } }]);
  const byStatus = Object.fromEntries(rows.map((row: any) => [String(row._id || 'UNKNOWN'), { count: Number(row.count || 0), totalFee: Number(row.totalFee || 0), currency: 'IDR' }]));
  return { totalSubscribers: Object.values(byStatus).reduce((sum: number, row: any) => sum + row.count, 0), byStatus, currency: 'IDR', dataAsOf: new Date().toISOString() };
}
