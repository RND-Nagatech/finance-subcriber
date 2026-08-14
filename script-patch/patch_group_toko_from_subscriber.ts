import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';
import { targetCollection } from './patch_config';

type AnyDoc = Record<string, any>;
type BulkOperation =
  | { insertOne: { document: AnyDoc } }
  | { updateOne: { filter: AnyDoc; update: AnyDoc } }
  | { updateMany: { filter: AnyDoc; update: AnyDoc } };

type GroupCandidate = {
  _id: mongoose.Types.ObjectId;
  kode_group: string;
  nama_group: string;
  rawNames: Set<string>;
  sourceSubscriberKode: string | null;
  subscriberCount: number;
  activeSubscriberCount: number;
  owner: string;
  no_hp: string;
  nama_owner: string | null;
  no_hp_owner: string | null;
  gender_owner: 'LAKI-LAKI' | 'PEREMPUAN' | null;
  nama_pic: string | null;
  no_hp_pic: string | null;
  gender_pic: 'LAKI-LAKI' | 'PEREMPUAN' | null;
  alamat: string | null;
};

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

const normalizeGender = (value: unknown): 'LAKI-LAKI' | 'PEREMPUAN' | null => {
  const text = cleanUpper(value);
  if (text === 'LAKI-LAKI' || text === 'PEREMPUAN') return text;
  return null;
};

const parseDate = (value: unknown): Date | null => {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? null : date;
};

const completenessScore = (row: AnyDoc): number => {
  return [
    row.nama_owner,
    row.no_hp_owner,
    row.gender_owner,
    row.nama_pic,
    row.no_hp_pic,
    row.gender_pic,
    row.alamat,
  ].reduce((score, value) => score + (cleanString(value) ? 1 : 0), 0);
};

const compareRows = (a: AnyDoc, b: AnyDoc): number => {
  const activeA = a.status_aktv === false || a.status_subscriber === 'NON_AKTIF' ? 0 : 1;
  const activeB = b.status_aktv === false || b.status_subscriber === 'NON_AKTIF' ? 0 : 1;
  if (activeA !== activeB) return activeB - activeA;

  const scoreDiff = completenessScore(b) - completenessScore(a);
  if (scoreDiff !== 0) return scoreDiff;

  const dateA = parseDate(a.update_date)?.getTime() || parseDate(a.input_date)?.getTime() || 0;
  const dateB = parseDate(b.update_date)?.getTime() || parseDate(b.input_date)?.getTime() || 0;
  return dateB - dateA;
};

const getNextKodeFactory = (existingRows: AnyDoc[]) => {
  const used = new Set(existingRows.map((row) => cleanUpper(row.kode_group)).filter(Boolean) as string[]);
  let max = 0;
  for (const kode of used) {
    const match = /^GRP(\d+)$/i.exec(kode);
    if (match) max = Math.max(max, Number(match[1]) || 0);
  }

  return () => {
    let kode = '';
    do {
      max += 1;
      kode = `GRP${String(max).padStart(4, '0')}`;
    } while (used.has(kode));
    used.add(kode);
    return kode;
  };
};

const buildCandidate = (namaGroup: string, rows: AnyDoc[], kodeGroup: string, id?: mongoose.Types.ObjectId): GroupCandidate => {
  const sorted = [...rows].sort(compareRows);
  const source = sorted[0] || {};
  const nama_owner = cleanUpper(source.nama_owner);
  const no_hp_owner = cleanString(source.no_hp_owner);

  return {
    _id: id || new mongoose.Types.ObjectId(),
    kode_group: kodeGroup,
    nama_group: namaGroup,
    rawNames: new Set(rows.map((row) => cleanString(row.nama_group)).filter(Boolean) as string[]),
    sourceSubscriberKode: cleanString(source.kode),
    subscriberCount: rows.length,
    activeSubscriberCount: rows.filter((row) => row.status_aktv !== false && row.status_subscriber !== 'NON_AKTIF').length,
    owner: nama_owner || '',
    no_hp: no_hp_owner || '',
    nama_owner,
    no_hp_owner,
    gender_owner: normalizeGender(source.gender_owner),
    nama_pic: cleanUpper(source.nama_pic),
    no_hp_pic: cleanString(source.no_hp_pic),
    gender_pic: normalizeGender(source.gender_pic),
    alamat: cleanUpper(source.alamat),
  };
};

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  const subscriber = db.collection(targetCollection('tm_subscriber'));
  const group = db.collection(targetCollection('tm_group'));
  const now = new Date();
  console.log(`📦 Source: ${subscriber.collectionName} -> Target: ${group.collectionName}`);

  const subscriberFilter: AnyDoc = {
    nama_group: { $nin: [null, ''] },
    ...(INCLUDE_INACTIVE_SUBSCRIBER ? {} : { status_aktv: { $ne: false }, delete_date: null }),
  };
  const subscriberRows = await subscriber.find(subscriberFilter, {
    projection: {
      kode: 1,
      nama_group: 1,
      nama_owner: 1,
      no_hp_owner: 1,
      gender_owner: 1,
      nama_pic: 1,
      no_hp_pic: 1,
      gender_pic: 1,
      alamat: 1,
      status_aktv: 1,
      status_subscriber: 1,
      input_date: 1,
      update_date: 1,
    },
  }).toArray();

  const rowsByNamaGroup = new Map<string, AnyDoc[]>();
  let skippedBlankGroup = 0;
  for (const row of subscriberRows) {
    const namaGroup = cleanUpper(row.nama_group);
    if (!namaGroup) {
      skippedBlankGroup += 1;
      continue;
    }
    const rows = rowsByNamaGroup.get(namaGroup) || [];
    rows.push(row);
    rowsByNamaGroup.set(namaGroup, rows);
  }

  const groupRows = await group.find({}, {
    projection: {
      _id: 1,
      kode_group: 1,
      nama_group: 1,
      status_aktv: 1,
      delete_date: 1,
    },
  }).toArray();
  const groupByNama = new Map(
    groupRows
      .map((row) => [cleanUpper(row.nama_group), row] as const)
      .filter(([nama]) => Boolean(nama)) as Array<[string, AnyDoc]>
  );
  const nextKodeGroup = getNextKodeFactory(groupRows);

  const stats = {
    subscriberRows: subscriberRows.length,
    groupedNamaGroup: rowsByNamaGroup.size,
    skippedBlankGroup,
    wouldInsertGroup: 0,
    wouldReactivateGroup: 0,
    wouldUpdateGroup: 0,
    skippedExistingGroup: 0,
    wouldUpdateSubscriber: 0,
    insertedGroup: 0,
    reactivatedOrUpdatedGroup: 0,
    updatedSubscriber: 0,
    examples: {
      insertGroup: [] as AnyDoc[],
      reactivateGroup: [] as AnyDoc[],
      updateGroup: [] as AnyDoc[],
      existingGroup: [] as AnyDoc[],
      subscriberBacklink: [] as AnyDoc[],
    },
  };

  const groupOps: BulkOperation[] = [];
  const subscriberOps: BulkOperation[] = [];

  for (const [namaGroup, rows] of [...rowsByNamaGroup.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    const existing = groupByNama.get(namaGroup);
    const isDeletedGroup = Boolean(existing && (existing.status_aktv === false || existing.delete_date));
    const candidate = buildCandidate(
      namaGroup,
      rows,
      cleanUpper(existing?.kode_group) || nextKodeGroup(),
      existing?._id
    );

    const groupSet = {
      kode_group: candidate.kode_group,
      nama_group: candidate.nama_group,
      owner: candidate.owner,
      no_hp: candidate.no_hp,
      nama_owner: candidate.nama_owner,
      no_hp_owner: candidate.no_hp_owner,
      gender_owner: candidate.gender_owner,
      nama_pic: candidate.nama_pic,
      no_hp_pic: candidate.no_hp_pic,
      gender_pic: candidate.gender_pic,
      alamat: candidate.alamat,
      update_date: now,
      update_by: 'patch-group-toko-from-subscriber',
    };

    if (!existing) {
      groupOps.push({
        insertOne: {
          document: {
            _id: candidate._id,
            ...groupSet,
            status_aktv: true,
            input_date: now,
            delete_date: null,
            input_by: 'patch-group-toko-from-subscriber',
            delete_by: null,
          },
        },
      });
      stats.wouldInsertGroup += 1;
      if (stats.examples.insertGroup.length < 10) {
        stats.examples.insertGroup.push({
          kode_group: candidate.kode_group,
          nama_group: candidate.nama_group,
          subscriberCount: candidate.subscriberCount,
          sourceSubscriberKode: candidate.sourceSubscriberKode,
        });
      }
    } else if (isDeletedGroup) {
      groupOps.push({
        updateOne: {
          filter: { _id: existing._id },
          update: {
            $set: {
              ...groupSet,
              status_aktv: true,
              delete_date: null,
              delete_by: null,
            },
          },
        },
      });
      stats.wouldReactivateGroup += 1;
      if (stats.examples.reactivateGroup.length < 10) {
        stats.examples.reactivateGroup.push({
          kode_group: candidate.kode_group,
          nama_group: candidate.nama_group,
          subscriberCount: candidate.subscriberCount,
        });
      }
    } else if (UPDATE_EXISTING) {
      groupOps.push({
        updateOne: {
          filter: { _id: existing._id },
          update: { $set: groupSet },
        },
      });
      stats.wouldUpdateGroup += 1;
      if (stats.examples.updateGroup.length < 10) {
        stats.examples.updateGroup.push({
          kode_group: candidate.kode_group,
          nama_group: candidate.nama_group,
          subscriberCount: candidate.subscriberCount,
        });
      }
    } else {
      stats.skippedExistingGroup += 1;
      if (stats.examples.existingGroup.length < 10) {
        stats.examples.existingGroup.push({
          kode_group: candidate.kode_group,
          nama_group: candidate.nama_group,
          subscriberCount: candidate.subscriberCount,
        });
      }
    }

    const rawNames = [...candidate.rawNames];
    subscriberOps.push({
      updateMany: {
        filter: { nama_group: { $in: rawNames } },
        update: {
          $set: {
            group_id: candidate._id,
            kode_group: candidate.kode_group,
            nama_group: candidate.nama_group,
            update_date: now,
            update_by: 'patch-group-toko-from-subscriber',
          },
        },
      },
    });
    stats.wouldUpdateSubscriber += rows.length;
    if (stats.examples.subscriberBacklink.length < 10) {
      stats.examples.subscriberBacklink.push({
        kode_group: candidate.kode_group,
        nama_group: candidate.nama_group,
        subscriberCount: candidate.subscriberCount,
        rawNames,
      });
    }
  }

  if (APPLY) {
    if (groupOps.length) {
      const result = await group.bulkWrite(groupOps as any[], { ordered: false });
      stats.insertedGroup = result.insertedCount || 0;
      stats.reactivatedOrUpdatedGroup = result.modifiedCount || 0;
    }
    if (subscriberOps.length) {
      const result = await subscriber.bulkWrite(subscriberOps as any[], { ordered: false });
      stats.updatedSubscriber = result.modifiedCount || 0;
    }
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    source: 'tm_subscriber',
    target: 'tm_group + tm_subscriber.group_id/kode_group',
    options: {
      includeInactiveSubscriber: INCLUDE_INACTIVE_SUBSCRIBER,
      updateExistingGroup: UPDATE_EXISTING,
    },
    stats,
    note: APPLY
      ? 'Patch group toko dijalankan ke database.'
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
