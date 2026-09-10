import { Request, Response } from 'express';

export interface AgentIdentity {
  sub: string;
  scope: string[];
  aud?: string | string[];
  iss?: string;
}

export interface AgentContext {
  requestId: string;
  correlationId: string;
  identity?: AgentIdentity;
}

export type AgentRequest = Request & { agentContext?: AgentContext; res: Response };

export class AgentHttpError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'AgentHttpError';
  }
}
