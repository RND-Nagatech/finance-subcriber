# Script Patch Data

Script di folder ini mendukung dua mode:

- `dry-run`: default, hanya analisa dan tampilkan rencana.
- `apply`: jalankan perubahan dengan argumen `--apply`.

## Konsep Collection

Untuk database development sekarang:

```bash
PATCH_SOURCE_SUFFIX=2
PATCH_TARGET_SUFFIX=
```

Contoh source/target:

- `tm_subscriber2` -> `tm_subscriber`
- `tm_program2` -> `tm_program`
- `tt_subscription_detail2` -> `tt_subscription_detail`

Untuk database asli, rename dulu collection lama menjadi source legacy:

- `tm_subscriber` -> `tm_subscriber_legacy`
- `tm_program` -> `tm_program_legacy`
- `tt_subscription_detail` -> `tt_subscription_detail_legacy`

Lalu jalankan patch dengan:

```bash
PATCH_SOURCE_SUFFIX=_legacy
PATCH_TARGET_SUFFIX=
```

Hasil akhirnya tetap masuk ke collection normal project baru:

- `tm_subscriber`
- `tm_program`
- `tm_group`
- `tm_karyawan`
- `tt_subscription_detail`
- `tt_subscription`
- `tt_subscriber_tahun`

## Jalankan Semua Berurutan

Dry-run:

```bash
./script-patch/run-patch-all.sh --source-suffix=2
```

Apply:

```bash
./script-patch/run-patch-all.sh --source-suffix=2 --apply
```

Untuk database asli setelah rename legacy:

```bash
./script-patch/run-patch-all.sh --source-suffix=_legacy --apply
```

Urutan runner:

1. Master Program
2. Master Subscriber
3. Master Karyawan dari Subscriber
4. Master Group Toko dari Subscriber
5. Subscription Detail, Rekap Bulanan, dan Subscriber Tahun

## Jalankan Per Script

Setiap script tetap bisa dijalankan sendiri, misalnya:

```bash
./script-patch/run-patch-subscriber2.sh --source-suffix=_legacy --apply
```

Argumen penting:

- `--source-suffix=...`: suffix collection source lama, default `2`.
- `--target-suffix=...`: suffix collection target baru, default kosong.
- `--source-tm_program=...`: nama collection source program eksplisit.
- `--target-tm_program=...`: nama collection target program eksplisit.
- `--source-tm_subscriber=...`: nama collection source subscriber eksplisit.
- `--target-tm_subscriber=...`: nama collection target subscriber eksplisit.
- `--source-tt_subscription_detail=...`: nama collection source subscription detail eksplisit.
- `--target-tt_subscription_detail=...`: nama collection target subscription detail eksplisit.
- `--target-tt_subscription=...`: nama collection rekap bulanan yang otomatis dibuat dari detail.
- `--target-tt_subscriber_tahun=...`: nama collection rekap tahunan subscriber yang otomatis dibuat dari detail.
- `--apply`: menjalankan patch. Tanpa ini hanya dry-run.
- `--replace-target`: hanya dipakai script subscription untuk rebuild total target detail/rekap.

Kalau collection target belum ada, MongoDB akan membuat collection saat script pertama kali insert/upsert.
