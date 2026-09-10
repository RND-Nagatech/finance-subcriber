import { NextFunction, Response } from 'express';
import { AgentHttpError, AgentRequest } from '../common/agentTypes';

const buckets = new Map<string, { startedAt: number; count: number }>();

export function agentRateLimitMiddleware(req: AgentRequest, _res: Response, next: NextFunction) {
  const configuredLimit = Number(process.env.AGENT_API_RATE_LIMIT || 60);
  const limit = Number.isFinite(configuredLimit) && configuredLimit > 0 ? Math.floor(configuredLimit) : 60;
  const windowMs = 60_000;
  const key = req.agentContext?.identity?.sub || req.ip || 'unknown';
  const now = Date.now();
  const current = buckets.get(key);
  if (!current || now - current.startedAt >= windowMs) {
    buckets.set(key, { startedAt: now, count: 1 });
    return next();
  }
  if (current.count >= limit) return next(new AgentHttpError(429, 'RATE_LIMITED', 'Agent API rate limit exceeded'));
  current.count += 1;
  next();
}
