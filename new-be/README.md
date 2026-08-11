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

