# Dokumentasi API Perjalanan Dinas Pegawai

Dokumen ini merangkum endpoint yang dibutuhkan aplikasi pegawai untuk melihat daftar perjalanan dinas, menginput item transaksi, upload bukti gambar/PDF, menyelesaikan input perjalanan, dan melihat history perjalanan.

## Konvensi Umum

- Base URL backend: `/api`
- Base path modul: `/api/perjalanan-dinas`
- Semua endpoint perjalanan dinas wajib autentikasi:

```http
Authorization: Bearer <jwt_token>
```

- Upload file memakai `multipart/form-data`.
- Field upload harus bernama `attachments`.
- File yang diizinkan: `image/*` dan `application/pdf`.
- Maksimal: 10 file, 10 MB per file.
- File yang berhasil diupload akan memiliki path seperti:

```text
/uploads/perjalanan-dinas/bukti-xxxx.jpg
```

- URL akses file:

```text
<BASE_BACKEND_URL>/uploads/perjalanan-dinas/bukti-xxxx.jpg
```

## Auth

Base path auth:

```text
/api/auth
```

Untuk aplikasi pegawai, gunakan login password agar mendapat JWT. Token dari login dikirim ke endpoint perjalanan dinas lewat header `Authorization`.

### Login

```http
POST /api/auth/login
```

Request body:

```json
{
  "email": "pegawai@example.com",
  "password": "password123"
}
```

Response sukses:

```json
{
  "success": true,
  "token": "<jwt_token>",
  "user": {
    "id": "664a...",
    "name": "Pegawai Satu",
    "email": "pegawai@example.com",
    "role": "user"
  }
}
```

Response gagal:

```json
{
  "message": "Email atau password salah"
}
```

Cara pakai token:

```http
Authorization: Bearer <jwt_token>
```

Contoh:

```js
const loginRes = await fetch(`${baseUrl}/api/auth/login`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    email: 'pegawai@example.com',
    password: 'password123'
  })
});

const loginData = await loginRes.json();
const token = loginData.token;

const tripsRes = await fetch(`${baseUrl}/api/perjalanan-dinas?status=ALL`, {
  headers: {
    Authorization: `Bearer ${token}`
  }
});
```

### Register

```http
POST /api/auth/register
```

Request body:

```json
{
  "name": "Pegawai Satu",
  "email": "pegawai@example.com",
  "password": "password123"
}
```

Response sukses:

```json
{
  "success": true,
  "message": "Registrasi berhasil",
  "userId": "664a..."
}
```

Catatan:

- Endpoint register membuat user baru dengan `username = email`.
- Role default mengikuti model `User` di backend.
- Untuk aplikasi production, pendaftaran pegawai biasanya lebih aman dibuat/dikelola admin, lalu pegawai hanya login.

### WebAuthn / YubiKey

Backend juga menyediakan endpoint WebAuthn:

```http
POST /api/auth/register-challenge
POST /api/auth/register-verify
POST /api/auth/login-challenge
POST /api/auth/login-verify
```

Catatan penting:

- Endpoint ini dipakai oleh flow security key/YubiKey di web.
- Saat ini `POST /api/auth/login-verify` mengembalikan data user, tetapi tidak mengembalikan JWT seperti `/api/auth/login`.
- Untuk aplikasi pegawai yang butuh akses API perjalanan dinas, gunakan `/api/auth/login` kecuali backend WebAuthn nanti disesuaikan agar mengembalikan token.

## Status Perjalanan

```text
BERJALAN
SEDANG_DIAUDIT
SELESAI
```

Untuk aplikasi pegawai, flow utamanya:

1. Ambil list perjalanan dinas milik pegawai.
2. Pilih satu perjalanan dengan status `BERJALAN`.
3. Input item transaksi.
4. Upload bukti pada item transaksi.
5. Submit perjalanan ke audit.
6. Lihat history perjalanan dinas.

## 1. Ambil List Perjalanan Dinas

```http
GET /api/perjalanan-dinas
```

Query params:

| Param | Wajib | Keterangan |
| --- | --- | --- |
| `status` | Tidak | `ALL`, `BERJALAN`, `SEDANG_DIAUDIT`, `SELESAI` |
| `user_id` | Tidak | Filter pegawai tertentu. Untuk role `user`, backend otomatis membatasi ke user login. |
| `from` | Tidak | Filter `tanggal_berangkat >= from`, format `YYYY-MM-DD` |
| `to` | Tidak | Filter `tanggal_berangkat <= to`, format `YYYY-MM-DD` |
| `q` | Tidak | Search kode perjalanan, tujuan, nama user, catatan |
| `page` | Tidak | Default `1` |
| `limit` | Tidak | Default `10`, maksimum `100` |

Contoh:

```http
GET /api/perjalanan-dinas?status=ALL&page=1&limit=10
```

Response:

```json
{
  "data": [
    {
      "_id": "665f...",
      "kode_perjalanan": "PD-20260608-1234",
      "user_id": "664a...",
      "user_username": "pegawai01",
      "user_name": "Pegawai Satu",
      "tujuan": "Jakarta",
      "tanggal_berangkat": "2026-06-08",
      "tanggal_pulang": "2026-06-10",
      "catatan": "Kunjungan client",
      "status": "BERJALAN",
      "posted_to_tt_finance": false,
      "return_done": false,
      "summary": {
        "total_inject": 1000000,
        "total_return": 0,
        "total_approved": 0,
        "total_transaksi": 250000,
        "sisa_dana": 750000,
        "total_items": 1,
        "item_counts": {
          "PENDING": 1,
          "APPROVED": 0,
          "REVISI": 0
        }
      }
    }
  ],
  "page": 1,
  "total": 1,
  "totalPages": 1
}
```

## 2. Ambil Detail Perjalanan

```http
GET /api/perjalanan-dinas/:id
```

Response:

```json
{
  "header": {
    "_id": "665f...",
    "kode_perjalanan": "PD-20260608-1234",
    "user_id": "664a...",
    "user_name": "Pegawai Satu",
    "tujuan": "Jakarta",
    "tanggal_berangkat": "2026-06-08",
    "tanggal_pulang": "2026-06-10",
    "status": "BERJALAN"
  },
  "summary": {
    "total_inject": 1000000,
    "total_return": 0,
    "total_approved": 0,
    "total_transaksi": 250000,
    "sisa_dana": 750000,
    "total_items": 1,
    "item_counts": {
      "PENDING": 1
    }
  }
}
```

## 3. Ambil Ringkasan Dana Perjalanan

```http
GET /api/perjalanan-dinas/:id/summary
```

Response:

```json
{
  "total_inject": 1000000,
  "total_return": 0,
  "total_approved": 250000,
  "total_transaksi": 250000,
  "sisa_dana": 750000,
  "total_items": 2,
  "item_counts": {
    "PENDING": 1,
    "APPROVED": 1,
    "REVISI": 0
  }
}
```

## 4. Ambil List Item Transaksi

```http
GET /api/perjalanan-dinas/:id/items
```

Query params:

| Param | Wajib | Keterangan |
| --- | --- | --- |
| `audit_status` | Tidak | `ALL`, `PENDING`, `APPROVED`, `REVISI` |

Response:

```json
[
  {
    "_id": "6660...",
    "perjalanan_id": "665f...",
    "user_id": "664a...",
    "user_name": "Pegawai Satu",
    "tanggal_transaksi": "2026-06-08",
    "nominal": 250000,
    "keterangan": "Transport bandara",
    "audit_status": "PENDING",
    "audit_catatan_item": "",
    "attachments": [
      {
        "path": "/uploads/perjalanan-dinas/bukti-123.jpg",
        "original_name": "struk.jpg",
        "mime_type": "image/jpeg",
        "size": 123456
      }
    ]
  }
]
```

## 5. Masukkan Item Transaksi

```http
POST /api/perjalanan-dinas/:id/items
```

Syarat:

- Perjalanan harus status `BERJALAN`.
- Role `user` hanya bisa input perjalanan miliknya.

Request body:

```json
{
  "tanggal_transaksi": "2026-06-08",
  "nominal": 250000,
  "keterangan": "Transport bandara"
}
```

Response `201`:

```json
{
  "_id": "6660...",
  "perjalanan_id": "665f...",
  "user_id": "664a...",
  "user_name": "Pegawai Satu",
  "tanggal_transaksi": "2026-06-08",
  "nominal": 250000,
  "keterangan": "Transport bandara",
  "audit_status": "PENDING",
  "attachments": [],
  "created_by": "Pegawai Satu",
  "created_at": "2026-06-08T01:00:00.000Z"
}
```

## 6. Upload Gambar/PDF Bukti Item Transaksi

```http
POST /api/perjalanan-dinas/:id/items/:itemId/attachments
```

Content-Type:

```http
multipart/form-data
```

Form data:

| Field | Wajib | Keterangan |
| --- | --- | --- |
| `attachments` | Ya | Satu atau banyak file image/PDF |

Syarat:

- Perjalanan harus status `BERJALAN`.
- Item belum terkunci audit.

Contoh JavaScript:

```js
const form = new FormData();
files.forEach((file) => form.append('attachments', file));

await fetch(`${baseUrl}/api/perjalanan-dinas/${id}/items/${itemId}/attachments`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${token}`
  },
  body: form
});
```

Response:

```json
{
  "success": true,
  "attachments": [
    {
      "path": "/uploads/perjalanan-dinas/bukti-123.jpg",
      "original_name": "struk.jpg",
      "mime_type": "image/jpeg",
      "size": 123456
    }
  ]
}
```

## 7. Edit Item Transaksi

```http
PUT /api/perjalanan-dinas/:id/items/:itemId
```

Request body, semua field opsional:

```json
{
  "tanggal_transaksi": "2026-06-08",
  "nominal": 275000,
  "keterangan": "Transport bandara + parkir"
}
```

Response:

```json
{
  "_id": "6660...",
  "tanggal_transaksi": "2026-06-08",
  "nominal": 275000,
  "keterangan": "Transport bandara + parkir",
  "audit_status": "PENDING"
}
```

## 8. Hapus Item Transaksi

```http
DELETE /api/perjalanan-dinas/:id/items/:itemId
```

Response:

```json
{
  "success": true
}
```

## 9. Hapus Bukti Item Transaksi

```http
DELETE /api/perjalanan-dinas/:id/items/:itemId/attachments/:filename
```

Contoh:

```http
DELETE /api/perjalanan-dinas/665f.../items/6660.../attachments/bukti-123.jpg
```

Response:

```json
{
  "success": true,
  "attachments": []
}
```

## 10. Selesaikan Input Perjalanan oleh Pegawai

Endpoint ini mengubah status dari `BERJALAN` menjadi `SEDANG_DIAUDIT`.

```http
POST /api/perjalanan-dinas/:id/submit-audit
```

Syarat:

- Status perjalanan harus `BERJALAN`.
- Minimal punya 1 item transaksi aktif.
- Pegawai hanya bisa submit perjalanan miliknya.

Request body: kosong.

Response:

```json
{
  "success": true,
  "header": {
    "_id": "665f...",
    "kode_perjalanan": "PD-20260608-1234",
    "status": "SEDANG_DIAUDIT"
  }
}
```

Setelah endpoint ini berhasil, pegawai tidak bisa lagi menambah/edit/hapus item atau upload bukti item.

## 11. Melihat History Perjalanan Dinas

Untuk history, gunakan endpoint list yang sama dengan filter status atau tanggal.

```http
GET /api/perjalanan-dinas?status=SELESAI&page=1&limit=20
```

Contoh filter semua history pegawai:

```http
GET /api/perjalanan-dinas?status=ALL&page=1&limit=20
```

Contoh filter tanggal:

```http
GET /api/perjalanan-dinas?from=2026-06-01&to=2026-06-30&page=1&limit=20
```

Untuk detail history, panggil:

```http
GET /api/perjalanan-dinas/:id
GET /api/perjalanan-dinas/:id/items
GET /api/perjalanan-dinas/:id/summary
```

## Endpoint Pendukung Dana

Endpoint berikut biasanya dipakai office/admin, bukan pegawai biasa. Namun aplikasi pegawai bisa menampilkan datanya sebagai informasi jika diperlukan.

### List Ledger Dana

```http
GET /api/perjalanan-dinas/:id/dana
```

Response:

```json
[
  {
    "_id": "6661...",
    "jenis": "INJECT",
    "nominal": 1000000,
    "kode_bank": "BCA",
    "no_rekening": "1234567890",
    "nama_rekening_snapshot": "REKENING OPERASIONAL",
    "keterangan": "Inject dana perjalanan",
    "created_at": "2026-06-08T01:00:00.000Z",
    "attachments": []
  }
]
```

## Endpoint Audit/Admin

Endpoint ini bukan kebutuhan utama aplikasi pegawai, tapi penting untuk memahami status akhir:

### Update Status Audit Item

```http
POST /api/perjalanan-dinas/:id/items/:itemId/audit-status
```

Request body:

```json
{
  "audit_status": "APPROVED",
  "audit_catatan_item": "OK"
}
```

Nilai `audit_status`: `PENDING`, `APPROVED`, `REVISI`.

### Finalisasi Audit

```http
POST /api/perjalanan-dinas/:id/finalize-audit
```

Request body:

```json
{
  "audit_catatan_header": "Semua bukti valid"
}
```

Syarat:

- Status perjalanan harus `SEDANG_DIAUDIT`.
- Semua item harus `APPROVED`.

Response:

```json
{
  "success": true,
  "header": {
    "_id": "665f...",
    "status": "SELESAI"
  },
  "summary": {
    "total_items": 2,
    "item_counts": {
      "APPROVED": 2
    }
  }
}
```

## Error yang Umum

```json
{ "message": "No token" }
```

```json
{ "message": "Invalid token" }
```

```json
{ "message": "Unauthorized" }
```

```json
{ "message": "Tambah item hanya saat status BERJALAN" }
```

```json
{ "message": "Minimal 1 transaksi item diperlukan" }
```

```json
{ "message": "No files uploaded" }
```

## Rekomendasi Flow Aplikasi Pegawai

1. Login via `POST /api/auth/login` dan simpan token.
2. Ambil perjalanan aktif:

```http
GET /api/perjalanan-dinas?status=BERJALAN&page=1&limit=20
```

3. Saat pegawai memilih perjalanan:

```http
GET /api/perjalanan-dinas/:id
GET /api/perjalanan-dinas/:id/items
GET /api/perjalanan-dinas/:id/summary
```

4. Saat pegawai menambah transaksi:

```http
POST /api/perjalanan-dinas/:id/items
```

5. Jika ada bukti:

```http
POST /api/perjalanan-dinas/:id/items/:itemId/attachments
```

6. Saat pegawai menekan tombol selesai/kirim:

```http
POST /api/perjalanan-dinas/:id/submit-audit
```

7. Untuk halaman history:

```http
GET /api/perjalanan-dinas?status=ALL&page=1&limit=20
```
