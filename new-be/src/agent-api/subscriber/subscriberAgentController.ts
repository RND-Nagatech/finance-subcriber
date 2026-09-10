import { Response } from 'express';
import { AgentRequest } from '../common/agentTypes';
import { sendAgentCollection, sendAgentSuccess } from '../common/agentResponse';
import { parseAgentQuery } from '../common/query';
import { getSubscriber, listSubscribers, parseSubscriberYear, subscriberByProgram, subscriberCumulative, subscriberGrowth, subscriberSummary, subscriberYears } from './subscriberAgentService';

const run = (handler: (req: AgentRequest) => Promise<unknown>) => (req: AgentRequest, _res: Response, next: (error?: unknown) => void) => handler(req).catch(next);

export const subscribers = run(async (req) => {
  const query = parseAgentQuery(req.query as any, ['code', 'fee', 'date', 'status']);
  const result = await listSubscribers(query, req.query as any);
  return sendAgentCollection(req, req.res, result.items, query.page, query.limit, result.totalItems);
});

export const subscriberDetail = run(async (req) => {
  const query = parseAgentQuery(req.query as any);
  const year = parseSubscriberYear(req.query.fiscalYear || req.query.year);
  return sendAgentSuccess(req, req.res, await getSubscriber(req.params.id, year));
});

export const subscriberYearList = run(async (req) => sendAgentSuccess(req, req.res, { items: await subscriberYears() }));
export const subscriberSummaryData = run(async (req) => sendAgentSuccess(req, req.res, await subscriberSummary()));
export const subscriberGrowthData = run(async (req) => sendAgentSuccess(req, req.res, await subscriberGrowth(parseSubscriberYear(req.params.year))));
export const subscriberCumulativeData = run(async (req) => sendAgentSuccess(req, req.res, await subscriberCumulative(parseSubscriberYear(req.params.year))));

export const subscriberByProgramData = run(async (req) => {
  const query = parseAgentQuery(req.query as any);
  const year = parseSubscriberYear(query.fiscalYear);
  return sendAgentSuccess(req, req.res, await subscriberByProgram(year, String(req.query.month || 'NOV').toUpperCase()));
});
