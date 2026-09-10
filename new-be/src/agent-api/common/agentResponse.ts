import { Response } from 'express';
import { AgentRequest } from './agentTypes';

const SOURCE = 'subscriber';

function metadata(req: AgentRequest, extra: Record<string, unknown> = {}) {
  return {
    source: SOURCE,
    generatedAt: new Date().toISOString(),
    requestId: req.agentContext?.requestId || 'unknown',
    ...extra,
  };
}

export function sendAgentSuccess(
  req: AgentRequest,
  res: Response,
  data: unknown,
  status = 200,
  extraMetadata: Record<string, unknown> = {},
) {
  return res.status(status).json({ success: true, data, metadata: metadata(req, extraMetadata) });
}

export function sendAgentCollection(
  req: AgentRequest,
  res: Response,
  items: unknown[],
  page: number,
  limit: number,
  totalItems: number,
  extraMetadata: Record<string, unknown> = {},
) {
  return sendAgentSuccess(req, res, { items }, 200, {
    pagination: {
      page,
      limit,
      totalItems,
      totalPages: Math.max(1, Math.ceil(totalItems / limit)),
    },
    ...extraMetadata,
  });
}

export function sendAgentError(
  req: AgentRequest,
  res: Response,
  status: number,
  code: string,
  message: string,
  details?: unknown,
) {
  return res.status(status).json({
    success: false,
    error: { code, message, ...(details === undefined ? {} : { details }) },
    metadata: metadata(req),
  });
}
