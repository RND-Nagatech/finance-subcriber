# Subscriber VPS Backend

Backend terpisah untuk auth, user management, subscriber, VPS/TT VPS, invoice/DOKU, fiscal year, dashboard subscriber/VPS, program, dan rekening invoice.

## Menjalankan

```bash
npm install
npm run dev
```

Server berjalan dari `.env`:

```bash
PORT=5008
```

## Route Utama

- `POST /api/auth/login`
- `GET /api/dashboard/subscriber-growth/:tahun`
- `GET /api/dashboard/subscriber-cumulative/:tahun`
- `GET /api/dashboard/subscriber-by-program`
- `GET|POST|PUT|DELETE /api/subscriber`
- `GET|POST|PATCH|DELETE /api/tt-vps`
- `GET /api/vps/available-subscribers`
- `GET|POST|PUT|DELETE /api/master/program`
- `GET|POST|PUT|DELETE /api/master/rekening`
- `GET|POST|PUT|DELETE /api/users`

## Subscriber Agent API

API ini read-only untuk Agent Gateway dan hanya mencakup data Subscriber serta metrik Subscriber. Finance, Perjalanan Dinas, Asset, Subscription, VPS, dan Order Confirmation tidak diekspos dari Agent API ini.

Aktifkan secara eksplisit di `.env`:

```bash
AGENT_API_ENABLED=true
AGENT_SERVICE_AUDIENCE=subscriber-api
AGENT_TOKEN_PUBLIC_KEY="-----BEGIN PUBLIC KEY-----\\n...\\n-----END PUBLIC KEY-----"
AGENT_API_RATE_LIMIT=60
```

Token harus berupa JWT service-to-service dengan `sub`, `aud`, `exp`, dan scope `subscriber:read`. Untuk deployment internal yang belum memakai RS256, `AGENT_TOKEN_SECRET` dapat digunakan sebagai alternatif HS256; secret ini harus berbeda dari `JWT_SECRET` dan `PORTAL_JWT_SECRET`.

Dokumentasi: `GET /api/agent/docs` dan OpenAPI JSON: `GET /api/agent/openapi.json`.
