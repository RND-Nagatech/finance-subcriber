import { Request, Response } from 'express';
import TtFinanceDetail from '../models/TtFinanceDetail';

// GET /tt-finance-detail?from=YYYY-MM-DD&to=YYYY-MM-DD&kategori=...&sub_kategori=...
export const listTtFinanceDetail = async (req: Request, res: Response) => {
  try {
    const { from, to, kategori, sub_kategori, sortKategori } = req.query;
      const filter: any = { status_deleted: { $ne: true } };
    if (from && to) {
      filter.tanggal = { $gte: from, $lte: to };
    } else if (from) {
      filter.tanggal = { $gte: from };
    } else if (to) {
      filter.tanggal = { $lte: to };
    }
    if (kategori && kategori !== 'ALL') filter.kategori = kategori;
    if (sub_kategori && sub_kategori !== 'ALL') filter.sub_kategori = sub_kategori;
    // Default sort by tanggal ascending; apply kategori sort when provided
    const sortObj: any = {};
    if (sortKategori === 'asc') sortObj.kategori = 1;
    else if (sortKategori === 'desc') sortObj.kategori = -1;
    // Always sort by tanggal ascending after kategori (stable ordering)
    sortObj.tanggal = 1;

    const data = await TtFinanceDetail.find(filter).sort(sortObj);
    res.json({ data });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error });
  }
};
