import { NextFunction, Response } from 'express';
import { AgentHttpError, AgentRequest } from '../common/agentTypes';
import { sendAgentError } from '../common/agentResponse';

export function agentErrorMiddleware(err: unknown, req: AgentRequest, res: Response, _next: NextFunction) {
  if (res.headersSent) return;
  const error = err instanceof AgentHttpError ? err : null;
  const status = error?.statusCode || 500;
  const code = error?.code || 'INTERNAL_ERROR';
  const message = error?.message || 'Internal server error';
  if (status >= 500) {
    console.error(JSON.stringify({
      event: 'agent_api_error',
      requestId: req.agentContext?.requestId,
      correlationId: req.agentContext?.correlationId,
      method: req.method,
      path: req.path,
      code,
      message,
    }));
  }
  sendAgentError(req, res, status, code, message, error?.details);
}
