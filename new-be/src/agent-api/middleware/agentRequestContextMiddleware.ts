import crypto from 'crypto';
import { NextFunction, Response } from 'express';
import { AgentRequest } from '../common/agentTypes';

export function agentRequestContextMiddleware(req: AgentRequest, res: Response, next: NextFunction) {
  const safeId = (value: string | undefined, fallback: string) => value && /^[A-Za-z0-9._:-]{1,128}$/.test(value) ? value : fallback;
  const requestId = safeId(req.header('X-Request-Id'), crypto.randomUUID())!;
  const correlationId = safeId(req.header('X-Correlation-Id'), requestId)!;
  req.agentContext = { requestId, correlationId };
  res.setHeader('X-Request-Id', requestId);
  res.setHeader('X-Correlation-Id', correlationId);

  const startedAt = Date.now();
  res.on('finish', () => {
    console.log(JSON.stringify({
      event: 'agent_api_request',
      method: req.method,
      path: req.path,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      requestId,
      correlationId,
      caller: req.agentContext?.identity?.sub || 'anonymous',
    }));
  });

  next();
}
