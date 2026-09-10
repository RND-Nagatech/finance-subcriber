import { NextFunction, Response } from 'express';
import { AgentRequest } from '../common/agentTypes';
import { sendAgentCollection, sendAgentSuccess } from '../common/agentResponse';
import { parseAgentQuery, parseBoolean } from '../common/query';
import { getFinanceCashflow, getFinanceCategory, getFinanceSummary, listAccounts, listBudgets, listFinanceTransactions, listFiscalPeriods } from './financeAgentService';
import { getAsset, getAssetSummary, listAssetLedger, listAssetTransfers, listAssetTypes, listAssets } from './assetAgentService';
import { getTravelExpense, listTravelExpenses, listTravelFunds, listTravelItems } from './travelExpenseAgentService';

const run = (handler: (req: AgentRequest) => Promise<unknown>) => (req: AgentRequest, res: Response, next: NextFunction) => handler(req).then((data: any) => data).catch(next);

export const financeSummary = run(async (req) => sendAgentSuccess(req, req.res, await getFinanceSummary(parseAgentQuery(req.query as any))));

export const financeRevenue = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['tanggal', 'nilai']);
  const result = await getFinanceCategory(query, 'PENDAPATAN');
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const financeExpenses = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['tanggal', 'nilai']);
  const result = await getFinanceCategory(query, 'EXPENSES');
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const financeProfitAndLoss = run(async (req) => {
  const summary: any = await getFinanceSummary(parseAgentQuery(req.query as any));
  return sendAgentSuccess(req, req.res, { period: summary.period, currency: summary.currency, revenue: summary.revenue, expenses: summary.expenses, net: summary.profitAndLoss.net, dataAsOf: summary.dataAsOf });
});

export const financeCashflow = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['date']);
  const result = await getFinanceCashflow(query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const financeTransactions = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['tanggal', 'nilai', 'kategori', 'created_at']);
  const result = await listFinanceTransactions(query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const financeAccounts = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['nama_rekening', 'saldo']);
  const result = await listAccounts(query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const financeBudgets = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['year', 'name']);
  const result = await listBudgets(query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const financeFiscalPeriods = run(async (req) => sendAgentSuccess(req, req.res, { items: await listFiscalPeriods() }));

export const travelExpenses = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['tanggal_berangkat', 'created_at']);
  const result = await listTravelExpenses(query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const travelExpenseDetail = run(async (req) => sendAgentSuccess(req, req.res, await getTravelExpense(req.params.id)));

export const travelExpenseItems = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['tanggal_transaksi', 'created_at']);
  const result = await listTravelItems(req.params.id, query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const travelExpenseFunds = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['created_at', 'nominal']);
  const result = await listTravelFunds(req.params.id, query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const travelExpenseSummary = run(async (req) => {
  const detail = await getTravelExpense(req.params.id);
  return sendAgentSuccess(req, req.res, detail.summary);
});

export const assets = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['asset_code', 'asset_name', 'qty', 'input_date']);
  const result = await listAssets(query, parseBoolean(req.query.includeInactive));
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const assetDetail = run(async (req) => sendAgentSuccess(req, req.res, await getAsset(req.params.id)));
export const assetSummary = run(async (req) => sendAgentSuccess(req, req.res, await getAssetSummary()));

export const assetTypes = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['code', 'name']);
  const result = await listAssetTypes(query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const assetLedger = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['created_at', 'tanggal']);
  const result = await listAssetLedger(req.params.id, query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const assetLedgerHistory = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['created_at', 'tanggal']);
  const result = await listAssetLedger(undefined, query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const assetTransfers = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['tanggal', 'created_at']);
  const result = await listAssetTransfers(query);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});
