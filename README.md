# Finance Subscriber

Dokumentasi ini menjelaskan project `finance-subcriber`: struktur aplikasi, cara menjalankan frontend dan backend, konfigurasi environment, menu aktif, collection MongoDB utama, konsep data subscriber/subscription, serta alur patch data dari project lama.

## Ringkasan Project

`finance-subcriber` adalah aplikasi internal untuk mengelola data subscriber dan tagihan subscription.

Fokus utama project ini:

- Dashboard subscriber dan subscription.
- Master data pendukung subscriber.
- Subscriber outstand dan subscriber aktif/nonaktif.
- Transaksi subscription, sebelumnya disebut VPS.
- Invoice subscription dan pelunasan.
- Rekap bulanan subscription untuk dashboard.
- Summary tahunan per subscriber.
- Patch data dari struktur lama ke struktur baru.
- User management dan authentication.

Project ini adalah hasil pemisahan dari project finance lama. Source utama sekarang berada di:

```text
new-fe/
new-be/
script-patch/
docs/
```

## Konsep Utama

Project ini sengaja memisahkan data transaksi detail, rekap bulanan, dan cache summary tahunan supaya data besar tetap ringan dibaca, tetapi tetap bisa diaudit.

Sumber kebenaran transaksi:

```text
tt_subscription_detail
```

Rekap dashboard bulanan:

```text
tt_subscription
```

Cache summary tahunan per subscriber:

```text
tt_subscriber_tahun
```

Aturan penting:

- `tt_subscription_detail` adalah sumber transaksi utama.
- `tt_subscription` dihitung ulang dari detail, bukan increment/decrement manual.
- `tt_subscriber_tahun` adalah cache summary, bukan sumber transaksi.
- Jika ada selisih, solusi resminya adalah rebuild dari detail.
- Tidak ada array history di summary agar mengurangi risiko selisih.

## Teknologi

Frontend:

- React 18
- TypeScript
- Vite
- React Router DOM
- TanStack React Query
- Axios
- Tailwind CSS
- Radix UI / shadcn-style components
- Lucide React icons
- Recharts
- React Toastify dan Sonner
- CryptoJS untuk secure storage ringan di browser
- jsPDF, html2canvas, dan xlsx untuk export

Backend:

- Node.js
- Express
- TypeScript
- MongoDB
- Mongoose
- JWT authentication
- bcrypt
- Multer untuk upload file
- ExcelJS dan csv-parser untuk kebutuhan export/import
- SimpleWebAuthn untuk security key/passkey
- Morgan untuk request logging
- dotenv untuk environment

## Struktur Folder Penting

```text
finance-subcriber
├── docs/
│   └── subscription-refactor-plan.md
├── new-be/
│   ├── src/
│   │   ├── config/
│   │   ├── controllers/
│   │   ├── middleware/
│   │   ├── models/
│   │   ├── routes/
│   │   ├── scripts/
│   │   ├── services/
│   │   ├── utils/
│   │   └── server.ts
│   ├── uploads/
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
├── new-fe/
│   ├── public/
│   ├── src/
│   │   ├── api/
│   │   ├── components/
│   │   ├── hooks/
│   │   ├── lib/
│   │   ├── pages/
│   │   │   ├── Auth/
│   │   │   └── MasterData/
│   │   ├── store/
│   │   ├── utils/
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── .env.example
│   ├── package.json
│   ├── tailwind.config.ts
│   └── vite.config.ts
├── script-patch/
│   ├── README.md
│   ├── patch_legacy_subscriber2.ts
│   ├── patch_program2_to_program.ts
│   ├── patch_group_toko_from_subscriber.ts
│   ├── patch_karyawan_from_subscriber.ts
│   ├── patch_subscription_from_detail2.ts
│   └── run-patch-all.sh
└── README.md
```

## Environment

Template environment tersedia di:

```text
new-fe/.env.example
new-be/.env.example
```

### Frontend Environment

Contoh:

```env
VITE_API_BASE_URL=http://localhost:5001/api/
VITE_API_BASE_URL_ATTACHMENT=http://localhost:5001/uploads/
VITE_PROGRAM_INTERNAL_URL=http://localhost:5173
```

Penjelasan:

- `VITE_API_BASE_URL`: base URL API backend.
- `VITE_API_BASE_URL_ATTACHMENT`: base URL file static upload, misalnya invoice PDF.
- `VITE_PROGRAM_INTERNAL_URL`: URL program internal untuk integrasi login/session.

Catatan:

- Env frontend wajib memakai prefix `VITE_`.
- Nilai `VITE_*` ikut masuk ke bundle frontend.
- Jangan simpan secret/API key penting di env frontend.

### Backend Environment

Contoh:

```env
PORT=8080
MONGO_URI=mongodb://localhost:27017/akuntingdb
JWT_SECRET=change_this_to_a_strong_secret
PORTAL_JWT_SECRET=change_this_to_a_strong_portal_secret
DELETE_VALIDATED_SECRET_CODE=change_this_delete_secret_code
CORS_ORIGIN=http://localhost:3000

DOKU_ENVIRONMENT=sandbox
DOKU_CLIENT_ID=
DOKU_SECRET_KEY=
DOKU_PAYMENT_DUE_MINUTES=60
DOKU_REQUEST_TIMEOUT_MS=15000
DOKU_STATUS_TIMEOUT_MS=8000
CALLBACK_DOKU=https://finance.nagatech.id/api
DOKU_BASE_URL=https://api-sandbox.doku.com
```

Penjelasan penting:

- `PORT`: port backend.
- `MONGO_URI`: koneksi MongoDB.
- `JWT_SECRET`: secret token login aplikasi.
- `PORTAL_JWT_SECRET`: secret untuk integrasi portal/program internal.
- `CORS_ORIGIN`: origin frontend yang diizinkan.
- `DOKU_*`: konfigurasi pembayaran DOKU.
- `CALLBACK_DOKU`: base URL API publik untuk redirect/callback DOKU.

File `.env` lokal tidak boleh masuk git.

## Menjalankan Project

### Backend

```bash
cd new-be
npm install
npm run dev
```

Build backend:

```bash
cd new-be
npm run build
```

Start hasil build:

```bash
cd new-be
npm start
```

Health check:

```text
GET /api/health
```

### Frontend

```bash
cd new-fe
npm install
npm run dev
```

Build frontend:

```bash
cd new-fe
npm run build
```

Preview build:

```bash
cd new-fe
npm run preview
```

### Menjalankan FE dan BE Sekaligus

Dari folder `new-fe`:

```bash
npm run dev:all
```

Script ini menjalankan:

- Backend dari `../new-be`
- Frontend Vite

## Script NPM Penting

Backend:

| Script | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan backend dengan `ts-node-dev` |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm start` | Menjalankan hasil build |
| `npm run sync-indexes` | Sinkronisasi index Mongoose |
| `npm run sync-subscriber-payment-dates` | Sinkronisasi tanggal pembayaran subscriber |
| `npm run normalize-business-dates` | Normalisasi tanggal bisnis ke string |
| `npm run cleanup-subscriber-active-field` | Membersihkan field aktif lama yang tidak dipakai |
| `npm run sync-group-program-from-program` | Sinkronisasi group program dari master program |
| `npm run dedupe-ttvps` | Bantuan dedupe data subscription detail |

Frontend:

| Script | Fungsi |
| --- | --- |
| `npm run dev` | Menjalankan Vite dev server |
| `npm run dev:all` | Menjalankan backend dan frontend sekaligus |
| `npm run build` | Build production |
| `npm run build:dev` | Build mode development |
| `npm run preview` | Preview hasil build |
| `npm run lint` | Lint frontend |

## Routing Frontend

Routing utama berada di:

```text
new-fe/src/App.tsx
```

| Route | Halaman | Proteksi | Keterangan |
| --- | --- | --- | --- |
| `/` | Redirect ke `/dashboard` | Ya | Landing internal aplikasi |
| `/login` | Login | Tidak | Login user |
| `/register` | Register | Tidak | Register user/security key |
| `/sso/callback` | SSO Callback | Tidak | Integrasi program internal |
| `/sso/logout` | SSO Logout | Tidak | Logout dari program internal |
| `/dashboard` | Dashboard | Ya | Dashboard subscriber dan subscription |
| `/subscriber-outstand` | Subscriber Outstand | Ya | Data calon subscriber/pending |
| `/subscriber` | Subscriber | Ya | Data subscriber aktif/nonaktif |
| `/subscription` | Subscription | Ya | Tagihan dan pelunasan subscription |
| `/maintenance/patch` | Patch Data | Ya | Tools patch data legacy |
| `/master/group` | Group Toko | Ya | Master group toko |
| `/master/group-program` | Group Program | Ya | Master group program |
| `/master/program` | Program | Ya | Master program |
| `/master/karyawan` | Karyawan | Ya | Master karyawan/sales/implementator |
| `/master/perusahaan` | Perusahaan | Ya | Master perusahaan |
| `/master/bank` | Bank | Ya | Master bank |
| `/master/rekening` | Rekening | Ya | Master rekening invoice |
| `/users` | Users | Ya | Manajemen user, khusus role tertentu |

Route proteksi menggunakan:

```text
new-fe/src/components/ProtectedRoute.tsx
```

Layout utama:

```text
new-fe/src/components/MainLayout.tsx
new-fe/src/components/Sidebar.tsx
```

## Integrasi API Frontend

Frontend memakai Axios instance:

```text
new-fe/src/api/axiosInstance.ts
```

Fungsi utamanya:

- Menggunakan `VITE_API_BASE_URL`.
- Menambahkan token `Authorization: Bearer <token>`.
- Menghapus token dan redirect ke login jika response `401`.
- Menjadi pintu utama komunikasi FE ke BE.

Token dan data session disimpan melalui:

```text
new-fe/src/utils/secureStorage.ts
```

## Mount Route Backend

Route backend dipasang di:

```text
new-be/src/server.ts
```

| Prefix | Route File | Fungsi |
| --- | --- | --- |
| `/api/auth` | `authRoutes.ts` | Login, register, SSO, WebAuthn |
| `/api/dashboard` | `dashboardRoutes.ts` | Dashboard subscriber/subscription |
| `/api/master` | `masterRoutes.ts` | Master data utama |
| `/api/fiscal` | `fiscalRoutes.ts` | Fiscal year |
| `/api/subscriber` | `subscriberRoutes.ts` | Subscriber dan subscriber outstand |
| `/api/subscription` | `subscriptionRoutes.ts` | Summary dan endpoint subscription |
| `/api/tt-vps` | `subscriptionVpsAdapterRoutes.ts` | Adapter transaksi subscription detail |
| `/api/vps` | `subscriptionVpsAvailableRoutes.ts` | Available subscriber untuk subscription |
| `/api/users` | `userRoutes.ts` | Manajemen user |
| `/api/maintenance` | `maintenanceRoutes.ts` | Patch data dan maintenance tools |

## Authentication

Authentication menggunakan JWT.

Header:

```http
Authorization: Bearer <token>
```

Middleware:

```text
new-be/src/middleware/authMiddleware.ts
```

Beberapa endpoint read dipakai internal oleh frontend, sedangkan endpoint write penting diproteksi dengan login.

## Menu dan Modul

### Dashboard

Dashboard menampilkan ringkasan:

- Subscriber baru.
- Total subscriber.
- Total biaya subscriber.
- Estimasi subscription.
- Perolehan subscription estimasi/realisasi.
- Subscriber analytics.
- Subscriber by program/group program.
- Pertumbuhan subscriber vs tahun sebelumnya.

Sumber angka subscription dashboard:

```text
tt_subscription
tt_subscription_detail
tt_subscriber_tahun
```

### Master Data

Master data aktif:

- Group Toko
- Group Program
- Program
- Karyawan
- Perusahaan
- Bank
- Rekening

Catatan:

- `Group Toko` dipakai untuk grouping subscriber/toko.
- `Group Program` dipakai oleh master program, lalu otomatis mengisi field group program di subscriber.
- `Karyawan` dipakai sebagai pilihan Sales dan Implementator.
- `Rekening` dipakai untuk rekening invoice.

### Subscriber Outstand

Subscriber outstand adalah data subscriber yang belum valid/aktif sebagai subscriber berjalan.

Pola pemakaian:

1. Data dimasukkan sebagai outstand.
2. User melengkapi data.
3. Data divalidasi.
4. Data berpindah menjadi subscriber aktif.

### Subscriber

Subscriber adalah master toko/customer yang sudah aktif digunakan untuk subscription.

Field penting:

- `kode`
- `no_ok`
- `kode_group`
- `nama_group`
- `toko`
- `alamat`
- `program`
- `grup` atau group program
- `internal_kode`
- `biaya`
- `domain`
- `server_location`
- `kode_sales`
- `sales`
- `kode_implementator`
- `implementator`
- `tgl_implementasi`
- `tgl_dijalankan`
- `tgl_terbayar`
- `tgl_berakhir_langganan`
- `tgl_bayar_selanjutnya`
- `status_subscriber`
- `tgl_nonaktif`
- `alasan_nonaktif`

Status subscriber yang dipakai:

```text
AKTIF
NON_AKTIF
OUTSTAND
```

### Subscription

Subscription adalah modul tagihan yang sebelumnya disebut VPS.

Konsep baru:

- Detail tidak lagi langsung memenuhi satu tahun/periode seperti sistem lama.
- Detail yang ditampilkan adalah tagihan berjalan dan riwayat penting.
- Setelah tagihan dilunasi, sistem membuat tagihan berikutnya.
- Jika tagihan berikutnya masuk fiscal year berikutnya, data tetap dibuat.
- Filter tahun fiskal menentukan data yang terlihat di UI.

Status detail subscription:

```text
OPEN
PROCESS
DONE
```

Status aktif detail:

- `is_active: true`: tagihan aktif/dihitung.
- `is_active: false`: marker nonaktif, tidak dihitung estimasi/realisasi.

Alur umum:

1. Tambah subscription untuk subscriber.
2. Status awal `OPEN`.
3. Generate invoice mengubah status ke `PROCESS`.
4. Pelunasan mengubah status ke `DONE`.
5. Setelah lunas, sistem membuat tagihan berikutnya.
6. Batal pelunasan mengembalikan status dan menghitung ulang rekap.
7. Nonaktifkan detail akan mengurangi estimasi sesuai sisa periode.
8. Aktifkan kembali dilindungi proteksi agar tidak aktif di periode lama jika sudah ada data berikutnya.

## Collection MongoDB Utama

### Master

| Collection | Fungsi |
| --- | --- |
| `tm_group` | Master Group Toko |
| `tm_group_program` | Master Group Program |
| `tm_program` | Master Program |
| `tm_karyawan` | Master Karyawan |
| `tm_subscriber` | Master Subscriber dan Subscriber Outstand |
| `tm_perusahaan` | Master Perusahaan |
| `tm_bank` | Master Bank |
| `tm_rekening` | Master Rekening Invoice |
| `tm_user` | User aplikasi |

### Subscription

| Collection | Fungsi |
| --- | --- |
| `tt_subscription_detail` | Detail tagihan subscription, sumber transaksi utama |
| `tt_subscription` | Rekap bulanan subscription untuk dashboard |
| `tt_subscriber_tahun` | Cache summary tahunan per subscriber |
| `invoice_counters` | Counter nomor invoice |

### Konfigurasi

| Collection | Fungsi |
| --- | --- |
| `fiscalconfigs` | Tahun fiskal aktif |

## Fiscal Year

Fiscal year mengikuti pola Desember sampai November.

Contoh tahun fiskal 2026:

```text
DEC-25
JAN-26
FEB-26
MAR-26
APR-26
MAY-26
JUN-26
JUL-26
AUG-26
SEP-26
OCT-26
NOV-26
```

Konfigurasi tahun aktif disimpan di collection fiscal config, misalnya:

```json
{
  "key": "fiscal",
  "active_year": 2026
}
```

## Invoice dan DOKU

Invoice subscription dibuat dari menu Subscription.

Fitur terkait:

- Generate invoice satu data.
- Generate invoice bulk dari checkbox.
- Download ulang invoice.
- Upload/penyimpanan PDF invoice.
- Payment link DOKU.
- Callback/redirect DOKU.

File upload runtime disimpan di:

```text
new-be/uploads/
```

URL attachment dibentuk dari:

```text
VITE_API_BASE_URL_ATTACHMENT
```

## Patch Data Legacy

Script patch berada di:

```text
script-patch/
```

Dokumentasi lengkap:

```text
script-patch/README.md
```

### Konsep Patch

Untuk database development:

```bash
PATCH_SOURCE_SUFFIX=2
PATCH_TARGET_SUFFIX=
```

Contoh:

- `tm_subscriber2` -> `tm_subscriber`
- `tm_program2` -> `tm_program`
- `tt_subscription_detail2` -> `tt_subscription_detail`

Untuk database asli, rename dulu collection lama menjadi legacy:

- `tm_subscriber` -> `tm_subscriber_legacy`
- `tm_program` -> `tm_program_legacy`
- `tt_subscription_detail` -> `tt_subscription_detail_legacy`

Lalu jalankan patch:

```bash
./script-patch/run-patch-all.sh --source-suffix=_legacy --apply
```

### Jalankan Semua Patch

Dry-run:

```bash
./script-patch/run-patch-all.sh --source-suffix=2
```

Apply:

```bash
./script-patch/run-patch-all.sh --source-suffix=2 --apply
```

Urutan patch:

1. Master Program
2. Master Subscriber
3. Master Karyawan dari Subscriber
4. Master Group Toko dari Subscriber
5. Subscription Detail, Rekap Bulanan, dan Subscriber Tahun

### Catatan Subscription Legacy

Patch subscription lama punya aturan khusus:

- `tempo` legacy tidak dipercaya penuh.
- `tgl_berakhir_langganan` dihitung ulang dari `tgl_mulai_tagihan + jumlah_bulan - 1 hari`.
- `tgl_bayar_selanjutnya` dihitung dari `tgl_berakhir_langganan + 1 hari`.
- Relasi subscriber hanya auto match jika nama toko strict match dengan `tm_subscriber`.
- Jika tidak ketemu, detail tetap dipatch sebagai `UNVERIFIED`.
- Data `UNVERIFIED` tidak dihitung ke rekap bulanan/tahunan sampai diverifikasi.
- Baris nonaktif lama dipatch sebagai marker nonaktif, tetapi tidak dihitung estimasi/realisasi.
- Dari data lama yang tergenerate satu periode penuh, patch hanya menyisakan satu tagihan berjalan aktif paling awal per rangkaian.

## Maintenance Patch UI

Menu:

```text
/maintenance/patch
```

Fungsi:

- Menjalankan patch data dari UI.
- Melihat source/target collection.
- Verifikasi data subscription hasil patch yang `UNVERIFIED`.
- Menjaga agar patch tidak perlu dijalankan manual dari terminal untuk kebutuhan umum.

Tetap gunakan dry-run terlebih dahulu sebelum apply ke database penting.

## Rebuild dan Sinkronisasi

Karena summary dihitung ulang dari detail, maintenance yang umum dilakukan:

- Rebuild `tt_subscription` dari `tt_subscription_detail`.
- Rebuild `tt_subscriber_tahun` dari `tt_subscription_detail`.
- Sync index MongoDB setelah perubahan schema/index.

Script backend yang relevan:

```bash
cd new-be
npm run sync-indexes
npm run sync-subscriber-payment-dates
npm run normalize-business-dates
```

Patch subscription juga otomatis menghitung ulang:

```text
tt_subscription
tt_subscriber_tahun
```

## Catatan Data dan Naming

Pola collection:

- `tm_*`: master data.
- `tt_*`: transaksi/rekap transaksi berjalan.

Naming penting yang dipakai project baru:

- `Group Toko`: grouping toko/customer.
- `Group Program`: grouping program/subscriber product.
- `Subscription`: pengganti penyebutan VPS pada UI baru.
- `tt_subscription_detail`: detail tagihan.
- `tt_subscription`: rekap bulanan.
- `tt_subscriber_tahun`: summary tahunan per subscriber.

Collection lama seperti `tt_vps_detail`, `tt_cps`, atau rekap tahunan lama tidak dijadikan sumber utama project baru.

## Development Notes

Hal-hal yang perlu dijaga saat development:

- Jangan menghitung ulang angka dashboard di frontend.
- Jangan menambah angka summary dengan increment/decrement manual jika bisa rebuild dari detail.
- Jangan menyimpan summary tahunan ke `tm_subscriber`.
- Untuk perubahan master subscriber yang berpengaruh ke tagihan, sinkronkan ke subscription detail yang belum lunas saja.
- Data invoice yang sudah `DONE` sebaiknya tetap menjaga informasi saat invoice dibuat.
- Gunakan soft delete sesuai pola model, kecuali flow tertentu memang sudah diputuskan perlu hard delete agar tidak menumpuk.
- Jalankan build FE/BE setelah perubahan besar.

## Build Check

Backend:

```bash
npm run build --prefix new-be
```

Frontend:

```bash
npm run build --prefix new-fe
```

Warning Vite tentang chunk besar atau Browserslist lama bukan error build, tetapi bisa dirapikan terpisah jika dibutuhkan.

