# Subscriber VPS Frontend

Frontend terpisah untuk modul Subscriber, VPS, Dashboard Subscriber/VPS, Master Program/Rekening, Users, dan Auth.

## Menjalankan

```bash
npm install
npm run dev
```

Default API ada di `.env`:

```bash
VITE_API_BASE_URL=http://localhost:5008/api/
VITE_API_BASE_URL_ATTACHMENT=http://localhost:5008/uploads/
```

## Menu Aktif

- Dashboard
- Subscriber
- VPS
- Master Data: Program, Rekening Invoice
- Users untuk role `superuser`

