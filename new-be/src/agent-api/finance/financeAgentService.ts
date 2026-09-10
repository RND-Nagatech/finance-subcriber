import TtFinanceDetail from '../../models/TtFinanceDetail';
import Rekening from '../../models/Rekening';
import Budget from '../../models/Budget';
import BudgetUsage from '../../models/BudgetUsage';
import { AgentHttpError } from '../common/agentTypes';
import { AgentQuery, dateFilter } from '../common/query';

const FINANCE_CATEGORIES = ['PENDAPATAN', 'BIAYA', 'PEMBELIAN'];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function baseFilter(query: AgentQuery, extra: Record<string, unknown> = {}) {
  const filter: Record<string, unknown> = {
    status_deleted: { $ne: true },
    transaction_mode: { $ne: 'SPECIAL' },
    ...dateFilter(query, 'tanggal'),
    ...(query.fiscalYear ? { tahun_fiskal: query.fiscalYear } : {}),
    ...extra,
  };
  if (query.search) {
    const rx = new RegExp(escapeRegex(query.search), 'i');
    filter.$or = [
      { kategori: rx }, { sub_kategori: rx }, { akun: rx },
      { keterangan: rx }, { kode_perusahaan: rx }, { nama_perusahaan: rx },
    ];
  }
  return filter;
}

function publicTransaction(row: any) {
  return {
    id: String(row._id),
    tanggal: row.tanggal,
    bulan: row.bulan,
    tahunFiskal: row.tahun_fiskal,
    kategori: row.kategori,
    subKategori: row.sub_kategori,
    akun: row.akun,
    nilai: Number(row.nilai || 0),
    currency: 'IDR',
    keterangan: row.keterangan || null,
    createdBy: row.created_by,
    createdAt: row.created_at,
    sourceType: row.source_type || null,
    assetId: row.asset_id ? String(row.asset_id) : null,
    assetCode: row.asset_code || null,
    assetName: row.asset_name || null,
    perjalananDinasId: row.perjalanan_dinas_id ? String(row.perjalanan_dinas_id) : null,
    transactionMode: row.transaction_mode || 'NORMAL',
    isValidated: Boolean(row.is_validated),
  };
}

export async function listFinanceTransactions(query: AgentQuery) {
  const filter = baseFilter(query);
  const sort: Record<string, 1 | -1> = { [query.sortBy || 'tanggal']: query.sortOrder, _id: query.sortOrder };
  const [totalItems, rows] = await Promise.all([
    TtFinanceDetail.countDocuments(filter),
    TtFinanceDetail.find(filter)
      .select('tanggal bulan tahun_fiskal kategori sub_kategori akun nilai keterangan created_by created_at source_type asset_id asset_code asset_name perjalanan_dinas_id transaction_mode is_validated')
      .sort(sort)
      .skip((query.page - 1) * query.limit)
      .limit(query.limit)
      .lean(),
  ]);
  return { items: rows.map(publicTransaction), totalItems };
}

async function categoryTotals(query: AgentQuery) {
  const rows = await TtFinanceDetail.aggregate([
    { $match: baseFilter(query, { kategori: { $in: FINANCE_CATEGORIES } }) },
    { $group: { _id: '$kategori', total: { $sum: '$nilai' }, count: { $sum: 1 } } },
    { $sort: { _id: 1 } },
  ]);
  const totals = Object.fromEntries(FINANCE_CATEGORIES.map((category) => [category, { amount: 0, count: 0 }]));
  for (const row of rows) totals[String(row._id)] = { amount: Number(row.total || 0), count: Number(row.count || 0) };
  return totals;
}

export async function getFinanceSummary(query: AgentQuery) {
  const totals = await categoryTotals(query);
  const revenue = totals.PENDAPATAN.amount;
  const expenses = totals.BIAYA.amount + totals.PEMBELIAN.amount;
  return {
    period: { startDate: query.startDate || null, endDate: query.endDate || null, fiscalYear: query.fiscalYear || null },
    currency: 'IDR',
    revenue: { amount: revenue, count: totals.PENDAPATAN.count },
    expenses: {
      amount: expenses,
      count: totals.BIAYA.count + totals.PEMBELIAN.count,
      byCategory: { biaya: totals.BIAYA.amount, pembelian: totals.PEMBELIAN.amount },
    },
    profitAndLoss: { revenue, expenses, net: revenue - expenses },
    byCategory: totals,
    dataAsOf: new Date().toISOString(),
  };
}

export async function getFinanceCategory(query: AgentQuery, category: 'PENDAPATAN' | 'BIAYA' | 'EXPENSES') {
  const filter = baseFilter(query, { kategori: category === 'EXPENSES' ? { $in: ['BIAYA', 'PEMBELIAN'] } : category });
  const sort: Record<string, 1 | -1> = { [query.sortBy || 'tanggal']: query.sortOrder, _id: query.sortOrder };
  const [totalItems, rows] = await Promise.all([
    TtFinanceDetail.countDocuments(filter),
    TtFinanceDetail.find(filter)
      .select('tanggal bulan tahun_fiskal kategori sub_kategori akun nilai keterangan created_by created_at source_type asset_id asset_code asset_name perjalanan_dinas_id transaction_mode is_validated')
      .sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
  ]);
  return { items: rows.map(publicTransaction), totalItems };
}

export async function getFinanceCashflow(query: AgentQuery) {
  const rows = await TtFinanceDetail.aggregate([
    { $match: baseFilter(query, { kategori: { $in: FINANCE_CATEGORIES } }) },
    { $group: { _id: '$tanggal', inflow: { $sum: { $cond: [{ $eq: ['$kategori', 'PENDAPATAN'] }, '$nilai', 0] } }, outflow: { $sum: { $cond: [{ $in: ['$kategori', ['BIAYA', 'PEMBELIAN']] }, '$nilai', 0] } } } },
    { $project: { _id: 0, date: '$_id', inflow: 1, outflow: 1, net: { $subtract: ['$inflow', '$outflow'] } } },
    { $sort: { date: query.sortOrder } },
    { $skip: (query.page - 1) * query.limit },
    { $limit: query.limit },
  ]);
  const totalRows = await TtFinanceDetail.aggregate([
    { $match: baseFilter(query, { kategori: { $in: FINANCE_CATEGORIES } }) },
    { $group: { _id: '$tanggal' } },
    { $count: 'total' },
  ]);
  return { items: rows.map((row) => ({ date: row.date, inflow: Number(row.inflow || 0), outflow: Number(row.outflow || 0), net: Number(row.net || 0), currency: 'IDR' })), totalItems: Number(totalRows[0]?.total || 0) };
}

export async function listAccounts(query: AgentQuery) {
  const filter = query.search ? { $or: [{ kode_bank: new RegExp(escapeRegex(query.search), 'i') }, { no_rekening: new RegExp(escapeRegex(query.search), 'i') }, { nama_rekening: new RegExp(escapeRegex(query.search), 'i') }] } : {};
  const [totalItems, rows] = await Promise.all([
    Rekening.countDocuments(filter),
    Rekening.find(filter).sort({ nama_rekening: query.sortOrder, _id: query.sortOrder }).skip((query.page - 1) * query.limit).limit(query.limit).select('kode_bank no_rekening nama_rekening kode_perusahaan nama_perusahaan saldo').lean(),
  ]);
  return { items: rows.map((row: any) => ({ id: String(row._id), bankCode: row.kode_bank, accountNumber: row.no_rekening, name: row.nama_rekening, companyCode: row.kode_perusahaan || null, companyName: row.nama_perusahaan || null, balance: Number(row.saldo || 0), currency: 'IDR' })), totalItems };
}

export async function listBudgets(query: AgentQuery) {
  const filter: any = { status_aktv: { $ne: false }, ...(query.fiscalYear ? { year: Number(query.fiscalYear) } : {}) };
  const [totalItems, rows] = await Promise.all([
    Budget.countDocuments(filter),
    Budget.find(filter).sort({ year: query.sortOrder, name: query.sortOrder, _id: query.sortOrder }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
  ]);
  const items = await Promise.all(rows.map(async (row: any) => {
    const usage = await BudgetUsage.aggregate([{ $match: { budget_id: row._id, status_aktv: { $ne: false }, reversed_at: null } }, { $group: { _id: null, amount: { $sum: '$amount_used' } } }]);
    return { id: String(row._id), name: row.name, year: row.year, totalAmount: Number(row.total_amount || 0), usedAmount: Number(usage[0]?.amount ?? row.used_amount ?? 0), currency: 'IDR', active: row.status_aktv !== false };
  }));
  return { items, totalItems };
}

export async function listFiscalPeriods() {
  const years = await TtFinanceDetail.distinct('tahun_fiskal', { status_deleted: { $ne: true }, transaction_mode: { $ne: 'SPECIAL' } });
  return years.filter(Boolean).sort().map((year) => ({ fiscalYear: String(year) }));
}

export function ensureAgentQuery(query: AgentQuery) {
  if (!query) throw new AgentHttpError(400, 'VALIDATION_ERROR', 'Query is required');
}
