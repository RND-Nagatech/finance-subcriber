export const agentOpenApi = {
  openapi: '3.0.3',
  info: { title: 'Finance Agent API', version: '1.0.0', description: 'Read-only service API for Finance, Travel Expenses, and Assets.' },
  servers: [{ url: '/api/agent/v1' }],
  security: [{ serviceJwt: ['finance:read'] }],
  components: {
    securitySchemes: { serviceJwt: { type: 'http', scheme: 'bearer', bearerFormat: 'JWT', description: 'JWT with sub, aud, exp, and finance:read scope.' } },
    parameters: { query: { name: 'search', in: 'query', required: false, schema: { type: 'string' }, description: 'Free-text filter. Other standard filters are documented by endpoint implementation.' } },
    schemas: {
      Metadata: { type: 'object', required: ['source', 'generatedAt', 'requestId'], properties: { source: { type: 'string' }, generatedAt: { type: 'string', format: 'date-time' }, requestId: { type: 'string' }, pagination: { $ref: '#/components/schemas/Pagination' } } },
      Pagination: { type: 'object', properties: { page: { type: 'integer' }, limit: { type: 'integer', maximum: 100 }, totalItems: { type: 'integer' }, totalPages: { type: 'integer' } } },
      Success: { type: 'object', required: ['success', 'data', 'metadata'], properties: { success: { type: 'boolean', example: true }, data: { type: 'object' }, metadata: { $ref: '#/components/schemas/Metadata' } } },
      Error: { type: 'object', required: ['success', 'error', 'metadata'], properties: { success: { type: 'boolean', example: false }, error: { type: 'object', properties: { code: { type: 'string' }, message: { type: 'string' }, details: {} } }, metadata: { $ref: '#/components/schemas/Metadata' } } },
    },
  },
  paths: {
    '/capabilities': { get: { summary: 'List available Agent tools', responses: { '200': { description: 'Capabilities' } } } },
    '/finance/summary': { get: { summary: 'Finance summary', parameters: [{ $ref: '#/components/parameters/query' }], responses: { '200': { description: 'Summary' } } } },
    '/finance/revenue': { get: { summary: 'Revenue transactions', responses: { '200': { description: 'Collection' } } } },
    '/finance/expenses': { get: { summary: 'Expense transactions', responses: { '200': { description: 'Collection' } } } },
    '/finance/profit-and-loss': { get: { summary: 'Profit and loss', responses: { '200': { description: 'Profit and loss' } } } },
    '/finance/cashflow': { get: { summary: 'Daily cashflow', responses: { '200': { description: 'Collection' } } } },
    '/finance/transactions': { get: { summary: 'Finance transactions', responses: { '200': { description: 'Collection' } } } },
    '/finance/accounts': { get: { summary: 'Bank accounts and balances', responses: { '200': { description: 'Collection' } } } },
    '/finance/account-balances': { get: { summary: 'Bank account balances', responses: { '200': { description: 'Collection' } } } },
    '/finance/budgets': { get: { summary: 'Budgets', responses: { '200': { description: 'Collection' } } } },
    '/finance/fiscal-periods': { get: { summary: 'Available fiscal periods', responses: { '200': { description: 'Collection' } } } },
    '/finance/travel-expenses': { get: { summary: 'Travel expense headers', responses: { '200': { description: 'Collection' } } } },
    '/finance/travel-expenses/{id}': { get: { summary: 'Travel expense detail', responses: { '200': { description: 'Detail' }, '404': { description: 'Not found' } } } },
    '/finance/travel-expenses/{id}/summary': { get: { summary: 'Travel expense summary', responses: { '200': { description: 'Summary' } } } },
    '/finance/travel-expenses/{id}/items': { get: { summary: 'Travel expense items', responses: { '200': { description: 'Collection' } } } },
    '/finance/travel-expenses/{id}/funds': { get: { summary: 'Travel expense funds', responses: { '200': { description: 'Collection' } } } },
    '/finance/assets': { get: { summary: 'Assets', responses: { '200': { description: 'Collection' } } } },
    '/finance/assets/summary': { get: { summary: 'Asset valuation summary', responses: { '200': { description: 'Summary' } } } },
    '/finance/assets/types': { get: { summary: 'Asset types', responses: { '200': { description: 'Collection' } } } },
    '/finance/assets/transfers': { get: { summary: 'Asset transfers', responses: { '200': { description: 'Collection' } } } },
    '/finance/assets/ledger': { get: { summary: 'Asset ledger history', responses: { '200': { description: 'Collection' } } } },
    '/finance/assets/{id}': { get: { summary: 'Asset detail', responses: { '200': { description: 'Detail' } } } },
    '/finance/assets/{id}/ledger': { get: { summary: 'Asset ledger', responses: { '200': { description: 'Collection' } } } },
  },
} as const;

export function agentDocsHtml() {
  return `<!doctype html><html><head><title>Finance Agent API</title><style>body{font:16px system-ui;max-width:900px;margin:40px auto;padding:0 20px}code{background:#f1f1f1;padding:2px 5px}li{margin:8px 0}</style></head><body><h1>Finance Agent API</h1><p>Read-only API for Finance, Travel Expenses, and Assets.</p><p>Download the <a href="/api/agent/openapi.json">OpenAPI document</a>.</p><ul>${Object.keys(agentOpenApi.paths).map((path) => `<li><code>GET /api/agent/v1${path}</code></li>`).join('')}</ul></body></html>`;
}
