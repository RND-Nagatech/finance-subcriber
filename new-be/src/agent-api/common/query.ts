import { AgentHttpError } from './agentTypes';

export interface AgentQuery {
  page: number;
  limit: number;
  search?: string;
  startDate?: string;
  endDate?: string;
  sortBy?: string;
  sortOrder: 1 | -1;
  fiscalYear?: string;
  status?: string;
}

function optionalString(value: unknown) {
  if (value === undefined || value === null || value === '') return undefined;
  if (Array.isArray(value)) throw new AgentHttpError(400, 'VALIDATION_ERROR', 'Query values must be scalar');
  return String(value).trim();
}

export function parseAgentQuery(query: Record<string, unknown>, allowedSort: string[] = []): AgentQuery {
  const page = Number(query.page ?? 1);
  const limit = Number(query.limit ?? 50);
  const sortOrder = String(query.sortOrder ?? 'desc').toLowerCase();
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AgentHttpError(400, 'VALIDATION_ERROR', 'page must be >= 1 and limit must be between 1 and 100');
  }
  if (sortOrder !== 'asc' && sortOrder !== 'desc') {
    throw new AgentHttpError(400, 'VALIDATION_ERROR', 'sortOrder must be asc or desc');
  }
  const startDate = optionalString(query.startDate);
  const endDate = optionalString(query.endDate);
  const isoDate = /^\d{4}-\d{2}-\d{2}$/;
  if ((startDate && !isoDate.test(startDate)) || (endDate && !isoDate.test(endDate))) {
    throw new AgentHttpError(400, 'VALIDATION_ERROR', 'startDate and endDate must use YYYY-MM-DD');
  }
  if (startDate && endDate && startDate > endDate) {
    throw new AgentHttpError(400, 'VALIDATION_ERROR', 'startDate must be before or equal to endDate');
  }
  const sortBy = optionalString(query.sortBy);
  if (sortBy && !allowedSort.includes(sortBy)) {
    throw new AgentHttpError(400, 'VALIDATION_ERROR', `sortBy must be one of: ${allowedSort.join(', ')}`);
  }
  const fiscalYear = optionalString(query.fiscalYear);
  if (fiscalYear && !/^\d{4}$/.test(fiscalYear)) {
    throw new AgentHttpError(400, 'VALIDATION_ERROR', 'fiscalYear must use YYYY');
  }
  return {
    page,
    limit,
    search: optionalString(query.search),
    startDate,
    endDate,
    sortBy,
    sortOrder: sortOrder === 'asc' ? 1 : -1,
    fiscalYear,
    status: optionalString(query.status),
  };
}

export function parseBoolean(value: unknown, fallback = false) {
  if (value === undefined || value === null || value === '') return fallback;
  const normalized = String(value).toLowerCase();
  if (['true', '1'].includes(normalized)) return true;
  if (['false', '0'].includes(normalized)) return false;
  throw new AgentHttpError(400, 'VALIDATION_ERROR', 'Boolean query value is invalid');
}

export function objectIdOrThrow(value: string, field = 'id') {
  if (!/^[a-f\d]{24}$/i.test(value)) throw new AgentHttpError(400, 'VALIDATION_ERROR', `${field} must be a valid ObjectId`);
  return value;
}

export function dateFilter(query: AgentQuery, field: string) {
  if (!query.startDate && !query.endDate) return {};
  return { [field]: { ...(query.startDate ? { $gte: query.startDate } : {}), ...(query.endDate ? { $lte: query.endDate } : {}) } };
}
