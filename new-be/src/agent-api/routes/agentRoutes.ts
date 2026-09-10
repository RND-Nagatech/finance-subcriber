import { RequestHandler, Response, Router } from 'express';
import { sendAgentSuccess } from '../common/agentResponse';
import { AgentRequest } from '../common/agentTypes';
import { agentAuthMiddleware, requireAgentScope } from '../middleware/agentAuthMiddleware';
import { agentErrorMiddleware } from '../middleware/agentErrorMiddleware';
import { agentRequestContextMiddleware } from '../middleware/agentRequestContextMiddleware';
import { agentRateLimitMiddleware } from '../middleware/agentRateLimitMiddleware';
import { subscriberByProgramData, subscriberCumulativeData, subscriberDetail, subscriberGrowthData, subscriberSummaryData, subscriberYearList, subscribers } from '../subscriber/subscriberAgentController';

const router = Router();
const h = (handler: unknown) => handler as RequestHandler;
router.use(h(agentRequestContextMiddleware));
router.use(h(agentAuthMiddleware));
router.use(h(requireAgentScope('subscriber:read')));
router.use(h(agentRateLimitMiddleware));

router.get('/capabilities', h((req: AgentRequest, res: Response) => sendAgentSuccess(req, res, {
  service: 'subscriber', version: 'v1', readOnly: true, domains: ['subscriber'],
  excludedDomains: ['travel-expenses', 'assets', 'subscription', 'vps', 'order-confirmation'],
  authentication: { type: 'service-jwt', requiredScope: 'subscriber:read' },
})));
router.get('/subscribers', h(subscribers));
router.get('/subscribers/summary', h(subscriberSummaryData));
router.get('/subscribers/years', h(subscriberYearList));
router.get('/subscribers/metrics/growth/:year', h(subscriberGrowthData));
router.get('/subscribers/metrics/cumulative/:year', h(subscriberCumulativeData));
router.get('/subscribers/metrics/by-program', h(subscriberByProgramData));
router.get('/subscribers/:id', h(subscriberDetail));
router.use(h(agentErrorMiddleware));
export default router;
