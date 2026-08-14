import mongoose from 'mongoose';
import fs from 'fs';
import path from 'path';

type AnyDoc = Record<string, any>;
type DetailDoc = AnyDoc & {
  _patch_source?: 'legacy' | 'synthetic';
  _patch_reason?: string;
  subscriber_id: mongoose.Types.ObjectId;
  kode_subscriber: string;
};

const SOURCE_COLLECTION = 'tt_subscription_detail2';
const DETAIL_COLLECTION = 'tt_subscription_detail';
const MONTHLY_COLLECTION = 'tt_subscription';
const SUBSCRIBER_TAHUN_COLLECTION = 'tt_subscriber_tahun';

const args = new Set(process.argv.slice(2));
const APPLY = args.has('--apply');
const REPLACE_TARGET = args.has('--replace-target');
const INCLUDE_INACTIVE_SUBSCRIBER = !args.has('--active-only');
const PATCH_SUBSCRIBER_DATES = !args.has('--skip-subscriber-dates');

const USER_TAG = 'patch-subscription-from-detail2';

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
  return text ? text.toUpperCase().replace(/\s+/g, ' ') : null;
};

const toNumber = (value: unknown, fallback = 0): number => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const parseAuditDate = (value: unknown, fallback = new Date()): Date => {
  if (!value) return fallback;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  const date = new Date(String(value));
  return Number.isNaN(date.getTime()) ? fallback : date;
};

const normalizeYmd = (value: unknown): string | null => {
  const raw = cleanString(value);
  if (!raw) return null;
  const full = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (full) return isValidYmd(raw) ? raw : null;
  const short = raw.match(/^(\d{2})-(\d{2})-(\d{2})$/);
  if (short) {
    const normalized = `20${short[1]}-${short[2]}-${short[3]}`;
    return isValidYmd(normalized) ? normalized : null;
  }
  return null;
};

const isValidYmd = (value: string): boolean => {
  const match = value.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!match) return false;
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
};

const parseYmd = (value: unknown): Date | null => {
  const ymd = normalizeYmd(value);
  if (!ymd) return null;
  const [year, month, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
};

const formatYmd = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const addMonths = (date: Date, months: number): Date => {
  const day = date.getUTCDate();
  const target = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + months, 1, 12));
  const endDay = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(day, endDay));
  return target;
};

const addDays = (date: Date, days: number): Date => {
  const next = new Date(date);
  next.setUTCDate(next.getUTCDate() + days);
  return next;
};

const getTempo = (start: Date, months: number): Date => addDays(addMonths(start, months), -1);

const toPeriode = (date: Date): string => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
};

const getFiscalYear = (date: Date) => date.getUTCMonth() === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();

const getFiscalEndDate = (date: Date) => {
  const endYear = getFiscalYear(date);
  return new Date(Date.UTC(endYear, 11, 0, 12));
};

const buildSchedule = (detail: Pick<DetailDoc, 'tgl_mulai_tagihan' | 'jumlah_bulan' | 'biaya_per_bulan' | 'diskon'>) => {
  const startDate = parseYmd(detail.tgl_mulai_tagihan);
  if (!startDate) return [];
  const rows: Array<{ periode: string; tahun: number; total: number }> = [];
  let cursor = startDate;
  let first = true;
  const months = Math.max(1, Number(detail.jumlah_bulan || 1));
  const price = Math.max(0, Number(detail.biaya_per_bulan || 0));
  const fiscalEnd = getFiscalEndDate(startDate);

  while (cursor <= fiscalEnd) {
    const jumlah = price * months;
    const diskon = first ? Math.max(0, Math.min(jumlah, Number(detail.diskon || 0))) : 0;
    rows.push({ periode: toPeriode(cursor), tahun: getFiscalYear(cursor), total: Math.max(0, jumlah - diskon) });
    cursor = addDays(getTempo(cursor, months), 1);
    first = false;
  }

  return rows;
};

const normalizeStatus = (value: unknown): 'OPEN' | 'PROCESS' | 'DONE' | 'BATAL' => {
  const text = cleanUpper(value);
  if (text === 'DONE' || text === 'PROCESS' || text === 'BATAL') return text;
  return 'OPEN';
};

const normalizeKey = (value: unknown) => cleanUpper(value) || '';

const normalizeLooseName = (value: unknown) => normalizeKey(value)
  .replace(/[^A-Z0-9]+/g, ' ')
  .replace(/\s+/g, ' ')
  .trim();

const getNameTokens = (value: unknown) => normalizeLooseName(value)
  .split(' ')
  .filter((token) => token.length >= 2);

const namesLookRelated = (left: unknown, right: unknown) => {
  const leftName = normalizeLooseName(left);
  const rightName = normalizeLooseName(right);
  if (!leftName || !rightName) return false;
  if (leftName === rightName) return true;
  if (leftName.length >= 5 && rightName.includes(leftName)) return true;
  if (rightName.length >= 5 && leftName.includes(rightName)) return true;

  const leftTokens = getNameTokens(left);
  const rightTokens = getNameTokens(right);
  if (!leftTokens.length || !rightTokens.length) return false;

  const [shorter, longer] = leftTokens.length <= rightTokens.length
    ? [leftTokens, rightTokens]
    : [rightTokens, leftTokens];
  const longerSet = new Set(longer);
  const shared = shorter.filter((token) => longerSet.has(token));
  return shorter.length <= 3
    ? shared.length === shorter.length
    : shared.length >= Math.min(3, shorter.length);
};

const nameSimilarityScore = (left: unknown, right: unknown) => {
  const leftName = normalizeLooseName(left);
  const rightName = normalizeLooseName(right);
  if (!leftName || !rightName) return 0;
  if (leftName === rightName) return 1000;
  let score = 0;
  if (rightName.includes(leftName)) score += 500 + leftName.length;
  if (leftName.includes(rightName)) score += 400 + rightName.length;
  const leftTokens = getNameTokens(left);
  const rightTokens = getNameTokens(right);
  const rightSet = new Set(rightTokens);
  const shared = leftTokens.filter((token) => rightSet.has(token));
  score += shared.length * 80;
  const leftSet = new Set(leftTokens);
  const reverseShared = rightTokens.filter((token) => leftSet.has(token));
  score += reverseShared.length * 20;
  score -= Math.abs(leftTokens.length - rightTokens.length) * 5;
  return score;
};

const normalizePhone = (value: unknown) => cleanString(value)?.replace(/\D+/g, '') || '';

const tokenOverlapScore = (left: unknown, right: unknown) => {
  const leftTokens = getNameTokens(left).filter((token) => token.length >= 3);
  const rightTokens = getNameTokens(right).filter((token) => token.length >= 3);
  if (!leftTokens.length || !rightTokens.length) return 0;
  const rightSet = new Set(rightTokens);
  return leftTokens.filter((token) => rightSet.has(token)).length * 30;
};

const getRowNames = (row: AnyDoc) => [
  row.toko,
  row.invoice_meta?.customer?.name,
  row.doku_payment?.customer?.name,
].filter(cleanString);

const getRowPhones = (row: AnyDoc) => [
  row.invoice_meta?.customer?.phone,
  row.doku_payment?.customer?.phone,
].map(normalizePhone).filter(Boolean);

const getSubscriberPhones = (subscriber: AnyDoc) => [
  subscriber.no_hp_owner,
  subscriber.no_hp_pic,
  subscriber.no_hp,
  subscriber.phone,
  subscriber.telepon,
].map(normalizePhone).filter(Boolean);

const getRowAddresses = (row: AnyDoc) => [
  row.invoice_meta?.customer?.address,
  row.doku_payment?.customer?.address,
].filter(cleanString);

const programScore = (rowProgram: unknown, subscriberProgram: unknown) => {
  const source = normalizeKey(rowProgram);
  const target = normalizeKey(subscriberProgram);
  if (!source || !target) return 0;
  if (source === target) return 300;
  if (target.includes(source) || source.includes(target)) return 180;
  return namesLookRelated(source, target) ? 80 : 0;
};

const isSubscriberActive = (row: AnyDoc) => {
  if (!row || row.delete_date) return false;
  if (row.status_aktv === false) return false;
  return row.status_subscriber !== 'NON_AKTIF';
};

const chooseSubscriber = (candidates: AnyDoc[]) => {
  if (!candidates.length) return { subscriber: null as AnyDoc | null, reason: 'unmatched' };
  if (candidates.length === 1) return { subscriber: candidates[0], reason: 'single' };

  const active = candidates.filter(isSubscriberActive);
  if (active.length === 1) return { subscriber: active[0], reason: 'active-one' };
  if (active.length > 1) return { subscriber: null as AnyDoc | null, reason: 'ambiguous-active' };

  const sorted = [...candidates].sort((a, b) => String(b.update_date || b.input_date || '').localeCompare(String(a.update_date || a.input_date || '')));
  return { subscriber: sorted[0], reason: 'inactive-latest' };
};

const chooseLooseSubscriber = (row: AnyDoc, subscribers: AnyDoc[]) => {
  const rowNames = getRowNames(row);
  const rowPhones = getRowPhones(row);
  const rowAddresses = getRowAddresses(row);
  const rowDaerah = normalizeKey(row.daerah || row.doku_payment?.customer?.city);

  const ranked = subscribers
    .map((subscriber) => {
      const bestNameScore = Math.max(...rowNames.map((name) => nameSimilarityScore(name, subscriber.toko)), 0);
      const sourcePhones = new Set(rowPhones);
      const hasPhoneMatch = getSubscriberPhones(subscriber).some((phone) => sourcePhones.has(phone));
      const addressScore = Math.max(...rowAddresses.map((address) => tokenOverlapScore(address, subscriber.alamat)), 0);
      const daerahScore = rowDaerah && normalizeKey(subscriber.daerah) === rowDaerah ? 150 : 0;
      const score = bestNameScore
        + programScore(row.program, subscriber.program)
        + daerahScore
        + addressScore
        + (hasPhoneMatch ? 300 : 0)
        + (isSubscriberActive(subscriber) ? 20 : 0);
      return { subscriber, score, bestNameScore, addressScore, daerahScore, hasPhoneMatch };
    })
    .filter((item) => item.score >= 250 && (item.bestNameScore >= 80 || item.hasPhoneMatch || item.addressScore >= 60))
    .sort((a, b) => b.score - a.score);

  if (!ranked.length) return { subscriber: null as AnyDoc | null, reason: 'unmatched' };

  const [first, second] = ranked;
  if (!second || first.score > second.score) {
    return { subscriber: first.subscriber, reason: `loose-score:${first.score}` };
  }

  const tied = ranked.filter((item) => item.score === first.score).map((item) => item.subscriber);
  const picked = chooseSubscriber(tied);
  return picked.subscriber ? { ...picked, reason: `loose-score:${picked.reason}` } : picked;
};

const pickCurrentUnpaidRows = (rows: AnyDoc[]) => {
  const unpaid = rows.filter((row) => normalizeStatus(row.status) !== 'DONE');
  if (!unpaid.length) return { selected: [] as AnyDoc[], notes: [] as string[] };

  const notes: string[] = [];
  const inactiveIndexes = unpaid
    .map((row, index) => row.is_active === false ? index : -1)
    .filter((index) => index >= 0);
  if (!inactiveIndexes.length) return { selected: [unpaid[0]], notes };

  notes.push('punya segmen nonaktif di data lama');
  const lastInactiveIndex = inactiveIndexes[inactiveIndexes.length - 1];
  const reactivated = unpaid.slice(lastInactiveIndex + 1).find((row) => row.is_active !== false);
  if (reactivated) {
    notes.push('dipilih tagihan aktif pertama setelah nonaktif terakhir');
    return { selected: [reactivated], notes };
  }

  notes.push('subscriber terlihat nonaktif; disimpan marker nonaktif terakhir');
  return { selected: [unpaid[lastInactiveIndex]], notes };
};

const cloneInvoiceMeta = (row: AnyDoc, start: string, tempo: string) => {
  if (!row.invoice_meta) return undefined;
  const cloned = JSON.parse(JSON.stringify(row.invoice_meta));
  if (Array.isArray(cloned.items)) {
    cloned.items = cloned.items.map((item: AnyDoc) => ({
      ...item,
      start_date: start,
      tempo_date: tempo,
    }));
  }
  return cloned;
};

const cloneDokuPayment = (row: AnyDoc) => row.doku_payment
  ? JSON.parse(JSON.stringify(row.doku_payment))
  : undefined;

const buildDetailDoc = (row: AnyDoc, subscriber: AnyDoc, reason: string): DetailDoc | null => {
  const startDate = parseYmd(row.start);
  if (!startDate) return null;
  const months = Math.max(1, toNumber(row.bulan, 1));
  const tempo = getTempo(startDate, months);
  const nextStart = addDays(tempo, 1);
  const start = formatYmd(startDate);
  const tempoYmd = formatYmd(tempo);
  const jumlahBiaya = Math.max(0, toNumber(row.jumlah_harga, toNumber(row.harga) * months));
  const diskon = Math.max(0, toNumber(row.diskon, 0));
  const diskonPercent = Math.max(0, Math.min(100, toNumber(row.diskon_percent, 0)));
  const totalBiaya = Math.max(0, toNumber(row.total_harga, jumlahBiaya - diskon));
  const invoiceMeta = cloneInvoiceMeta(row, start, tempoYmd);
  const dokuPayment = cloneDokuPayment(row);

  return {
    subscription_id: null,
    chain_id: cleanString(row.chain_id) || `legacy-${String(row._id)}`,
    subscriber_id: subscriber._id,
    kode_subscriber: cleanString(subscriber.kode) || '',
    toko: cleanString(row.toko) || subscriber.toko,
    program: cleanString(row.program) || subscriber.program,
    daerah: cleanString(row.daerah) || subscriber.daerah || null,
    periode: toPeriode(startDate),
    tahun: getFiscalYear(startDate),
    tgl_mulai_tagihan: start,
    jumlah_bulan: months,
    tgl_berakhir_langganan: tempoYmd,
    tgl_bayar_selanjutnya: formatYmd(nextStart),
    biaya_per_bulan: Math.max(0, toNumber(row.harga, subscriber.biaya || 0)),
    jumlah_biaya: jumlahBiaya,
    diskon,
    diskon_percent: diskonPercent,
    total_biaya: totalBiaya,
    is_active: row.is_active !== false,
    status: normalizeStatus(row.status),
    tgl_lunas: row.tgl_lunas ? normalizeYmd(row.tgl_lunas) : null,
    metode_bayar: cleanString(row.metode_bayar),
    keterangan: cleanString(row.keterangan) || '-',
    ...(invoiceMeta ? { invoice_meta: invoiceMeta } : {}),
    ...(dokuPayment ? { doku_payment: dokuPayment } : {}),
    input_date: parseAuditDate(row.input_date),
    update_date: parseAuditDate(row.update_date),
    delete_date: null,
    input_by: cleanString(row.input_by) || USER_TAG,
    update_by: cleanString(row.update_by) || USER_TAG,
    delete_by: null,
    _patch_source: 'legacy',
    _patch_reason: reason,
  };
};

const buildSyntheticOpen = (latestDone: DetailDoc): DetailDoc | null => {
  const startDate = parseYmd(latestDone.tgl_bayar_selanjutnya);
  if (!startDate) return null;
  const tempo = getTempo(startDate, latestDone.jumlah_bulan);
  const nextStart = addDays(tempo, 1);
  const jumlahBiaya = latestDone.biaya_per_bulan * latestDone.jumlah_bulan;
  const now = new Date();

  return {
    subscription_id: null,
    chain_id: latestDone.chain_id,
    subscriber_id: latestDone.subscriber_id,
    kode_subscriber: latestDone.kode_subscriber,
    toko: latestDone.toko,
    program: latestDone.program,
    daerah: latestDone.daerah || null,
    periode: toPeriode(startDate),
    tahun: getFiscalYear(startDate),
    tgl_mulai_tagihan: formatYmd(startDate),
    jumlah_bulan: latestDone.jumlah_bulan,
    tgl_berakhir_langganan: formatYmd(tempo),
    tgl_bayar_selanjutnya: formatYmd(nextStart),
    biaya_per_bulan: latestDone.biaya_per_bulan,
    jumlah_biaya: jumlahBiaya,
    diskon: 0,
    diskon_percent: 0,
    total_biaya: jumlahBiaya,
    is_active: true,
    status: 'OPEN',
    tgl_lunas: null,
    metode_bayar: null,
    keterangan: 'Dibuat otomatis dari patch data lama karena tagihan terakhir sudah lunas',
    input_date: now,
    update_date: now,
    delete_date: null,
    input_by: USER_TAG,
    update_by: USER_TAG,
    delete_by: null,
    _patch_source: 'synthetic',
    _patch_reason: 'synthetic-current-open-after-last-done',
  };
};

const rankForDuplicate = (doc: DetailDoc) => {
  const statusRank = doc.status === 'DONE' ? 4 : doc.status === 'PROCESS' ? 3 : doc.status === 'OPEN' ? 2 : 1;
  const sourceRank = doc._patch_source === 'legacy' ? 2 : 1;
  const activeRank = doc.is_active === false ? 0 : 1;
  return statusRank * 100 + sourceRank * 10 + activeRank;
};

async function main() {
  await connectDB();
  const db = mongoose.connection.db;
  const source = db.collection(SOURCE_COLLECTION);
  const detailTarget = db.collection(DETAIL_COLLECTION);
  const monthlyTarget = db.collection(MONTHLY_COLLECTION);
  const subscriberTahunTarget = db.collection(SUBSCRIBER_TAHUN_COLLECTION);
  const subscriberCol = db.collection('tm_subscriber');

  const sourceRows = await source.find({ delete_date: null }).toArray();
  const subscribers = await subscriberCol.find(INCLUDE_INACTIVE_SUBSCRIBER ? {} : {
    delete_date: null,
    status_aktv: { $ne: false },
    status_subscriber: { $ne: 'NON_AKTIF' },
  }).toArray();

  const subscribersByTokoProgram = new Map<string, AnyDoc[]>();
  const subscribersByToko = new Map<string, AnyDoc[]>();
  for (const subscriber of subscribers) {
    const toko = normalizeKey(subscriber.toko);
    const program = normalizeKey(subscriber.program);
    const tokoProgramKey = `${toko}||${program}`;
    if (!subscribersByTokoProgram.has(tokoProgramKey)) subscribersByTokoProgram.set(tokoProgramKey, []);
    if (!subscribersByToko.has(toko)) subscribersByToko.set(toko, []);
    subscribersByTokoProgram.get(tokoProgramKey)?.push(subscriber);
    subscribersByToko.get(toko)?.push(subscriber);
  }

  const rowsByChain = new Map<string, AnyDoc[]>();
  for (const row of sourceRows) {
    const chainId = cleanString(row.chain_id) || `legacy-${String(row._id)}`;
    if (!rowsByChain.has(chainId)) rowsByChain.set(chainId, []);
    rowsByChain.get(chainId)?.push(row);
  }

  const stats = {
    sourceRows: sourceRows.length,
    chains: rowsByChain.size,
    matchedChains: 0,
    unmatchedChains: 0,
    invalidDateRows: 0,
    legacyDoneRows: 0,
    legacyProcessRows: 0,
    selectedCurrentRows: 0,
    syntheticOpenRows: 0,
    duplicateRowsSkipped: 0,
    wouldInsertDetails: 0,
    wouldInsertMonthly: 0,
    wouldInsertSubscriberTahun: 0,
    wouldUpdateSubscriberDates: 0,
    insertedDetails: 0,
    insertedMonthly: 0,
    insertedSubscriberTahun: 0,
    updatedSubscriberDates: 0,
    notes: {
      chainWithInactiveSegments: 0,
      chainWithSyntheticOpen: 0,
      chainWithSkippedDuplicate: 0,
      chainWithLooseMatch: 0,
    },
    examples: {
      unmatched: [] as AnyDoc[],
      invalidDate: [] as AnyDoc[],
      inactiveSegments: [] as AnyDoc[],
      duplicateSkipped: [] as AnyDoc[],
      syntheticOpen: [] as AnyDoc[],
    },
  };

  const candidateDetails: DetailDoc[] = [];
  const subscriberById = new Map<string, AnyDoc>();
  subscribers.forEach((subscriber) => subscriberById.set(String(subscriber._id), subscriber));
  const latestDoneBySubscriber = new Map<string, DetailDoc>();
  const hasCurrentBySubscriber = new Set<string>();

  for (const [chainId, rows] of rowsByChain) {
    rows.sort((a, b) => (normalizeYmd(a.start) || String(a.start)).localeCompare(normalizeYmd(b.start) || String(b.start)));
    const first = rows[0] || {};
    const tokoProgramKey = `${normalizeKey(first.toko)}||${normalizeKey(first.program)}`;
    let picked = chooseSubscriber(subscribersByTokoProgram.get(tokoProgramKey) || []);
    let matchReason = `toko+program:${picked.reason}`;
    if (!picked.subscriber) {
      picked = chooseSubscriber(subscribersByToko.get(normalizeKey(first.toko)) || []);
      matchReason = `toko:${picked.reason}`;
    }
    if (!picked.subscriber) {
      picked = chooseLooseSubscriber(first, subscribers);
      matchReason = picked.subscriber ? picked.reason : `loose:${picked.reason}`;
    }

    if (!picked.subscriber) {
      stats.unmatchedChains += 1;
      if (stats.examples.unmatched.length < 12) {
        stats.examples.unmatched.push({
          chain_id: chainId,
          toko: first.toko,
          program: first.program,
          rows: rows.length,
          starts: rows.map((row) => row.start).slice(0, 12),
          statuses: rows.map((row) => row.status).slice(0, 12),
        });
      }
      continue;
    }
    stats.matchedChains += 1;
    if (matchReason.startsWith('loose-')) stats.notes.chainWithLooseMatch += 1;

    const doneRows = rows.filter((row) => normalizeStatus(row.status) === 'DONE');
    const activeProcessRows = rows.filter((row) => normalizeStatus(row.status) === 'PROCESS' && row.is_active !== false);
    const { selected, notes } = pickCurrentUnpaidRows(rows);
    if (notes.length) {
      stats.notes.chainWithInactiveSegments += 1;
      if (stats.examples.inactiveSegments.length < 12) {
        stats.examples.inactiveSegments.push({
          chain_id: chainId,
          toko: first.toko,
          program: first.program,
          notes,
          selected_start: selected[0]?.start,
          rows: rows.map((row) => ({ start: row.start, status: row.status, is_active: row.is_active })),
        });
      }
    }

    const selectedById = new Set(selected.map((row) => String(row._id)));
    const processRows = activeProcessRows.filter((row) => !selectedById.has(String(row._id)));
    const selectedRows = [...doneRows, ...processRows, ...selected];
    let latestDoneDetail: DetailDoc | null = null;
    for (const row of selectedRows) {
      const detail = buildDetailDoc(row, picked.subscriber, matchReason);
      if (!detail) {
        stats.invalidDateRows += 1;
        if (stats.examples.invalidDate.length < 12) {
          stats.examples.invalidDate.push({ chain_id: chainId, toko: row.toko, start: row.start, tempo: row.tempo, periode: row.periode, status: row.status });
        }
        continue;
      }
      candidateDetails.push(detail);
      if (detail.status === 'DONE') {
        stats.legacyDoneRows += 1;
        if (!latestDoneDetail || detail.tgl_mulai_tagihan > latestDoneDetail.tgl_mulai_tagihan) latestDoneDetail = detail;
      } else if (detail.status === 'PROCESS') {
        stats.legacyProcessRows += 1;
        hasCurrentBySubscriber.add(String(detail.subscriber_id));
      } else {
        stats.selectedCurrentRows += 1;
        hasCurrentBySubscriber.add(String(detail.subscriber_id));
      }
    }

    if (latestDoneDetail) {
      const subscriberId = String(latestDoneDetail.subscriber_id);
      const current = latestDoneBySubscriber.get(subscriberId);
      if (!current || latestDoneDetail.tgl_mulai_tagihan > current.tgl_mulai_tagihan) {
        latestDoneBySubscriber.set(subscriberId, latestDoneDetail);
      }
    }
  }

  for (const [subscriberId, latestDoneDetail] of latestDoneBySubscriber) {
    const subscriber = subscriberById.get(subscriberId);
    if (hasCurrentBySubscriber.has(subscriberId) || !isSubscriberActive(subscriber)) continue;
    const synthetic = buildSyntheticOpen(latestDoneDetail);
    if (synthetic) {
      candidateDetails.push(synthetic);
      stats.syntheticOpenRows += 1;
      stats.notes.chainWithSyntheticOpen += 1;
      if (stats.examples.syntheticOpen.length < 12) {
        stats.examples.syntheticOpen.push({
          chain_id: synthetic.chain_id,
          toko: synthetic.toko,
          start: synthetic.tgl_mulai_tagihan,
          last_done: latestDoneDetail.tgl_mulai_tagihan,
        });
      }
    }
  }

  const finalBySubscriberStart = new Map<string, DetailDoc>();
  for (const detail of candidateDetails) {
    const key = `${String(detail.subscriber_id)}||${detail.tgl_mulai_tagihan}||${normalizeKey(detail.program)}||null`;
    const existing = finalBySubscriberStart.get(key);
    if (!existing) {
      finalBySubscriberStart.set(key, detail);
      continue;
    }
    const winner = rankForDuplicate(detail) > rankForDuplicate(existing) ? detail : existing;
    const skipped = winner === detail ? existing : detail;
    finalBySubscriberStart.set(key, winner);
    stats.duplicateRowsSkipped += 1;
    stats.notes.chainWithSkippedDuplicate += 1;
    if (stats.examples.duplicateSkipped.length < 12) {
      stats.examples.duplicateSkipped.push({
        subscriber_id: String(skipped.subscriber_id),
        toko: skipped.toko,
        start: skipped.tgl_mulai_tagihan,
        skipped_status: skipped.status,
        skipped_chain_id: skipped.chain_id,
        kept_status: winner.status,
        kept_chain_id: winner.chain_id,
      });
    }
  }

  const finalDetails = [...finalBySubscriberStart.values()]
    .sort((a, b) => a.tgl_mulai_tagihan.localeCompare(b.tgl_mulai_tagihan) || a.toko.localeCompare(b.toko));

  const hasLaterActiveUnpaid = (detail: DetailDoc) => finalDetails.some((other) => (
    other !== detail
    && String(other.subscriber_id) === String(detail.subscriber_id)
    && other.status !== 'DONE'
    && other.is_active !== false
    && other.tgl_mulai_tagihan > detail.tgl_mulai_tagihan
  ));

  const monthly = new Map<string, AnyDoc>();
  const addMonthly = (periode: string, tahun: number, values: Partial<AnyDoc>) => {
    const current = monthly.get(periode) || {
      periode,
      tahun,
      estimasi: 0,
      realisasi: 0,
      total_subscriber_estimasi: 0,
      total_subscriber_realisasi: 0,
    };
    current.estimasi += Number(values.estimasi || 0);
    current.realisasi += Number(values.realisasi || 0);
    current.total_subscriber_estimasi += Number(values.total_subscriber_estimasi || 0);
    current.total_subscriber_realisasi += Number(values.total_subscriber_realisasi || 0);
    monthly.set(periode, current);
  };

  for (const detail of finalDetails) {
    if (detail.status === 'DONE') {
      addMonthly(detail.periode, detail.tahun, {
        estimasi: detail.total_biaya,
        total_subscriber_estimasi: 1,
      });
      const paidDate = parseYmd(detail.tgl_lunas);
      if (paidDate) {
        addMonthly(toPeriode(paidDate), getFiscalYear(paidDate), {
          realisasi: detail.total_biaya,
          total_subscriber_realisasi: 1,
        });
      }
      continue;
    }

    if (detail.is_active === false) continue;
    if (detail.status === 'PROCESS' && hasLaterActiveUnpaid(detail)) {
      addMonthly(detail.periode, detail.tahun, {
        estimasi: detail.total_biaya,
        total_subscriber_estimasi: 1,
      });
      continue;
    }
    for (const entry of buildSchedule(detail)) {
      addMonthly(entry.periode, entry.tahun, {
        estimasi: entry.total,
        total_subscriber_estimasi: 1,
      });
    }
  }

  const monthlyDocs = [...monthly.values()].sort((a, b) => a.periode.localeCompare(b.periode)).map((row) => ({
    ...row,
    updated_at: new Date(),
    input_date: new Date(),
    update_date: new Date(),
    delete_date: null,
    input_by: USER_TAG,
    update_by: USER_TAG,
    delete_by: null,
  }));
  const monthlyFiscal2026Preview = monthlyDocs
    .filter((row) => Number(row.tahun) === 2026)
    .map((row) => ({
      periode: row.periode,
      estimasi: row.estimasi,
      realisasi: row.realisasi,
      total_subscriber_estimasi: row.total_subscriber_estimasi,
      total_subscriber_realisasi: row.total_subscriber_realisasi,
    }));

  const subscriberYearMap = new Map<string, AnyDoc>();
  const addSubscriberYear = (detail: DetailDoc, tahun: number, values: Partial<AnyDoc>) => {
    const key = `${String(detail.subscriber_id)}||${tahun}`;
    const subscriber = subscriberById.get(String(detail.subscriber_id)) || {};
    const current = subscriberYearMap.get(key) || {
      subscriber_id: detail.subscriber_id,
      kode_subscriber: detail.kode_subscriber,
      toko: subscriber.toko || detail.toko,
      kode_group: subscriber.kode_group || null,
      nama_group: subscriber.nama_group || null,
      program: subscriber.program || detail.program || null,
      status_subscriber: subscriber.status_subscriber || 'AKTIF',
      tahun,
      total_rencana_tagihan: 0,
      tagihan_terbayar: 0,
      sisa_tagihan: 0,
      last_rebuild_at: new Date(),
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: USER_TAG,
      update_by: USER_TAG,
      delete_by: null,
    };
    current.tagihan_terbayar += Number(values.tagihan_terbayar || 0);
    current.sisa_tagihan += Number(values.sisa_tagihan || 0);
    current.total_rencana_tagihan = current.tagihan_terbayar + current.sisa_tagihan;
    subscriberYearMap.set(key, current);
  };

  for (const detail of finalDetails) {
    if (detail.status === 'DONE') {
      addSubscriberYear(detail, detail.tahun, { tagihan_terbayar: detail.total_biaya });
      continue;
    }
    if (detail.is_active === false) continue;
    if (detail.status === 'PROCESS' && hasLaterActiveUnpaid(detail)) {
      addSubscriberYear(detail, detail.tahun, { sisa_tagihan: detail.total_biaya });
      continue;
    }
    for (const entry of buildSchedule(detail)) {
      addSubscriberYear(detail, entry.tahun, { sisa_tagihan: entry.total });
    }
  }

  const subscriberYearDocs = [...subscriberYearMap.values()]
    .sort((a, b) => Number(a.tahun) - Number(b.tahun) || String(a.toko).localeCompare(String(b.toko)));

  const subscriberDateOps: AnyDoc[] = [];
  if (PATCH_SUBSCRIBER_DATES) {
    const latestDoneBySubscriber = new Map<string, DetailDoc>();
    for (const detail of finalDetails) {
      if (detail.status !== 'DONE') continue;
      const key = String(detail.subscriber_id);
      const current = latestDoneBySubscriber.get(key);
      if (!current || detail.tgl_mulai_tagihan > current.tgl_mulai_tagihan) latestDoneBySubscriber.set(key, detail);
    }
    for (const [subscriberId, detail] of latestDoneBySubscriber) {
      subscriberDateOps.push({
        updateOne: {
          filter: { _id: new mongoose.Types.ObjectId(subscriberId) },
          update: {
            $set: {
              tgl_terbayar: detail.tgl_mulai_tagihan,
              tgl_berakhir_langganan: detail.tgl_berakhir_langganan,
              tgl_bayar_selanjutnya: detail.tgl_bayar_selanjutnya,
              update_date: new Date(),
              update_by: USER_TAG,
            },
          },
        },
      });
    }
  }

  stats.wouldInsertDetails = finalDetails.length;
  stats.wouldInsertMonthly = monthlyDocs.length;
  stats.wouldInsertSubscriberTahun = subscriberYearDocs.length;
  stats.wouldUpdateSubscriberDates = subscriberDateOps.length;

  if (APPLY) {
    if (REPLACE_TARGET) {
      await Promise.all([
        detailTarget.deleteMany({}),
        monthlyTarget.deleteMany({}),
        subscriberTahunTarget.deleteMany({}),
      ]);
    }
    await detailTarget.dropIndex('subscriber_id_1_tgl_mulai_tagihan_1_delete_date_1').catch(() => undefined);
    await detailTarget.createIndex(
      { subscriber_id: 1, tgl_mulai_tagihan: 1, program: 1, delete_date: 1 },
      { unique: true }
    );

    if (finalDetails.length) {
      const docs = finalDetails.map(({ _patch_source, _patch_reason, ...doc }) => doc);
      const result = await detailTarget.insertMany(docs, { ordered: false });
      stats.insertedDetails = result.length;
    }
    if (monthlyDocs.length) {
      const result = await monthlyTarget.insertMany(monthlyDocs, { ordered: false });
      stats.insertedMonthly = result.length;
    }
    if (subscriberYearDocs.length) {
      const result = await subscriberTahunTarget.insertMany(subscriberYearDocs, { ordered: false });
      stats.insertedSubscriberTahun = result.length;
    }
    if (subscriberDateOps.length) {
      const result = await subscriberCol.bulkWrite(subscriberDateOps, { ordered: false });
      stats.updatedSubscriberDates = result.modifiedCount || 0;
    }
  }

  console.log(JSON.stringify({
    mode: APPLY ? 'APPLY' : 'DRY_RUN',
    source: SOURCE_COLLECTION,
    target: `${DETAIL_COLLECTION} + ${MONTHLY_COLLECTION} + ${SUBSCRIBER_TAHUN_COLLECTION}`,
    options: {
      replaceTarget: REPLACE_TARGET,
      includeInactiveSubscriber: INCLUDE_INACTIVE_SUBSCRIBER,
      patchSubscriberDates: PATCH_SUBSCRIBER_DATES,
    },
    stats,
    preview: {
      monthlyFiscal2026: monthlyFiscal2026Preview,
    },
    note: APPLY
      ? 'Patch subscription dijalankan ke database.'
      : 'Dry-run saja. Jalankan dengan --apply --replace-target untuk patch ulang target kosong/bersih.',
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
