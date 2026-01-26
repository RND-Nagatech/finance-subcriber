import { Request, Response } from 'express';
import TTVpsDetail, { ITTVpsDetail } from '../models/TTVpsDetail';
import TTVps from '../models/TTVps';
import Subscriber from '../models/Subscriber';
import { addDays, calcTempo, enumerateMonthsInclusive, toPeriod, formatYMD } from '../utils/vpsPeriod';
import mongoose from 'mongoose';

function sum(arr: number[]): number { return arr.reduce((a, b) => a + b, 0); }

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

export const updateItem = async (req: Request, res: Response) => {
  try {
    const { periode, itemId } = req.params as { periode: string; itemId: string };
    const { start, bulan, harga, diskon, status, diskon_percent } = req.body as Partial<{ start: string; bulan: number; harga: number; diskon: number; status: 'OPEN'|'DONE'; diskon_percent: number }>;
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
