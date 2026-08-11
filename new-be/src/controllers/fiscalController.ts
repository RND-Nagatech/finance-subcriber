import { Request, Response } from 'express';
import FiscalConfig from '../models/FiscalConfig';
import Subscriber from '../models/Subscriber';
import TTVpsDetail from '../models/TTVpsDetail';
import { fiscalMonthsForYear } from '../utils/fiscal';

export const getFiscalYears = async (_req: Request, res: Response) => {
  try {
    const subscriberYears = await Subscriber.aggregate([
      { $match: { tanggal: { $exists: true, $ne: null } } },
      {
        $project: {
          year: { $year: { date: '$tanggal', timezone: 'Asia/Jakarta' } },
          month: { $month: { date: '$tanggal', timezone: 'Asia/Jakarta' } },
        },
      },
      {
        $project: {
          fiscalYear: {
            $cond: [{ $eq: ['$month', 12] }, { $add: ['$year', 1] }, '$year'],
          },
        },
      },
      { $group: { _id: '$fiscalYear' } },
    ]);

    const vpsYears = await TTVpsDetail.aggregate([
      { $match: { periode: { $type: 'string' } } },
      {
        $project: {
          year: { $toInt: { $substr: ['$periode', 0, 4] } },
          month: { $toInt: { $substr: ['$periode', 5, 2] } },
        },
      },
      {
        $project: {
          fiscalYear: {
            $cond: [{ $eq: ['$month', 12] }, { $add: ['$year', 1] }, '$year'],
          },
        },
      },
      { $group: { _id: '$fiscalYear' } },
    ]);

    const years = Array.from(new Set([...subscriberYears, ...vpsYears].map((row: any) => Number(row._id))))
      .filter((year) => Number.isFinite(year))
      .sort((a, b) => b - a);

    res.json({ success: true, years: years.length ? years : [new Date().getFullYear()] });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getFiscalMonths = async (req: Request, res: Response) => {
  try {
    const tahun = Number(req.query.tahun) || new Date().getFullYear();
    res.json({ success: true, months: fiscalMonthsForYear(tahun) });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};

export const getActiveFiscalYear = async (_req: Request, res: Response) => {
  try {
    const cfg = await FiscalConfig.findOne({ key: 'fiscal' }).lean();
    if (cfg?.active_year) {
      return res.json({ success: true, activeYear: cfg.active_year });
    }

    const yearsResult = await TTVpsDetail.aggregate([
      { $match: { periode: { $type: 'string' } } },
      {
        $project: {
          year: { $toInt: { $substr: ['$periode', 0, 4] } },
          month: { $toInt: { $substr: ['$periode', 5, 2] } },
        },
      },
      {
        $project: {
          fiscalYear: {
            $cond: [{ $eq: ['$month', 12] }, { $add: ['$year', 1] }, '$year'],
          },
        },
      },
      { $sort: { fiscalYear: -1 } },
      { $limit: 1 },
    ]);

    res.json({ success: true, activeYear: yearsResult[0]?.fiscalYear || new Date().getFullYear() });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
