import { Request, Response } from 'express';
import mongoose from 'mongoose';
import Subscriber from '../models/Subscriber';
import Subscription from '../models/Subscription';
import SubscriptionDetail from '../models/SubscriptionDetail';
import InvoiceCounter from '../models/InvoiceCounter';
import { addDays, getTempo, parseDateOnly, toPeriode } from '../utils/subscriptionPeriod';
import {
  createDokuCheckout,
  DokuApiError,
  getDokuTransactionStatus,
  normalizeDokuCustomer,
  verifyDokuCallbackToken,
  verifyDokuNotificationSignature,
} from '../services/dokuService';
import {
  rebuildSubscriberTahun,
  rebuildSubscriberTahunForDetails,
} from '../services/subscriberTahunService';

const INVOICE_SENDER = {
  name: 'PT. NAGATECH SISTEM INTEGRATOR',
  address: 'JL.CILENGKRANG 1, BANDUNG, JAWA BARAT, INDONESIA',
  phone: '0811-2286-6660',
};

const resolveUserId = (req: Request) => {
  if (req.user && typeof req.user === 'object') {
    return (req.user as any).name || (req.user as any).username || (req.user as any).id || (req.user as any)._id || 'system';
  }
  if (typeof req.user === 'string' && req.user.length > 0) return req.user;
  return 'system';
};

const normalizeOptionalString = (value: unknown): string | null => {
  const text = String(value ?? '').trim();
  return text || null;
};

const formatDateOnly = (date: Date) => {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getDateKeyYYMMDD = (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
};

const getMonthKeyYYMM = (date = new Date()) => {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
};

const generateMonthlyInvoiceNumber = async () => {
  const now = new Date();
  const dateKey = getDateKeyYYMMDD(now);
  const monthKey = getMonthKeyYYMM(now);
  const counter = await InvoiceCounter.findOneAndUpdate(
    { date_key: monthKey },
    { $inc: { last_seq: 1 } },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );
  const seq = String(counter?.last_seq || 1).padStart(4, '0');
  return `FJ${dateKey}-${seq}`;
};

const isDokuLinkStillActive = (expiredDate?: string) => {
  if (!expiredDate || !/^\d{14}$/.test(expiredDate)) return false;
  const year = Number(expiredDate.slice(0, 4));
  const month = Number(expiredDate.slice(4, 6));
  const day = Number(expiredDate.slice(6, 8));
  const hour = Number(expiredDate.slice(8, 10));
  const minute = Number(expiredDate.slice(10, 12));
  const second = Number(expiredDate.slice(12, 14));
  const expiresAt = Date.UTC(year, month - 1, day, hour - 7, minute, second);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
};

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
      totalBiaya: Math.max(0, jumlahBiaya - diskon),
    });
    cursorStart = nextStart;
    isFirst = false;
  }

  return entries;
};

const recalcRekapTahun = async (tahun: number, userTag: string) => {
  void tahun;
  void userTag;
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
        realisasi: summary?.realisasi || 0,
        total_subscriber_realisasi: summary?.total_subscriber_realisasi || 0,
        updated_at: new Date(),
        update_date: new Date(),
        update_by: userTag,
      },
    }
  );
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
  if (!fiscalYear) return;
  const periods = getFiscalPeriods(fiscalYear);
  const monthly: Record<string, { estimasi: number; realisasi: number; total_subscriber_estimasi: number; total_subscriber_realisasi: number }> = {};
  periods.forEach((periode) => {
    monthly[periode] = { estimasi: 0, realisasi: 0, total_subscriber_estimasi: 0, total_subscriber_realisasi: 0 };
  });

  const details: any[] = await SubscriptionDetail.find({
    delete_date: null,
    status: { $in: ['OPEN', 'PROCESS', 'DONE'] },
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
      if (Number(detail.tahun || 0) === fiscalYear && monthly[detail.periode]) {
        monthly[detail.periode].estimasi += Number(detail.total_biaya || 0);
        monthly[detail.periode].total_subscriber_estimasi += 1;
      }
      const paidPeriode = periodeFromPaidDate(detail.tgl_lunas);
      if (paidPeriode && monthly[paidPeriode]) {
        monthly[paidPeriode].realisasi += Number(detail.total_biaya || 0);
        monthly[paidPeriode].total_subscriber_realisasi += 1;
      }
      continue;
    }
    if (detail.is_active === false) continue;
    if (detail.status === 'PROCESS' && hasLaterActiveUnpaid(detail)) {
      if (Number(detail.tahun || 0) === fiscalYear && monthly[detail.periode]) {
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

const createOpenDetail = async (
  seed: {
    chain_id: string;
    subscriber_id: any;
    kode_subscriber: string;
    toko: string;
    program: string;
    biaya_per_bulan: number;
    jumlah_bulan: number;
  },
  startDate: Date,
  userTag: string,
  options: { diskon?: number; keterangan?: string | null } = {}
) => {
  const jumlahBulan = seed.jumlah_bulan || 1;
  const tempo = getTempo(startDate, jumlahBulan);
  const nextStart = addDays(tempo, 1);
  const jumlahBiaya = seed.biaya_per_bulan * jumlahBulan;
  const diskon = Math.max(0, Math.min(jumlahBiaya, Number(options.diskon || 0)));

  const detail = await SubscriptionDetail.create({
    subscription_id: null,
    chain_id: seed.chain_id,
    subscriber_id: seed.subscriber_id,
    kode_subscriber: seed.kode_subscriber,
    toko: seed.toko,
    program: seed.program,
    periode: toPeriode(startDate),
    tahun: getFiscalYear(startDate),
    tgl_mulai_tagihan: formatDateOnly(startDate),
    jumlah_bulan: jumlahBulan,
    tgl_berakhir_langganan: formatDateOnly(tempo),
    tgl_bayar_selanjutnya: formatDateOnly(nextStart),
    biaya_per_bulan: seed.biaya_per_bulan,
    jumlah_biaya: jumlahBiaya,
    diskon,
    total_biaya: Math.max(0, jumlahBiaya - diskon),
    status: 'OPEN',
    keterangan: options.keterangan || null,
    input_by: userTag,
    update_by: userTag,
  });

  await rebuildSubscriptionYears(getDetailRekapYears(detail), userTag);
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
  const startYmd = formatDateOnly(startDate);
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

  if ((latest.status === 'OPEN' || latest.status === 'PROCESS') && latest.is_active !== false) {
    throw new Error('Subscriber sudah memiliki subscription aktif.');
  }

  const minStart = parseDateOnly(latest.tgl_bayar_selanjutnya) || parseDateOnly(latest.tgl_mulai_tagihan);
  if (minStart && startDate < minStart) {
    throw new Error(`Periode sebelumnya sudah ada. Lanjutkan dari tanggal tagihan selanjutnya (${formatDateOnly(minStart)}).`);
  }
};

const syncSubscriberPaymentDatesFromLatestDone = async (subscriberId: any, userTag: string) => {
  const latestDone: any = await SubscriptionDetail.findOne({
    subscriber_id: subscriberId,
    status: 'DONE',
    delete_date: null,
  }).sort({ tgl_mulai_tagihan: -1 });

  await Subscriber.findByIdAndUpdate(subscriberId, {
    tgl_terbayar: latestDone?.tgl_mulai_tagihan || null,
    tgl_berakhir_langganan: latestDone?.tgl_berakhir_langganan || null,
    tgl_bayar_selanjutnya: latestDone?.tgl_bayar_selanjutnya || null,
    update_date: new Date(),
    update_by: userTag,
  });
};

const markDetailLunas = async (params: {
  detail: any;
  paidDate: Date;
  userTag: string;
  metodeBayar?: string | null;
  diskon?: number;
  keterangan?: string | null;
}) => {
  const { detail, paidDate, userTag, metodeBayar, diskon, keterangan } = params;
  if (detail.status === 'DONE') {
    return { detail, nextDetail: null, alreadyPaid: true };
  }

  const affectedYears = getDetailRekapYears(detail);
  detail.diskon = Math.max(0, Number(diskon ?? detail.diskon ?? 0));
  detail.total_biaya = Math.max(0, detail.jumlah_biaya - detail.diskon);
  detail.status = 'DONE';
  detail.tgl_lunas = formatDateOnly(paidDate);
  detail.metode_bayar = metodeBayar || detail.metode_bayar || null;
  detail.keterangan = keterangan || detail.keterangan;
  detail.update_date = new Date();
  detail.update_by = userTag;
  await detail.save();
  await syncSubscriberPaymentDatesFromLatestDone(detail.subscriber_id, userTag);

  let nextDetail = null;
  const nextStartDate = parseDateOnly(detail.tgl_bayar_selanjutnya);
  if (nextStartDate && detail.is_active !== false && await isSubscriberSubscriptionActive(detail.subscriber_id)) {
    const existingOpen = await SubscriptionDetail.findOne({
      chain_id: detail.chain_id,
      status: { $in: ['OPEN', 'PROCESS'] },
      delete_date: null,
    });
    const existingNext = await SubscriptionDetail.findOne({
      chain_id: detail.chain_id,
      tgl_mulai_tagihan: formatDateOnly(nextStartDate),
      delete_date: null,
    });
    if (!existingOpen && !existingNext) {
      nextDetail = await createOpenDetail(
        {
          chain_id: detail.chain_id,
          subscriber_id: detail.subscriber_id,
          kode_subscriber: detail.kode_subscriber,
          toko: detail.toko,
          program: detail.program,
          biaya_per_bulan: detail.biaya_per_bulan,
          jumlah_bulan: detail.jumlah_bulan,
        },
        nextStartDate,
        userTag
      );
    }
  }

  getDetailRekapYears(detail).forEach((year) => affectedYears.add(year));
  getDetailRekapYears(nextDetail).forEach((year) => affectedYears.add(year));
  await rebuildSubscriptionYears(affectedYears, userTag);
  await rebuildSubscriberTahunForDetails([detail, nextDetail], userTag);

  return { detail, nextDetail, alreadyPaid: false };
};

const buildInvoiceMeta = async (detail: any, userTag: string) => {
  const subscriber = await Subscriber.findById(detail.subscriber_id).lean();
  const invoiceNumber = detail.invoice_meta?.invoice_number || await generateMonthlyInvoiceNumber();

  return {
    invoice_number: invoiceNumber,
    generated_at: new Date(),
    generated_by: userTag,
    sender: INVOICE_SENDER,
    customer: {
      name: detail.toko,
      address: subscriber?.alamat || '-',
      phone: subscriber?.no_hp_owner || subscriber?.nomor_telepon || '-',
    },
    items: [
      {
        program_name: detail.program,
        qty: detail.jumlah_bulan,
        unit_price: detail.biaya_per_bulan,
        line_total: detail.jumlah_biaya,
        start_date: formatDateOnly(detail.tgl_mulai_tagihan),
        tempo_date: formatDateOnly(detail.tgl_berakhir_langganan),
      },
    ],
    subtotal: detail.jumlah_biaya,
    discount_rp: detail.diskon,
    grand_total: detail.total_biaya,
    display_date: formatDateOnly(new Date()),
  };
};

const ensureInvoiceMeta = async (detail: any, userTag: string) => {
  const affectedYears = getDetailRekapYears(detail);
  detail.invoice_meta = await buildInvoiceMeta(detail, userTag);
  detail.status = 'PROCESS';
  detail.update_date = new Date();
  detail.update_by = userTag;
  await detail.save();
  getDetailRekapYears(detail).forEach((year) => affectedYears.add(year));
  await rebuildSubscriptionYears(affectedYears, userTag);
  await rebuildSubscriberTahunForDetails([detail], userTag);
  return detail;
};

export const listSubscription = async (req: Request, res: Response) => {
  try {
    const page = Math.max(1, Number(req.query.page || 1));
    const limit = Math.min(100, Math.max(1, Number(req.query.limit || 10)));
    const search = String(req.query.search || '').trim();
    const tahun = req.query.tahun ? Number(req.query.tahun) : null;
    const filter: any = { delete_date: null };
    if (tahun) filter.tahun = tahun;
    if (search) {
      filter.$or = [
        { periode: { $regex: search, $options: 'i' } },
      ];
    }

    const [data, total] = await Promise.all([
      Subscription.find(filter).sort({ periode: 1 }).skip((page - 1) * limit).limit(limit).lean(),
      Subscription.countDocuments(filter),
    ]);

    res.json({ data, pagination: { page, limit, total, totalPages: Math.max(1, Math.ceil(total / limit)) } });
  } catch (error) {
    console.error('Error in listSubscription:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const listSubscriptionDetail = async (req: Request, res: Response) => {
  try {
    const { tahun, status, subscription_id } = req.query;
    const filter: any = { delete_date: null };
    if (tahun) filter.tahun = Number(tahun);
    if (status) filter.status = status;
    if (subscription_id) filter.subscription_id = subscription_id;
    const data = await SubscriptionDetail.find(filter).sort({ tgl_mulai_tagihan: 1 }).lean();
    res.json(data);
  } catch (error) {
    console.error('Error in listSubscriptionDetail:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createSubscription = async (req: Request, res: Response) => {
  try {
    const { subscriber_id, tgl_mulai_tagihan, jumlah_bulan = 1, biaya_per_bulan, diskon = 0, keterangan } = req.body;
    const startDate = parseDateOnly(tgl_mulai_tagihan);
    if (!subscriber_id || !startDate) {
      return res.status(400).json({ message: 'Subscriber dan tgl mulai tagihan wajib diisi.' });
    }

    const subscriber = await Subscriber.findById(subscriber_id);
    if (!subscriber) return res.status(404).json({ message: 'Subscriber tidak ditemukan.' });

    const active = await SubscriptionDetail.findOne({ subscriber_id, status: { $in: ['OPEN', 'PROCESS'] }, is_active: { $ne: false }, delete_date: null });
    if (active) return res.status(400).json({ message: 'Subscriber sudah memiliki subscription aktif.' });
    try {
      await validateNewSubscriptionStart(subscriber._id, startDate, subscriber.program);
    } catch (error: any) {
      return res.status(400).json({ message: error?.message || 'Tanggal mulai subscription tidak valid.' });
    }

    const userTag = resolveUserId(req);
    const months = Math.max(1, Number(jumlah_bulan || 1));
    const price = Math.max(0, Number(biaya_per_bulan ?? subscriber.biaya ?? 0));
    const chainId = new mongoose.Types.ObjectId().toString();
    const scheduleEntries = buildFiscalSchedule({
      startDate,
      jumlahBulan: months,
      biayaPerBulan: price,
      firstDiskon: Number(diskon || 0),
    });

    const detail = await createOpenDetail({
      chain_id: chainId,
      subscriber_id: subscriber._id,
      kode_subscriber: subscriber.kode,
      toko: subscriber.toko,
      program: subscriber.program,
      biaya_per_bulan: price,
      jumlah_bulan: months,
    }, startDate, userTag, {
      diskon: Number(diskon || 0),
      keterangan: normalizeOptionalString(keterangan),
    });
    await rebuildSubscriberTahun(subscriber._id, detail.tahun, userTag);
    res.status(201).json({ success: true, message: 'Subscription berhasil dibuat.', data: { rekap: scheduleEntries, detail } });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Detail subscription untuk periode tersebut sudah ada.' });
    }
    console.error('Error in createSubscription:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const lunasiSubscriptionDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tgl_lunas, metode_bayar, diskon = 0, keterangan } = req.body;
    const paidDate = parseDateOnly(tgl_lunas) || new Date();
    const userTag = resolveUserId(req);

    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });
    if (detail.status === 'DONE') return res.status(400).json({ message: 'Detail subscription sudah lunas.' });

    const result = await markDetailLunas({
      detail,
      paidDate,
      userTag,
      metodeBayar: metode_bayar || null,
      diskon,
      keterangan,
    });

    res.json({ success: true, message: 'Pembayaran subscription berhasil dilunasi.', data: { detail: result.detail, next_detail: result.nextDetail } });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Detail subscription berikutnya sudah ada.' });
    }
    console.error('Error in lunasiSubscriptionDetail:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateSubscriptionDetailStatus = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { status, tanggalLunas } = req.body as { status?: 'OPEN' | 'PROCESS' | 'DONE'; tanggalLunas?: string };
    const userTag = resolveUserId(req);
    if (!['OPEN', 'PROCESS', 'DONE'].includes(String(status))) {
      return res.status(400).json({ message: 'Status tidak valid.' });
    }

    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });

    if (status === 'DONE') {
      const paidDate = parseDateOnly(tanggalLunas) || new Date();
      const result = await markDetailLunas({ detail, paidDate, userTag, metodeBayar: detail.metode_bayar || null });
      return res.json({ success: true, message: 'Status diperbarui.', data: { detail: result.detail, next_detail: result.nextDetail } });
    }

    const affectedYears = getDetailRekapYears(detail);
    let removedNextDetail: any = null;
    if (detail.status === 'DONE' && status === 'PROCESS') {
      const nextDetail = await SubscriptionDetail.findOne({
        chain_id: detail.chain_id,
        tgl_mulai_tagihan: detail.tgl_bayar_selanjutnya,
        status: 'OPEN',
        delete_date: null,
      });
      if (nextDetail) {
        removedNextDetail = nextDetail.toObject ? nextDetail.toObject() : nextDetail;
        getDetailRekapYears(removedNextDetail).forEach((year) => affectedYears.add(year));
        await SubscriptionDetail.deleteOne({ _id: nextDetail._id });
      }
      detail.tgl_lunas = null;
      detail.metode_bayar = null;
    }

    detail.status = status as any;
    detail.tgl_lunas = null;
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();
    await syncSubscriberPaymentDatesFromLatestDone(detail.subscriber_id, userTag);

    getDetailRekapYears(detail).forEach((year) => affectedYears.add(year));
    await rebuildSubscriptionYears(affectedYears, userTag);
    await rebuildSubscriberTahunForDetails([detail, removedNextDetail], userTag);
    res.json({ success: true, message: 'Status diperbarui.', data: detail });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Detail subscription berikutnya sudah ada.' });
    }
    console.error('Error in updateSubscriptionDetailStatus:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateSubscriptionDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { tgl_mulai_tagihan, jumlah_bulan, biaya_per_bulan, diskon = 0, keterangan } = req.body;
    const userTag = resolveUserId(req);

    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });
    if (detail.status !== 'OPEN') {
      return res.status(400).json({ message: 'Edit hanya tersedia untuk detail subscription status OPEN.' });
    }

    const oldStartDate = parseDateOnly(detail.tgl_mulai_tagihan);
    if (!oldStartDate) return res.status(400).json({ message: 'Tgl mulai tagihan lama tidak valid.' });
    const oldSummaryTarget = { subscriber_id: detail.subscriber_id, tahun: detail.tahun };
    const affectedYears = getDetailRekapYears(detail);

    const nextStartDate = tgl_mulai_tagihan ? parseDateOnly(tgl_mulai_tagihan) : oldStartDate;
    if (!nextStartDate) return res.status(400).json({ message: 'Tgl mulai tagihan tidak valid.' });
    const nextJumlahBulan = Math.max(1, Number(jumlah_bulan ?? detail.jumlah_bulan ?? 1));
    const nextBiayaPerBulan = Math.max(0, Number(biaya_per_bulan ?? detail.biaya_per_bulan ?? 0));
    const nextJumlahBiaya = nextBiayaPerBulan * nextJumlahBulan;
    const nextDiskon = Math.max(0, Math.min(nextJumlahBiaya, Number(diskon || 0)));
    const tempo = getTempo(nextStartDate, nextJumlahBulan);
    const nextPayDate = addDays(tempo, 1);
    detail.tgl_mulai_tagihan = formatDateOnly(nextStartDate);
    detail.periode = toPeriode(nextStartDate);
    detail.tahun = getFiscalYear(nextStartDate);
    detail.jumlah_bulan = nextJumlahBulan;
    detail.tgl_berakhir_langganan = formatDateOnly(tempo);
    detail.tgl_bayar_selanjutnya = formatDateOnly(nextPayDate);
    detail.biaya_per_bulan = nextBiayaPerBulan;
    detail.jumlah_biaya = nextJumlahBiaya;
    detail.diskon = nextDiskon;
    detail.total_biaya = Math.max(0, nextJumlahBiaya - nextDiskon);
    detail.keterangan = normalizeOptionalString(keterangan) || null;
    detail.invoice_meta = undefined;
    detail.doku_payment = undefined;
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();

    getDetailRekapYears(detail).forEach((year) => affectedYears.add(year));
    await rebuildSubscriptionYears(affectedYears, userTag);
    await rebuildSubscriberTahunForDetails([oldSummaryTarget, detail], userTag);

    res.json({ success: true, message: 'Detail subscription berhasil diupdate.', data: detail });
  } catch (error: any) {
    if (error?.code === 11000) {
      return res.status(400).json({ message: 'Detail subscription untuk periode tersebut sudah ada.' });
    }
    console.error('Error in updateSubscriptionDetail:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteSubscriptionDetail = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userTag = resolveUserId(req);
    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });
    if (detail.status !== 'OPEN') {
      return res.status(400).json({ message: 'Hapus hanya tersedia untuk detail subscription status OPEN.' });
    }

    const affectedYears = getDetailRekapYears(detail);

    detail.delete_date = new Date();
    detail.delete_by = userTag;
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();

    await rebuildSubscriptionYears(affectedYears, userTag);
    await rebuildSubscriberTahunForDetails([detail], userTag);

    res.json({ success: true, message: 'Detail subscription berhasil dihapus.' });
  } catch (error) {
    console.error('Error in deleteSubscriptionDetail:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const generateSubscriptionDokuPaymentLink = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userTag = resolveUserId(req);
    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });
    if (detail.status === 'DONE' || detail.status === 'BATAL') {
      return res.status(400).json({ message: 'Payment link hanya bisa dibuat untuk detail OPEN/PROCESS.' });
    }

    await ensureInvoiceMeta(detail, userTag);

    if (
      detail.doku_payment?.payment_url &&
      detail.doku_payment?.status !== 'SUCCESS' &&
      isDokuLinkStillActive(detail.doku_payment?.expired_date)
    ) {
      return res.json({ message: 'Payment link DOKU masih aktif.', reused: true, payment: detail.doku_payment });
    }

    const subscriber = await Subscriber.findById(detail.subscriber_id).lean();
    const customer = normalizeDokuCustomer({
      id: detail.kode_subscriber,
      name: detail.toko,
      phone: subscriber?.no_hp_owner || subscriber?.nomor_telepon || undefined,
      address: subscriber?.alamat || undefined,
      country: 'ID',
    });
    const amount = Math.round(Number(detail.invoice_meta?.grand_total ?? detail.total_biaya));
    const invoiceNumber = String(detail.invoice_meta?.invoice_number || '').trim();
    if (!invoiceNumber) return res.status(500).json({ message: 'Nomor invoice gagal dibuat.' });

    const dokuResult = await createDokuCheckout({
      amount,
      invoiceNumber,
      customer,
    });

    detail.doku_payment = {
      invoice_number: invoiceNumber,
      payment_url: dokuResult.paymentUrl,
      token_id: dokuResult.tokenId,
      expired_date: dokuResult.expiredDate,
      amount,
      request_id: dokuResult.requestId,
      generated_at: new Date(),
      generated_by: userTag,
      status: 'PENDING',
      customer: dokuResult.customer,
    };
    detail.status = 'PROCESS';
    detail.update_date = new Date();
    detail.update_by = userTag;
    await detail.save();

    res.json({ message: 'Payment link DOKU berhasil dibuat.', reused: false, payment: detail.doku_payment });
  } catch (error: any) {
    if (error instanceof DokuApiError) {
      return res.status(error.status || 502).json({ message: error.message, request_id: error.requestId, details: error.details });
    }
    console.error('Error in generateSubscriptionDokuPaymentLink:', error);
    res.status(500).json({ message: error?.message || 'Server error', error });
  }
};

export const handleSubscriptionDokuNotification = async (req: Request, res: Response) => {
  try {
    const rawBody = (req as Request & { rawBody?: string }).rawBody || JSON.stringify(req.body || {});
    const requestId = String(req.headers['request-id'] || '');
    const originalRequestId = String(req.body?.transaction?.original_request_id || req.body?.order?.request_id || '');
    const channelId = req.body?.channel?.id ? String(req.body.channel.id) : undefined;
    const invoiceNumber = String(req.body?.order?.invoice_number || '').trim();
    const amount = Math.round(Number(req.body?.order?.amount));
    const transactionStatus = String(req.body?.transaction?.status || '').toUpperCase();
    const paidAt = req.body?.transaction?.date ? new Date(req.body.transaction.date) : new Date();

    const signatureValid = verifyDokuNotificationSignature({
      clientId: String(req.headers['client-id'] || ''),
      requestId,
      requestTimestamp: String(req.headers['request-timestamp'] || ''),
      requestTarget: req.originalUrl.split('?')[0],
      requestBody: rawBody,
      signature: String(req.headers.signature || ''),
    });
    if (!signatureValid) return res.status(401).json({ message: 'Invalid DOKU signature' });
    if (!invoiceNumber || !Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Invalid DOKU payload' });
    }
    if (transactionStatus !== 'SUCCESS') {
      return res.json({ message: 'DOKU notification ignored', status: transactionStatus || 'UNKNOWN' });
    }

    const detail = await SubscriptionDetail.findOne({ 'doku_payment.invoice_number': invoiceNumber });
    if (!detail) return res.status(404).json({ message: 'Invoice DOKU tidak ditemukan.' });
    if (Math.round(Number(detail.doku_payment?.amount)) !== amount) {
      return res.status(400).json({ message: 'Nominal DOKU tidak sesuai.' });
    }

    detail.doku_payment = {
      ...(detail.doku_payment as any),
      status: 'SUCCESS',
      paid_at: paidAt,
      notification_request_id: requestId,
      transaction_original_request_id: originalRequestId || detail.doku_payment?.transaction_original_request_id,
      channel_id: channelId || detail.doku_payment?.channel_id,
    };
    await detail.save();
    await markDetailLunas({ detail, paidDate: paidAt, userTag: 'doku', metodeBayar: 'DOKU' });
    return res.json({ message: 'OK' });
  } catch (error) {
    console.error('Error in handleSubscriptionDokuNotification:', error);
    return res.status(500).json({ message: 'Server error', error });
  }
};

export const handleSubscriptionDokuCallbackResult = async (req: Request, res: Response) => {
  const token = String(req.query.token || '');
  const payload = verifyDokuCallbackToken(token);
  const frontendBase = String(process.env.FRONTEND_URL || process.env.APP_URL || 'http://localhost:8081').replace(/\/$/, '');
  const redirectTo = (status: string, message: string) => {
    const params = new URLSearchParams({ status, message });
    return res.redirect(`${frontendBase}/subscription?${params.toString()}`);
  };

  if (!payload) return redirectTo('failed', 'Token pembayaran tidak valid atau kedaluwarsa.');

  try {
    const detail = await SubscriptionDetail.findOne({ 'doku_payment.invoice_number': payload.invoiceNumber });
    if (!detail) return redirectTo('failed', 'Invoice pembayaran tidak ditemukan.');
    if (Math.round(Number(detail.doku_payment?.amount)) !== payload.amount) {
      return redirectTo('failed', 'Nominal pembayaran tidak sesuai.');
    }

    const dokuStatus = await getDokuTransactionStatus(payload.invoiceNumber);
    if (dokuStatus.status !== 'SUCCESS') {
      return redirectTo('pending', 'Pembayaran belum berhasil.');
    }

    const paidAt = dokuStatus.transactionDate ? new Date(dokuStatus.transactionDate) : new Date();
    detail.doku_payment = {
      ...(detail.doku_payment as any),
      status: 'SUCCESS',
      paid_at: paidAt,
      callback_verified_at: new Date(),
      transaction_original_request_id: dokuStatus.originalRequestId || detail.doku_payment?.transaction_original_request_id,
      channel_id: dokuStatus.channelId || detail.doku_payment?.channel_id,
    };
    await detail.save();
    await markDetailLunas({ detail, paidDate: paidAt, userTag: 'doku', metodeBayar: 'DOKU' });
    return redirectTo('success', 'Pembayaran subscription berhasil.');
  } catch (error: any) {
    console.error('Error in handleSubscriptionDokuCallbackResult:', error);
    return redirectTo('failed', error?.message || 'Gagal verifikasi pembayaran.');
  }
};

export const generateSubscriptionInvoice = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userTag = resolveUserId(req);
    const detail = await SubscriptionDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Detail subscription tidak ditemukan.' });
    if (detail.status === 'DONE' || detail.status === 'BATAL') {
      return res.status(400).json({ message: 'Invoice hanya bisa dibuat untuk detail OPEN/PROCESS.' });
    }

    await ensureInvoiceMeta(detail, userTag);

    res.json({ success: true, message: 'Invoice subscription berhasil dibuat.', data: detail });
  } catch (error) {
    console.error('Error in generateSubscriptionInvoice:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
