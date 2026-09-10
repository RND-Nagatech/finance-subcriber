import jwt, { JwtPayload } from 'jsonwebtoken';
import { NextFunction, Response } from 'express';
import { AgentHttpError, AgentRequest, AgentIdentity } from '../common/agentTypes';

function configuredAudience() {
  return String(process.env.AGENT_SERVICE_AUDIENCE || 'subscriber-api');
}

function tokenKey(): { key: string; algorithm: 'RS256' | 'HS256' } | null {
  const publicKey = String(process.env.AGENT_TOKEN_PUBLIC_KEY || '').replace(/\\n/g, '\n').trim();
  if (publicKey) return { key: publicKey, algorithm: 'RS256' };
  const secret = String(process.env.AGENT_TOKEN_SECRET || '').trim();
  if (secret) return { key: secret, algorithm: 'HS256' };
  return null;
}

function scopes(payload: JwtPayload) {
  if (Array.isArray(payload.scope)) return payload.scope.map(String);
  return String(payload.scope || '').split(' ').map((value) => value.trim()).filter(Boolean);
}

export function requireAgentScope(requiredScope: string) {
  return (req: AgentRequest, _res: Response, next: NextFunction) => {
    const identity = req.agentContext?.identity;
    if (!identity?.scope.includes(requiredScope)) {
      return next(new AgentHttpError(403, 'FORBIDDEN', `Missing required scope: ${requiredScope}`));
    }
    next();
  };
}

export function agentAuthMiddleware(req: AgentRequest, _res: Response, next: NextFunction) {
  const authorization = String(req.header('Authorization') || '');
  const match = authorization.match(/^Bearer\s+(.+)$/i);
  if (!match) return next(new AgentHttpError(401, 'UNAUTHORIZED', 'Bearer service token is required'));

  const config = tokenKey();
  if (!config) return next(new AgentHttpError(503, 'AGENT_AUTH_NOT_CONFIGURED', 'Agent service authentication is not configured'));

  try {
    const decoded = jwt.verify(match[1], config.key, {
      algorithms: [config.algorithm],
      audience: configuredAudience(),
      ...(process.env.AGENT_SERVICE_ISSUER ? { issuer: process.env.AGENT_SERVICE_ISSUER } : {}),
    });
    if (typeof decoded === 'string' || !decoded.sub) {
      return next(new AgentHttpError(401, 'UNAUTHORIZED', 'Token identity is invalid'));
    }
    const payload = decoded as JwtPayload;
    const identity: AgentIdentity = {
      sub: String(payload.sub),
      scope: scopes(payload),
      aud: payload.aud,
      iss: payload.iss,
    };
    req.agentContext = { ...(req.agentContext as any), identity };
    next();
  } catch {
    next(new AgentHttpError(401, 'UNAUTHORIZED', 'Service token is invalid or expired'));
  }
}
