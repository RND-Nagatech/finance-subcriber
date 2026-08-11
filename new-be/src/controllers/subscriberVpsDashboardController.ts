import { Request, Response } from 'express';
import Subscriber from '../models/Subscriber';
import Program from '../models/Program';

const FISCAL_ORDER = ['DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV'];
const MONTH_BY_NUMBER: Record<string, string> = {
  '12': 'DEC',
  '01': 'JAN',
  '02': 'FEB',
  '03': 'MAR',
  '04': 'APR',
  '05': 'MAY',
  '06': 'JUN',
  '07': 'JUL',
  '08': 'AUG',
  '09': 'SEP',
  '10': 'OCT',
  '11': 'NOV',
};

function fiscalBounds(tahun: number) {
  return {
    start: new Date(Date.UTC(tahun - 1, 11, 1, 0, 0, 0, 0)),
    endExclusive: new Date(Date.UTC(tahun, 11, 1, 0, 0, 0, 0)),
  };
}

export const subscriberGrowth = async (req: Request, res: Response) => {
  try {
    const tahunNum = Number(req.params.tahun || req.query.tahun || new Date().getFullYear());
    if (!Number.isFinite(tahunNum)) return res.status(400).json({ message: 'Tahun tidak valid' });

    const { start, endExclusive } = fiscalBounds(tahunNum);
    const rows = await Subscriber.aggregate([
      { $match: { status_aktv: true, tanggal: { $gte: start, $lt: endExclusive } } },
      { $group: { _id: { $dateToString: { format: '%m', date: '$tanggal', timezone: 'Asia/Jakarta' } }, count: { $sum: 1 } } },
    ]);

    const counts = rows.reduce((acc: Record<string, number>, row: any) => {
      const month = MONTH_BY_NUMBER[String(row._id).padStart(2, '0')];
      if (month) acc[month] = Number(row.count || 0);
      return acc;
    }, {});

    const data = FISCAL_ORDER.map((bulan, index) => ({
      bulan,
      count: counts[bulan] || 0,
      year: index === 0 ? tahunNum - 1 : tahunNum,
    }));

    const totalSubscriber = await Subscriber.countDocuments({ status_aktv: true, tanggal: { $lt: endExclusive } });
    res.json({ success: true, tahun: String(tahunNum), totalSubscriber, data });
  } catch (error) {
    console.error('Error in subscriberGrowth:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const subscriberCumulative = async (req: Request, res: Response) => {
  try {
    const tahunNum = Number(req.params.tahun || req.query.tahun || new Date().getFullYear());
    if (!Number.isFinite(tahunNum)) return res.status(400).json({ message: 'Tahun tidak valid' });

    const { start, endExclusive } = fiscalBounds(tahunNum);
    const openingBalance = await Subscriber.countDocuments({ status_aktv: true, tanggal: { $lt: start } });
    const rows = await Subscriber.aggregate([
      { $match: { status_aktv: true, tanggal: { $gte: start, $lt: endExclusive } } },
      { $group: { _id: { $dateToString: { format: '%m', date: '$tanggal', timezone: 'Asia/Jakarta' } }, count: { $sum: 1 } } },
    ]);

    const counts = rows.reduce((acc: Record<string, number>, row: any) => {
      const month = MONTH_BY_NUMBER[String(row._id).padStart(2, '0')];
      if (month) acc[month] = Number(row.count || 0);
      return acc;
    }, {});

    let runningTotal = openingBalance;
    const data = FISCAL_ORDER.map((bulan, index) => {
      runningTotal += counts[bulan] || 0;
      return {
        bulan,
        total: runningTotal,
        year: index === 0 ? tahunNum - 1 : tahunNum,
      };
    });

    res.json({
      success: true,
      tahun: String(tahunNum),
      totalSubscriber: runningTotal,
      opening_balance: openingBalance,
      data,
    });
  } catch (error) {
    console.error('Error in subscriberCumulative:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const subscriberByProgram = async (req: Request, res: Response) => {
  try {
    const tahun = Number(req.query.tahun || new Date().getFullYear());
    let bulan = String(req.query.bulan || 'NOV').toUpperCase();
    if (bulan === 'ANNUAL') bulan = 'NOV';

    const monthIndex: Record<string, number> = {
      JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
      JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11,
    };
    const endYear = bulan === 'DEC' ? tahun - 1 : tahun;
    const endDate = new Date(Date.UTC(endYear, monthIndex[bulan] + 1, 0, 23, 59, 59, 999));

    const rows = await Subscriber.aggregate([
      { $match: { status_aktv: true, tanggal: { $lte: endDate } } },
      { $lookup: { from: Program.collection.name, localField: 'program', foreignField: 'nama', as: 'program_info' } },
      { $unwind: { path: '$program_info', preserveNullAndEmptyArrays: true } },
      { $project: { program: 1, biaya: 1, group_program: { $ifNull: ['$program_info.group_program', '$program'] } } },
      {
        $group: {
          _id: '$group_program',
          programs: { $addToSet: '$program' },
          total_subscriber: { $sum: 1 },
          total_biaya: { $sum: '$biaya' },
        },
      },
      {
        $project: {
          program: '$_id',
          programs: 1,
          total_subscriber: 1,
          total_biaya: 1,
          avg_biaya_per_subscriber: {
            $cond: [{ $eq: ['$total_subscriber', 0] }, 0, { $divide: ['$total_biaya', '$total_subscriber'] }],
          },
        },
      },
      { $sort: { total_subscriber: -1 } },
    ]);

    res.json({ success: true, tahun: String(tahun), bulan, data: rows });
  } catch (error) {
    console.error('Error in subscriberByProgram:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};
