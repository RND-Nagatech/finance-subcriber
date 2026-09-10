export const agentOpenApi = {
  openapi: '3.0.3',
  info: { title: 'Subscriber Agent API', version: '1.0.0', description: 'Read-only service API for Subscriber data and subscriber metrics.' },
  servers: [{ url: '/api/agent/v1' }],
  security: [{ serviceJwt: [] }],
  components: {
    securitySchemes: { serviceJwt: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT with sub, aud, exp, and subscriber:read scope.' } },
    schemas: {
      Metadata: { type: 'object', required: ['source', 'generatedAt', 'requestId'], properties: { source: { type: 'string' }, generatedAt: { type: 'string', format: 'date-time' }, requestId: { type: 'string' }, pagination: { $ref: '#/components/schemas/Pagination' } } },
      Pagination: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer', maximum: 100 }, totalItems: { type: 'integer' }, totalPages: { type: 'integer' } } },
      Success: { type: 'object', required: ['success', 'data', 'metadata'], properties: { success: { type: 'boolean', example: true }, data: { type: 'object' }, metadata: { $ref: '#/components/schemas/Metadata' } } },
      Error: { type: 'object', required: ['success', 'error', 'metadata'], properties: { success: { type: 'boolean', example: false }, error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } }, metadata: { $ref: '#/components/schemas/Metadata' } } },
    },
  },
  paths: {
    '/capabilities': { get: { summary: 'List available Subscriber Agent tools', responses: { '200': { description: 'Capabilities' } } } },
    '/subscribers': { get: { summary: 'List subscribers', parameters: [{ name: 'search', in: 'query', schema: { type: 'string' } }, { name: 'status', in: 'query', schema: { type: 'string', enum: ['AKTIF', 'OUTSTAND', 'NON_AKTIF', 'ALL'] } }, { name: 'year', in: 'query', schema: { type: 'string', pattern: '^\\d{4}$' } }, { name: 'month', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 12 } }, { name: 'page', in: 'query', schema: { type: 'integer', minimum: 1 } }, { name: 'limit', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 100 } }], responses: { '200': { description: 'Subscriber collection' } } } },
    '/subscribers/{id}': { get: { summary: 'Get one subscriber by id or code', parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }], responses: { '200': { description: 'Subscriber detail' }, '404': { description: 'Not found' } } } },
    '/subscribers/summary': { get: { summary: 'Get current subscriber summary by status', responses: { '200': { description: 'Summary' } } } },
    '/subscribers/years': { get: { summary: 'List subscriber registration years', responses: { '200': { description: 'Years' } } } },
    '/subscribers/metrics/growth/{year}': { get: { summary: 'Get subscriber growth by fiscal month', parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'string', pattern: '^\\d{4}$' } }], responses: { '200': { description: 'Growth metric' } } } },
    '/subscribers/metrics/cumulative/{year}': { get: { summary: 'Get cumulative subscriber count by fiscal month', parameters: [{ name: 'year', in: 'path', required: true, schema: { type: 'string', pattern: '^\\d{4}$' } }], responses: { '200': { description: 'Cumulative metric' } } } },
    '/subscribers/metrics/by-program': { get: { summary: 'Get subscriber totals grouped by program', parameters: [{ name: 'fiscalYear', in: 'query', schema: { type: 'string', pattern: '^\\d{4}$' } }, { name: 'month', in: 'query', schema: { type: 'string', example: 'NOV' } }], responses: { '200': { description: 'Program metric' } } } },
  },
} as const;

export function agentDocsHtml() {
  return `<!doctype html><html><head><title>Subscriber Agent API</title><style>body{font:16px system-ui;max-width:900px;margin:40px auto;padding:0 20px}code{background:#f1f1f1;padding:2px 5px}li{margin:8px 0}</style></head><body><h1>Subscriber Agent API</h1><p>Read-only API for Subscriber data and metrics.</p><p>Download the <a href="/api/agent/openapi.json">OpenAPI document</a>.</p><ul>${Object.keys(agentOpenApi.paths).map((path) => `<li><code>GET /api/agent/v1${path}</code></li>`).join('')}</ul></body></html>`;
}
