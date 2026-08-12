# Rencana Refactor Subscriber & Subscription

## Keputusan Final Penamaan Collection

Mulai implementasi ini, collection resmi yang dipakai oleh modul baru adalah:

- `tm_group`
- `tm_subscriber`
- `tt_subscription`
- `tt_subscription_detail`
- `tt_subscription_rekap_tahun`

Collection lama berikut tidak dipakai lagi oleh alur aplikasi aktif dan bukan target pengembangan baru:

- `tt_vps`
- `tt_vps_details`
- `tt_cps` jika pernah ada/terpikir sebagai nama alternatif

Artinya:

- Endpoint aktif untuk transaksi adalah `/api/subscription`.
- Dashboard subscription membaca `tt_subscription_detail` dan `tt_subscription_rekap_tahun`.
- Fiscal year membaca `tm_subscriber` dan `tt_subscription_detail`.
- Menu aktif memakai istilah Subscription.
- File/collection lama hanya dianggap legacy/archive data lama, bukan sumber data fitur baru.

Status implementasi saat ini:

- Route aktif backend sudah memakai `/api/subscription`.
- Menu aktif frontend sudah memakai `/subscription`.
- `tt_subscription`, `tt_subscription_detail`, dan `tt_subscription_rekap_tahun` sudah menjadi sumber data transaksi/dashboard subscription.
- Generate invoice, payment link DOKU, callback/notification DOKU, pelunasan manual, dan pembuatan tagihan periode berikutnya sudah diarahkan ke collection subscription.
- File lama bertema VPS masih boleh ada sebagai arsip/dead code, tetapi tidak boleh dimount di route aktif atau dipakai menu aktif.

## Pola Penamaan Existing

Dari model yang ada di `new-be/src/models`, pola collection saat ini:

- Master memakai prefix `tm_`
  - `tm_subscriber`
  - `tm_program`
  - `tm_rekening`
  - `tm_user`
  - `tm_bank`
  - `tm_kategori`
- Transaksi memakai prefix `tt_`
  - `tt_finance`
  - `tt_finance_daily`
  - `tt_perjalanan_dinas`
  - `tt_perjalanan_dinas_detail`
- History/tahunan tertentu memakai prefix `th_`
  - `th_finance`
  - `th_finance_daily`

Jadi rencana baru harus mengikuti pola ini:

- Master Group: `tm_group`
- Master Subscriber tetap: `tm_subscriber`
- Rekap subscription bulanan: `tt_subscription`
- Detail/tagihan subscription berjalan: `tt_subscription_detail`
- Rekap tahunan dashboard: `tt_subscription_rekap_tahun`

## Rekomendasi Istilah UI

Saya tetap sarankan istilah menu:

- **Subscription** untuk menu utama.
- **Transaksi Subscription** untuk halaman tagihan.
- **Subscriber** untuk master customer/toko.

Catatan:

- Nama collection tetap jangan pakai `vps` lagi untuk modul baru agar lebih fleksibel.

## Rekomendasi Penamaan Field Tanggal

Saya revisi agar tidak terlalu English dan tetap jelas secara bisnis.

| Kebutuhan | Nama Existing | Rekomendasi Field Baru | Catatan |
|---|---|---|---|
| Tanggal implementasi | `tanggal` | `tgl_implementasi` | Ini menggantikan makna `tanggal` pada subscriber. |
| Tanggal mulai dijalankan | baru | `tgl_dijalankan` | Sesuai istilah yang diminta. |
| Awal periode yang sedang dibayar | `start` | `tgl_mulai_tagihan` | Lebih tepat daripada `tgl_terbayar`. |
| Tanggal pelunasan aktual | `tgl_lunas` | `tgl_lunas` | Tetap dipakai karena sudah jelas. |
| Akhir masa langganan/tagihan | `tempo` | `tgl_berakhir_langganan` | Sesuai istilah yang diminta. |
| Tanggal tagihan berikutnya | next `start` | `tgl_bayar_selanjutnya` | Sesuai istilah yang diminta. |

Kenapa bukan `tgl_terbayar`?

- Contoh `2026-01-01` untuk periode 1 Januari 2026 sampai 31 Januari 2026 sebenarnya adalah tanggal mulai periode/tagihan.
- `tgl_terbayar` mudah rancu dengan tanggal pembayaran aktual.
- Untuk pembayaran aktual, field yang sudah jelas adalah `tgl_lunas`.

Contoh hasil field:

```txt
tgl_mulai_tagihan = 2026-01-01
tgl_berakhir_langganan = 2026-01-31
tgl_bayar_selanjutnya = 2026-02-01
tgl_lunas = 2026-01-10
```

## Struktur Collection Baru

### 1. `tm_group`

Master group untuk mengelompokkan subscriber.

```ts
{
  _id: ObjectId,
  kode_group: string,      // unique, contoh: GRP0001
  nama_group: string,      // contoh: PANTES GROUP
  owner: string | null,    // mengikuti istilah user, bisa juga label UI "Owner"
  no_hp: string | null,
  alamat: string | null,

  status_aktv: boolean,
  input_date: Date,
  update_date: Date,
  delete_date: Date | null,
  input_by: string,
  update_by: string | null,
  delete_by: string | null
}
```

Index:

```ts
{ kode_group: 1 } unique
{ nama_group: 1 }
{ status_aktv: 1 }
```

### 2. `tm_subscriber`

Collection tetap `tm_subscriber`, tetapi field ditambah.

```ts
{
  // existing utama
  kode: string,
  toko: string,
  daerah: string,
  program: string,
  biaya: number,
  alamat: string | null,

  // relasi group
  group_id: ObjectId | null,
  kode_group: string | null,
  nama_group: string | null,
  owner_group: string | null,
  no_hp_group: string | null,
  alamat_group: string | null,

  // server
  server_location: string | null, // contoh: 192.168.23.101

  // tanggal subscriber
  tgl_implementasi: Date | null,
  tgl_dijalankan: Date | null,

  // sementara untuk compatibility data lama
  tanggal: Date | null,

  status_aktv: boolean,
  input_date: Date,
  update_date: Date,
  delete_date: Date | null,
  input_by: string,
  update_by: string | null,
  delete_by: string | null
}
```

Catatan:

- Saat pilih group `(kode_group - nama_group)`, FE otomatis menampilkan `owner`, `no_hp`, dan `alamat`.
- BE tetap validasi `group_id`, lalu mengisi snapshot `kode_group`, `nama_group`, `owner_group`, `no_hp_group`, `alamat_group`.
- Snapshot ini berguna supaya histori subscriber tidak berubah mendadak kalau master group diedit.
- `tanggal` lama nanti bisa tetap diisi sama dengan `tgl_implementasi` selama masa transisi.

Validasi `server_location`:

```txt
Format awal: IPv4, contoh 192.168.23.101
```

Kalau nanti server bisa hostname/domain, validasinya bisa dilonggarkan.

### 3. `tt_subscription`

Rekap subscription bulanan. Collection ini mirip pola `tt_vps` lama: satu dokumen mewakili rekap per bulan/periode, bukan header kontrak subscriber.

Saat subscription dibuat dari tengah fiscal year, sistem langsung membuat rekap bulanan dari bulan mulai tagihan sampai akhir periode fiskal NOV. Contoh: periode fiskal DEC 2025 sampai NOV 2026, jika tagihan pertama mulai AGU 2026 maka `tt_subscription` langsung berisi rekap AGU, SEP, OKT, dan NOV 2026.

```ts
{
  _id: ObjectId,
  periode: string,                       // YYYY-MM
  tahun: number,                         // fiscal year: DEC tahun sebelumnya sampai NOV tahun ini

  estimasi: number,                      // total estimasi tagihan bulan tersebut
  realisasi: number,                     // total tagihan LUNAS bulan tersebut
  total_subscriber_estimasi: number,     // jumlah subscriber yang masuk estimasi bulan tersebut
  total_subscriber_realisasi: number,    // jumlah subscriber yang sudah lunas bulan tersebut
  updated_at: Date,

  input_date: Date,
  update_date: Date,
  delete_date: Date | null,
  input_by: string,
  update_by: string | null,
  delete_by: string | null
}
```

Index:

```ts
{ periode: 1 } unique
{ tahun: 1 }
```

Business rule:

- `tt_subscription` tidak menyimpan subscriber spesifik.
- Jika ada subscriber baru dengan jadwal tagihan AGU sampai NOV, setiap bulan pada rentang itu ditambahkan ke nilai `estimasi`.
- `realisasi` dan `total_subscriber_realisasi` dihitung dari detail yang sudah `LUNAS`.

### 4. `tt_subscription_detail`

Detail tagihan/transaksi subscription. Collection ini menyimpan data tagihan per subscriber satu per satu. Detail berikutnya baru dibuat setelah detail terakhir lunas.

```ts
{
  _id: ObjectId,
  subscription_id: ObjectId | null,      // tidak wajib karena tt_subscription adalah rekap bulanan
  chain_id: string,                      // pengikat rangkaian tagihan subscriber

  subscriber_id: ObjectId,
  kode_subscriber: string,
  toko: string,

  group_id: ObjectId | null,
  kode_group: string | null,
  nama_group: string | null,

  kode_transaksi: string,          // unique, contoh: TSUB000001
  tahun_fiskal: number,            // contoh: 2026
  periode: string,                 // YYYY-MM, dari tgl_mulai_tagihan

  tgl_mulai_tagihan: string,       // contoh: 2026-01-01
  tgl_berakhir_langganan: string,  // contoh: 2026-01-31
  tgl_bayar_selanjutnya: string,   // contoh: 2026-02-01
  jumlah_bulan: number,            // default 1

  biaya_per_bulan: number,
  jumlah_biaya: number,
  diskon: number,
  diskon_percent: number,
  total_biaya: number,

  status: 'OPEN' | 'PROCESS' | 'LUNAS' | 'BATAL',
  tgl_lunas: string | null,
  jumlah_lunas: number | null,
  metode_bayar: 'MANUAL' | 'DOKU' | null,

  invoice_meta: { ... } | null,
  doku_payment: { ... } | null,
  keterangan: string | null,

  input_date: Date,
  update_date: Date,
  delete_date: Date | null,
  input_by: string,
  update_by: string | null,
  delete_by: string | null
}
```

Index:

```ts
{ chain_id: 1, tgl_mulai_tagihan: 1, delete_date: 1 } unique
{ chain_id: 1, status: 1 }
{ tahun_fiskal: 1, status: 1 }
{ periode: 1 }
{ status: 1, tgl_lunas: 1 }
{ 'invoice_meta.invoice_number': 1 } sparse
{ 'doku_payment.invoice_number': 1 } sparse
```

Catatan status:

- Existing sekarang memakai `OPEN`, `PROCESS`, `DONE`.
- Untuk modul baru saya sarankan `DONE` diganti `LUNAS` agar lebih mudah dibaca di database dan UI.

### 5. `tt_subscription_rekap_tahun`

Rekap tahunan untuk dashboard.

```ts
{
  _id: ObjectId,
  tahun_fiskal: number,

  total_subscriber_aktif: number,
  total_estimasi: number,
  total_lunas: number,
  total_belum_lunas: number,

  total_transaksi_open: number,
  total_transaksi_process: number,
  total_transaksi_lunas: number,
  total_transaksi_batal: number,

  updated_at: Date
}
```

Index:

```ts
{ tahun_fiskal: 1 } unique
```

Catatan:

- Rekap ini bisa dihitung langsung dari `tt_subscription_detail`.
- Kalau data makin besar, rekap disimpan dan di-update setiap transaksi dibuat/lunas/batal.

## Alur Bisnis Baru

### A. Master Group

1. User membuat data di `tm_group`.
2. Field:
   - kode group
   - nama group
   - owner
   - no hp
   - alamat

### B. Master Subscriber

1. User pilih group dari combobox `(kode_group - nama_group)`.
2. FE otomatis menampilkan owner, no hp, alamat.
3. User isi/tambah:
   - toko
   - daerah
   - program
   - biaya
   - server location
   - tgl implementasi
   - tgl dijalankan
4. BE simpan subscriber ke `tm_subscriber`.

### C. Buat Subscription Pertama

1. Dari subscriber, user klik buat subscription.
2. User isi:
   - tgl mulai tagihan
   - jumlah bulan, default 1
   - diskon optional
3. BE membuat:
   - rekap bulanan di `tt_subscription` dari bulan mulai tagihan sampai akhir periode fiskal NOV
   - 1 data tagihan awal di `tt_subscription_detail`
4. Sistem tidak langsung membuat semua detail tagihan. Detail berikutnya baru muncul setelah detail terakhir lunas.

Contoh:

```txt
periode fiskal = DEC 2025 - NOV 2026
tgl_mulai_tagihan = 2026-08-01
jumlah_bulan = 1

tt_subscription dibuat/ditambah:
- 2026-08
- 2026-09
- 2026-10
- 2026-11

tt_subscription_detail dibuat:
- mulai = 2026-08-01
- berakhir = 2026-08-31
- bayar selanjutnya = 2026-09-01
- status = OPEN
```

### D. Generate Invoice / DOKU

1. Transaksi `OPEN` dibuat invoice.
2. Status menjadi `PROCESS`.
3. DOKU payment link mengacu ke data `tt_subscription_detail`.

### E. Pelunasan

1. Pelunasan manual atau DOKU callback sukses.
2. Data detail berubah:

```txt
status = LUNAS
tgl_lunas = tanggal pembayaran aktual
jumlah_lunas = total pembayaran
metode_bayar = MANUAL atau DOKU
```

3. Sistem otomatis membuat detail tagihan berikutnya jika masih dalam periode fiskal yang sama:

```txt
tgl_mulai_tagihan = previous.tgl_bayar_selanjutnya
tgl_berakhir_langganan = hasil hitung periode berikutnya
tgl_bayar_selanjutnya = H+1 dari tgl_berakhir_langganan
status = OPEN
```

4. `tt_subscription` periode detail yang lunas dihitung ulang bagian realisasinya.

## Endpoint Implementasi

### Master Group

Mengikuti pola master existing:

```http
GET    /api/master/group
GET    /api/master/group/options
GET    /api/master/group/:id
POST   /api/master/group
PUT    /api/master/group/:id
DELETE /api/master/group/:id
```

Response options:

```json
[
  {
    "_id": "...",
    "kode_group": "GRP0001",
    "nama_group": "PANTES GROUP",
    "label": "GRP0001 - PANTES GROUP",
    "owner": "Budi",
    "no_hp": "08123456789",
    "alamat": "Bandung"
  }
]
```

### Master Subscriber

Tetap:

```http
GET    /api/subscriber
GET    /api/subscriber/:id
POST   /api/subscriber
PUT    /api/subscriber/:id
DELETE /api/subscriber/:id
```

Query tambahan:

```txt
?group_id=...
?kode_group=GRP0001
?server_location=192.168.23.101
?tahun_implementasi=2026
```

Payload contoh:

```json
{
  "toko": "Subscriber A",
  "group_id": "...",
  "daerah": "Bandung",
  "program": "NAGATECH MEMBER",
  "biaya": 900000,
  "server_location": "192.168.23.101",
  "tgl_implementasi": "2026-01-01",
  "tgl_dijalankan": "2026-01-03"
}
```

### Subscription

```http
GET    /api/subscription
POST   /api/subscription
GET    /api/subscription/detail
GET    /api/subscription/rekap-tahun
POST   /api/subscription/detail/:id/invoice/generate
POST   /api/subscription/detail/:id/doku/payment-link
PATCH  /api/subscription/detail/:id/lunas
GET    /api/subscription/doku/result
POST   /api/subscription/doku/notify
```

Payload create:

```json
{
  "subscriber_id": "...",
  "tgl_mulai_tagihan": "2026-01-01",
  "jumlah_bulan": 1,
  "biaya_per_bulan": 900000
}
```

Query list:

```txt
?status=OPEN|PROCESS|LUNAS|BATAL
?tahun=2026
?subscription_id=...
```

Payload lunas manual:

```json
{
  "tgl_lunas": "2026-01-10",
  "diskon": 0,
  "metode_bayar": "MANUAL",
  "keterangan": "Transfer"
}
```

Response setelah lunas:

```json
{
  "message": "Transaksi subscription berhasil dilunasi",
  "transaksi_lunas": { "...": "..." },
  "transaksi_selanjutnya": {
    "tgl_mulai_tagihan": "2026-02-01",
    "tgl_berakhir_langganan": "2026-02-28",
    "tgl_bayar_selanjutnya": "2026-03-01",
    "status": "OPEN"
  }
}
```

### Dashboard

```http
GET /api/dashboard/subscriber-vps
GET /api/subscription/rekap-tahun?tahun=2026
GET /api/subscription/detail?tahun=2026
```

Rekap response:

```json
{
  "tahun_fiskal": 2026,
  "total_subscriber_aktif": 120,
  "total_estimasi": 1296000000,
  "total_lunas": 540000000,
  "total_belum_lunas": 756000000,
  "transaksi": {
    "open": 80,
    "process": 5,
    "lunas": 60,
    "batal": 0
  }
}
```

Bulanan response:

```json
[
  {
    "periode": "2026-01",
    "label": "JAN-26",
    "total_estimasi": 108000000,
    "total_lunas": 80000000,
    "total_subscriber": 120,
    "total_subscriber_lunas": 88
  }
]
```

## Perubahan Frontend

### Menu

Rekomendasi:

- Dashboard
- Master Data
  - Group
  - Program
  - Rekening Invoice
- Subscriber
- Subscription
  - Transaksi Subscription
- Users

### Master Group Page

Fitur:

- Table group.
- Search by kode group, nama group, owner.
- Form create/update:
  - kode_group
  - nama_group
  - owner
  - no_hp
  - alamat

### Subscriber Page

Tambahan:

- Combobox Group `(kode_group - nama_group)`.
- Auto display owner, no hp, alamat.
- Input `server_location`.
- Input `tgl_implementasi`.
- Input `tgl_dijalankan`.

### Subscription Page

Halaman transaksi resmi bernama `Subscription`.

Default list:

- Tampilkan transaksi aktif saja: `OPEN` dan `PROCESS`.
- Riwayat `LUNAS` bisa dilihat lewat filter.
- Tidak lagi pakai range periode yang memunculkan semua jadwal masa depan.

Kolom utama:

- Subscriber / toko
- Group
- Program
- Server location
- Tgl mulai tagihan
- Tgl berakhir langganan
- Tgl bayar selanjutnya
- Total biaya
- Status
- Action invoice/DOKU/lunas

## Catatan Data Lama

### Subscriber

Mapping:

```txt
tanggal -> tgl_implementasi
tgl_dijalankan -> null
grup -> nama_group sementara
server_location -> null
```

Strategi group:

1. Ambil distinct `grup` dari `tm_subscriber`.
2. Buat data `tm_group` untuk setiap grup non-empty.
3. Update subscriber dengan `group_id`, `kode_group`, `nama_group`.
4. Owner/no hp/alamat group bisa diisi manual setelah migrasi.

Data transaksi lama tidak dipakai oleh runtime aplikasi baru. Jika suatu saat data historis perlu dibawa, prosesnya harus berupa migrasi sekali jalan ke collection resmi `tt_subscription` dan `tt_subscription_detail`, bukan membaca dua collection secara paralel.

## Modul Backend Baru

```txt
src/models/Group.ts
src/models/Subscription.ts
src/models/SubscriptionDetail.ts
src/models/SubscriptionRekapTahun.ts

src/controllers/groupController.ts
src/controllers/subscriptionController.ts
src/controllers/subscriptionDetailController.ts
src/controllers/subscriptionDashboardController.ts

src/routes/groupRoutes.ts
src/routes/subscriptionRoutes.ts
src/routes/subscriptionDetailRoutes.ts
```

Utility:

```txt
src/utils/subscriptionPeriod.ts
```

Isi utility:

- `hitungTglBerakhirLangganan(tglMulaiTagihan, jumlahBulan)`
- `hitungTglBayarSelanjutnya(tglBerakhirLangganan)`
- `getTahunFiskal(tanggal)`
- `getPeriode(tanggal)`
- `buatTransaksiBerikutnya(transaksiLunas)`

## Business Rules

1. Satu subscriber hanya boleh punya satu `tt_subscription_detail` aktif dengan status `OPEN` atau `PROCESS`.
2. `tt_subscription` adalah rekap bulanan, bukan header aktif subscriber.
3. Detail berikutnya hanya dibuat setelah detail sekarang `LUNAS`.
4. `tgl_mulai_tagihan` tidak boleh lebih besar dari `tgl_berakhir_langganan`.
5. `tgl_bayar_selanjutnya` selalu H+1 dari `tgl_berakhir_langganan`.
6. `tgl_lunas` adalah tanggal pembayaran aktual.
7. DOKU callback hanya boleh melunasi transaksi yang statusnya `PROCESS`.
8. Saat membuat subscription baru, estimasi `tt_subscription` langsung digenerate sampai akhir fiscal year NOV.
9. Dashboard tahunan mengikuti fiscal year DEC sampai NOV, seperti pola existing.

## Urutan Implementasi Disarankan

1. Buat Master Group: model, controller, route, halaman FE.
2. Tambah relasi group ke Subscriber.
3. Tambah `server_location`, `tgl_implementasi`, `tgl_dijalankan` ke Subscriber.
4. Buat `tt_subscription` sebagai rekap bulanan.
5. Buat `tt_subscription_detail` sebagai detail tagihan berjalan.
6. Buat create subscription yang mengisi rekap bulanan sampai NOV dan hanya membuat satu detail awal.
7. Buat proses `lunas` yang otomatis membuat tagihan berikutnya.
8. Adapt invoice dan DOKU ke `tt_subscription_detail`.
9. Buat dashboard rekap baru.
10. Ubah menu/label menjadi Subscription.
11. Jika diperlukan, buat script migrasi sekali jalan dari data historis ke `tt_subscription` dan `tt_subscription_detail`.
12. Pastikan runtime aplikasi hanya membaca/menulis collection subscription resmi.

## Open Questions

1. Apakah satu subscriber bisa punya lebih dari satu subscription aktif?
2. Apakah `server_location` wajib IPv4 saja, atau boleh hostname/domain?
3. Kalau master group diedit, subscriber lama harus ikut berubah atau tetap snapshot?
4. Saat DOKU lunas, `tgl_lunas` memakai tanggal transaksi dari DOKU atau tanggal callback diterima?
5. Kalau transaksi dibatalkan, apakah sistem tetap membuat tagihan berikutnya?
6. Dashboard estimasi tahunan menghitung 12 bulan penuh, atau hanya tagihan yang sudah terbentuk?
