# Panduan Migrasi Collection

Dokumen ini menjelaskan collection apa saja yang perlu dibawa dari database lama ke project `finance-subcriber`, bagaimana mapping-nya ke collection baru, dan bagaimana cara mengisi konfigurasi di menu **Maintenance Patch Data**.

## Prinsip Utama

- Data lama jangan langsung ditulis ke collection final tanpa proses patch.
- Collection lama disalin atau di-rename dulu menjadi collection source dengan suffix `2`.
- Collection final tetap memakai nama normal project baru, misalnya `tm_subscriber`, `tm_program`, dan `tt_subscription_detail`.
- Rekap bulanan dan tahunan tidak diambil mentah dari project lama. Keduanya dihitung ulang dari `tt_subscription_detail`.
- Jalankan **Dry Run** dulu sebelum **Apply Patch**.
- Data subscription yang tidak ketemu relasi subscriber akan masuk sebagai `UNVERIFIED` dan tidak ikut rekap sampai diverifikasi dari menu Patch Data.

## Collection Source Yang Wajib Disiapkan

Tabel ini mengikuti default yang dipakai di menu **Maintenance Patch Data**, yaitu source memakai suffix `2`.

### Source Yang Diproses Dari Menu Patch Data

| Data | Collection lama asli | Source di menu Patch Data | Target final |
| --- | --- | --- | --- |
| Master Program | `tm_program` | `tm_program2` | `tm_program` |
| Master Subscriber | `tm_subscriber` | `tm_subscriber2` | `tm_subscriber` |
| Detail Subscription | `tt_subscription_detail` atau detail VPS lama | `tt_subscription_detail2` | `tt_subscription_detail` |

Copy atau rename collection lama ke nama source yang memakai suffix `2`, supaya isi di UI Patch Data tetap sama:

| Collection lama asli | Copy/rename menjadi |
| --- | --- |
| `tm_program` | `tm_program2` |
| `tm_subscriber` | `tm_subscriber2` |
| `tt_subscription_detail` | `tt_subscription_detail2` |

Jika nama detail lama bukan `tt_subscription_detail`, misalnya masih bernama `tt_vps_detail`, copy atau rename dulu menjadi `tt_subscription_detail2`.

### Master Pendukung Yang Juga Wajib Disiapkan

Collection berikut diperlukan untuk operasional subscription, terutama saat generate invoice dan memilih rekening pembayaran. Saat ini collection ini belum diproses oleh menu Patch Data utama, jadi siapkan di target dengan import manual, input dari menu master, atau script terpisah jika datanya banyak.

| Data | Collection lama | Source jika ingin backup suffix `2` | Target final | Dipakai untuk |
| --- | --- | --- | --- | --- |
| Master Perusahaan | `tm_perusahaan` | `tm_perusahaan2` | `tm_perusahaan` | Identitas perusahaan pada invoice/dokumen. |
| Master Bank | `tm_bank` | `tm_bank2` | `tm_bank` | Referensi bank. |
| Master Rekening | `tm_rekening` | `tm_rekening2` | `tm_rekening` | Pilihan rekening pembayaran subscription. |

## Collection Yang Dibuat Dari Proses Patch

| Collection final | Dibuat dari | Keterangan |
| --- | --- | --- |
| `tm_program` | `tm_program2` | Struktur program disesuaikan dengan project baru. |
| `tm_group_program` | Data group program dari program lama | Dibuat/di-upsert otomatis saat patch program. |
| `tm_subscriber` | `tm_subscriber2` | Master subscriber final untuk menu Subscriber dan Subscriber Outstand. |
| `tm_karyawan` | Field sales dan implementator dari `tm_subscriber` hasil patch | Dipakai sebagai dropdown Sales dan Implementator. |
| `tm_group` | Field `nama_group` dan data PIC/owner dari `tm_subscriber` hasil patch | Master Group Toko. |
| `tt_subscription_detail` | `tt_subscription_detail2` | Sumber transaksi utama subscription. |
| `tt_subscription` | Hasil hitung ulang dari `tt_subscription_detail` | Rekap bulanan untuk dashboard. |
| `tt_subscriber_tahun` | Hasil hitung ulang dari `tt_subscription_detail` | Summary tahunan per subscriber. |

## Collection Yang Tidak Perlu Diimpor Mentah

| Collection lama | Perlakuan |
| --- | --- |
| `tt_vps` / rekap bulanan lama | Tidak perlu dimigrasi ke `tt_subscription`. Gunakan hanya sebagai pembanding audit karena `tt_subscription` dihitung ulang dari detail. |
| Rekap tahunan lama | Tidak perlu dimigrasi. `tt_subscriber_tahun` dihitung ulang dari detail. |
| Collection history/array rekap lama | Tidak dipakai, supaya tidak membawa selisih lama ke sistem baru. |

## Collection Pendukung Lain Yang Perlu Dicek

Collection berikut tidak termasuk patch utama subscriber-subscription. Siapkan jika dibutuhkan oleh fitur terkait.

| Collection | Keterangan |
| --- | --- |
| `tm_user` | User aplikasi. Migrasikan hanya jika akun lama memang ingin dipakai lagi. |
| `fiscalconfigs` | Tahun fiskal aktif, contoh `{ key: "fiscal", active_year: 2026 }`. |
| `invoice_counters` | Counter nomor invoice. Migrasikan hanya jika nomor invoice lama harus dilanjutkan. Kalau tidak, sistem akan membuat counter baru saat generate invoice. |

## Cara Pakai Di Menu Patch Data

Menu:

```text
Maintenance Patch Data
```

Mode yang tersedia:

| Mode | Kapan dipakai |
| --- | --- |
| Semua Data | Patch lengkap dari program, subscriber, karyawan, group toko, subscription detail, rekap bulanan, dan rekap tahunan. |
| Subscription Saja | Patch ulang subscription detail dan rebuild rekap, tanpa patch ulang master program/subscriber. |

### Contoh Default Untuk Menu Patch Data

Isi field seperti ini:

| Field | Isi |
| --- | --- |
| Program - Collection Awal | `tm_program2` |
| Program - Target Collection | `tm_program` |
| Subscriber - Collection Awal | `tm_subscriber2` |
| Subscriber - Target Collection | `tm_subscriber` |
| Subscription Detail - Collection Awal | `tt_subscription_detail2` |
| Subscription Detail - Target Collection | `tt_subscription_detail` |
| Rekap Bulanan | `tt_subscription` |
| Rekap Subscriber Tahunan | `tt_subscriber_tahun` |

## Checkbox Patch Data

### Kosongkan Target Subscription Sebelum Apply

Gunakan checkbox ini saat ingin patch ulang subscription dari awal.

Efeknya:

- target `tt_subscription_detail` dikosongkan sesuai scope patch;
- target `tt_subscription` dihitung ulang;
- target `tt_subscriber_tahun` dihitung ulang;
- mencegah data subscription double saat patch diulang.

Untuk database penting, lakukan **Dry Run** dulu, lalu aktifkan checkbox ini hanya jika memang ingin mengganti hasil patch subscription sebelumnya.

### Isi Gap Lama Sebagai Nonaktif

Gunakan hanya kalau hasil **Dry Run** menunjukkan gap periode lama yang memang perlu ditutup sebagai periode nonaktif.

Efeknya:

- sistem membuat marker nonaktif untuk periode yang hilang;
- marker ini tidak dihitung ke estimasi/realisasi;
- tujuannya hanya menjaga riwayat agar tanggal tidak terlihat loncat.

## Urutan Patch Aman

1. Backup database.
2. Rename/copy collection lama menjadi collection source dengan suffix `2`.
3. Buka menu **Maintenance Patch Data**.
4. Isi collection awal dan target sesuai tabel di atas.
5. Jalankan **Dry Run**.
6. Cek hasil statistik, gap, dan data `UNVERIFIED`.
7. Jalankan **Apply Patch**.
8. Verifikasi data subscription yang `UNVERIFIED` dari section verifikasi di menu Patch Data.
9. Pastikan `tm_perusahaan`, `tm_bank`, dan `tm_rekening` sudah tersedia sebelum generate invoice atau proses pembayaran subscription.
10. Cek menu Subscriber, Subscriber Outstand, Subscription, dan Dashboard.

## Aturan Khusus Subscription

- `tt_subscription_detail` adalah sumber kebenaran transaksi.
- `tt_subscription` selalu dihitung ulang dari detail, bukan menambah/mengurangi angka manual.
- `tt_subscriber_tahun` juga dihitung ulang dari detail.
- Data `UNVERIFIED` tidak ikut rekap bulanan dan tahunan.
- Data nonaktif lama tetap bisa dipatch sebagai marker nonaktif, tetapi tidak dihitung sebagai estimasi/realisasi.
- Dari data lama yang dulu tergenerate satu periode penuh, patch hanya menyisakan tagihan berjalan yang relevan agar tidak ada banyak `OPEN` sekaligus untuk subscriber yang sama.
- Jika ada selisih angka, solusi resminya adalah rebuild dari detail, bukan edit angka rekap manual.

## Checklist Setelah Migrasi

- `tm_program` sudah berisi program aktif dengan group program yang benar.
- `tm_group_program` sudah terisi.
- `tm_subscriber` sudah berisi subscriber dengan `kode_group`, `nama_group`, `kode_sales`, dan `kode_implementator`.
- `tm_group` sudah berisi Group Toko hasil grouping dari subscriber.
- `tm_karyawan` sudah berisi sales dan implementator dari data subscriber.
- `tm_perusahaan`, `tm_bank`, dan `tm_rekening` sudah tersedia untuk invoice dan pilihan rekening pembayaran.
- `tt_subscription_detail` tidak memiliki relasi subscriber yang salah.
- Data `UNVERIFIED` sudah dicek dan diverifikasi manual jika diperlukan.
- `tt_subscription` sudah sesuai hasil rebuild detail.
- `tt_subscriber_tahun` jumlahnya wajar, yaitu maksimal satu dokumen per subscriber per tahun.
- Dashboard dan menu subscription membaca angka dari collection baru.
