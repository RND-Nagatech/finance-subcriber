export * from './vpsTTController2';
/*import { Request, Response } from 'express';
import TTVpsDetail, { ITTVpsDetail } from '../models/TTVpsDetail';
import TTVps from '../models/TTVps';
import Subscriber from '../models/Subscriber';
import { addDays, addMonths, calcTempo, enumerateMonthsInclusive, toPeriod, formatYMD } from '../utils/vpsPeriod';
import mongoose from 'mongoose';

type CreateScheduleBody = {
  subscriber_id?: string;
  toko?: string;
  program?: string;
  daerah?: string;
  harga?: number;
  start: string; // YYYY-MM-DD
  bulan: number; // initial term months
  diskon?: number; // applied to first month
  diskon_percent?: number; // applied to first term
};

function sum(arr: number[]): number { return arr.reduce((a, b) => a + b, 0); }

async function recalcAggregateForPeriode(periode: string, user: any) {
  // Ambil semua dokumen transaksi VPS detail
  const allDetailsDocs = await TTVpsDetail.find({});
  // Estimasi dan total_toko_estimasi dari periode ini saja
  const periodeDocs = allDetailsDocs.filter(d => d.periode === periode);
  const estimasi = sum(periodeDocs.map(d => d.total_harga));
  const total_toko_estimasi = periodeDocs.length;
  // realisasi dan total_toko_realisasi: semua dokumen status DONE dan tgl_lunas di periode target
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

function getFiscalEndMonth(start: Date): Date {
  const y = start.getUTCFullYear();
  const m = start.getUTCMonth(); // 0..11
  const endYear = m === 11 ? y + 1 : y; // if Dec, next year's Nov; else same year's Nov
  return new Date(Date.UTC(endYear, 10, 1)); // November 1st
}

function lastDayOfMonth(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0));
}

export const createSchedule = async (req: Request, res: Response) => {
  try {
    const body = req.body as CreateScheduleBody;
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

    // Build schedule: setiap entry menggunakan "bulan" months (bukan 1 bulan)
    const firstTempo = calcTempo(startDate, body.bulan);
    const fiscalEndMonth = getFiscalEndMonth(startDate); // Nov 1st of fiscal end year
    const fiscalEndDate = lastDayOfMonth(new Date(Date.UTC(fiscalEndMonth.getUTCFullYear(), fiscalEndMonth.getUTCMonth(), 1)));

    const entries: { start: Date; bulan: number; tempo: Date; diskon: number }[] = [];

    // First term
    entries.push({ start: startDate, bulan: body.bulan, tempo: firstTempo, diskon: diskonFirst });

    // Continue per X bulan sampai fiscal end
    let cursorStart = addDays(firstTempo, 1);
    while (cursorStart <= fiscalEndDate) {
      const tempo = calcTempo(cursorStart, body.bulan);
      entries.push({ start: cursorStart, bulan: body.bulan, tempo, diskon: 0 });
      const nextStart = addDays(tempo, 1);
      if (nextStart > fiscalEndDate) break;
      cursorStart = nextStart;
    }


    // Persist setiap entry sebagai satu dokumen
    const affectedPeriodes = new Set<string>();
    const chainId = new mongoose.Types.ObjectId().toString();
    for (const e of entries) {
      const periode = toPeriod(e.start);
      affectedPeriodes.add(periode);
      const jumlah_harga = harga! * e.bulan;
      const now = new Date();
      const doc: Partial<ITTVpsDetail> = {
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
        status: 'OPEN',
        input_date: now,
        update_date: now,
        delete_date: null,
        input_by: userTag,
        update_by: userTag,
        delete_by: null,
      };
      await TTVpsDetail.create(doc);
    }

    // Recalculate aggregates
    for (const p of affectedPeriodes) {
      await recalcAggregateForPeriode(p, (req as any).user);
    }

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
    // Ambil semua dokumen VPS detail di periode tersebut
    const docs = await TTVpsDetail.find({ periode });
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
    // Compute aggregates from detail documents of the target periode
    const detailsDocs = await TTVpsDetail.find({ periode });
    const computedEstimasi = detailsDocs.reduce((acc, d) => acc + (d.total_harga || 0), 0);
    const realisasiDetails = detailsDocs.filter(d => d.status === 'DONE' && d.tgl_lunas && d.tgl_lunas.slice(0,7) === periode);
    const computedRealisasi = sum(realisasiDetails.map(d => d.total_harga));
    const computedTotalTokoEstimasi = detailsDocs.length;
    const computedTotalTokoRealisasi = realisasiDetails.length;

    // Upsert aggregate document to keep cache in sync
    await TTVps.updateOne(
      { periode },
      {
        $set: {
          estimasi: computedEstimasi,
          realisasi: computedRealisasi,
          total_toko_estimasi: computedTotalTokoEstimasi,
          total_toko_realisasi: computedTotalTokoRealisasi,
    // Estimasi dari dokumen periode ini; realisasi dari SEMUA dokumen dengan tgl_lunas di periode target
    const detailsDocsPerPeriod = await TTVpsDetail.find({ periode });
    const computedEstimasi = detailsDocsPerPeriod.reduce((acc, d) => acc + (d.total_harga || 0), 0);
    const realisasiDocs = await TTVpsDetail.find({ status: 'DONE', tgl_lunas: { $regex: `^${periode}` } });
    const computedRealisasi = realisasiDocs.reduce((acc, d) => acc + (d.total_harga || 0), 0);
    const computedTotalTokoEstimasi = detailsDocsPerPeriod.length;
    const computedTotalTokoRealisasi = realisasiDocs.length;
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
    const { status, tanggalLunas } = req.body as { status: 'OPEN' | 'DONE', tanggalLunas?: string };
    if (!['OPEN', 'DONE'].includes(status)) return res.status(400).json({ message: 'invalid status' });
    const userTag = (req as any).user?.username || (req as any).user?._id || 'system';

    const item = await TTVpsDetail.findOne({ _id: itemId, periode });
    if (!item) return res.status(404).json({ message: 'item not found' });
    item.status = status;
    if (status === 'DONE' && tanggalLunas) {
      item.tgl_lunas = tanggalLunas;
    } else if (status === 'OPEN') {
      item.tgl_lunas = undefined;
    }
    item.update_date = new Date();
    item.update_by = userTag;
    await item.save();
    // Recalculate aggregates for the item period and, if provided, the tgl_lunas period
    const affected = new Set<string>();
    affected.add(periode);
    if (status === 'DONE' && tanggalLunas) affected.add(tanggalLunas.slice(0,7));
    for (const p of affected) {
      await recalcAggregateForPeriode(p, (req as any).user);
    }
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
    }
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};

export const getAggregateByPeriode = async (req: Request, res: Response) => {
  try {
    const { periode } = req.query as { periode?: string };
    if (!periode) return res.status(400).json({ message: 'periode is required' });

    // Estimasi dari dokumen periode ini; realisasi dari SEMUA dokumen dengan tgl_lunas di periode target
    const detailsDocsPerPeriod = await TTVpsDetail.find({ periode });
    const computedEstimasi = detailsDocsPerPeriod.reduce((acc, d) => acc + (d.total_harga || 0), 0);
    const realisasiDocs = await TTVpsDetail.find({ status: 'DONE', tgl_lunas: { $regex: `^${periode}` } });
    const computedRealisasi = realisasiDocs.reduce((acc, d) => acc + (d.total_harga || 0), 0);
    const computedTotalTokoEstimasi = detailsDocsPerPeriod.length;
    const computedTotalTokoRealisasi = realisasiDocs.length;

    // Upsert aggregate document to keep cache in sync
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
        const endM = `${yStr}-11`;
        const startDate = new Date(startM + '-01T00:00:00.000Z');
        const endDate = new Date(endM + '-01T00:00:00.000Z');
        const months = enumerateMonthsInclusive(startDate, endDate);
        for (const p of months) targets.push(p);
      }
      for (const p of targets) {
        await recalcAggregateForPeriode(p, (req as any).user);
      }
    } else if (startChanged) {
      // Jika hanya start berubah, lakukan ripple update pada dokumen berikutnya sampai akhir tahun
      const subsequent = await TTVpsDetail.find({
        chain_id: doc.chain_id,
        toko: doc.toko,
        program: doc.program,
        periode: { $gte: periode, $regex: `^${tahunEdit}-` }
      }).sort({ start: 1 });

      const affected = new Set<string>();
      let prevTempoDate = new Date(doc.tempo + 'T00:00:00.000Z');
      for (const d of subsequent) {
        if (d._id.toString() === doc._id.toString()) continue; // skip edited
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

      // Recalc aggregates for affected periodes including edited periode
      affected.add(periode);
      for (const p of affected) {
        await recalcAggregateForPeriode(p, (req as any).user);
      }
    } else {
      // No chain-wide changes; recalc current periode
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

export const getLastPeriod = async (req: Request, res: Response) => {
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
    // Determine last known period (YYYY-MM) and next fiscal label
    const lastDoc = await TTVpsDetail.findOne({}, { periode: 1 }).sort({ periode: -1 }).lean();
    if (!lastDoc?.periode) return res.status(400).json({ message: 'Tidak ada data periode terakhir' });
    const [lastYearStr, lastMonthStr] = lastDoc.periode.split('-');
    const lastYear = parseInt(lastYearStr, 10);
    const nextFiscalLabel = lastYear + 1; // Caption purpose

    // Collect all items for the last fiscal year range (Dec lastYear-1 to Nov lastYear)
    const rangeStart = `${lastYear - 1}-12`;
    const rangeEnd = `${lastYear}-11`;
    const fiscalDocs = await TTVpsDetail.find({ periode: { $gte: rangeStart, $lte: rangeEnd } }).lean();

    // Build map of toko -> latest item
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

    // For each toko, generate next fiscal schedule based on last item properties
    const affectedPeriodes = new Set<string>();
    const userTag = (req as any).user?.username || (req as any).user?._id || 'system';
    for (const [toko, info] of Object.entries(tokoLatest)) {
      const last = info.last;
      const program = last.program;
      const daerah = (last as any).daerah || '';
      const harga = last.harga;
      // infer next fiscal segment size from the latest data in last period
      const initialMonths = last.bulan;
      const startDate = addDays(new Date(last.tempo + 'T00:00:00.000Z'), 1);

      // Build schedule: first term then monthly until fiscal end (Nov)
      const firstTempo = calcTempo(startDate, initialMonths);
      const endYear = startDate.getUTCMonth() === 11 ? startDate.getUTCFullYear() + 1 : startDate.getUTCFullYear();
      const fiscalEndDate = new Date(Date.UTC(endYear, 11, 0)); // last day of Nov

      const entries: { start: Date; bulan: number; tempo: Date; diskon: number }[] = [];
      // Term awal: gunakan initialMonths
      entries.push({ start: startDate, bulan: initialMonths, tempo: firstTempo, diskon: 0 });
      // Sisa: gunakan segmen ukuran initialMonths, hentikan bila start berikutnya melewati akhir fiskal
      let cursorStart = addDays(firstTempo, 1);
      while (cursorStart <= fiscalEndDate) {
        const tempo = calcTempo(cursorStart, initialMonths);
        entries.push({ start: cursorStart, bulan: initialMonths, tempo, diskon: 0 });
        const nextStart = addDays(tempo, 1);
        if (nextStart > fiscalEndDate) break;
        cursorStart = nextStart;
      }

      // Persist entries with a new chain_id
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
          status: 'OPEN',
          input_date: new Date(),
          update_date: new Date(),
          input_by: userTag,
          update_by: userTag,
        });
      }
    }

    // Recalculate aggregates for affected periods
    for (const p of affectedPeriodes) {
      await recalcAggregateForPeriode(p, (req as any).user);
    }

    return res.json({ message: 'generated', nextFiscalLabel, affected: Array.from(affectedPeriodes).sort() });
  } catch (err: any) {
    console.error(err);
    return res.status(500).json({ message: 'internal error', error: err?.message });
  }
};*/