import { Request, Response } from 'express';
import VpsSubscription from '../models/Vps';
import Subscriber from '../models/Subscriber';
import { addMonths, calcDueDate, calcGross, calcNet, generateNextFiscalYearPeriods, generatePeriodsUntilFiscalNovember } from '../utils/vps';
import TTVpsDetail from '../models/TTVpsDetail';
import TTVps from '../models/TTVps';
import { addDays as addDaysUTC, calcTempo as calcTempoUTC, toPeriod, formatYMD } from '../utils/vpsPeriod';

export const listVps = async (req: Request, res: Response) => {
  try {
    const items = await VpsSubscription.find()
      .populate('subscriber', 'toko kode biaya program daerah')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ success: true, data: items });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const getVps = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await VpsSubscription.findById(id).populate('subscriber', 'toko kode biaya program daerah').lean();
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    res.json({ success: true, data: item });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const availableSubscribers = async (_req: Request, res: Response) => {
  try {
    // Subscribers not yet linked to any VPS subscription
    const used = await VpsSubscription.distinct('subscriber');
    // Also exclude shops already present in TT VPS detail schedule
    const usedTTToko = await TTVpsDetail.distinct('toko');
    const subs = await Subscriber.find({ _id: { $nin: used }, toko: { $nin: usedTTToko }, status_aktv: true })
      .select('toko biaya kode program daerah')
      .sort({ toko: 1 })
      .lean();
    res.json({ success: true, data: subs });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const createVps = async (req: Request, res: Response) => {
  try {
    const { subscriberId, startDate, months, discount } = req.body as { subscriberId: string; startDate: string; months: number; discount?: number };
    if (!subscriberId || !startDate || !months) return res.status(400).json({ success: false, message: 'subscriberId, startDate, months required' });

    const sub = await Subscriber.findById(subscriberId);
    if (!sub) return res.status(404).json({ success: false, message: 'Subscriber not found' });

    const exists = await VpsSubscription.findOne({ subscriber: sub._id });
    if (exists) return res.status(400).json({ success: false, message: 'Subscriber already has VPS record' });

    const pricePerMonth = sub.biaya || 0;
    const sDate = new Date(startDate);
    const dueDate = calcDueDate(sDate, months);
    const grossAmount = calcGross(pricePerMonth, months);
    const disc = Math.max(0, Number(discount || 0));
    const netAmount = calcNet(grossAmount, disc);

    const item = await VpsSubscription.create({
      subscriber: sub._id,
      pricePerMonth,
      startDate: sDate,
      months,
      dueDate,
      grossAmount,
      discount: disc,
      netAmount,
      status: 'ACTIVE',
    });
    const populated = await item.populate('subscriber', 'toko kode biaya program daerah');
    // Also write to tt_vps_details / tt_vps per-month documents
    try {
      await createTTDocumentsForNewVps({
        refId: String(item._id),
        toko: sub.toko,
        program: sub.program,
        pricePerMonth,
        startDate: sDate,
        months,
        discountFirst: disc,
        user: (req as any).user,
      });
    } catch (e) {
      console.error('Failed to write tt_vps docs:', e);
      // do not fail the main response; just log
    }
    res.json({ success: true, data: populated });
  } catch (error) {
    console.error('createVps error', error);
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const updateVps = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { startDate, months, discount, status } = req.body as { startDate?: string; months?: number; discount?: number; status?: 'ACTIVE'|'COMPLETED'|'CANCELLED' };
    const item = await VpsSubscription.findById(id).populate('subscriber', 'toko program biaya');
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });

    if (startDate) item.startDate = new Date(startDate);
    if (months) item.months = Math.max(1, months);
    if (typeof discount === 'number') item.discount = Math.max(0, discount);
    if (status) item.status = status;

    // Recompute derived
    item.dueDate = calcDueDate(item.startDate, item.months);
    item.grossAmount = calcGross(item.pricePerMonth, item.months);
    item.netAmount = calcNet(item.grossAmount, item.discount);

    // If startDate changed, regenerate periods from new start until fiscal November (keep historical payments if same month/year?)
    if (startDate) {
      const newPeriods = await generatePeriodsUntilFiscalNovember({ startDate: item.startDate, pricePerMonth: item.pricePerMonth });
      item.periods = newPeriods;
    }

    await item.save();
    const populated = await item.populate('subscriber', 'toko kode biaya program daerah');

    // Sync TT documents for this subscription (remove old ref items, then regenerate)
    try {
      await resyncTTForVps(String(item._id), {
        toko: (item as any).subscriber?.toko,
        program: (item as any).subscriber?.program,
        pricePerMonth: item.pricePerMonth,
        startDate: item.startDate,
        months: item.months,
        discountFirst: item.discount,
        user: (req as any).user,
      });
    } catch (e) {
      console.error('Failed to resync tt_vps on update:', e);
    }
    res.json({ success: true, data: populated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const deleteVps = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const item = await VpsSubscription.findByIdAndDelete(id);
    if (!item) return res.status(404).json({ success: false, message: 'Not found' });
    try {
      await removeTTByRef(String(id), (req as any).user);
    } catch (e) {
      console.error('Failed to remove tt_vps ref on delete:', e);
    }
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

export const regenerateNextFiscalYear = async (_req: Request, res: Response) => {
  try {
    const items = await VpsSubscription.find({ status: 'ACTIVE' });
    for (const item of items) {
      const startDay = item.startDate.getDate();
      const periods = await generateNextFiscalYearPeriods({ startDayOfMonth: startDay, pricePerMonth: item.pricePerMonth });
      // Remove any periods that already exist for the same month/year to avoid duplicates
      const key = (m: number, y: number) => `${y}-${m}`;
      const existing = new Set(item.periods.map(p => key(p.month, p.year)));
      for (const p of periods) {
        if (!existing.has(key(p.month, p.year))) {
          item.periods.push(p as any);
        }
      }
      await item.save();
    }
    res.json({ success: true, updated: items.length });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error });
  }
};

async function recalcAggregateForPeriodeTT(periode: string, user: any) {
  const docs = await TTVpsDetail.find({ periode });
  const estimasi = docs.reduce((a, d) => a + (d.total_harga || 0), 0);
  const realisasiDocs = docs.filter(d => d.status === 'DONE' && d.tgl_lunas && d.tgl_lunas.slice(0,7) === periode);
  const realisasi = realisasiDocs.reduce((a, d) => a + (d.total_harga || 0), 0);
  const total_toko_estimasi = docs.length;
  const total_toko_realisasi = realisasiDocs.length;
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

async function createTTDocumentsForNewVps(params: {
  refId?: string;
  toko: string;
  program: string;
  daerah?: string;
  pricePerMonth: number;
  startDate: Date;
  months: number;
  discountFirst: number;
  user?: any;
}) {
  const { refId, toko, program, daerah, pricePerMonth, startDate, months, discountFirst, user } = params;
  const firstTempo = calcTempoUTC(startDate, months);
  const endYear = startDate.getUTCMonth() === 11 ? startDate.getUTCFullYear() + 1 : startDate.getUTCFullYear();
  const fiscalEndDate = new Date(Date.UTC(endYear, 11, 0));

  const entries: { start: Date; bulan: number; tempo: Date; diskon: number }[] = [];
  let cursorStart = new Date(startDate);
  while (cursorStart <= fiscalEndDate) {
    const tempo = calcTempoUTC(cursorStart, months);
    entries.push({ start: new Date(cursorStart), bulan: months, tempo, diskon: entries.length === 0 ? (discountFirst || 0) : 0 });
    const nextStart = addDaysUTC(tempo, 1);
    if (nextStart > fiscalEndDate) break;
    cursorStart = nextStart;
  }

  const userTag = user?.username || user?._id || 'system';
  const affected = new Set<string>();
  for (const e of entries) {
    const periode = toPeriod(e.start);
    affected.add(periode);
    const base = pricePerMonth * e.bulan;
    const now = new Date();
    await TTVpsDetail.create({
      periode,
      chain_id: refId || undefined,
      toko,
      program,
      daerah: daerah || '',
      start: formatYMD(e.start),
      bulan: e.bulan,
      tempo: formatYMD(e.tempo),
      harga: pricePerMonth,
      jumlah_harga: base,
      diskon: e.diskon,
      diskon_percent: e === entries[0] ? (base > 0 ? Math.round((e.diskon / base) * 100) : 0) : 0,
      total_harga: base - e.diskon,
      status: 'OPEN',
      input_date: now,
      update_date: now,
      input_by: userTag,
      update_by: userTag,
    } as any);
  }
  for (const p of affected) await recalcAggregateForPeriodeTT(p, user);
}

async function removeTTByRef(refId: string, user?: any) {
  const docs = await TTVpsDetail.find({ chain_id: refId });
  const periodes = new Set<string>(docs.map(d => d.periode));
  await TTVpsDetail.deleteMany({ chain_id: refId });
  for (const p of periodes) await recalcAggregateForPeriodeTT(p, user);
}

async function resyncTTForVps(refId: string, params: {
  toko: string;
  program: string;
  pricePerMonth: number;
  startDate: Date;
  months: number;
  discountFirst: number;
  user?: any;
}) {
  await removeTTByRef(refId, params.user);
  await createTTDocumentsForNewVps({ refId, ...params });
}
