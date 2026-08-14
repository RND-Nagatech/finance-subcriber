import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

type AnyDoc = Record<string, any>;
type Candidate = {
  kode_karyawan: string;
  nama_karyawan: string;
  sumber: 'SALES' | 'IMPLEMENTATOR' | 'SALES, IMPLEMENTATOR';
  jumlah_sales: number;
  jumlah_implementator: number;
};
type BulkOperation = { insertOne: { document: AnyDoc } } | { updateOne: { filter: AnyDoc; update: AnyDoc } };

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const UPDATE_EXISTING = args.has('--update-existing');
const INCLUDE_INACTIVE_SUBSCRIBER = !args.has('--active-only');

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
  await mongoose.connect(resolveMongoUri());
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

const isValidCandidate = (kode: string | null, nama: string | null): kode is string => {
  if (!kode || !nama) return false;
  const invalid = new Set(['-', 'N/A', 'NULL', 'NONE', 'KOSONG', 'KOSONGKAN']);
  return !invalid.has(kode) && !invalid.has(nama);
};

const upsertCandidate = (
  map: Map<string, Candidate>,
  kodeRaw: unknown,
  namaRaw: unknown,
  role: 'SALES' | 'IMPLEMENTATOR'
) => {
  const kode = cleanUpper(kodeRaw);
  const nama = cleanUpper(namaRaw);
  if (!isValidCandidate(kode, nama)) return false;

  const current = map.get(kode);
  if (!current) {
    map.set(kode, {
      kode_karyawan: kode,
      nama_karyawan: nama,
      sumber: role,
      jumlah_sales: role === 'SALES' ? 1 : 0,
      jumlah_implementator: role === 'IMPLEMENTATOR' ? 1 : 0,
    });
    return true;
  }

  if (!current.nama_karyawan || current.nama_karyawan === current.kode_karyawan) {
    current.nama_karyawan = nama;
  }
  if (current.sumber !== role) current.sumber = 'SALES, IMPLEMENTATOR';
  if (role === 'SALES') current.jumlah_sales += 1;
  if (role === 'IMPLEMENTATOR') current.jumlah_implementator += 1;
  return true;
};

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  const subscriber = db.collection('tm_subscriber');
  const karyawan = db.collection('tm_karyawan');
  const now = new Date();

  const subscriberFilter = INCLUDE_INACTIVE_SUBSCRIBER ? {} : { status_aktv: { $ne: false }, delete_date: null };
  const rows = await subscriber
    .find(subscriberFilter, {
      projection: {
        kode_sales: 1,
        sales: 1,
        kode_implementator: 1,
        implementator: 1,
      },
    })
    .toArray();

  const candidates = new Map<string, Candidate>();
  let skippedBlank = 0;
  for (const row of rows) {
    if (!upsertCandidate(candidates, row.kode_sales, row.sales, 'SALES')) skippedBlank += 1;
    if (!upsertCandidate(candidates, row.kode_implementator, row.implementator, 'IMPLEMENTATOR')) skippedBlank += 1;
  }

  const activeKaryawanRows = await karyawan.find({ status_aktv: { $ne: false }, delete_date: null }).toArray();
  const deletedKaryawanRows = await karyawan.find({
    $or: [{ status_aktv: false }, { delete_date: { $ne: null } }],
  }).toArray();
  const activeByKode = new Map(activeKaryawanRows.map((row) => [cleanUpper(row.kode_karyawan), row]).filter(([kode]) => Boolean(kode)) as Array<[string, AnyDoc]>);
  const deletedByKode = new Map(deletedKaryawanRows.map((row) => [cleanUpper(row.kode_karyawan), row]).filter(([kode]) => Boolean(kode)) as Array<[string, AnyDoc]>);

  const stats = {
    subscriberRows: rows.length,
    groupedKaryawan: candidates.size,
    skippedBlank,
    wouldInsert: 0,
    wouldReactivate: 0,
    wouldUpdateExisting: 0,
    skippedExisting: 0,
    inserted: 0,
    reactivated: 0,
    updatedExisting: 0,
    examples: {
      insert: [] as Candidate[],
      reactivate: [] as Candidate[],
      updateExisting: [] as Candidate[],
      existing: [] as Candidate[],
    },
  };

  const operations: BulkOperation[] = [];
  for (const candidate of [...candidates.values()].sort((a, b) => a.kode_karyawan.localeCompare(b.kode_karyawan))) {
    const active = activeByKode.get(candidate.kode_karyawan);
    const deleted = deletedByKode.get(candidate.kode_karyawan);

    const setData = {
      nama_karyawan: candidate.nama_karyawan,
      jabatan: null,
      divisi: null,
      no_hp: null,
      email: null,
      update_date: now,
      update_by: 'patch-karyawan-from-subscriber',
    };

    if (active) {
      if (UPDATE_EXISTING) {
        operations.push({
          updateOne: {
            filter: { _id: active._id },
            update: { $set: setData },
          },
        });
        stats.wouldUpdateExisting += 1;
        if (stats.examples.updateExisting.length < 10) stats.examples.updateExisting.push(candidate);
      } else {
        stats.skippedExisting += 1;
        if (stats.examples.existing.length < 10) stats.examples.existing.push(candidate);
      }
      continue;
    }

    if (deleted) {
      operations.push({
        updateOne: {
          filter: { _id: deleted._id },
          update: {
            $set: {
              ...setData,
              status_aktv: true,
              delete_date: null,
              delete_by: null,
            },
          },
        },
      });
      stats.wouldReactivate += 1;
      if (stats.examples.reactivate.length < 10) stats.examples.reactivate.push(candidate);
      continue;
    }

    operations.push({
      insertOne: {
        document: {
          kode_karyawan: candidate.kode_karyawan,
          nama_karyawan: candidate.nama_karyawan,
          jabatan: null,
          divisi: null,
          no_hp: null,
          email: null,
          status_aktv: true,
          input_date: now,
          update_date: now,
          delete_date: null,
          input_by: 'patch-karyawan-from-subscriber',
          update_by: null,
          delete_by: null,
        },
      },
    });
    stats.wouldInsert += 1;
    if (stats.examples.insert.length < 10) stats.examples.insert.push(candidate);
  }

  if (APPLY && operations.length) {
    const result = await karyawan.bulkWrite(operations as any[], { ordered: false });
    stats.inserted = result.insertedCount || 0;
    stats.reactivated = result.modifiedCount || 0;
    stats.updatedExisting = UPDATE_EXISTING ? result.modifiedCount || 0 : 0;
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    source: 'tm_subscriber',
    target: 'tm_karyawan',
    options: {
      includeInactiveSubscriber: INCLUDE_INACTIVE_SUBSCRIBER,
      updateExisting: UPDATE_EXISTING,
    },
    stats,
    note: APPLY
      ? 'Patch dijalankan ke database.'
      : 'Dry-run saja. Jalankan dengan --apply untuk benar-benar insert/reactivate/update.',
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
