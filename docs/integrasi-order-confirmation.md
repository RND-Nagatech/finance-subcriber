# Integrasi Finance Subscriber ke Order Confirmation

Perubahan ini membuat field `NO OK` di form subscriber tidak diketik manual lagi. Frontend subscriber mengambil daftar No OK dari backend subscriber, lalu backend subscriber meneruskan request ke `order-confirmation-api` memakai HMAC signature.

## Endpoint Backend Subscriber

```txt
GET /api/integrations/order-confirmation/no-ok/search?search=...&page=1&limit=100
GET /api/integrations/order-confirmation/no-ok/detail?no_ok=...
```

Endpoint ini memakai JWT login subscriber seperti endpoint lain, sehingga frontend tidak memegang secret integrasi.

## Environment Backend Subscriber

Tambahkan di `new-be/.env`:

```env
ORDER_CONFIRMATION_BASE_URL=http://localhost:9999
ORDER_CONFIRMATION_INTEGRATION_CLIENT_ID=finance_subscriber
ORDER_CONFIRMATION_INTEGRATION_SECRET=secret-yang-sama-dengan-order-confirmation
ORDER_CONFIRMATION_TIMEOUT_MS=10000
```

Nilai `ORDER_CONFIRMATION_INTEGRATION_SECRET` harus sama dengan secret client `finance_subscriber` di `order-confirmation-api`.

## Environment Order Confirmation

Tambahkan di `order-confirmation-api/.env`:

```env
INTEGRATION_API_ENABLED=true
INTEGRATION_API_CLIENTS=finance_subscriber:secret-yang-sama-dengan-subscriber
INTEGRATION_TIMESTAMP_TOLERANCE_SECONDS=300
```

## Flow

1. User buka form subscriber.
2. Frontend memanggil backend subscriber untuk mengambil daftar No OK valid.
3. Backend subscriber membuat signature HMAC dan memanggil order confirmation.
4. User memilih No OK dari dropdown.
5. Saat simpan, backend subscriber validasi ulang No OK ke order confirmation.
6. Data subscriber tetap menyimpan field lama `no_ok`.

## File yang Berubah

- `new-be/src/services/orderConfirmationIntegrationService.ts`
- `new-be/src/controllers/orderConfirmationIntegrationController.ts`
- `new-be/src/routes/orderConfirmationIntegrationRoutes.ts`
- `new-be/src/controllers/masterController.ts`
- `new-be/src/server.ts`
- `new-fe/src/api/orderConfirmation.ts`
- `new-fe/src/pages/Subscriber.tsx`
