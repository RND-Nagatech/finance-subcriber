import mongoose from 'mongoose';
import Subscriber from '../models/Subscriber';
import SubscriberTahun from '../models/SubscriberTahun';
import SubscriptionDetail from '../models/SubscriptionDetail';
import { addDays, getTempo, parseDateOnly, toPeriode } from '../utils/subscriptionPeriod';

const getFiscalYear = (date: Date) => date.getUTCMonth() === 11 ? date.getUTCFullYear() + 1 : date.getUTCFullYear();

const getFiscalEndDate = (date: Date) => {
  const endYear = getFiscalYear(date);
  return new Date(Date.UTC(endYear, 11, 0, 12, 0, 0, 0));
};

const buildFiscalSchedule = (params: {
  startDate: Date;
  jumlahBulan: number;
  biayaPerBulan: number;
  firstDiskon?: number;
}) => {
  const entries: Array<{ periode: string; tahun: number; totalBiaya: number }> = [];
  const fiscalEndDate = getFiscalEndDate(params.startDate);
  let cursorStart = params.startDate;
  let isFirst = true;

  while (cursorStart <= fiscalEndDate) {
    const tempo = getTempo(cursorStart, params.jumlahBulan);
    const nextStart = addDays(tempo, 1);
    const jumlahBiaya = params.biayaPerBulan * params.jumlahBulan;
    const diskon = isFirst ? Math.max(0, Math.min(jumlahBiaya, Number(params.firstDiskon || 0))) : 0;
    entries.push({
      periode: toPeriode(cursorStart),
      tahun: getFiscalYear(cursorStart),
      totalBiaya: Math.max(0, jumlahBiaya - diskon),
    });
    cursorStart = nextStart;
    isFirst = false;
  }

  return entries;
};

const toObjectId = (value: unknown) => {
  if (!value) return null;
  if (value instanceof mongoose.Types.ObjectId) return value;
  if (mongoose.Types.ObjectId.isValid(String(value))) return new mongoose.Types.ObjectId(String(value));
  return null;
};

export const getCurrentFiscalYear = () => {
  const now = new Date();
  return getFiscalYear(new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 12)));
};

export const rebuildSubscriberTahun = async (subscriberId: unknown, tahun: number, userTag = 'system') => {
  const objectId = toObjectId(subscriberId);
  const fiscalYear = Number(tahun || 0);
  if (!objectId || !fiscalYear) return null;

  const subscriber: any = await Subscriber.findById(objectId).lean();
  if (!subscriber || subscriber.delete_date) {
    await SubscriberTahun.updateOne(
      { subscriber_id: objectId, tahun: fiscalYear, delete_date: null },
      {
        $set: {
          delete_date: new Date(),
          delete_by: userTag,
          update_date: new Date(),
          update_by: userTag,
        },
      }
    );
    return null;
  }

  const [paidSummary] = await SubscriptionDetail.aggregate([
    {
      $match: {
        subscriber_id: objectId,
        tahun: fiscalYear,
        status: 'DONE',
        delete_date: null,
      },
    },
    {
      $group: {
        _id: null,
        total: { $sum: '$total_biaya' },
      },
    },
  ]);

  const activeDetails: any[] = await SubscriptionDetail.find({
    subscriber_id: objectId,
    tahun: fiscalYear,
    status: { $in: ['OPEN', 'PROCESS'] },
    is_active: { $ne: false },
    delete_date: null,
  }).lean();

  const sisaTagihan = activeDetails.reduce((sum, detail) => {
    const startDate = parseDateOnly(detail.tgl_mulai_tagihan);
    if (!startDate) return sum;
    const schedule = buildFiscalSchedule({
      startDate,
      jumlahBulan: Math.max(1, Number(detail.jumlah_bulan || 1)),
      biayaPerBulan: Math.max(0, Number(detail.biaya_per_bulan || 0)),
      firstDiskon: Number(detail.diskon || 0),
    });
    return sum + schedule
      .filter((entry) => entry.tahun === fiscalYear)
      .reduce((entrySum, entry) => entrySum + Number(entry.totalBiaya || 0), 0);
  }, 0);

  const tagihanTerbayar = Math.max(0, Number(paidSummary?.total || 0));
  const summaryPayload = {
    subscriber_id: objectId,
    kode_subscriber: subscriber.kode,
    toko: subscriber.toko,
    kode_group: subscriber.kode_group || null,
    nama_group: subscriber.nama_group || null,
    program: subscriber.program || null,
    status_subscriber: subscriber.status_subscriber || 'AKTIF',
    tahun: fiscalYear,
    tagihan_terbayar: tagihanTerbayar,
    sisa_tagihan: Math.max(0, sisaTagihan),
    total_rencana_tagihan: Math.max(0, tagihanTerbayar + sisaTagihan),
    last_rebuild_at: new Date(),
    update_date: new Date(),
    update_by: userTag,
    delete_date: null,
    delete_by: null,
  };

  const result = await SubscriberTahun.findOneAndUpdate(
    { subscriber_id: objectId, tahun: fiscalYear, delete_date: null },
    {
      $set: summaryPayload,
      $setOnInsert: {
        input_date: new Date(),
        input_by: userTag,
      },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true }
  ).lean();

  return result;
};

export const rebuildSubscriberTahunForDetails = async (
  details: Array<{ subscriber_id?: unknown; tahun?: number } | null | undefined>,
  userTag = 'system'
) => {
  const keys = new Set<string>();
  for (const detail of details) {
    const objectId = toObjectId(detail?.subscriber_id);
    const tahun = Number(detail?.tahun || 0);
    if (objectId && tahun) keys.add(`${objectId.toString()}::${tahun}`);
  }

  const results = [];
  for (const key of keys) {
    const [subscriberId, tahun] = key.split('::');
    results.push(await rebuildSubscriberTahun(subscriberId, Number(tahun), userTag));
  }
  return results;
};

export const rebuildAllSubscriberTahun = async (tahun: number, userTag = 'system') => {
  const fiscalYear = Number(tahun || 0);
  if (!fiscalYear) return { total: 0, rebuilt: 0 };

  const subscriberIds = new Set<string>();
  const subscribers = await Subscriber.find({
    delete_date: null,
    status_aktv: true,
    status_subscriber: { $in: ['AKTIF', 'NON_AKTIF'] },
  }, { _id: 1 }).lean();
  subscribers.forEach((subscriber: any) => subscriberIds.add(String(subscriber._id)));

  const detailSubscriberIds = await SubscriptionDetail.distinct('subscriber_id', {
    tahun: fiscalYear,
    delete_date: null,
  });
  detailSubscriberIds.forEach((subscriberId: any) => subscriberIds.add(String(subscriberId)));

  let rebuilt = 0;
  for (const subscriberId of subscriberIds) {
    await rebuildSubscriberTahun(subscriberId, fiscalYear, userTag);
    rebuilt += 1;
  }

  return { total: subscriberIds.size, rebuilt };
};
