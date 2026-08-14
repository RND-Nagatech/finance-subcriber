import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

type AnyDoc = Record<string, any>;
type BulkOperation = { insertOne: { document: AnyDoc } } | { updateOne: { filter: AnyDoc; update: AnyDoc } };

const SOURCE_COLLECTION = 'tm_subscriber2';
const TARGET_COLLECTION = 'tm_subscriber';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const INCLUDE_DELETED = !args.has('--active-only');
const UPDATE_EXISTING = args.has('--update-existing');
const PRESERVE_ID = !args.has('--new-id');

const resolveMongoUri = (): string => {
  if (process.env.MONGO_URI) return process.env.MONGO_URI;
  const envPath = path.resolve(__dirname, '../new-be/.env');
  if (fs.existsSync(envPath)) {
    const envText = fs.readFileSync(envPath, 'utf8');
    const line = envText.split(/\r?\n/).find((row) => row.trim().startsWith('MONGO_URI='));
    const value = line?.replace(/^MONGO_URI=/, '').trim().replace(/^['"]|['"]$/g, '');
    if (value) return value;
  }
  return 'mongodb://localhost:27017/db_finance';
};

const connectDB = async () => {
  const mongoUri = resolveMongoUri();
  await mongoose.connect(mongoUri);
  console.log(`✅ MongoDB connected successfully to: ${mongoose.connection.name}`);
};

const cleanString = (value: unknown): string | null => {
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text ? text : null;
};

const cleanUpper = (value: unknown): string | null => {
  const text = cleanString(value);
  return text ? text.toUpperCase() : null;
};

const parseDate = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toYMD = (value: unknown): string | null => {
  const date = parseDate(value);
  if (!date) return null;
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const toAuditDate = (value: unknown, fallback = new Date()): Date => {
  return parseDate(value) || fallback;
};

const isUrlLike = (value: unknown): boolean => {
  return /^https?:\/\//i.test(String(value || '').trim());
};

const normalizeVia = (value: unknown): 'VISIT' | 'ONLINE' => {
  const text = cleanUpper(value);
  return text === 'ONLINE' ? 'ONLINE' : 'VISIT';
};

const normalizeGender = (value: unknown): 'LAKI-LAKI' | 'PEREMPUAN' | null => {
  const text = cleanUpper(value);
  if (text === 'LAKI-LAKI' || text === 'PEREMPUAN') return text;
  return null;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

function normalizeLegacySubscriber(
  row: AnyDoc,
  karyawanByName: Map<string, string>,
  programGroupByProgramName: Map<string, string>,
  now: Date
) {
  const kode = cleanString(row.kode);
  const toko = cleanUpper(row.toko);
  const daerah = cleanUpper(row.daerah) || 'TANPA DAERAH';
  const program = cleanUpper(row.program);
  const tanggal = toYMD(row.tanggal);
  const deleteDate = parseDate(row.delete_date);
  // Field legacy `active` di tm_subscriber2 tidak reliable: delete lama hanya
  // mengubah status_aktv/delete_date, sementara active sering tetap true.
  const isDeleted = Boolean(deleteDate || row.status_aktv === false);

  if (!kode || !toko || !program) {
    return {
      ok: false as const,
      reason: `field wajib kosong: ${[
        !kode ? 'kode' : null,
        !toko ? 'toko' : null,
        !program ? 'program' : null,
      ].filter(Boolean).join(', ')}`,
    };
  }

  const rawNoOk = cleanString(row.no_ok);
  const rawDomain = cleanString(row.domain);
  const noOkLooksLikeUrl = isUrlLike(rawNoOk);
  const domain = rawDomain || (noOkLooksLikeUrl ? rawNoOk : null);
  const sales = cleanUpper(row.sales);
  const implementator = cleanUpper(row.implementator);
  const mappedKodeSales = sales ? karyawanByName.get(sales) || null : null;
  const mappedKodeImplementator = implementator ? karyawanByName.get(implementator) || null : null;
  const legacyNamaGroup = cleanUpper(row.grup);
  const mappedGroupProgram = programGroupByProgramName.get(program) || null;

  const normalized: AnyDoc = {
    kode,
    group_id: null,
    kode_group: null,
    nama_group: legacyNamaGroup,
    no_ok: noOkLooksLikeUrl ? null : rawNoOk,
    nomor_telepon: cleanString(row.nomor_telepon),
    kode_sales: sales ? (mappedKodeSales || sales) : null,
    sales,
    nama_owner: cleanUpper(row.nama_owner),
    no_hp_owner: cleanString(row.no_hp_owner),
    gender_owner: normalizeGender(row.gender_owner),
    nama_pic: cleanUpper(row.nama_pic),
    no_hp_pic: cleanString(row.no_hp_pic),
    gender_pic: normalizeGender(row.gender_pic),
    toko,
    grup: mappedGroupProgram,
    domain,
    server_location: cleanString(row.server_location),
    alamat: cleanUpper(row.alamat),
    daerah,
    program,
    vb_online: cleanString(row.vb_online),
    biaya: toNumber(row.biaya, 0),
    tanggal,
    tgl_implementasi: tanggal,
    tgl_dijalankan: null,
    tgl_terbayar: null,
    tgl_berakhir_langganan: null,
    tgl_bayar_selanjutnya: null,
    kode_implementator: implementator ? (mappedKodeImplementator || implementator) : null,
    implementator,
    via: normalizeVia(row.via),
    internal_kode: cleanUpper(row.internal_kode) || '-',
    prev_subscriber: toNumber(row.prev_subscriber, 0),
    current_subscriber: toNumber(row.current_subscriber, 1),
    prev_biaya: toNumber(row.prev_biaya, 0),
    current_biaya: toNumber(row.current_biaya, toNumber(row.biaya, 0)),
    status_subscriber: isDeleted ? 'NON_AKTIF' : 'AKTIF',
    tgl_non_aktif: deleteDate ? toYMD(deleteDate) : null,
    alasan_non_aktif: isDeleted ? 'MIGRASI DATA LAMA: DATA TERHAPUS/NON AKTIF DI PROJECT LAMA' : null,
    status_aktv: !isDeleted,
    input_date: toAuditDate(row.input_date, now),
    update_date: toAuditDate(row.update_date, now),
    delete_date: deleteDate,
    deleted_at: parseDate(row.deleted_at),
    input_by: cleanString(row.input_by) || 'migration',
    update_by: cleanString(row.update_by),
    delete_by: cleanString(row.delete_by),
    deleted_by: cleanString(row.deleted_by),
  };

  if (PRESERVE_ID && row._id) {
    normalized._id = row._id;
  }

  return {
    ok: true as const,
    doc: normalized,
    meta: {
      noOkMovedToDomain: Boolean(noOkLooksLikeUrl),
      salesMapped: Boolean(mappedKodeSales),
      implementatorMapped: Boolean(mappedKodeImplementator),
      salesFallbackToName: Boolean(sales && !mappedKodeSales),
      implementatorFallbackToName: Boolean(implementator && !mappedKodeImplementator),
      groupProgramMapped: Boolean(mappedGroupProgram),
      groupProgramFallbackToLegacyGroup: Boolean(!mappedGroupProgram && legacyNamaGroup),
      isDeleted,
      legacyActiveIgnored: row.active !== undefined,
      legacyActiveConflict: row.active === true && (row.status_aktv === false || Boolean(deleteDate)),
    },
  };
}

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  const source = db.collection(SOURCE_COLLECTION);
  const target = db.collection(TARGET_COLLECTION);
  const karyawan = await db.collection('tm_karyawan')
    .find({ status_aktv: { $ne: false }, delete_date: null })
    .project({ kode_karyawan: 1, nama_karyawan: 1 })
    .toArray();
  const karyawanByName = new Map(
    karyawan
      .map((row) => [cleanUpper(row.nama_karyawan), cleanUpper(row.kode_karyawan)] as const)
      .filter(([name, kode]) => Boolean(name && kode)) as Array<[string, string]>
  );
  const programRows = [
    ...await db.collection('tm_program')
      .find({ status_aktv: { $ne: false }, delete_date: null })
      .project({ nama: 1, group_program: 1 })
      .toArray(),
    ...await db.collection('tm_program2')
      .find({})
      .project({ nama: 1, group_program: 1 })
      .toArray(),
  ];
  const programGroupByProgramName = new Map(
    programRows
      .map((row) => [cleanUpper(row.nama), cleanUpper(row.group_program)] as const)
      .filter(([name, groupProgram]) => Boolean(name && groupProgram)) as Array<[string, string]>
  );

  const sourceRows = await source.find(INCLUDE_DELETED ? {} : { status_aktv: { $ne: false }, delete_date: null }).toArray();
  const targetByKode = new Map<string, AnyDoc>();
  const targetRows = await target.find({}, { projection: { _id: 1, kode: 1 } }).toArray();
  for (const row of targetRows) {
    const kode = cleanString(row.kode);
    if (kode) targetByKode.set(kode, row);
  }

  const now = new Date();
  const stats = {
    source: sourceRows.length,
    wouldInsert: 0,
    wouldUpdate: 0,
    inserted: 0,
    updated: 0,
    skippedExisting: 0,
    skippedInvalid: 0,
    skippedIdConflict: 0,
    skippedDeletedByFlag: INCLUDE_DELETED ? 0 : undefined,
    noOkMovedToDomain: 0,
    salesMapped: 0,
    salesFallbackToName: 0,
    implementatorMapped: 0,
    implementatorFallbackToName: 0,
    groupProgramMapped: 0,
    groupProgramFallbackToLegacyGroup: 0,
    deletedRowsIncluded: 0,
    legacyActiveIgnored: 0,
    legacyActiveConflict: 0,
    invalidExamples: [] as Array<{ kode?: unknown; toko?: unknown; reason: string }>,
    existingExamples: [] as Array<{ kode: string; legacy_toko?: string; target_id?: string }>,
  };

  const operations: BulkOperation[] = [];
  const targetIds = new Set(targetRows.map((row) => String(row._id)));

  for (const row of sourceRows) {
    const normalized = normalizeLegacySubscriber(row, karyawanByName, programGroupByProgramName, now);
    if (!normalized.ok) {
      stats.skippedInvalid += 1;
      if (stats.invalidExamples.length < 20) {
        stats.invalidExamples.push({ kode: row.kode, toko: row.toko, reason: normalized.reason });
      }
      continue;
    }

    const doc = normalized.doc;
    if (normalized.meta.noOkMovedToDomain) stats.noOkMovedToDomain += 1;
    if (normalized.meta.salesMapped) stats.salesMapped += 1;
    if (normalized.meta.salesFallbackToName) stats.salesFallbackToName += 1;
    if (normalized.meta.implementatorMapped) stats.implementatorMapped += 1;
    if (normalized.meta.implementatorFallbackToName) stats.implementatorFallbackToName += 1;
    if (normalized.meta.groupProgramMapped) stats.groupProgramMapped += 1;
    if (normalized.meta.groupProgramFallbackToLegacyGroup) stats.groupProgramFallbackToLegacyGroup += 1;
    if (normalized.meta.isDeleted) stats.deletedRowsIncluded += 1;
    if (normalized.meta.legacyActiveIgnored) stats.legacyActiveIgnored += 1;
    if (normalized.meta.legacyActiveConflict) stats.legacyActiveConflict += 1;

    const existing = targetByKode.get(doc.kode);
    if (existing && !UPDATE_EXISTING) {
      stats.skippedExisting += 1;
      if (stats.existingExamples.length < 20) {
        stats.existingExamples.push({ kode: doc.kode, legacy_toko: doc.toko, target_id: String(existing._id) });
      }
      continue;
    }

    if (!existing && doc._id && targetIds.has(String(doc._id))) {
      stats.skippedIdConflict += 1;
      continue;
    }

    if (existing && UPDATE_EXISTING) {
      const { _id, kode, ...set } = doc;
      operations.push({
        updateOne: {
          filter: { kode: doc.kode },
          update: { $set: set, $unset: { active: '' } },
        },
      });
      stats.wouldUpdate += 1;
    } else {
      operations.push({ insertOne: { document: doc } });
      stats.wouldInsert += 1;
    }
  }

  if (APPLY && operations.length) {
    const result = await target.bulkWrite(operations as any[], { ordered: false });
    stats.inserted = result.insertedCount || 0;
    stats.updated = result.modifiedCount || 0;
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    source: SOURCE_COLLECTION,
    target: TARGET_COLLECTION,
    options: {
      includeDeleted: INCLUDE_DELETED,
      updateExisting: UPDATE_EXISTING,
      preserveId: PRESERVE_ID,
    },
    stats,
    note: APPLY
      ? 'Patch dijalankan ke database.'
      : 'Dry-run saja. Jalankan dengan --apply untuk benar-benar insert/update.',
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await mongoose.disconnect();
  });
