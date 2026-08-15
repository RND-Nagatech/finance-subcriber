import { Request, Response } from 'express';
import crypto from 'crypto';
import Subscriber from '../models/Subscriber';
import Subscription from '../models/Subscription';
import SubscriptionDetail from '../models/SubscriptionDetail';
import SubscriberTahun from '../models/SubscriberTahun';
import InvoiceCounter from '../models/InvoiceCounter';
import { addDays, getTempo, parseDateOnly, toPeriode } from '../utils/subscriptionPeriod';
import {
  getCurrentFiscalYear,
  rebuildAllSubscriberTahun,
  rebuildSubscriberTahun,
  rebuildSubscriberTahunForDetails,
} from '../services/subscriberTahunService';
import {
  createDokuCheckout,
  DokuApiError,
  normalizeDokuCustomer,
} from '../services/dokuService';

const INVOICE_SENDER = {
  name: 'PT. NAGATECH SISTEM INTEGRATOR',
  address: 'JL.CILENGKRANG 1 , CIBIRU, KOTA BANDUNG, JAWA BARAT',
  phone: '0811-2286-6660',
};

const jobs = new Map<string, { status: 'running' | 'done' | 'error'; nextFiscalLabel: number; total: number; done: number; startedAt: number; finishedAt?: number; error?: string }>();

const resolveUserId = (req: Request) => {
  if (req.user && typeof req.user === 'object') {
    return (req.user as any).name || (req.user as any).username || (req.user as any).id || (req.user as any)._id || 'system';
  }
  if (typeof req.user === 'string' && req.user.length > 0) return req.user;
  return 'system';
};

const isUnverifiedDetail = (detail: any) => (
  detail?.patch_match_status === 'UNVERIFIED'
  || !detail?.subscriber_id
  || !detail?.kode_subscriber
);

const requireVerifiedDetail = (detail: any, res: Response) => {
  if (!isUnverifiedDetail(detail)) return false;
  res.status(400).json({ message: 'Data subscription belum diverifikasi. Verifikasi relasi subscriber terlebih dahulu.' });
  return true;
};

const formatYMD = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const asDate = (value: unknown): Date => {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new Error(`Tanggal tidak valid: ${String(value || '-')}`);
  return parsed;
};

const asYMD = (value: unknown): string => formatYMD(asDate(value));

const getFiscalYear = (date: Date) => date.getUTCMonth() === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();

const getFiscalEndDate = (date: Date) => {
  const endYear = getFiscalYear(date);
  return new Date(Date.UTC(endYear, 11, 0, 12, 0, 0, 0));
};

const periodeFromPaidDate = (value: unknown): string | null => {
  const paidDate = parseDateOnly(value);
  return paidDate ? toPeriode(paidDate) : null;
};

const buildFiscalSchedule = (params: {
  startDate: Date;
  jumlahBulan: number;
  biayaPerBulan: number;
  firstDiskon?: number;
  firstDiskonPercent?: number;
}) => {
  const entries: Array<{
    startDate: Date;
    tempo: Date;
    nextStart: Date;
    periode: string;
    tahun: number;
    jumlahBulan: number;
    jumlahBiaya: number;
    diskon: number;
    diskonPercent: number;
    totalBiaya: number;
  }> = [];
  const fiscalEndDate = getFiscalEndDate(params.startDate);
  let cursorStart = params.startDate;
  let isFirst = true;

  while (cursorStart <= fiscalEndDate) {
    const tempo = getTempo(cursorStart, params.jumlahBulan);
    const nextStart = addDays(tempo, 1);
    const jumlahBiaya = params.biayaPerBulan * params.jumlahBulan;
    const diskon = isFirst ? Math.max(0, Math.min(jumlahBiaya, Number(params.firstDiskon || 0))) : 0;
    entries.push({
      startDate: cursorStart,
      tempo,
      nextStart,
      periode: toPeriode(cursorStart),
      tahun: getFiscalYear(cursorStart),
      jumlahBulan: params.jumlahBulan,
      jumlahBiaya,
      diskon,
      diskonPercent: isFirst ? Math.max(0, Math.min(100, Number(params.firstDiskonPercent || 0))) : 0,
      totalBiaya: Math.max(0, jumlahBiaya - diskon),
    });
    cursorStart = nextStart;
    isFirst = false;
  }

  return entries;
};

const recalcSubscriptionPeriode = async (periode: string, userTag: string) => {
  const [summary] = await SubscriptionDetail.aggregate([
    {
      $match: {
        delete_date: null,
        status: 'DONE',
        tgl_lunas: { $gte: `${periode}-01`, $lte: `${periode}-31` },
      },
    },
    {
      $group: {
        _id: null,
        realisasi: { $sum: '$total_biaya' },
        total_subscriber_realisasi: { $sum: 1 },
      },
    },
  ]);

  await Subscription.updateOne(
    { periode },
    {
      $set: {
        periode,
        tahun: periode.endsWith('-12') ? Number(periode.slice(0, 4)) + 1 : Number(periode.slice(0, 4)),
        realisasi: summary?.realisasi || 0,
        total_subscriber_realisasi: summary?.total_subscriber_realisasi || 0,
        updated_at: new Date(),
        update_date: new Date(),
        update_by: userTag,
      },
      $setOnInsert: {
        input_date: new Date(),
        input_by: userTag,
        estimasi: 0,
        total_subscriber_estimasi: 0,
        delete_date: null,
        delete_by: null,
      },
    },
    { upsert: true }
  );
};

const recalcRekapTahun = async (tahun: number, userTag: string) => {
  void tahun;
  void userTag;
};

const getDetailRekapYears = (detail: any) => {
  const years = new Set<number>();
  if (!detail) return years;
  const detailYear = Number(detail.tahun || 0);
  if (detailYear) years.add(detailYear);
  const paidDate = parseDateOnly(detail.tgl_lunas);
  if (paidDate) years.add(getFiscalYear(paidDate));
  const startDate = parseDateOnly(detail.tgl_mulai_tagihan);
  if (startDate && detail.status !== 'DONE' && detail.is_active !== false) {
    const schedule = buildFiscalSchedule({
      startDate,
      jumlahBulan: Math.max(1, Number(detail.jumlah_bulan || 1)),
      biayaPerBulan: Math.max(0, Number(detail.biaya_per_bulan || 0)),
      firstDiskon: Number(detail.diskon || 0),
      firstDiskonPercent: Number(detail.diskon_percent || 0),
    });
    schedule.forEach((entry) => years.add(entry.tahun));
  }
  return years;
};

const rebuildSubscriptionYears = async (years: Iterable<number>, userTag: string) => {
  const cleanYears = [...new Set([...years].map(Number).filter(Boolean))];
  for (const year of cleanYears) {
    await rebuildSubscriptionMonthlyRekap(year, userTag);
  }
};

const getFiscalPeriods = (tahun: number) => {
  const periods: string[] = [];
  for (let month = 11; month <= 22; month += 1) {
    const date = new Date(Date.UTC(tahun - 1, month, 1, 12));
    periods.push(toPeriode(date));
  }
  return periods;
};

const rebuildSubscriptionMonthlyRekap = async (tahun: number, userTag: string) => {
  const fiscalYear = Number(tahun || 0);
  if (!fiscalYear) return { tahun: fiscalYear, periods: 0 };

  const monthly: Record<string, {
    estimasi: number;
    realisasi: number;
    total_subscriber_estimasi: number;
    total_subscriber_realisasi: number;
  }> = {};

  for (const periode of getFiscalPeriods(fiscalYear)) {
    monthly[periode] = {
      estimasi: 0,
      realisasi: 0,
      total_subscriber_estimasi: 0,
      total_subscriber_realisasi: 0,
    };
  }

  const fiscalPeriods = getFiscalPeriods(fiscalYear);
  const details: any[] = await SubscriptionDetail.find({
    delete_date: null,
    status: { $in: ['OPEN', 'PROCESS', 'DONE'] },
    subscriber_id: { $ne: null },
    patch_match_status: { $ne: 'UNVERIFIED' },
  }).lean();
  const hasLaterActiveUnpaid = (detail: any) => details.some((other) => (
    String(other._id) !== String(detail._id)
    && String(other.subscriber_id) === String(detail.subscriber_id)
    && other.status !== 'DONE'
    && other.is_active !== false
    && String(other.tgl_mulai_tagihan || '') > String(detail.tgl_mulai_tagihan || '')
  ));

  for (const detail of details) {
    if (detail.status === 'DONE') {
      if (detail.tahun === fiscalYear && monthly[detail.periode]) {
        monthly[detail.periode].estimasi += Number(detail.total_biaya || 0);
        monthly[detail.periode].total_subscriber_estimasi += 1;
      }
      const paidPeriode = periodeFromPaidDate(detail.tgl_lunas);
      if (paidPeriode && fiscalPeriods.includes(paidPeriode) && monthly[paidPeriode]) {
        monthly[paidPeriode].realisasi += Number(detail.total_biaya || 0);
        monthly[paidPeriode].total_subscriber_realisasi += 1;
      }
      continue;
    }

    if (detail.is_active === false) continue;
    if (detail.status === 'PROCESS' && hasLaterActiveUnpaid(detail)) {
      if (detail.tahun === fiscalYear && monthly[detail.periode]) {
        monthly[detail.periode].estimasi += Number(detail.total_biaya || 0);
        monthly[detail.periode].total_subscriber_estimasi += 1;
      }
      continue;
    }
    const startDate = parseDateOnly(detail.tgl_mulai_tagihan);
    if (!startDate) continue;
    const schedule = buildFiscalSchedule({
      startDate,
      jumlahBulan: Math.max(1, Number(detail.jumlah_bulan || 1)),
      biayaPerBulan: Math.max(0, Number(detail.biaya_per_bulan || 0)),
      firstDiskon: Number(detail.diskon || 0),
      firstDiskonPercent: Number(detail.diskon_percent || 0),
    });

    for (const entry of schedule) {
      if (entry.tahun !== fiscalYear || !monthly[entry.periode]) continue;
      monthly[entry.periode].estimasi += Number(entry.totalBiaya || 0);
      monthly[entry.periode].total_subscriber_estimasi += 1;
    }
  }

  const now = new Date();
  for (const [periode, values] of Object.entries(monthly)) {
    await Subscription.updateOne(
      { periode },
      {
        $set: {
          periode,
          tahun: fiscalYear,
          estimasi: Math.max(0, values.estimasi),
          realisasi: Math.max(0, values.realisasi),
          total_subscriber_estimasi: Math.max(0, values.total_subscriber_estimasi),
          total_subscriber_realisasi: Math.max(0, values.total_subscriber_realisasi),
          updated_at: now,
          update_date: now,
          update_by: userTag,
          delete_date: null,
          delete_by: null,
        },
        $setOnInsert: {
          input_date: now,
          input_by: userTag,
        },
      },
      { upsert: true }
    );
  }

  await recalcRekapTahun(fiscalYear, userTag);
  return { tahun: fiscalYear, periods: Object.keys(monthly).length };
};

const createOpenDetail = async (seed: {
  chain_id: string;
  subscriber_id: any;
  kode_subscriber: string;
  toko: string;
  program: string;
  daerah?: string | null;
  biaya_per_bulan: number;
  jumlah_bulan: number;
}, startDate: Date, userTag: string, options: { diskon?: number; diskon_percent?: number; keterangan?: string | null } = {}) => {
  const tempo = getTempo(startDate, seed.jumlah_bulan);
  const nextStart = addDays(tempo, 1);
  const jumlahBiaya = seed.biaya_per_bulan * seed.jumlah_bulan;
  const diskon = Math.max(0, Math.min(jumlahBiaya, Number(options.diskon || 0)));
  const detail = await SubscriptionDetail.create({
    subscription_id: null,
    chain_id: seed.chain_id,
    subscriber_id: seed.subscriber_id,
    kode_subscriber: seed.kode_subscriber,
    toko: seed.toko,
    program: seed.program,
    daerah: seed.daerah || null,
    periode: toPeriode(startDate),
    tahun: getFiscalYear(startDate),
    tgl_mulai_tagihan: formatYMD(startDate),
    jumlah_bulan: seed.jumlah_bulan,
    tgl_berakhir_langganan: formatYMD(tempo),
    tgl_bayar_selanjutnya: formatYMD(nextStart),
    biaya_per_bulan: seed.biaya_per_bulan,
    jumlah_biaya: jumlahBiaya,
    diskon,
    diskon_percent: Math.max(0, Math.min(100, Number(options.diskon_percent || 0))),
    total_biaya: Math.max(0, jumlahBiaya - diskon),
    status: 'OPEN',
    is_active: true,
    keterangan: options.keterangan || '-',
    input_by: userTag,
    update_by: userTag,
  });
  return detail;
};

const isSubscriberSubscriptionActive = async (subscriberId: any) => {
  if (!subscriberId) return false;
  const subscriber: any = await Subscriber.findOne({ _id: subscriberId, delete_date: null }).lean();
  if (!subscriber) return false;
  if (subscriber.status_aktv === false) return false;
  return subscriber.status_subscriber !== 'NON_AKTIF';
};

const validateNewSubscriptionStart = async (subscriberId: any, startDate: Date, program?: string | null) => {
  const startYmd = formatYMD(startDate);
  const duplicate = await SubscriptionDetail.findOne({
    subscriber_id: subscriberId,
    tgl_mulai_tagihan: startYmd,
    ...(program ? { program } : {}),
    delete_date: null,
  }).lean();
  if (duplicate) {
    throw new Error(`Periode subscription dengan tanggal mulai ${startYmd} sudah ada untuk subscriber ini.`);
  }

  const latest: any = await SubscriptionDetail.findOne({
    subscriber_id: subscriberId,
    delete_date: null,
  }).sort({ tgl_mulai_tagihan: -1, input_date: -1 }).lean();

  if (!latest) return;

  if (latest.status === 'OPEN' || latest.status === 'PROCESS') {
    if (latest.is_active !== false) {
      throw new Error('Subscriber sudah memiliki subscription aktif.');
    }
  }

  const minStart = parseDateOnly(latest.tgl_bayar_selanjutnya) || parseDateOnly(latest.tgl_mulai_tagihan);
  if (minStart && startDate < minStart) {
    throw new Error(`Periode sebelumnya sudah ada. Lanjutkan dari tanggal tagihan selanjutnya (${formatYMD(minStart)}).`);
  }
};

const syncSubscriberPaymentDatesFromLatestDone = async (subscriberId: any, userTag: string) => {
  const latestDone: any = await SubscriptionDetail.findOne({
    subscriber_id: subscriberId,
    status: 'DONE',
    delete_date: null,
  }).sort({ tgl_mulai_tagihan: -1 });

  const updatePayload = latestDone
    ? {
        tgl_terbayar: asYMD(latestDone.tgl_mulai_tagihan),
        tgl_berakhir_langganan: asYMD(latestDone.tgl_berakhir_langganan),
        tgl_bayar_selanjutnya: asYMD(latestDone.tgl_bayar_selanjutnya),
        update_date: new Date(),
        update_by: userTag,
      }
    : {
        tgl_terbayar: null,
        tgl_berakhir_langganan: null,
        tgl_bayar_selanjutnya: null,
        update_date: new Date(),
        update_by: userTag,
      };

  await Subscriber.findByIdAndUpdate(subscriberId, updatePayload);
};

const toDto = (detail: any) => ({
  _id: String(detail._id),
  ref_id: String(detail.subscriber_id || ''),
  kode_subscriber: detail.kode_subscriber || null,
  periode: detail.periode,
  chain_id: detail.chain_id,
  toko: detail.toko,
  kode_group: detail.kode_group || detail.subscriber_info?.kode_group || null,
  nama_group: detail.nama_group || detail.subscriber_info?.nama_group || null,
  program: detail.program,
  daerah: detail.daerah || '',
  start: asYMD(detail.tgl_mulai_tagihan),
  bulan: Number(detail.jumlah_bulan || 1),
  tempo: asYMD(detail.tgl_berakhir_langganan),
  harga: Number(detail.biaya_per_bulan || 0),
  jumlah_harga: Number(detail.jumlah_biaya || 0),
  diskon: Number(detail.diskon || 0),
  diskon_percent: Number(detail.diskon_percent || 0),
  total_harga: Number(detail.total_biaya || 0),
  is_active: detail.is_active !== false,
  status: detail.status === 'LUNAS' ? 'DONE' : detail.status,
  tgl_lunas: detail.tgl_lunas ? asYMD(detail.tgl_lunas) : undefined,
  invoice_meta: detail.invoice_meta,
  doku_payment: detail.doku_payment,
  keterangan: detail.keterangan || '-',
  patch_match_status: detail.patch_match_status || (detail.subscriber_id ? 'MATCHED' : 'UNVERIFIED'),
  patch_match_reason: detail.patch_match_reason || null,
  patch_source_toko: detail.patch_source_toko || null,
  patch_source_program: detail.patch_source_program || null,
});

const generateMonthlyInvoiceNumber = async () => {
  const now = new Date();
  const yy = String(now.getFullYear()).slice(-2);
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const counter = await InvoiceCounter.findOneAndUpdate(
    { date_key: `${yy}${mm}` },
    { $inc: { last_seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  return `FJ${yy}${mm}${dd}-${String(counter?.last_seq || 1).padStart(4, '0')}`;
};

export const availableSubscribers = async (_req: Request, res: Response) => {
  const rows = await Subscriber.find({
    delete_date: null,
    status_aktv: true,
    $or: [
      { status_subscriber: 'AKTIF' },
      { status_subscriber: 'NON_AKTIF' },
      { status_subscriber: { $exists: false } },
      { status_subscriber: null },
    ],
  }).sort({ toko: 1 }).lean();
  const data = await Promise.all(rows.map(async (row: any) => {
    const latest: any = await SubscriptionDetail.findOne({
      subscriber_id: row._id,
      delete_date: null,
    }).sort({ tgl_mulai_tagihan: -1, input_date: -1 }).lean();
    return {
      _id: String(row._id),
      toko: row.toko,
      biaya: Number(row.biaya || 0),
      program: row.program || '',
      daerah: row.daerah || '',
      suggested_start: latest?.tgl_bayar_selanjutnya ? asYMD(latest.tgl_bayar_selanjutnya) : null,
      latest_start: latest?.tgl_mulai_tagihan ? asYMD(latest.tgl_mulai_tagihan) : null,
      latest_status: latest?.status || null,
      latest_is_active: latest ? latest.is_active !== false : null,
    };
  }));
  res.json({ data });
};

export const getDetailsByPeriode = async (req: Request, res: Response) => {
  const periode = String(req.query.periode || '').trim();
  const rows = await SubscriptionDetail.find({ periode, delete_date: null }).sort({ tgl_mulai_tagihan: 1, toko: 1 }).lean();
  res.json(rows.map(toDto));
};

export const getDetailsByToko = async (req: Request, res: Response) => {
  const toko = String(req.query.toko || '').trim();
  const rows = await SubscriptionDetail.find({ toko, delete_date: null }).sort({ tgl_mulai_tagihan: 1 }).lean();
  res.json(rows.map(toDto));
};

export const searchDetails = async (req: Request, res: Response) => {
  try {
    const periodeFrom = String(req.query.periode_from || '').trim();
    const periodeTo = String(req.query.periode_to || '').trim();
    const toko = String(req.query.toko || 'ALL').trim();
    const kodeGroup = String(req.query.kode_group || 'ALL').trim();
    const status = String(req.query.status || 'OPEN').trim().toUpperCase();
    const search = String(req.query.search || '').trim();
    const includeInactive = String(req.query.include_inactive || '').toLowerCase() === 'true';
    const limit = Math.min(Math.max(Number(req.query.limit || 1000), 1), 1000);

    const hasPeriode = Boolean(periodeFrom && periodeTo);
    const hasToko = Boolean(toko && toko !== 'ALL');
    const hasGroup = Boolean(kodeGroup && kodeGroup !== 'ALL');

    if (status === 'ALL' && !hasPeriode && !hasToko && !hasGroup) {
      return res.status(400).json({
        message: 'Filter terlalu luas. Pilih periode, group toko, toko, atau status selain ALL.',
      });
    }

    const match: any = { delete_date: null };
    if (!includeInactive) match.is_active = { $ne: false };
    if (status !== 'ALL') match.status = status;
    if (hasPeriode) {
      const isDateRange = periodeFrom.length >= 10 || periodeTo.length >= 10;
      if (isDateRange) {
        match.tgl_mulai_tagihan = { $gte: periodeFrom, $lte: periodeTo };
      } else {
        match.periode = { $gte: periodeFrom, $lte: periodeTo };
      }
    }
    if (hasToko) {
      match.toko = toko;
    }

    const pipeline: any[] = [
      { $match: match },
      {
        $lookup: {
          from: Subscriber.collection.name,
          localField: 'subscriber_id',
          foreignField: '_id',
          as: 'subscriber_info',
        },
      },
      { $unwind: { path: '$subscriber_info', preserveNullAndEmptyArrays: true } },
    ];

    if (hasGroup) {
      pipeline.push({ $match: { 'subscriber_info.kode_group': kodeGroup } });
    }

    if (search) {
      pipeline.push({
        $match: {
          $or: [
            { toko: { $regex: search, $options: 'i' } },
            { program: { $regex: search, $options: 'i' } },
            { daerah: { $regex: search, $options: 'i' } },
            { 'subscriber_info.nama_group': { $regex: search, $options: 'i' } },
            { 'subscriber_info.kode_group': { $regex: search, $options: 'i' } },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: { tgl_mulai_tagihan: 1, toko: 1 } },
      { $limit: limit }
    );

    const rows = await SubscriptionDetail.aggregate(pipeline);
    res.json(rows.map(toDto));
  } catch (error) {
    console.error('Error in searchDetails:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getAggregateByPeriode = async (req: Request, res: Response) => {
  const periode = String(req.query.periode || '').trim();
  const row = await Subscription.findOne({ periode, delete_date: null }).lean();
  res.json(row ? {
    _id: String(row._id),
    periode: row.periode,
    estimasi: row.estimasi,
    realisasi: row.realisasi,
    total_toko_estimasi: row.total_subscriber_estimasi,
    total_toko_realisasi: row.total_subscriber_realisasi,
  } : null);
};

export const createSchedule = async (req: Request, res: Response) => {
  const userTag = resolveUserId(req);
  const { subscriber_id, start, bulan = 1, diskon = 0, diskon_percent = 0, keterangan } = req.body;
  const startDate = parseDateOnly(start);
  if (!subscriber_id || !startDate) return res.status(400).json({ message: 'Subscriber dan start date wajib diisi.' });
  const subscriber: any = await Subscriber.findById(subscriber_id);
  if (!subscriber) return res.status(404).json({ message: 'Subscriber tidak ditemukan.' });
  const active = await SubscriptionDetail.findOne({ subscriber_id, status: { $in: ['OPEN', 'PROCESS'] }, is_active: { $ne: false }, delete_date: null });
  if (active) return res.status(400).json({ message: 'Subscriber sudah memiliki subscription aktif.' });
  try {
    await validateNewSubscriptionStart(subscriber._id, startDate, subscriber.program);
  } catch (error: any) {
    return res.status(400).json({ message: error?.message || 'Tanggal mulai subscription tidak valid.' });
  }

  const months = Math.max(1, Number(bulan || 1));
  const price = Math.max(0, Number(subscriber.biaya || 0));
  const detail = await createOpenDetail({
    chain_id: crypto.randomUUID(),
    subscriber_id: subscriber._id,
    kode_subscriber: subscriber.kode,
    toko: subscriber.toko,
    program: subscriber.program,
    daerah: subscriber.daerah || null,
    biaya_per_bulan: price,
    jumlah_bulan: months,
  }, startDate, userTag, { diskon: Number(diskon || 0), diskon_percent: Number(diskon_percent || 0), keterangan });
  await Subscriber.updateOne(
    { _id: subscriber._id, delete_date: null },
    {
      $set: {
        status_subscriber: 'AKTIF',
        tgl_non_aktif: null,
        alasan_non_aktif: null,
        update_date: new Date(),
        update_by: userTag,
      },
    }
  );
  await rebuildSubscriptionYears(getDetailRekapYears(detail), userTag);
  await rebuildSubscriberTahun(subscriber._id, detail.tahun, userTag);
  res.status(201).json(toDto(detail));
};

export const updateItem = async (req: Request, res: Response) => {
  const userTag = resolveUserId(req);
  const { periode, itemId } = req.params;
  const detail: any = await SubscriptionDetail.findOne({ _id: itemId, periode, delete_date: null });
  if (!detail) return res.status(404).json({ message: 'item not found' });
  if (detail.status !== 'OPEN') return res.status(400).json({ message: 'Edit tersedia hanya untuk status OPEN' });
  const oldSummaryTarget = { subscriber_id: detail.subscriber_id, tahun: detail.tahun };
  const affectedYears = getDetailRekapYears(detail);

  const startDate = req.body.start ? asDate(req.body.start) : asDate(detail.tgl_mulai_tagihan);
  const months = Math.max(1, Number(req.body.bulan ?? detail.jumlah_bulan ?? 1));
  const price = Math.max(0, Number(req.body.harga ?? detail.biaya_per_bulan ?? 0));
  const jumlahBiaya = price * months;
  const diskon = Math.max(0, Math.min(jumlahBiaya, Number(req.body.diskon ?? detail.diskon ?? 0)));
  const tempo = getTempo(startDate, months);
  detail.tgl_mulai_tagihan = formatYMD(startDate);
  detail.periode = toPeriode(startDate);
  detail.tahun = getFiscalYear(startDate);
  detail.jumlah_bulan = months;
  detail.tgl_berakhir_langganan = formatYMD(tempo);
  detail.tgl_bayar_selanjutnya = formatYMD(addDays(tempo, 1));
  detail.biaya_per_bulan = price;
  detail.jumlah_biaya = jumlahBiaya;
  detail.diskon = diskon;
  detail.diskon_percent = Math.max(0, Math.min(100, Number(req.body.diskon_percent ?? detail.diskon_percent ?? 0)));
  detail.total_biaya = Math.max(0, jumlahBiaya - diskon);
  detail.keterangan = String(req.body.keterangan || detail.keterangan || '-').trim() || '-';
  detail.invoice_meta = undefined;
  detail.doku_payment = undefined;
  detail.update_date = new Date();
  detail.update_by = userTag;
  await detail.save();

  getDetailRekapYears(detail).forEach((year) => affectedYears.add(year));
  await rebuildSubscriptionYears(affectedYears, userTag);
  await rebuildSubscriberTahunForDetails([oldSummaryTarget, detail], userTag);
  res.json({ message: 'item updated', item: toDto(detail) });
};

export const deleteItem = async (req: Request, res: Response) => {
  const userTag = resolveUserId(req);
  const { periode, itemId } = req.params;
  const detail: any = await SubscriptionDetail.findOne({ _id: itemId, periode, delete_date: null });
  if (!detail) return res.status(404).json({ message: 'item not found' });
  if (detail.status !== 'OPEN') return res.status(400).json({ message: 'Hapus tersedia hanya untuk status OPEN' });
  const affectedYears = getDetailRekapYears(detail);
  detail.delete_date = new Date();
  detail.delete_by = userTag;
  await detail.save();
  await rebuildSubscriptionYears(affectedYears, userTag);
  await rebuildSubscriberTahunForDetails([detail], userTag);
  res.json({ message: 'item deleted' });
};

export const verifySubscriptionDetail = async (req: Request, res: Response) => {
  try {
    const userTag = resolveUserId(req);
    const { periode, itemId } = req.params;
    const subscriberId = String(req.body.subscriber_id || '').trim();
    if (!subscriberId) return res.status(400).json({ message: 'Subscriber wajib dipilih.' });

    const detail: any = await SubscriptionDetail.findOne({ _id: itemId, periode, delete_date: null });
    if (!detail) return res.status(404).json({ message: 'item not found' });
    if (detail.status !== 'OPEN') return res.status(400).json({ message: 'Verifikasi tersedia hanya untuk status OPEN.' });

    const subscriber: any = await Subscriber.findOne({ _id: subscriberId, delete_date: null });
    if (!subscriber) return res.status(404).json({ message: 'Subscriber tidak ditemukan.' });

    const duplicate = await SubscriptionDetail.findOne({
      _id: { $ne: detail._id },
      subscriber_id: subscriber._id,
      tgl_mulai_tagihan: asYMD(detail.tgl_mulai_tagihan),
      program: subscriber.program || detail.program,
      delete_date: null,
    }).lean();
    if (duplicate) {
      return res.status(400).json({
        message: `Periode ${asYMD(detail.tgl_mulai_tagihan)} sudah ada untuk subscriber ${subscriber.toko}.`,
      });
    }

    const affectedYears = getDetailRekapYears(detail);
    const oldSummaryTarget = { subscriber_id: detail.subscriber_id, tahun: detail.tahun };
    detail.subscriber_id = subscriber._id;
    detail.kode_subscriber = subscriber.kode || null;
    detail.toko = subscriber.toko || detail.toko;
    detail.program = subscriber.program || detail.program;
    detail.daerah = subscriber.daerah || detail.daerah || null;
    detail.patch_match_status = 'VERIFIED';
    detail.patch_match_reason = 'verified-from-ui';
    detail.verified_at = new Date();
    detail.verified_by = userTag;
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();

    getDetailRekapYears(detail).forEach((year) => affectedYears.add(year));
    await rebuildSubscriptionYears(affectedYears, userTag);
    await rebuildSubscriberTahunForDetails([oldSummaryTarget, detail], userTag);
    res.json({ message: 'Subscription berhasil diverifikasi.', item: toDto(detail) });
  } catch (error: any) {
    res.status(500).json({ message: error?.message || 'Server error', error });
  }
};

export const updateItemActive = async (req: Request, res: Response) => {
  const userTag = resolveUserId(req);
  const { periode, itemId } = req.params;
  const detail: any = await SubscriptionDetail.findOne({ _id: itemId, periode, delete_date: null });
  if (!detail) return res.status(404).json({ message: 'item not found' });
  if (requireVerifiedDetail(detail, res)) return;
  const isActive = Boolean(req.body.is_active);
  const wasActive = detail.is_active !== false;
  if (isActive && !wasActive) {
    const laterDetail = await SubscriptionDetail.findOne({
      subscriber_id: detail.subscriber_id,
      tgl_mulai_tagihan: { $gt: asYMD(detail.tgl_mulai_tagihan) },
      delete_date: null,
    }).sort({ tgl_mulai_tagihan: 1 }).lean();
    if (laterDetail) {
      return res.status(400).json({
        message: `Data tidak bisa diaktifkan kembali karena sudah ada subscription lanjutan mulai ${asYMD((laterDetail as any).tgl_mulai_tagihan)}.`,
      });
    }
  }
  const affectedYears = getDetailRekapYears(detail);
  detail.is_active = isActive;
  detail.update_date = new Date();
  detail.update_by = userTag;
  await detail.save();
  getDetailRekapYears(detail).forEach((year) => affectedYears.add(year));
  if (detail.subscriber_id) {
    const subscriberUpdate = isActive
      ? {
          status_subscriber: 'AKTIF',
          tgl_non_aktif: null,
          alasan_non_aktif: null,
          update_date: new Date(),
          update_by: userTag,
        }
      : {
          status_subscriber: 'NON_AKTIF',
          tgl_non_aktif: formatYMD(parseDateOnly(req.body.tgl_non_aktif) || new Date()),
          alasan_non_aktif: String(req.body.alasan_non_aktif || '').trim() || '-',
          update_date: new Date(),
          update_by: userTag,
        };
    await Subscriber.updateOne({ _id: detail.subscriber_id, delete_date: null }, { $set: subscriberUpdate });
  }
  if (wasActive !== isActive) {
    await rebuildSubscriptionYears(affectedYears, userTag);
  }
  await rebuildSubscriberTahunForDetails([detail], userTag);
  res.json({ message: 'active updated', item: toDto(detail) });
};

const markDone = async (detail: any, paidDate: Date, userTag: string) => {
  if (detail.status === 'DONE') return null;
  detail.status = 'DONE';
  detail.tgl_lunas = formatYMD(paidDate);
  detail.update_date = new Date();
  detail.update_by = userTag;
  await detail.save();
  await syncSubscriberPaymentDatesFromLatestDone(detail.subscriber_id, userTag);
  let nextDetail = null;
  const nextStartDate = asDate(detail.tgl_bayar_selanjutnya);
  if (detail.is_active !== false && await isSubscriberSubscriptionActive(detail.subscriber_id)) {
    const existingOpen = await SubscriptionDetail.findOne({
      chain_id: detail.chain_id,
      status: { $in: ['OPEN', 'PROCESS'] },
      delete_date: null,
    });
    const existingNext = await SubscriptionDetail.findOne({
      chain_id: detail.chain_id,
      tgl_mulai_tagihan: formatYMD(nextStartDate),
      delete_date: null,
    });
    if (!existingOpen && !existingNext) {
      nextDetail = await createOpenDetail({
        chain_id: detail.chain_id,
        subscriber_id: detail.subscriber_id,
        kode_subscriber: detail.kode_subscriber,
        toko: detail.toko,
        program: detail.program,
        daerah: detail.daerah,
        biaya_per_bulan: detail.biaya_per_bulan,
        jumlah_bulan: detail.jumlah_bulan,
      }, nextStartDate, userTag);
    }
  }
  return nextDetail;
};

export const updateItemStatus = async (req: Request, res: Response) => {
  const userTag = resolveUserId(req);
  const { periode, itemId } = req.params;
  const status = String(req.body.status || '');
  const detail: any = await SubscriptionDetail.findOne({ _id: itemId, periode, delete_date: null });
  if (!detail) return res.status(404).json({ message: 'item not found' });
  if (requireVerifiedDetail(detail, res)) return;
  if (!['OPEN', 'PROCESS', 'DONE'].includes(status)) return res.status(400).json({ message: 'status tidak valid' });

  const affectedYears = getDetailRekapYears(detail);
  let removedNextDetail: any = null;
  let createdNextDetail: any = null;
  if (status === 'DONE') {
    createdNextDetail = await markDone(detail, parseDateOnly(req.body.tanggalLunas) || new Date(), userTag);
  } else {
    if (detail.status === 'DONE' && status === 'PROCESS') {
      const nextDetail: any = await SubscriptionDetail.findOne({ chain_id: detail.chain_id, tgl_mulai_tagihan: asYMD(detail.tgl_bayar_selanjutnya), status: 'OPEN', delete_date: null });
      if (nextDetail) {
        removedNextDetail = nextDetail.toObject ? nextDetail.toObject() : nextDetail;
        getDetailRekapYears(removedNextDetail).forEach((year) => affectedYears.add(year));
        await SubscriptionDetail.deleteOne({ _id: nextDetail._id });
      }
      detail.tgl_lunas = null;
    }
    detail.status = status;
    if (status === 'OPEN') {
      detail.tgl_lunas = null;
      detail.invoice_meta = undefined;
      detail.doku_payment = undefined;
    }
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();
    await syncSubscriberPaymentDatesFromLatestDone(detail.subscriber_id, userTag);
  }
  getDetailRekapYears(detail).forEach((year) => affectedYears.add(year));
  getDetailRekapYears(createdNextDetail).forEach((year) => affectedYears.add(year));
  await rebuildSubscriptionYears(affectedYears, userTag);
  await rebuildSubscriberTahunForDetails([detail, removedNextDetail, createdNextDetail], userTag);
  res.json({ message: 'status updated', item: toDto(detail) });
};

export const generateInvoiceAndMarkProcess = async (req: Request, res: Response) => {
  const userTag = resolveUserId(req);
  const targetItems = Array.isArray(req.body.target_items) && req.body.target_items.length
    ? req.body.target_items
    : [{ periode: req.params.periode, item_id: req.params.itemId }];
  const docs: any[] = [];
  for (const target of targetItems) {
    const found: any = await SubscriptionDetail.findOne({ _id: target.item_id, periode: target.periode, delete_date: null });
    if (found) docs.push(found);
  }
  if (!docs.length) return res.status(404).json({ message: 'item not found' });
  if (docs.some(isUnverifiedDetail)) {
    return res.status(400).json({ message: 'Ada data subscription yang belum diverifikasi. Verifikasi relasi subscriber terlebih dahulu.' });
  }

  const invoiceNumber = docs[0].invoice_meta?.invoice_number || await generateMonthlyInvoiceNumber();
  const payload = req.body || {};
  const invoice = {
    invoice_number: invoiceNumber,
    generated_at: new Date(),
    generated_by: userTag,
    sender: INVOICE_SENDER,
    customer: payload.customer || { name: docs[0].toko, address: '', phone: '' },
    payment_accounts: Array.isArray(payload.payment_accounts) ? payload.payment_accounts : [],
    items: Array.isArray(payload.items) ? payload.items : docs.map((doc) => ({
      program_name: doc.program,
      qty: doc.jumlah_bulan,
      unit_price: doc.biaya_per_bulan,
      line_total: doc.jumlah_biaya,
      start_date: asYMD(doc.tgl_mulai_tagihan),
      tempo_date: asYMD(doc.tgl_berakhir_langganan),
    })),
    subtotal: Number(payload.subtotal ?? docs.reduce((sum, doc) => sum + Number(doc.jumlah_biaya || 0), 0)),
    discount_label: String(payload.discount_label || 'DISC'),
    discount_percent: Number(payload.discount_percent || 0),
    discount_rp: Number(payload.discount_rp ?? docs.reduce((sum, doc) => sum + Number(doc.diskon || 0), 0)),
    extra_deduction_rp: Number(payload.extra_deduction_rp || 0),
    grand_total: Number(payload.grand_total ?? docs.reduce((sum, doc) => sum + Number(doc.total_biaya || 0), 0)),
    notes: payload.notes || '',
    display_date: payload.display_date || formatYMD(new Date()),
  };

  const affectedYears = new Set<number>();
  for (const doc of docs) {
    getDetailRekapYears(doc).forEach((year) => affectedYears.add(year));
    doc.invoice_meta = invoice;
    doc.status = 'PROCESS';
    doc.update_date = new Date();
    doc.update_by = userTag;
    await doc.save();
    getDetailRekapYears(doc).forEach((year) => affectedYears.add(year));
  }
  await rebuildSubscriptionYears(affectedYears, userTag);
  await rebuildSubscriberTahunForDetails(docs, userTag);
  res.json({
    message: 'invoice generated',
    status: 'PROCESS',
    periode: docs[0].periode,
    item_id: String(docs[0]._id),
    affected_items: docs.map((doc) => ({ periode: doc.periode, item_id: String(doc._id) })),
    affected_periodes: Array.from(new Set(docs.map((doc) => doc.periode))),
    invoice,
    doku_payment: null,
  });
};

export const generateDokuPaymentLink = async (req: Request, res: Response) => {
  try {
    const userTag = resolveUserId(req);
    const { periode, itemId } = req.params;
    const detail: any = await SubscriptionDetail.findOne({ _id: itemId, periode, delete_date: null });
    if (!detail) return res.status(404).json({ message: 'item not found' });
    if (requireVerifiedDetail(detail, res)) return;
    if (!detail.invoice_meta?.invoice_number) {
      detail.invoice_meta = {
        invoice_number: await generateMonthlyInvoiceNumber(),
        generated_at: new Date(),
        generated_by: userTag,
        sender: INVOICE_SENDER,
        customer: { name: detail.toko, address: '', phone: '' },
        items: [{ program_name: detail.program, qty: detail.jumlah_bulan, unit_price: detail.biaya_per_bulan, line_total: detail.jumlah_biaya, start_date: asYMD(detail.tgl_mulai_tagihan), tempo_date: asYMD(detail.tgl_berakhir_langganan) }],
        subtotal: detail.jumlah_biaya,
        discount_label: 'DISC',
        discount_percent: detail.diskon_percent || 0,
        discount_rp: detail.diskon || 0,
        extra_deduction_rp: 0,
        grand_total: detail.total_biaya,
        notes: '',
        display_date: formatYMD(new Date()),
      };
    }
    const subscriber: any = await Subscriber.findById(detail.subscriber_id).lean();
    const affectedYears = getDetailRekapYears(detail);
    const dokuResult = await createDokuCheckout({
      amount: Math.round(Number(detail.invoice_meta.grand_total || detail.total_biaya)),
      invoiceNumber: detail.invoice_meta.invoice_number,
      customer: normalizeDokuCustomer({
        id: detail.kode_subscriber,
        name: detail.toko,
        phone: subscriber?.no_hp_owner || subscriber?.nomor_telepon || undefined,
        address: subscriber?.alamat || undefined,
        country: 'ID',
      }),
    });
    detail.doku_payment = {
      invoice_number: detail.invoice_meta.invoice_number,
      payment_url: dokuResult.paymentUrl,
      token_id: dokuResult.tokenId,
      expired_date: dokuResult.expiredDate,
      amount: Math.round(Number(detail.invoice_meta.grand_total || detail.total_biaya)),
      request_id: dokuResult.requestId,
      generated_at: new Date(),
      generated_by: userTag,
      status: 'PENDING',
      customer: dokuResult.customer,
    };
    detail.status = 'PROCESS';
    await detail.save();
    getDetailRekapYears(detail).forEach((year) => affectedYears.add(year));
    await rebuildSubscriptionYears(affectedYears, userTag);
    await rebuildSubscriberTahunForDetails([detail], userTag);
    res.json({ message: 'Link pembayaran DOKU berhasil dibuat.', reused: false, payment: detail.doku_payment });
  } catch (error: any) {
    if (error instanceof DokuApiError) return res.status(error.status || 502).json({ message: error.message, details: error.details });
    res.status(500).json({ message: error?.message || 'Server error', error });
  }
};

export const listSubscriberTahun = async (req: Request, res: Response) => {
  try {
    const tahun = Number(req.query.tahun || getCurrentFiscalYear());
    const subscriberId = String(req.query.subscriber_id || '').trim();
    const kodeGroup = String(req.query.kode_group || 'ALL').trim();
    const statusSubscriber = String(req.query.status_subscriber || 'ALL').trim().toUpperCase();
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(Math.max(Number(req.query.limit || 25), 1), 500);
    const skip = (page - 1) * limit;

    const match: any = { tahun, delete_date: null };
    if (subscriberId) match.subscriber_id = subscriberId;
    if (kodeGroup && kodeGroup !== 'ALL') match.kode_group = kodeGroup;
    if (statusSubscriber && statusSubscriber !== 'ALL') match.status_subscriber = statusSubscriber;

    const [data, total] = await Promise.all([
      SubscriberTahun.find(match).sort({ toko: 1 }).skip(skip).limit(limit).lean(),
      SubscriberTahun.countDocuments(match),
    ]);

    res.json({
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error in listSubscriberTahun:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const rebuildSubscriberTahunEndpoint = async (req: Request, res: Response) => {
  try {
    const userTag = resolveUserId(req);
    const tahun = Number(req.body.tahun || req.query.tahun || getCurrentFiscalYear());
    const subscriberId = String(req.body.subscriber_id || req.query.subscriber_id || '').trim();
    if (!tahun) return res.status(400).json({ message: 'Tahun wajib diisi.' });

    if (subscriberId) {
      const row = await rebuildSubscriberTahun(subscriberId, tahun, userTag);
      return res.json({ message: 'Summary subscriber tahunan berhasil direbuild.', total: row ? 1 : 0, data: row });
    }

    const result = await rebuildAllSubscriberTahun(tahun, userTag);
    res.json({ message: 'Summary subscriber tahunan berhasil direbuild.', ...result });
  } catch (error) {
    console.error('Error in rebuildSubscriberTahunEndpoint:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const rebuildSubscriptionMonthlyRekapEndpoint = async (req: Request, res: Response) => {
  try {
    const userTag = resolveUserId(req);
    const tahun = Number(req.body.tahun || req.query.tahun || getCurrentFiscalYear());
    if (!tahun) return res.status(400).json({ message: 'Tahun wajib diisi.' });
    const result = await rebuildSubscriptionMonthlyRekap(tahun, userTag);
    res.json({ message: 'Rekap subscription bulanan berhasil direbuild.', ...result });
  } catch (error) {
    console.error('Error in rebuildSubscriptionMonthlyRekapEndpoint:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getLastPeriod = async (_req: Request, res: Response) => {
  const last = await SubscriptionDetail.findOne({ delete_date: null }, { periode: 1 }).sort({ periode: -1 }).lean();
  res.json({ periode: last?.periode || null });
};

export const startGenerateNextFiscal = async (_req: Request, res: Response) => {
  const last = await SubscriptionDetail.findOne({ delete_date: null }, { tahun: 1 }).sort({ tahun: -1 }).lean();
  const nextFiscalLabel = Number(last?.tahun || new Date().getFullYear()) + 1;
  const jobId = crypto.randomUUID();
  jobs.set(jobId, { status: 'done', nextFiscalLabel, total: 0, done: 0, startedAt: Date.now(), finishedAt: Date.now() });
  res.json({ jobId, nextFiscalLabel, total: 0 });
};

export const getGenerateStatus = async (req: Request, res: Response) => {
  const job = jobs.get(String(req.query.jobId || ''));
  res.json(job || { status: 'done', nextFiscalLabel: new Date().getFullYear() + 1, total: 0, done: 0, startedAt: Date.now(), finishedAt: Date.now() });
};

export const generateNextFiscal = async (_req: Request, res: Response) => {
  res.json({ message: 'Generate data tahunan tidak dipakai di modul subscription baru.', nextFiscalLabel: new Date().getFullYear() + 1, affected: [] });
};

export const renewSubscriptionNextFiscal = async (req: Request, res: Response) => {
  try {
    const userTag = resolveUserId(req);
    const targetYear = Number(req.body.tahun || req.query.tahun || 0);
    if (!targetYear) return res.status(400).json({ message: 'Tahun tujuan wajib diisi.' });

    const subscribers: any[] = await Subscriber.find({
      delete_date: null,
      status_aktv: true,
      $or: [
        { status_subscriber: 'AKTIF' },
        { status_subscriber: { $exists: false } },
        { status_subscriber: null },
      ],
    }).sort({ toko: 1 }).lean();

    const created: Array<{ toko: string; periode: string; start: string }> = [];
    const skipped: Array<{ toko: string; alasan: string }> = [];

    for (const subscriber of subscribers) {
      const latest: any = await SubscriptionDetail.findOne({
        subscriber_id: subscriber._id,
        delete_date: null,
      }).sort({ tgl_mulai_tagihan: -1, input_date: -1 });

      if (!latest) {
        skipped.push({ toko: subscriber.toko, alasan: 'belum memiliki data subscription' });
        continue;
      }

      if (latest.is_active === false || subscriber.status_subscriber === 'NON_AKTIF') {
        skipped.push({ toko: subscriber.toko, alasan: 'subscriber nonaktif' });
        continue;
      }

      if (latest.status === 'OPEN' || latest.status === 'PROCESS') {
        const latestStart = asDate(latest.tgl_mulai_tagihan);
        const latestFiscalYear = getFiscalYear(latestStart);
        skipped.push({
          toko: subscriber.toko,
          alasan: latestFiscalYear === targetYear ? 'data lanjutan sudah tersedia' : 'tagihan terakhir belum lunas',
        });
        continue;
      }

      if (latest.status !== 'DONE') {
        skipped.push({ toko: subscriber.toko, alasan: 'tagihan terakhir belum lunas' });
        continue;
      }

      const nextStart = asDate(latest.tgl_bayar_selanjutnya);
      const nextFiscalYear = getFiscalYear(nextStart);
      if (nextFiscalYear < targetYear) {
        skipped.push({ toko: subscriber.toko, alasan: 'tagihan terakhir belum lengkap atau ada gap sebelum tahun tujuan' });
        continue;
      }
      if (nextFiscalYear > targetYear) {
        skipped.push({ toko: subscriber.toko, alasan: 'tagihan berikutnya belum masuk tahun tujuan' });
        continue;
      }

      const existingNext = await SubscriptionDetail.findOne({
        chain_id: latest.chain_id,
        tgl_mulai_tagihan: formatYMD(nextStart),
        delete_date: null,
      });
      if (existingNext) {
        skipped.push({ toko: subscriber.toko, alasan: 'data lanjutan sudah tersedia' });
        continue;
      }

      const existingActive = await SubscriptionDetail.findOne({
        chain_id: latest.chain_id,
        status: { $in: ['OPEN', 'PROCESS'] },
        delete_date: null,
      });
      if (existingActive) {
        skipped.push({ toko: subscriber.toko, alasan: 'data lanjutan sudah tersedia' });
        continue;
      }

      const detail = await createOpenDetail({
        chain_id: latest.chain_id,
        subscriber_id: latest.subscriber_id,
        kode_subscriber: latest.kode_subscriber,
        toko: latest.toko,
        program: latest.program,
        daerah: latest.daerah || null,
        biaya_per_bulan: latest.biaya_per_bulan,
        jumlah_bulan: latest.jumlah_bulan,
      }, nextStart, userTag, { diskon: 0, diskon_percent: 0, keterangan: 'Renew subscription' });

      await rebuildSubscriptionYears(getDetailRekapYears(detail), userTag);
      await rebuildSubscriberTahunForDetails([detail], userTag);
      created.push({ toko: detail.toko, periode: detail.periode, start: detail.tgl_mulai_tagihan });
    }

    res.json({
      message: `Renew Subscription ${targetYear} selesai.`,
      tahun: targetYear,
      dibuat: created.length,
      dilewati: skipped.length,
      detail: {
        dibuat: created,
        dilewati: skipped,
      },
    });
  } catch (error) {
    console.error('Error in renewSubscriptionNextFiscal:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const uploadInvoicePdfs = async (req: Request, res: Response) => {
  const invoiceNumber = decodeURIComponent(String(req.params.invoiceNumber || ''));
  const files = req.files as Record<string, Express.Multer.File[]> | undefined;
  const original = files?.original?.[0];
  const paid = files?.paid?.[0];
  const pdf_original_url = original ? `/uploads/vps-invoices/${original.filename}` : undefined;
  const pdf_paid_url = paid ? `/uploads/vps-invoices/${paid.filename}` : undefined;
  await SubscriptionDetail.updateMany(
    { 'invoice_meta.invoice_number': invoiceNumber },
    {
      $set: {
        ...(pdf_original_url ? { 'invoice_meta.pdf_original_url': pdf_original_url } : {}),
        ...(pdf_paid_url ? { 'invoice_meta.pdf_paid_url': pdf_paid_url } : {}),
      },
    }
  );
  res.json({ pdf_original_url, pdf_paid_url });
};
