import { RequestHandler, Response, Router } from 'express';
import { sendAgentSuccess } from '../common/agentResponse';
import { AgentRequest } from '../common/agentTypes';
import { agentAuthMiddleware } from '../middleware/agentAuthMiddleware';
import { agentErrorMiddleware } from '../middleware/agentErrorMiddleware';
import { agentRequestContextMiddleware } from '../middleware/agentRequestContextMiddleware';
import { agentRateLimitMiddleware } from '../middleware/agentRateLimitMiddleware';
import { requireAgentScope } from '../middleware/agentAuthMiddleware';
import {
  assetDetail, assetLedger, assetLedgerHistory, assetSummary, assetTransfers, assetTypes, assets,
  financeAccounts, financeBudgets, financeCashflow, financeExpenses, financeFiscalPeriods, financeProfitAndLoss, financeRevenue, financeSummary, financeTransactions,
  travelExpenseDetail, travelExpenseFunds, travelExpenseItems, travelExpenseSummary, travelExpenses,
} from '../finance/financeAgentController';

const router = Router();
const h = (handler: unknown) => handler as RequestHandler;
router.use(h(agentRequestContextMiddleware));
router.use(h(agentAuthMiddleware));
router.use(h(requireAgentScope('finance:read')));
router.use(h(agentRateLimitMiddleware));

router.get('/capabilities', h((req: AgentRequest, res: Response) => sendAgentSuccess(req, res, {
  service: 'finance-subcriber', version: 'v1', readOnly: true,
  domains: ['finance', 'travel-expenses', 'assets'],
  excludedDomains: ['subscription', 'subscriber', 'vps', 'order-confirmation'],
  authentication: { type: 'service-jwt', requiredScope: 'finance:read' },
})));

router.get('/finance/summary', h(financeSummary));
router.get('/finance/revenue', h(financeRevenue));
router.get('/finance/expenses', h(financeExpenses));
router.get('/finance/profit-and-loss', h(financeProfitAndLoss));
router.get('/finance/cashflow', h(financeCashflow));
router.get('/finance/transactions', h(financeTransactions));
router.get('/finance/accounts', h(financeAccounts));
router.get('/finance/account-balances', h(financeAccounts));
router.get('/finance/budgets', h(financeBudgets));
router.get('/finance/fiscal-periods', h(financeFiscalPeriods));

router.get('/finance/travel-expenses', h(travelExpenses));
router.get('/finance/travel-expenses/:id', h(travelExpenseDetail));
router.get('/finance/travel-expenses/:id/summary', h(travelExpenseSummary));
router.get('/finance/travel-expenses/:id/items', h(travelExpenseItems));
router.get('/finance/travel-expenses/:id/funds', h(travelExpenseFunds));

router.get('/finance/assets', h(assets));
router.get('/finance/assets/summary', h(assetSummary));
router.get('/finance/assets/types', h(assetTypes));
router.get('/finance/assets/transfers', h(assetTransfers));
router.get('/finance/assets/ledger', h(assetLedgerHistory));
router.get('/finance/assets/:id', h(assetDetail));
router.get('/finance/assets/:id/ledger', h(assetLedger));

router.use(h(agentErrorMiddleware));
export default router;
