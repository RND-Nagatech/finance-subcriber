import { Request, Response } from 'express';
import TTVpsDetail, { ITTVpsDetail } from '../models/TTVpsDetail';
import TTVps from '../models/TTVps';
import Subscriber from '../models/Subscriber';
import InvoiceCounter from '../models/InvoiceCounter';
import { addDays, calcTempo, enumerateMonthsInclusive, toPeriod, formatYMD } from '../utils/vpsPeriod';
import mongoose from 'mongoose';
import {
  createDokuCheckout,
  DokuApiError,
  normalizeDokuCustomer,
  verifyDokuNotificationSignature,
} from '../services/dokuService';

function sum(arr: number[]): number { return arr.reduce((a, b) => a + b, 0); }

const INVOICE_SENDER = {
  name: 'PT. GRAHA INTEGRA APLIKASI',
  address: 'SEMARANG',
  phone: '0815-1959-5999',
};

function getDateKeyYYMMDD(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}${mm}${dd}`;
}

function getMonthKeyYYMM(date = new Date()): string {
  const yy = String(date.getFullYear()).slice(-2);
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  return `${yy}${mm}`;
}

async function generateMonthlyInvoiceNumber(): Promise<string> {
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
}

function generateDokuInvoiceNumber(itemId: string, sourceInvoiceNumber?: string): string {
  const sourceKey = String(sourceInvoiceNumber || '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  if (sourceKey) return `VPS${sourceKey}`.slice(0, 30);
  const dateKey = getDateKeyYYMMDD(new Date());
  const itemKey = itemId.replace(/[^a-zA-Z0-9]/g, '').slice(-8).toUpperCase();
  const randomKey = new mongoose.Types.ObjectId().toHexString().slice(-6).toUpperCase();
  return `VPS${dateKey}${itemKey}${randomKey}`.slice(0, 30);
}

function isDokuLinkStillActive(expiredDate?: string): boolean {
  if (!expiredDate || !/^\d{14}$/.test(expiredDate)) return false;
  const year = Number(expiredDate.slice(0, 4));
  const month = Number(expiredDate.slice(4, 6));
  const day = Number(expiredDate.slice(6, 8));
  const hour = Number(expiredDate.slice(8, 10));
  const minute = Number(expiredDate.slice(10, 12));
  const second = Number(expiredDate.slice(12, 14));
  const expiresAt = Date.UTC(year, month - 1, day, hour - 7, minute, second);
  return Number.isFinite(expiresAt) && expiresAt > Date.now();
}

async function resolveDokuCustomer(
  item: ITTVpsDetail,
  fallback?: { phone?: string; address?: string }
) {
  let subscriber = await Subscriber.findOne({
    toko: item.toko,
    program: item.program,
    delete_date: null,
  }).sort({ update_date: -1 });
  if (!subscriber) {
    subscriber = await Subscriber.findOne({ toko: item.toko, delete_date: null }).sort({ update_date: -1 });
  }

  return normalizeDokuCustomer({
    id: subscriber?.kode,
    name: item.toko,
    phone: subscriber?.nomor_telepon
      || subscriber?.no_hp_pic
      || subscriber?.no_hp_owner
      || fallback?.phone
      || item.invoice_meta?.customer?.phone,
    address: subscriber?.alamat
      || fallback?.address
      || item.invoice_meta?.customer?.address,
    city: subscriber?.daerah || item.daerah,
    country: 'ID',
  });
}

function isSameDokuCustomer(
  stored: NonNullable<ITTVpsDetail['doku_payment']>['customer'],
  current: ReturnType<typeof normalizeDokuCustomer>
): boolean {
  if (!stored?.name) return false;
  return JSON.stringify(normalizeDokuCustomer(stored)) === JSON.stringify(current);
}

function formatJakartaDate(value?: string): string {
  const date = value ? new Date(value) : new Date();
  const validDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(validDate);
  const getPart = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value || '';
  return `${getPart('year')}-${getPart('month')}-${getPart('day')}`;
}

async function recalcAggregateForPeriode(periode: string, user: any) {
  const allDetailsDocs = await TTVpsDetail.find({});
  const periodeDocs = allDetailsDocs.filter(d => d.periode === periode && (d as any).is_active !== false);
  const estimasi = sum(periodeDocs.map(d => d.total_harga));
  const total_toko_estimasi = periodeDocs.length;
  const realisasiDetails = allDetailsDocs.filter(d => d.status === 'DONE' && d.tgl_lunas && d.tgl_lunas.slice(0,7) === periode);
  const realisasi = sum(realisasiDetails.map(d => d.total_harga));
  const total_toko_realisasi = realisasiDetails.length;
  await TTVps.updateOne(
    { periode },
    {
      $set: {
        periode,
        estimasi,
        realisasi,
        total_toko_estimasi,
        total_toko_realisasi,
        updated_at: new Date(),
        update_date: new Date(),
        update_by: user?.username || user?._id || 'system',
      },
      $setOnInsert: {
        input_date: new Date(),
        input_by: user?.username || user?._id || 'system',
      },
    },
    { upsert: true }
  );
}

export const createSchedule = async (req: Request, res: Response) => {
  try {
    const body = req.body as {
      subscriber_id?: string;
      toko?: string;
      program?: string;
      daerah?: string;
      harga?: number;
      start: string;
      bulan: number;
      diskon?: number;
      diskon_percent?: number;
      keterangan?: string;
    };
    if (!body || !body.start || !body.bulan) {
      return res.status(400).json({ message: 'start and bulan are required' });
    }
    let toko = body.toko;
    let program = body.program;
    let daerah = body.daerah;
    let harga = body.harga;

    if (body.subscriber_id) {
      const sub = await Subscriber.findById(body.subscriber_id);
      if (!sub) return res.status(400).json({ message: 'subscriber not found' });
      toko = sub.toko;
      program = sub.program;
      daerah = sub.daerah;
      harga = sub.biaya;
    }

    if (!toko || !program || !daerah || typeof harga !== 'number') {
      return res.status(400).json({ message: 'toko, program, daerah, harga are required (or provide subscriber_id)' });
    }
    const diskonFirst = body.diskon ?? 0;
    const diskonPercentFirst = typeof body.diskon_percent === 'number' ? Math.max(0, Math.min(100, body.diskon_percent)) : 0;
    const startDate = new Date(body.start + 'T00:00:00.000Z');
    if (isNaN(startDate.getTime())) return res.status(400).json({ message: 'invalid start date' });

    const userTag = (req as any).user?.username || (req as any).user?._id || 'system';

    // Build schedule entries until fiscal end (Nov)
    const entries: { start: Date; bulan: number; tempo: Date; diskon: number }[] = [];
    const firstTempo = calcTempo(startDate, body.bulan);
    entries.push({ start: startDate, bulan: body.bulan, tempo: firstTempo, diskon: diskonFirst });

    let cursorStart = addDays(firstTempo, 1);
    // November last day of same fiscal year
    const endYear = startDate.getUTCMonth() === 11 ? startDate.getUTCFullYear() + 1 : startDate.getUTCFullYear();
    const fiscalEndDate = new Date(Date.UTC(endYear, 11, 0));
    while (cursorStart <= fiscalEndDate) {
      const tempo = calcTempo(cursorStart, body.bulan);
      entries.push({ start: cursorStart, bulan: body.bulan, tempo, diskon: 0 });
      const nextStart = addDays(tempo, 1);
      if (nextStart > fiscalEndDate) break;
      cursorStart = nextStart;
    }

    const affectedPeriodes = new Set<string>();
    const chainId = new mongoose.Types.ObjectId().toString();
    for (const e of entries) {
      const periode = toPeriod(e.start);
      affectedPeriodes.add(periode);
      const jumlah_harga = harga! * e.bulan;
      const now = new Date();
      await TTVpsDetail.create({
        periode,
        chain_id: chainId,
        toko: toko!,
        program: program!,
        daerah: daerah!,
        start: formatYMD(e.start),
        bulan: e.bulan,
        tempo: formatYMD(e.tempo),
        harga: harga!,
        jumlah_harga,
        diskon: e.diskon,
        diskon_percent: e === entries[0] ? (diskonPercentFirst || (jumlah_harga > 0 ? Math.round((diskonFirst / jumlah_harga) * 100) : 0)) : 0,
        total_harga: jumlah_harga - e.diskon,
        keterangan: e === entries[0] ? (body.keterangan && String(body.keterangan).trim() ? String(body.keterangan).trim() : '-') : '-',
        is_active: true,
        status: 'OPEN',
        input_date: now,
        update_date: now,
        delete_date: null,
        input_by: userTag,
        update_by: userTag,
        delete_by: null,
      } as Partial<ITTVpsDetail>);
    }

    for (const p of affectedPeriodes) await recalcAggregateForPeriode(p, (req as any).user);
    return res.json({ message: 'schedule created', months: entries.length });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

export const getDetailsByPeriode = async (req: Request, res: Response) => {
  try {
    const { periode } = req.query as { periode?: string };
    if (!periode) return res.status(400).json({ message: 'periode is required' });
    const docs = await TTVpsDetail.find({ periode });
    return res.json(docs || []);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

export const getDetailsByToko = async (req: Request, res: Response) => {
  try {
    const { toko } = req.query as { toko?: string };
    if (!toko) return res.status(400).json({ message: 'toko is required' });
    const docs = await TTVpsDetail.find({ toko }).sort({ periode: 1, start: 1 });
    return res.json(docs || []);
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

export const getAggregateByPeriode = async (req: Request, res: Response) => {
  try {
    const { periode } = req.query as { periode?: string };
    if (!periode) return res.status(400).json({ message: 'periode is required' });

    const detailsDocsPerPeriod = await TTVpsDetail.find({ periode });
    const activeDetails = detailsDocsPerPeriod.filter(d => (d as any).is_active !== false);
    const computedEstimasi = activeDetails.reduce((acc, d) => acc + (d.total_harga || 0), 0);
    const realisasiDocs = await TTVpsDetail.find({ status: 'DONE', tgl_lunas: { $regex: `^${periode}` } });
    const computedRealisasi = realisasiDocs.reduce((acc, d) => acc + (d.total_harga || 0), 0);
    const computedTotalTokoEstimasi = activeDetails.length;
    const computedTotalTokoRealisasi = realisasiDocs.length;

    await TTVps.updateOne(
      { periode },
      {
        $set: {
          estimasi: computedEstimasi,
          realisasi: computedRealisasi,
          total_toko_estimasi: computedTotalTokoEstimasi,
          total_toko_realisasi: computedTotalTokoRealisasi,
          update_date: new Date(),
          update_by: (req as any).user?.username || (req as any).user?._id || 'system',
        },
        $setOnInsert: {
          input_date: new Date(),
          input_by: (req as any).user?.username || (req as any).user?._id || 'system',
        },
      },
      { upsert: true }
    );

    const aggregateDoc = await TTVps.findOne({ periode });
    return res.json(aggregateDoc ? {
      _id: aggregateDoc._id,
      periode: aggregateDoc.periode,
      estimasi: aggregateDoc.estimasi,
      realisasi: aggregateDoc.realisasi,
      total_toko_estimasi: aggregateDoc.total_toko_estimasi,
      total_toko_realisasi: aggregateDoc.total_toko_realisasi,
    } : {
      _id: undefined,
      periode,
      estimasi: computedEstimasi,
      realisasi: computedRealisasi,
      total_toko_estimasi: computedTotalTokoEstimasi,
      total_toko_realisasi: computedTotalTokoRealisasi,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

export const updateItemStatus = async (req: Request, res: Response) => {
  try {
    const { periode, itemId } = req.params as { periode: string; itemId: string };
    const { status, tanggalLunas } = req.body as { status: 'OPEN' | 'PROCESS' | 'DONE', tanggalLunas?: string };
    if (!['OPEN', 'PROCESS', 'DONE'].includes(status)) return res.status(400).json({ message: 'invalid status' });
    const userTag = (req as any).user?.username || (req as any).user?._id || 'system';

    const item = await TTVpsDetail.findOne({ _id: itemId, periode });
    if (!item) return res.status(404).json({ message: 'item not found' });
    const prevLunasPeriod = item.tgl_lunas ? item.tgl_lunas.slice(0,7) : undefined;
    // Block status changes if item is inactive (except ensuring it's OPEN)
    if ((item as any).is_active === false && status !== 'OPEN') {
      return res.status(400).json({ message: 'Data nonaktif. Aktifkan terlebih dahulu sebelum proses/invoice/pelunasan.' });
    }
    // Enforce workflow: OPEN -> PROCESS -> DONE
    if (status === 'DONE') {
      if (item.status !== 'PROCESS') {
        return res.status(400).json({ message: 'Status harus PROCESS terlebih dahulu sebelum DONE' });
      }
      if (!tanggalLunas) {
        return res.status(400).json({ message: 'tanggalLunas diperlukan untuk status DONE' });
      }
      item.status = 'DONE';
      item.tgl_lunas = tanggalLunas;
    } else if (status === 'PROCESS') {
      item.status = 'PROCESS';
      item.tgl_lunas = undefined; // ensure none
    } else if (status === 'OPEN') {
      item.status = 'OPEN';
      item.tgl_lunas = undefined;
    }
    item.update_date = new Date();
    item.update_by = userTag;
    await item.save();

    const affected = new Set<string>();
    affected.add(periode);
    if (status === 'DONE' && tanggalLunas) affected.add(tanggalLunas.slice(0,7));
    // On cancelling payment (to PROCESS or OPEN), recalc the previous tgl_lunas period
    if ((status === 'PROCESS' || status === 'OPEN') && prevLunasPeriod) affected.add(prevLunasPeriod);
    for (const p of affected) await recalcAggregateForPeriode(p, (req as any).user);

    const aggregateDoc = await TTVps.findOne({ periode });
    return res.json(aggregateDoc ? {
      _id: aggregateDoc._id,
      periode: aggregateDoc.periode,
      estimasi: aggregateDoc.estimasi,
      realisasi: aggregateDoc.realisasi,
      total_toko_estimasi: aggregateDoc.total_toko_estimasi,
      total_toko_realisasi: aggregateDoc.total_toko_realisasi,
    } : {
      _id: undefined,
      periode,
      estimasi: 0,
      realisasi: 0,
      total_toko_estimasi: 0,
      total_toko_realisasi: 0,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

export const generateDokuPaymentLink = async (req: Request, res: Response) => {
  try {
    const { periode, itemId } = req.params as { periode: string; itemId: string };
    const item = await TTVpsDetail.findOne({ _id: itemId, periode });
    if (!item) return res.status(404).json({ message: 'item not found' });
    if ((item as any).is_active === false) {
      return res.status(400).json({ message: 'Data nonaktif. Aktifkan terlebih dahulu sebelum membuat link pembayaran.' });
    }
    if (item.status === 'DONE') {
      return res.status(400).json({ message: 'Pembayaran VPS sudah selesai.' });
    }

    const amount = Math.round(Number(item.invoice_meta?.grand_total ?? item.total_harga));
    if (!Number.isSafeInteger(amount) || amount <= 0) {
      return res.status(400).json({ message: 'Total tagihan harus lebih dari 0.' });
    }

    const customer = await resolveDokuCustomer(item);

    const currentPayment = item.doku_payment;
    if (
      currentPayment?.payment_url
      && currentPayment.amount === amount
      && currentPayment.status !== 'SUCCESS'
      && isDokuLinkStillActive(currentPayment.expired_date)
      && isSameDokuCustomer(currentPayment.customer, customer)
    ) {
      return res.json({
        message: 'payment link masih aktif',
        reused: true,
        payment: currentPayment,
      });
    }

    const invoiceNumber = generateDokuInvoiceNumber(item._id.toString());
    const result = await createDokuCheckout({
      amount,
      invoiceNumber,
      customer,
    });
    const now = new Date();
    const userTag = (req as any).user?.username || (req as any).user?._id || 'system';

    item.doku_payment = {
      invoice_number: invoiceNumber,
      payment_url: result.paymentUrl,
      token_id: result.tokenId,
      expired_date: result.expiredDate,
      amount,
      request_id: result.requestId,
      generated_at: now,
      generated_by: userTag,
      status: 'PENDING',
      customer: result.customer,
    };
    item.update_date = now;
    item.update_by = userTag;
    await item.save();

    return res.status(201).json({
      message: 'payment link berhasil dibuat',
      reused: false,
      payment: item.doku_payment,
    });
  } catch (err: any) {
    if (err instanceof DokuApiError) {
      console.error('DOKU payment link error:', {
        message: err.message,
        status: err.status,
        request_id: err.requestId,
        details: err.details,
      });
      return res.status(502).json({
        message: err.message,
        doku_status: err.status,
        doku_request_id: err.requestId,
        doku_details: err.details,
      });
    }
    console.error('DOKU payment link error:', err);
    return res.status(502).json({ message: err?.message || 'Gagal membuat payment link DOKU.' });
  }
};

export const handleDokuNotification = async (req: Request, res: Response) => {
  const clientId = String(req.get('Client-Id') || '');
  const requestId = String(req.get('Request-Id') || '');
  const requestTimestamp = String(req.get('Request-Timestamp') || '');
  const signature = String(req.get('Signature') || '');
  const rawBody = (req as Request & { rawBody?: string }).rawBody;
  const requestTarget = req.originalUrl.split('?')[0];

  if (!clientId || !requestId || !requestTimestamp || !signature || rawBody === undefined) {
    return res.status(400).json({ message: 'Header atau raw body notification DOKU tidak lengkap.' });
  }

  try {
    const signatureValid = verifyDokuNotificationSignature({
      clientId,
      requestId,
      requestTimestamp,
      requestTarget,
      requestBody: rawBody,
      signature,
    });
    if (!signatureValid) {
      return res.status(401).json({ message: 'Signature notification DOKU tidak valid.' });
    }

    const transactionStatus = String(req.body?.transaction?.status || '').toUpperCase();
    const invoiceNumber = String(req.body?.order?.invoice_number || '').trim();
    if (!invoiceNumber) {
      return res.status(400).json({ message: 'Invoice number DOKU tidak tersedia.' });
    }
    if (transactionStatus !== 'SUCCESS') {
      return res.status(200).json({ message: 'Notification diterima dan tidak mengubah status.', ignored: true });
    }

    const paymentAmount = Math.round(Number(req.body?.order?.amount));
    if (!Number.isSafeInteger(paymentAmount) || paymentAmount <= 0) {
      return res.status(400).json({ message: 'Nominal notification DOKU tidak valid.' });
    }

    const docs = await TTVpsDetail.find({ 'doku_payment.invoice_number': invoiceNumber });
    if (docs.length === 0) {
      return res.status(404).json({ message: 'Invoice DOKU tidak ditemukan.' });
    }
    const amountMismatch = docs.some((doc) => Math.round(Number(doc.doku_payment?.amount)) !== paymentAmount);
    if (amountMismatch) {
      return res.status(409).json({ message: 'Nominal pembayaran DOKU tidak sesuai dengan invoice.' });
    }

    const transactionDateRaw = String(req.body?.transaction?.date || '');
    const paidAtCandidate = new Date(transactionDateRaw);
    const paidAt = Number.isNaN(paidAtCandidate.getTime()) ? new Date() : paidAtCandidate;
    const paymentDate = formatJakartaDate(paidAt.toISOString());
    const updateTag = `DOKU:${requestId}`;
    const channelId = String(req.body?.channel?.id || '').trim();
    const originalRequestId = String(req.body?.transaction?.original_request_id || '').trim();

    await TTVpsDetail.updateMany(
      { 'doku_payment.invoice_number': invoiceNumber },
      {
        $set: {
          'doku_payment.status': 'SUCCESS',
          'doku_payment.paid_at': paidAt,
          'doku_payment.notification_request_id': requestId,
          ...(originalRequestId ? { 'doku_payment.transaction_original_request_id': originalRequestId } : {}),
          ...(channelId ? { 'doku_payment.channel_id': channelId } : {}),
        },
      }
    );

    const pendingIds = docs.filter((doc) => doc.status !== 'DONE').map((doc) => doc._id);
    if (pendingIds.length === 0) {
      return res.status(200).json({ message: 'Pembayaran DOKU sudah pernah diproses.', already_processed: true });
    }

    await TTVpsDetail.updateMany(
      { _id: { $in: pendingIds }, status: { $ne: 'DONE' } },
      {
        $set: {
          status: 'DONE',
          tgl_lunas: paymentDate,
          update_date: new Date(),
          update_by: updateTag,
        },
      }
    );

    const affectedPeriodes = new Set(docs.map((doc) => doc.periode));
    affectedPeriodes.add(paymentDate.slice(0, 7));
    for (const periode of affectedPeriodes) {
      await recalcAggregateForPeriode(periode, { username: updateTag });
    }

    return res.status(200).json({
      message: 'Pembayaran DOKU berhasil diproses.',
      invoice_number: invoiceNumber,
      updated_items: pendingIds.length,
    });
  } catch (err: any) {
    console.error('DOKU notification error:', {
      message: err?.message || err,
      request_id: requestId,
    });
    return res.status(500).json({ message: 'Gagal memproses notification DOKU.' });
  }
};

export const generateInvoiceAndMarkProcess = async (req: Request, res: Response) => {
  let session: mongoose.ClientSession | null = null;
  try {
    const { periode, itemId } = req.params as { periode: string; itemId: string };
    const body = req.body as {
      target_items?: Array<{ periode?: string; item_id?: string }>;
      customer?: { name?: string; address?: string; phone?: string };
      payment_accounts?: Array<{
        kode_bank?: string;
        no_rekening?: string;
        nama_rekening?: string;
      }>;
      items?: Array<{
        program_name?: string;
        qty?: number;
        unit_price?: number;
        line_total?: number;
        start_date?: string;
        tempo_date?: string;
      }>;
      discount_label?: string;
      discount_percent?: number;
      discount_rp?: number;
      extra_deduction_rp?: number;
      subtotal?: number;
      grand_total?: number;
      notes?: string;
      display_date?: string;
    };

    const userTag = (req as any).user?.username || (req as any).user?._id || 'system';

    const targetItemsRaw = Array.isArray(body?.target_items) ? body.target_items : [];
    const normalizedTargetItems = (
      targetItemsRaw.length > 0
        ? targetItemsRaw
        : (periode && itemId ? [{ periode, item_id: itemId }] : [])
    )
      .map((it) => ({
        periode: String(it?.periode || '').trim(),
        item_id: String(it?.item_id || '').trim(),
      }))
      .filter((it) => it.periode && it.item_id);

    if (normalizedTargetItems.length === 0) {
      return res.status(400).json({ message: 'Minimal harus ada 1 item target invoice.' });
    }

    const uniqueTargets = Array.from(
      new Map(
        normalizedTargetItems.map((it) => [`${it.periode}::${it.item_id}`, it])
      ).values()
    );

    const targetIds = uniqueTargets.map((it) => new mongoose.Types.ObjectId(it.item_id));
    const targetPeriodes = Array.from(new Set(uniqueTargets.map((it) => it.periode)));
    const docs = await TTVpsDetail.find({
      _id: { $in: targetIds },
      periode: { $in: targetPeriodes },
    });

    if (docs.length !== uniqueTargets.length) {
      return res.status(404).json({ message: 'Sebagian item target invoice tidak ditemukan.' });
    }

    const sortedDocs = uniqueTargets.map((target) => {
      const found = docs.find((doc) => doc._id.toString() === target.item_id && doc.periode === target.periode);
      if (!found) {
        throw new Error(`Target item tidak ditemukan untuk ${target.periode}/${target.item_id}`);
      }
      return found;
    });

    const invalidInactive = sortedDocs.find((doc) => (doc as any).is_active === false);
    if (invalidInactive) {
      return res.status(400).json({ message: 'Ada data nonaktif. Aktifkan terlebih dahulu sebelum proses invoice.' });
    }
    const invalidStatus = sortedDocs.find((doc) => doc.status !== 'OPEN');
    if (invalidStatus) {
      return res.status(400).json({ message: 'Semua item invoice harus berstatus OPEN.' });
    }

    const firstItem = sortedDocs[0];

    const customerName = String(body?.customer?.name || firstItem.toko || '').trim();
    if (!customerName) return res.status(400).json({ message: 'Nama toko/customer wajib diisi.' });
    const customerAddress = String(body?.customer?.address || '').trim();
    const customerPhone = String(body?.customer?.phone || '').trim();
    const paymentAccountsRaw = Array.isArray(body?.payment_accounts) ? body.payment_accounts : [];
    const sanitizedPaymentAccounts = paymentAccountsRaw
      .map((acc) => ({
        kode_bank: String(acc?.kode_bank || '').trim(),
        no_rekening: String(acc?.no_rekening || '').trim(),
        nama_rekening: String(acc?.nama_rekening || '').trim(),
      }))
      .filter((acc) => acc.no_rekening.length > 0);

    const rawItems = Array.isArray(body?.items) ? body.items : [];
    const sanitizedItems = rawItems
      .map((it) => {
        const program_name = String(it?.program_name || '').trim();
        const qty = Math.max(0, Number(it?.qty || 0));
        const unit_price = Math.max(0, Number(it?.unit_price || 0));
        const line_total = Math.max(0, Math.round(qty * unit_price));
        const start_date = String(it?.start_date || '').trim();
        const tempo_date = String(it?.tempo_date || '').trim();
        return { program_name, qty, unit_price, line_total, start_date, tempo_date };
      })
      .filter((it) => it.program_name && it.qty > 0);

    if (sanitizedItems.length === 0) {
      return res.status(400).json({ message: 'Minimal harus ada 1 item invoice yang valid.' });
    }

    const subtotalCalculated = sanitizedItems.reduce((acc, it) => acc + it.line_total, 0);
    const discountLabel = String(body?.discount_label || 'DISC').trim() || 'DISC';
    const discountPercentInput = Math.max(0, Math.min(100, Number(body?.discount_percent || 0)));
    const discountRpInput = Math.max(0, Number(body?.discount_rp || 0));
    const extraDeductionRp = Math.min(
      subtotalCalculated,
      Math.max(0, Number(body?.extra_deduction_rp || 0))
    );
    const discountRp =
      discountRpInput > 0
        ? Math.min(subtotalCalculated, Math.floor(discountRpInput))
        : Math.min(subtotalCalculated, Math.floor((subtotalCalculated * discountPercentInput) / 100));
    const discountPercent =
      subtotalCalculated > 0 ? Math.round((discountRp / subtotalCalculated) * 10000) / 100 : 0;
    const grandTotal = Math.max(0, subtotalCalculated - discountRp - extraDeductionRp);
    if (!Number.isSafeInteger(grandTotal) || grandTotal <= 0) {
      return res.status(400).json({ message: 'Total invoice harus lebih dari 0 untuk membuat link pembayaran DOKU.' });
    }

    const invoiceNumber = await generateMonthlyInvoiceNumber();
    const now = new Date();
    const displayDate = body?.display_date && /^\d{4}-\d{2}-\d{2}$/.test(String(body.display_date))
      ? String(body.display_date)
      : formatYMD(now);

    const sharedInvoiceMeta = {
      invoice_number: invoiceNumber,
      generated_at: now,
      generated_by: userTag,
      sender: INVOICE_SENDER,
      customer: {
        name: customerName,
        address: customerAddress,
        phone: customerPhone,
      },
      payment_accounts: sanitizedPaymentAccounts,
      items: sanitizedItems,
      subtotal: subtotalCalculated,
      discount_label: discountLabel,
      discount_percent: discountPercent,
      discount_rp: discountRp,
      extra_deduction_rp: extraDeductionRp,
      grand_total: grandTotal,
      notes: (body?.notes || '').toString().trim(),
      display_date: displayDate,
    };

    const dokuCustomer = await resolveDokuCustomer(firstItem, {
      phone: customerPhone,
      address: customerAddress,
    });
    // A newly generated invoice must get a fresh checkout so its current callback
    // configuration is always registered at DOKU.
    const dokuInvoiceNumber = generateDokuInvoiceNumber(firstItem._id.toString(), invoiceNumber);
    const dokuResult = await createDokuCheckout({
      amount: grandTotal,
      invoiceNumber: dokuInvoiceNumber,
      customer: dokuCustomer,
    });
    const sharedDokuPayment: NonNullable<ITTVpsDetail['doku_payment']> = {
      invoice_number: dokuInvoiceNumber,
      payment_url: dokuResult.paymentUrl,
      token_id: dokuResult.tokenId,
      expired_date: dokuResult.expiredDate,
      amount: grandTotal,
      request_id: dokuResult.requestId,
      generated_at: now,
      generated_by: userTag,
      status: 'PENDING',
      customer: dokuResult.customer,
    };

    session = await mongoose.startSession();
    await session.withTransaction(async () => {
      for (const doc of sortedDocs) {
        doc.invoice_meta = sharedInvoiceMeta as any;
        doc.doku_payment = sharedDokuPayment;
        doc.status = 'PROCESS';
        doc.tgl_lunas = undefined;
        doc.update_date = now;
        doc.update_by = userTag;
        await doc.save({ session });
      }
    });

    const affectedPeriodes = Array.from(new Set(sortedDocs.map((doc) => doc.periode)));
    for (const affectedPeriode of affectedPeriodes) {
      await recalcAggregateForPeriode(affectedPeriode, (req as any).user);
    }

    return res.json({
      message: 'invoice generated',
      status: 'PROCESS',
      invoice: sharedInvoiceMeta,
      doku_payment: sharedDokuPayment,
      item_id: firstItem._id,
      periode: firstItem.periode,
      affected_items: sortedDocs.map((doc) => ({
        item_id: doc._id,
        periode: doc.periode,
      })),
      affected_periodes: affectedPeriodes,
    });
  } catch (err: any) {
    if (err instanceof DokuApiError) {
      console.error('DOKU invoice checkout error:', {
        message: err.message,
        status: err.status,
        request_id: err.requestId,
        details: err.details,
      });
      return res.status(502).json({
        message: err.message,
        doku_status: err.status,
        doku_request_id: err.requestId,
        doku_details: err.details,
      });
    }
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  } finally {
    if (session) await session.endSession();
  }
};

export const updateItem = async (req: Request, res: Response) => {
  try {
    const { periode, itemId } = req.params as { periode: string; itemId: string };
    const { start, bulan, harga, diskon, status, diskon_percent, keterangan } = req.body as Partial<{ start: string; bulan: number; harga: number; diskon: number; status: 'OPEN'|'DONE'; diskon_percent: number; keterangan?: string }>;
    const userTag = (req as any).user?.username || (req as any).user?._id || 'system';

    const doc = await TTVpsDetail.findOne({ _id: itemId, periode });
    if (!doc) return res.status(404).json({ message: 'item not found' });

    const oldStart = doc.start;
    const oldBulan = doc.bulan;

    if (typeof start === 'string' && start) {
      const ym = start.slice(0,7);
      if (ym !== periode) return res.status(400).json({ message: 'start harus tetap di periode yang sama' });
      doc.start = start;
    }
    if (typeof bulan === 'number' && bulan > 0) doc.bulan = bulan;
    if (typeof harga === 'number' && harga >= 0) doc.harga = harga;
    if (typeof diskon === 'number' && diskon >= 0) doc.diskon = diskon;
    if (typeof diskon_percent === 'number' && diskon_percent >= 0) doc.diskon_percent = Math.min(100, diskon_percent);
    if (typeof keterangan === 'string') doc.keterangan = keterangan && String(keterangan).trim() ? String(keterangan).trim() : '-';
    if (status && (status === 'OPEN' || status === 'DONE')) doc.status = status;

    const startDateObj = new Date(doc.start + 'T00:00:00.000Z');
    doc.tempo = formatYMD(calcTempo(startDateObj, doc.bulan));
    doc.jumlah_harga = doc.harga * doc.bulan;
    doc.total_harga = doc.jumlah_harga - doc.diskon;
    doc.update_date = new Date();
    doc.update_by = userTag;
    await doc.save();

    const bulanChanged = doc.bulan !== oldBulan;
    const startChanged = doc.start !== oldStart;
    const tahunEdit = periode.slice(0,4);

    if (bulanChanged) {
      // 1) Remove subsequent docs in the same fiscal year for this chain
      await TTVpsDetail.deleteMany({
        chain_id: doc.chain_id,
        toko: doc.toko,
        program: doc.program,
        periode: { $gt: periode, $regex: `^${tahunEdit}-` }
      });

      // 2) Regenerate subsequent schedule using the new bulan setting
      //    Starting from the day after this doc's tempo until fiscal end (Nov)
      const createdPeriodes = new Set<string>();
      const startDate = new Date(doc.start + 'T00:00:00.000Z');
      const firstTempo = new Date(doc.tempo + 'T00:00:00.000Z');
      let cursorStart = addDays(firstTempo, 1);
      const endYear = startDate.getUTCMonth() === 11 ? startDate.getUTCFullYear() + 1 : startDate.getUTCFullYear();
      const fiscalEndDate = new Date(Date.UTC(endYear, 11, 0)); // last day of November

      while (cursorStart <= fiscalEndDate) {
        const tempo = calcTempo(cursorStart, doc.bulan);
        const jumlah_harga = doc.harga * doc.bulan;
        const now = new Date();
        const periodeNew = toPeriod(cursorStart);
        await TTVpsDetail.create({
          periode: periodeNew,
          chain_id: doc.chain_id,
          toko: doc.toko,
          program: doc.program,
          daerah: (doc as any).daerah,
          keterangan: '-',
          start: formatYMD(cursorStart),
          bulan: doc.bulan,
          tempo: formatYMD(tempo),
          harga: doc.harga,
          jumlah_harga,
          diskon: 0,
          diskon_percent: 0,
          total_harga: jumlah_harga,
          status: 'OPEN',
          input_date: now,
          update_date: now,
          delete_date: null,
          input_by: userTag,
          update_by: userTag,
          delete_by: null,
        } as Partial<ITTVpsDetail>);
        createdPeriodes.add(periodeNew);

        const nextStart = addDays(tempo, 1);
        if (nextStart > fiscalEndDate) break;
        cursorStart = nextStart;
      }

      // 3) Recalculate aggregates for current and affected subsequent periodes
      const [yStr, mStr] = periode.split('-');
      const yNum = parseInt(yStr, 10);
      const mNum = parseInt(mStr, 10);
      const targets: string[] = [periode];
      if (!isNaN(yNum) && !isNaN(mNum) && mNum < 11) {
        const pad = (n: number) => String(n).padStart(2, '0');
        const startM = `${yStr}-${pad(mNum + 1)}`;
        const endM = `${yStr}-11`;
        const startMonthDate = new Date(startM + '-01T00:00:00.000Z');
        const endMonthDate = new Date(endM + '-01T00:00:00.000Z');
        const months = enumerateMonthsInclusive(startMonthDate, endMonthDate);
        for (const p of months) targets.push(p);
      }
      for (const p of new Set<string>([...targets, ...Array.from(createdPeriodes)]) ) {
        await recalcAggregateForPeriode(p, (req as any).user);
      }
    } else if (startChanged) {
      const subsequent = await TTVpsDetail.find({
        chain_id: doc.chain_id,
        toko: doc.toko,
        program: doc.program,
        periode: { $gte: periode, $regex: `^${tahunEdit}-` }
      }).sort({ start: 1 });

      const affected = new Set<string>();
      let prevTempoDate = new Date(doc.tempo + 'T00:00:00.000Z');
      for (const d of subsequent) {
        if (d._id.toString() === doc._id.toString()) continue;
        const newStart = addDays(prevTempoDate, 1);
        const newTempo = calcTempo(newStart, d.bulan);
        d.start = formatYMD(newStart);
        d.tempo = formatYMD(newTempo);
        d.periode = toPeriod(newStart);
        d.jumlah_harga = d.harga * d.bulan;
        d.total_harga = d.jumlah_harga - (d.diskon || 0);
        d.update_date = new Date();
        d.update_by = userTag;
        await d.save();
        affected.add(d.periode);
        prevTempoDate = newTempo;
      }

      affected.add(periode);
      for (const p of affected) await recalcAggregateForPeriode(p, (req as any).user);
    } else {
      await recalcAggregateForPeriode(periode, (req as any).user);
    }

    return res.json({ message: 'item updated' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

export const deleteItem = async (req: Request, res: Response) => {
  try {
    const { periode, itemId } = req.params as { periode: string; itemId: string };
    const found = await TTVpsDetail.findOne({ _id: itemId, periode });
    if (!found) return res.status(404).json({ message: 'item not found' });
    await TTVpsDetail.deleteOne({ _id: itemId, periode });
    await recalcAggregateForPeriode(periode, (req as any).user);
    return res.json({ message: 'item deleted' });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

export const getLastPeriod = async (_req: Request, res: Response) => {
  try {
    const last = await TTVpsDetail.findOne({}, { periode: 1 }).sort({ periode: -1 }).lean();
    return res.json({ periode: last?.periode || null });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

export const generateNextFiscal = async (req: Request, res: Response) => {
  try {
    const lastDoc = await TTVpsDetail.findOne({}, { periode: 1 }).sort({ periode: -1 }).lean();
    if (!lastDoc?.periode) return res.status(400).json({ message: 'Tidak ada data periode terakhir' });
    const [lastYearStr] = lastDoc.periode.split('-');
    const lastYear = parseInt(lastYearStr, 10);
    const nextFiscalLabel = lastYear + 1;
    const rangeStart = `${lastYear - 1}-12`;
    const rangeEnd = `${lastYear}-11`;
    const fiscalDocs = await TTVpsDetail.find({ periode: { $gte: rangeStart, $lte: rangeEnd } }).lean();

    type Item = ITTVpsDetail & { _id?: any };
    const tokoLatest: Record<string, { last: Item }> = {};
    for (const it of fiscalDocs) {
      const key = it.toko;
      const currTempo = new Date(it.tempo + 'T00:00:00.000Z').getTime();
      const existing = tokoLatest[key]?.last;
      const existingTempo = existing ? new Date(existing.tempo + 'T00:00:00.000Z').getTime() : -Infinity;
      if (!existing || currTempo > existingTempo) {
        tokoLatest[key] = { last: it as Item };
      }
    }

    const affectedPeriodes = new Set<string>();
    const userTag = (req as any).user?.username || (req as any).user?._id || 'system';
    for (const [toko, info] of Object.entries(tokoLatest)) {
      const last = info.last;
      const program = last.program;
      const daerah = (last as any).daerah || '';
      const harga = last.harga;
      const initialMonths = last.bulan;
      const startDate = addDays(new Date(last.tempo + 'T00:00:00.000Z'), 1);

      const entries: { start: Date; bulan: number; tempo: Date; diskon: number }[] = [];
      const firstTempo = calcTempo(startDate, initialMonths);
      entries.push({ start: startDate, bulan: initialMonths, tempo: firstTempo, diskon: 0 });
      let cursorStart = addDays(firstTempo, 1);
      const endYear = startDate.getUTCMonth() === 11 ? startDate.getUTCFullYear() + 1 : startDate.getUTCFullYear();
      const fiscalEndDate = new Date(Date.UTC(endYear, 11, 0));
      while (cursorStart <= fiscalEndDate) {
        const tempo = calcTempo(cursorStart, initialMonths);
        entries.push({ start: cursorStart, bulan: initialMonths, tempo, diskon: 0 });
        const nextStart = addDays(tempo, 1);
        if (nextStart > fiscalEndDate) break;
        cursorStart = nextStart;
      }

      const chainId = new mongoose.Types.ObjectId().toString();
      for (const e of entries) {
        const periode = toPeriod(e.start);
        affectedPeriodes.add(periode);
        await TTVpsDetail.create({
          periode,
          chain_id: chainId,
          toko,
          program,
          daerah,
          start: formatYMD(e.start),
          bulan: e.bulan,
          tempo: formatYMD(e.tempo),
          harga,
          jumlah_harga: harga * e.bulan,
          diskon: 0,
          diskon_percent: 0,
          total_harga: harga * e.bulan,
          keterangan: '-',
            is_active: true,
          status: 'OPEN',
          input_date: new Date(),
          update_date: new Date(),
          input_by: userTag,
          update_by: userTag,
        });
      }
    }

    for (const p of affectedPeriodes) await recalcAggregateForPeriode(p, (req as any).user);
    return res.json({ message: 'generated', nextFiscalLabel, affected: Array.from(affectedPeriodes).sort() });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

// In-memory progress tracker for generate job
const generateJobs: Record<string, { status: 'running'|'done'|'error'; nextFiscalLabel: number; total: number; done: number; startedAt: number; finishedAt?: number; error?: string }> = {};

export const startGenerateNextFiscal = async (req: Request, res: Response) => {
  try {
    const lastDoc = await TTVpsDetail.findOne({}, { periode: 1 }).sort({ periode: -1 }).lean();
    if (!lastDoc?.periode) return res.status(400).json({ message: 'Tidak ada data periode terakhir' });
    const [lastYearStr] = lastDoc.periode.split('-');
    const lastYear = parseInt(lastYearStr, 10);
    const nextFiscalLabel = lastYear + 1;
    const rangeStart = `${lastYear - 1}-12`;
    const rangeEnd = `${lastYear}-11`;
    const fiscalDocs = await TTVpsDetail.find({ periode: { $gte: rangeStart, $lte: rangeEnd } }).lean();

    type Item = ITTVpsDetail & { _id?: any };
    const tokoLatest: Record<string, { last: Item }> = {};
    for (const it of fiscalDocs) {
      const key = it.toko;
      const currTempo = new Date(it.tempo + 'T00:00:00.000Z').getTime();
      const existing = tokoLatest[key]?.last;
      const existingTempo = existing ? new Date(existing.tempo + 'T00:00:00.000Z').getTime() : -Infinity;
      if (!existing || currTempo > existingTempo) {
        tokoLatest[key] = { last: it as Item };
      }
    }

    const jobId = new mongoose.Types.ObjectId().toString();
    generateJobs[jobId] = { status: 'running', nextFiscalLabel, total: Object.keys(tokoLatest).length, done: 0, startedAt: Date.now() };

    // Run the heavy work asynchronously
    (async () => {
      try {
        const affectedPeriodes = new Set<string>();
        const userTag = (req as any).user?.username || (req as any).user?._id || 'system';
        for (const [toko, info] of Object.entries(tokoLatest)) {
          const last = info.last;
          const program = last.program;
          const daerah = (last as any).daerah || '';
          const harga = last.harga;
          const initialMonths = last.bulan;
          const startDate = addDays(new Date(last.tempo + 'T00:00:00.000Z'), 1);

          const entries: { start: Date; bulan: number; tempo: Date; diskon: number }[] = [];
          const firstTempo = calcTempo(startDate, initialMonths);
          entries.push({ start: startDate, bulan: initialMonths, tempo: firstTempo, diskon: 0 });
          let cursorStart = addDays(firstTempo, 1);
          const endYear = startDate.getUTCMonth() === 11 ? startDate.getUTCFullYear() + 1 : startDate.getUTCFullYear();
          const fiscalEndDate = new Date(Date.UTC(endYear, 11, 0));
          while (cursorStart <= fiscalEndDate) {
            const tempo = calcTempo(cursorStart, initialMonths);
            entries.push({ start: cursorStart, bulan: initialMonths, tempo, diskon: 0 });
            const nextStart = addDays(tempo, 1);
            if (nextStart > fiscalEndDate) break;
            cursorStart = nextStart;
          }

          const chainId = new mongoose.Types.ObjectId().toString();
          for (const e of entries) {
            const periode = toPeriod(e.start);
            affectedPeriodes.add(periode);
            await TTVpsDetail.create({
              periode,
              chain_id: chainId,
              toko,
              program,
              daerah,
              start: formatYMD(e.start),
              bulan: e.bulan,
              tempo: formatYMD(e.tempo),
              harga,
              jumlah_harga: harga * e.bulan,
              diskon: 0,
              diskon_percent: 0,
              total_harga: harga * e.bulan,
              keterangan: '-',
              is_active: true,
              status: 'OPEN',
              input_date: new Date(),
              update_date: new Date(),
              input_by: userTag,
              update_by: userTag,
            });
          }
          generateJobs[jobId].done += 1;
        }
        for (const p of affectedPeriodes) await recalcAggregateForPeriode(p, (req as any).user);
        generateJobs[jobId].status = 'done';
        generateJobs[jobId].finishedAt = Date.now();
      } catch (e: any) {
        generateJobs[jobId].status = 'error';
        generateJobs[jobId].error = e?.message || 'error';
        generateJobs[jobId].finishedAt = Date.now();
      }
    })();

    return res.json({ jobId, nextFiscalLabel, total: generateJobs[jobId].total });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

export const getGenerateStatus = async (req: Request, res: Response) => {
  const { jobId } = req.query as { jobId?: string };
  if (!jobId || !generateJobs[jobId]) return res.status(404).json({ message: 'job not found' });
  const job = generateJobs[jobId];
  return res.json({ status: job.status, nextFiscalLabel: job.nextFiscalLabel, total: job.total, done: job.done, startedAt: job.startedAt, finishedAt: job.finishedAt, error: job.error });
};

export const updateItemActive = async (req: Request, res: Response) => {
  try {
    const { periode, itemId } = req.params as { periode: string; itemId: string };
    const { is_active } = req.body as { is_active: boolean };
    if (typeof is_active !== 'boolean') return res.status(400).json({ message: 'is_active harus boolean' });
    const userTag = (req as any).user?.username || (req as any).user?._id || 'system';

    const item = await TTVpsDetail.findOne({ _id: itemId, periode });
    if (!item) return res.status(404).json({ message: 'item not found' });

    // Only OPEN items can be deactivated
    if (is_active === false && item.status !== 'OPEN') {
      return res.status(400).json({ message: 'Hanya data dengan status OPEN yang bisa dinonaktifkan' });
    }

    (item as any).is_active = is_active;
    item.update_date = new Date();
    item.update_by = userTag;
    await item.save();

    await recalcAggregateForPeriode(periode, (req as any).user);

    const aggregateDoc = await TTVps.findOne({ periode });
    return res.json(aggregateDoc ? {
      _id: aggregateDoc._id,
      periode: aggregateDoc.periode,
      estimasi: aggregateDoc.estimasi,
      realisasi: aggregateDoc.realisasi,
      total_toko_estimasi: aggregateDoc.total_toko_estimasi,
      total_toko_realisasi: aggregateDoc.total_toko_realisasi,
    } : {
      _id: undefined,
      periode,
      estimasi: 0,
      realisasi: 0,
      total_toko_estimasi: 0,
      total_toko_realisasi: 0,
    });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};
