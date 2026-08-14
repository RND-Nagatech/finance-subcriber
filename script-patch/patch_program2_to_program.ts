import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { sourceCollection, targetCollection } from './patch_config';

type AnyDoc = Record<string, any>;
type BulkOperation = { insertOne: { document: AnyDoc } } | { updateOne: { filter: AnyDoc; update: AnyDoc } };

const SOURCE_COLLECTION = sourceCollection('tm_program');
const TARGET_COLLECTION = targetCollection('tm_program');
const GROUP_COLLECTION = targetCollection('tm_group_program');

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const UPDATE_EXISTING = args.has('--update-existing');
const INCLUDE_INACTIVE = !args.has('--active-only');
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

const parseDate = (value: unknown): Date | null => {
  if (value === undefined || value === null || value === '') return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const toAuditDate = (value: unknown, fallback = new Date()): Date => parseDate(value) || fallback;

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const isDeleted = (row: AnyDoc): boolean => {
  return Boolean(parseDate(row.delete_date) || row.status_aktv === false || row.active === false);
};

function normalizeGroupProgram(groupProgram: unknown, now: Date) {
  const group_program = cleanUpper(groupProgram);
  if (!group_program) return null;
  return {
    group_program,
    status_aktv: true,
    input_date: now,
    update_date: now,
    delete_date: null,
    input_by: 'patch-program2-to-program',
    update_by: null,
    delete_by: null,
  };
}

function normalizeProgram(row: AnyDoc, now: Date) {
  const nama = cleanUpper(row.nama);
  const kode = cleanUpper(row.kode);
  const internal_kode = cleanUpper(row.internal_kode);
  const group_program = cleanUpper(row.group_program);
  const biaya = toNumber(row.biaya, NaN);

  const missing = [
    !nama ? 'nama' : null,
    !kode ? 'kode' : null,
    !internal_kode ? 'internal_kode' : null,
    !group_program ? 'group_program' : null,
    !Number.isFinite(biaya) ? 'biaya' : null,
  ].filter(Boolean);

  if (missing.length) {
    return {
      ok: false as const,
      reason: `field wajib kosong/tidak valid: ${missing.join(', ')}`,
    };
  }

  const deleteDate = parseDate(row.delete_date);
  const deleted = isDeleted(row);
  const doc: AnyDoc = {
    nama,
    kode,
    internal_kode,
    biaya,
    group_program,
    total_subscriber: toNumber(row.total_subscriber, 0),
    total_biaya_subscriber: toNumber(row.total_biaya_subscriber, 0),
    status_aktv: !deleted,
    input_date: toAuditDate(row.input_date, now),
    update_date: toAuditDate(row.update_date, now),
    delete_date: deleteDate,
    input_by: cleanString(row.input_by) || 'patch-program2-to-program',
    update_by: cleanString(row.update_by),
    delete_by: cleanString(row.delete_by),
  };

  if (PRESERVE_ID && row._id) doc._id = row._id;

  return { ok: true as const, doc, meta: { deleted } };
}

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  const source = db.collection(SOURCE_COLLECTION);
  const target = db.collection(TARGET_COLLECTION);
  const groupTarget = db.collection(GROUP_COLLECTION);
  const now = new Date();
  console.log(`📦 Source: ${SOURCE_COLLECTION} -> Target: ${TARGET_COLLECTION}`);

  const sourceFilter = INCLUDE_INACTIVE ? {} : { status_aktv: { $ne: false }, delete_date: null };
  const sourceRows = await source.find(sourceFilter).toArray();

  const groupRows = await groupTarget.find({}, { projection: { _id: 1, group_program: 1, status_aktv: 1, delete_date: 1 } }).toArray();
  const groupByName = new Map(groupRows.map((row) => [cleanUpper(row.group_program), row]).filter(([name]) => Boolean(name)) as Array<[string, AnyDoc]>);

  const targetRows = await target.find({}, { projection: { _id: 1, kode: 1, nama: 1, delete_date: 1, status_aktv: 1 } }).toArray();
  const targetByKode = new Map(targetRows.map((row) => [cleanUpper(row.kode), row]).filter(([kode]) => Boolean(kode)) as Array<[string, AnyDoc]>);
  const targetByNama = new Map(targetRows.map((row) => [cleanUpper(row.nama), row]).filter(([nama]) => Boolean(nama)) as Array<[string, AnyDoc]>);
  const targetIds = new Set(targetRows.map((row) => String(row._id)));

  const stats = {
    source: sourceRows.length,
    groupProgram: {
      uniqueFromSource: 0,
      wouldInsert: 0,
      wouldReactivate: 0,
      skippedExisting: 0,
      inserted: 0,
      reactivated: 0,
    },
    program: {
      wouldInsert: 0,
      wouldUpdate: 0,
      skippedExisting: 0,
      skippedInvalid: 0,
      skippedIdConflict: 0,
      deletedRowsIncluded: 0,
      inserted: 0,
      updated: 0,
    },
    invalidExamples: [] as Array<{ kode?: unknown; nama?: unknown; reason: string }>,
    existingExamples: [] as Array<{ kode: string; nama: string; target_id?: string }>,
  };

  const groupOperations: BulkOperation[] = [];
  const uniqueGroups = new Map<string, AnyDoc>();
  for (const row of sourceRows) {
    const normalized = normalizeGroupProgram(row.group_program, now);
    if (normalized) uniqueGroups.set(normalized.group_program, normalized);
  }
  stats.groupProgram.uniqueFromSource = uniqueGroups.size;

  for (const group of uniqueGroups.values()) {
    const existingGroup = groupByName.get(group.group_program);
    if (!existingGroup) {
      groupOperations.push({ insertOne: { document: group } });
      stats.groupProgram.wouldInsert += 1;
      continue;
    }

    if (existingGroup.status_aktv === false || existingGroup.delete_date) {
      groupOperations.push({
        updateOne: {
          filter: { _id: existingGroup._id },
          update: {
            $set: {
              status_aktv: true,
              delete_date: null,
              delete_by: null,
              update_date: now,
              update_by: 'patch-program2-to-program',
            },
          },
        },
      });
      stats.groupProgram.wouldReactivate += 1;
      continue;
    }

    stats.groupProgram.skippedExisting += 1;
  }

  const programOperations: BulkOperation[] = [];
  for (const row of sourceRows) {
    const normalized = normalizeProgram(row, now);
    if (!normalized.ok) {
      stats.program.skippedInvalid += 1;
      if (stats.invalidExamples.length < 20) {
        stats.invalidExamples.push({ kode: row.kode, nama: row.nama, reason: normalized.reason });
      }
      continue;
    }

    const doc = normalized.doc;
    if (normalized.meta.deleted) stats.program.deletedRowsIncluded += 1;

    const existingByKode = targetByKode.get(doc.kode);
    const existingByNama = targetByNama.get(doc.nama);
    const existing = existingByKode || existingByNama;

    if (existing && !UPDATE_EXISTING) {
      stats.program.skippedExisting += 1;
      if (stats.existingExamples.length < 20) {
        stats.existingExamples.push({ kode: doc.kode, nama: doc.nama, target_id: String(existing._id) });
      }
      continue;
    }

    if (!existing && doc._id && targetIds.has(String(doc._id))) {
      stats.program.skippedIdConflict += 1;
      continue;
    }

    if (existing && UPDATE_EXISTING) {
      const { _id, kode, ...set } = doc;
      programOperations.push({
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: set },
        },
      });
      stats.program.wouldUpdate += 1;
      continue;
    }

    programOperations.push({ insertOne: { document: doc } });
    stats.program.wouldInsert += 1;
  }

  if (APPLY) {
    if (groupOperations.length) {
      const result = await groupTarget.bulkWrite(groupOperations as any[], { ordered: false });
      stats.groupProgram.inserted = result.insertedCount || 0;
      stats.groupProgram.reactivated = result.modifiedCount || 0;
    }
    if (programOperations.length) {
      const result = await target.bulkWrite(programOperations as any[], { ordered: false });
      stats.program.inserted = result.insertedCount || 0;
      stats.program.updated = result.modifiedCount || 0;
    }
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    source: SOURCE_COLLECTION,
    target: TARGET_COLLECTION,
    groupTarget: GROUP_COLLECTION,
    options: {
      includeInactive: INCLUDE_INACTIVE,
      updateExisting: UPDATE_EXISTING,
      preserveId: PRESERVE_ID,
    },
    stats,
    removedLegacyFields: ['active', 'deleted_at', 'deleted_by', '__v'],
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
