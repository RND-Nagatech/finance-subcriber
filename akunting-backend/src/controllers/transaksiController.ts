import { Request, Response, NextFunction } from 'express';
import Transaksi from '../models/Transaksi';
import ThFinance from '../models/ThFinance';
import FiscalConfig from '../models/FiscalConfig';
import TtFinanceDetail from '../models/TtFinanceDetail';
import TtFinanceDaily from '../models/TtFinanceDaily';
import Rekening from '../models/Rekening';
import RiwayatSaldoRekening from '../models/RiwayatSaldoRekening';
import Bank from '../models/Bank';

// Validasi data hasil attachment (hanya superuser/corsec)
export const validateAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = req.user as any; // diasumsikan sudah ada middleware auth, req.user terisi
    if (!user || (user.role !== 'superuser' && user.role !== 'corsec')) {
      return res.status(403).json({ message: 'Unauthorized' });
    }
    const { id } = req.body;
    if (!id) return res.status(400).json({ message: 'ID is required' });
    const doc = await TtFinanceDetail.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi detail not found' });
    if (doc.is_validated) {
      return res.status(400).json({ message: 'Transaksi sudah divalidasi, tidak bisa divalidasi ulang.' });
    }

    // Update saldo rekening jika ada rekening
    if (doc.kode_bank && doc.no_rekening) {
      const rekening = await Rekening.findOne({ kode_bank: doc.kode_bank, no_rekening: doc.no_rekening });
      if (rekening) {
        const saldoAwal = rekening.saldo;
        let saldoMasuk = 0;
        let saldoKeluar = 0;
        let saldoAkhir = saldoAwal;

        if (doc.kategori === 'PENDAPATAN') {
          saldoMasuk = doc.nilai;
          saldoAkhir += doc.nilai;
        } else {
          saldoKeluar = doc.nilai;
          saldoAkhir -= doc.nilai;
        }

        // Buat riwayat saldo rekening
        const riwayat = new RiwayatSaldoRekening({
          kode_bank: doc.kode_bank,
          no_rekening: doc.no_rekening,
          saldo_awal: saldoAwal,
          saldo_masuk: saldoMasuk,
          saldo_keluar: saldoKeluar,
          saldo_akhir: saldoAkhir,
          transaksi_id: doc._id,
          tanggal: new Date(doc.tanggal),
          keterangan: `${doc.kategori}/${doc.sub_kategori}/${doc.akun}`
        });

        await riwayat.save();

        // Update saldo rekening
        rekening.saldo = saldoAkhir;
        await rekening.save();
      }
    }

    // Jalankan update aggregation
    await updateTtFinanceDaily(doc.tanggal, doc.bulan, doc.kategori, doc.sub_kategori, doc.akun, doc.nilai, 'increment');
    await recalculateTransaksiAggregation(doc.kategori, doc.sub_kategori, doc.akun, doc.bulan, doc.nilai, doc.created_by, 'increment');
    doc.is_validated = true;
    await doc.save();
    res.json({ success: true, message: 'Validasi berhasil' });
  } catch (error) {
    next(error);
  }
};


// Helper function to update tt_finance_daily
async function updateTtFinanceDaily(tanggal: string, bulan: string, kategori: string, sub_kategori: string, akun: string, nilai: number, operation: 'increment' | 'decrement') {
  // Calculate fiscal year from bulan
  let tahunFiskal: string | undefined = undefined;
  if (bulan) {
    const match = bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
    if (match) {
      const bulanStr = match[1].toUpperCase();
      let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
      const bulanMap: Record<string, number> = {
        JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
        JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
      };
      const bulanAngka = bulanMap[bulanStr] || 1;
      tahunFiskal = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
    }
  }
  if (!tahunFiskal) return;

  // Format bulan fiskal from tanggal
  const [yyyy, mm, dd] = tanggal.split('-');
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const monthIdx = parseInt(mm, 10) - 1;
  const bulanFiskal = `${monthNames[monthIdx]}-${yyyy.slice(2)}`;

  if (operation === 'increment') {
    await TtFinanceDaily.findOneAndUpdate(
      {
        tanggal,
        bulan_fiskal: bulanFiskal,
        tahun_fiskal: tahunFiskal,
        kategori,
        sub_kategori,
        akun
      },
      {
        $inc: { total_nilai: nilai },
        $setOnInsert: { created_at: new Date() }
      },
      { upsert: true, new: true }
    );
  } else if (operation === 'decrement') {
    const existingDoc = await TtFinanceDaily.findOne({
      tanggal,
      bulan_fiskal: bulanFiskal,
      tahun_fiskal: tahunFiskal,
      kategori,
      sub_kategori,
      akun
    });

    if (existingDoc) {
      const newTotalNilai = (existingDoc.total_nilai || 0) - nilai;

      if (newTotalNilai <= 0) {
        await TtFinanceDaily.findOneAndDelete({
          tanggal,
          bulan_fiskal: bulanFiskal,
          tahun_fiskal: tahunFiskal,
          kategori,
          sub_kategori,
          akun
        });
      } else {
        await TtFinanceDaily.findOneAndUpdate(
          {
            tanggal,
            bulan_fiskal: bulanFiskal,
            tahun_fiskal: tahunFiskal,
            kategori,
            sub_kategori,
            akun
          },
          {
            $inc: { total_nilai: -nilai }
          },
          { new: true }
        );
      }
    }
  }
}

async function recalculateTransaksiAggregation(kategori: string, sub_kategori: string, akun: string, bulan: string, nilai: number, input_by: string, operation: 'increment' | 'decrement') {
  // Find tt_finance doc
    let tahunFiskal: string | undefined = undefined;
    if (!tahunFiskal && bulan) {
      const match = bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        tahunFiskal = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
    }
   // Cari dokumen tt_finance hanya berdasarkan kategori, sub_kategori, akun, tahun_fiskal
    let doc = await Transaksi.findOne({ kategori, sub_kategori, akun, tahun_fiskal: tahunFiskal });

    if (!doc) {
      // Buat baru jika belum ada
      doc = new Transaksi({
        kategori,
        sub_kategori,
        akun,
        data_bulanan: [{ bulan, nilai }],
        total_tahunan: nilai,
        input_by,
        tahun_fiskal: tahunFiskal,
        created_at: new Date(),
        updated_at: new Date(),
      });
    } else {
      // Update data_bulanan jika sudah ada
      const idx = doc.data_bulanan.findIndex((d: any) => d.bulan === bulan);
      if (idx >= 0) {
        // SUM nilai jika bulan sudah ada
        doc.data_bulanan[idx].nilai += operation === 'increment' ? nilai : -nilai;
      } else {
        doc.data_bulanan.push({ bulan, nilai });
      }
      // Hitung total tahunan
      doc.total_tahunan = doc.data_bulanan.reduce((sum: number, d: any) => sum + d.nilai, 0);
      doc.updated_at = new Date();
      doc.tahun_fiskal = tahunFiskal || doc.tahun_fiskal;
    }
    await doc.save();
}

export const deleteTransaksi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const deleted_by = req.body?.deleted_by || req.query?.deleted_by || 'SYSTEM';
    // Find detail
    const detail = await TtFinanceDetail.findById(id);
    if(!detail) return res.status(404).json({ message: 'Transaksi detail not found' });
    if (detail.is_validated) {
      return res.status(400).json({ message: 'Transaksi sudah divalidasi, tidak bisa dihapus.' });
    }
    // Soft delete: set status_deleted, deleted_at, deleted_by
    detail.status_deleted = true;
    detail.deleted_at = new Date();
    detail.deleted_by = deleted_by;
    await detail.save();

    res.json({ success: true, message: 'Transaksi soft deleted', detail });
  } catch (error) {
    next(error);
  }
};
// Edit data bulanan pada transaksi
export const editTransaksiBulanan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, bulan } = req.params;
    const { nilai } = req.body;
    const doc = await Transaksi.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi not found' });
    const idx = doc.data_bulanan.findIndex((d: any) => d.bulan === bulan);
    if (idx === -1) return res.status(404).json({ message: 'Bulan not found' });
    doc.data_bulanan[idx].nilai = nilai;
    doc.total_tahunan = doc.data_bulanan.reduce((sum: number, d: any) => sum + d.nilai, 0);
    doc.updated_at = new Date();
    await doc.save();
    res.json(doc);
  } catch (error) {
    next(error);
  }
};

// Hapus data bulanan pada transaksi
export const deleteTransaksiBulanan = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, bulan } = req.params;
    const doc = await Transaksi.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi not found' });
    doc.data_bulanan = doc.data_bulanan.filter((d: any) => d.bulan !== bulan);
    doc.total_tahunan = doc.data_bulanan.reduce((sum: number, d: any) => sum + d.nilai, 0);
    doc.updated_at = new Date();
    await doc.save();
    res.json(doc);
  } catch (error) {
    next(error);
  }
};

// Upload attachments for transaksi
export const uploadAttachments = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const files = req.files as Express.Multer.File[];
    if (!files || files.length === 0) return res.status(400).json({ message: 'No files uploaded' });

    const doc = await TtFinanceDetail.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi not found' });

    const newAttachments = files.map(file => ({
      path: `/uploads/transaksi/${file.filename}`
    }));
    doc.attachments = [...(doc.attachments || []), ...newAttachments];
    doc.updated_at = new Date();
    await doc.save();



    res.json({ success: true, attachments: doc.attachments });
  } catch (error) {
    next(error);
  }
};

// Delete attachment from transaksi
export const deleteAttachment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id, filename } = req.params;
    const doc = await TtFinanceDetail.findById(id);
    if (!doc) return res.status(404).json({ message: 'Transaksi not found' });

    // Filter out the attachment to be deleted
    const filteredAttachments = (doc.attachments || []).filter(att => !att.path.includes(filename));
    const wasLastAttachment = (doc.attachments || []).length > 0 && filteredAttachments.length === 0;

    doc.attachments = filteredAttachments;
    doc.updated_at = new Date();
    await doc.save();

    // If this was the last attachment, update tt_finance_daily
    if (wasLastAttachment) {
      await updateTtFinanceDaily(doc.tanggal, doc.bulan, doc.kategori, doc.sub_kategori, doc.akun, doc.nilai, 'decrement');
      await recalculateTransaksiAggregation(doc.kategori, doc.sub_kategori, doc.akun, doc.bulan, doc.nilai, doc.created_by, 'decrement');
    }

    res.json({ success: true, attachments: doc.attachments });
  } catch (error) {
    next(error);
  }
};


export const createTransaksi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kategori, sub_kategori, akun, bulan, nilai, input_by, tahun_fiskal, tanggal, keterangan, kode_perusahaan, nama_perusahaan, kode_bank, no_rekening } = req.body;
    if (!kategori || !sub_kategori || !akun || !bulan || nilai === undefined) {
      return res.status(400).json({ message: 'kategori, sub_kategori, akun, bulan, nilai required' });
    }
    // --- Fiscal year validation ---
    // Get fiscal year from bulan or tahun_fiskal
    let fiscalYearInput = tahun_fiskal;
    if (!fiscalYearInput && bulan) {
      const match = bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        fiscalYearInput = bulanAngka >= 12 ? (tahunNum + 1) : tahunNum;
      }
    }
    // Get active year from FiscalConfig
    const fiscalConfig = await FiscalConfig.findOne({ key: 'fiscal' });
    const activeYear = fiscalConfig?.active_year ? Number(fiscalConfig.active_year) : null;
    if (activeYear !== null && Number(fiscalYearInput) > activeYear) {
      return res.status(400).json({ message: `Tahun fiskal ${fiscalYearInput} melebihi tahun aktif ${activeYear}. Input/edit ditolak.` });
    }
    // Otomatis ambil tahun fiskal dari bulan jika tidak dikirim
    let tahunFiskal = tahun_fiskal;
    if (!tahunFiskal && bulan) {
      // Format bulan: "APR - 25" → bulan=APR, tahun=25
      const match = bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        // Map bulan ke angka
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        // Aturan fiskal: Desember (12) → tahun fiskal = tahun+1, Jan–Nov → tahun fiskal = tahun
        tahunFiskal = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
    }
    if (!tahunFiskal) {
      return res.status(400).json({ message: 'tahun_fiskal tidak ditemukan dari bulan' });
    }
   

    // Simpan detail transaksi ke tt_finance_detail
    // tanggal HARUS diambil dari input (bukan tanggal input), dan WAJIB ADA
    if (!tanggal) {
      return res.status(400).json({ message: 'tanggal (tanggal transaksi) wajib diisi' });
    }
    const detail = new TtFinanceDetail({
      tanggal: tanggal,
      bulan,
      kategori,
      sub_kategori,
      akun,
      nilai,
      keterangan: keterangan && keterangan.trim() !== '' ? keterangan.toUpperCase() : '-',
      created_by: input_by,
      created_at: new Date(),
      kode_perusahaan: kode_perusahaan || '',
      nama_perusahaan: nama_perusahaan || '',
      kode_bank: kode_bank && kode_bank.trim() !== '' ? kode_bank : '-',
      no_rekening: no_rekening && no_rekening.trim() !== '' ? no_rekening : '-',
      tahun_fiskal
    });

    await detail.save();

    res.json(detail);
  } catch (error) {
    next(error);
  }
};

export const listTransaksi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { tahun, bulan, kategori, sub_kategori, page = '1', limit = '10', flatten = '0', sortKategori } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const doFlatten = String(flatten) === '1' || String(flatten).toLowerCase() === 'true';
    const filter: any = {};
    if (tahun) filter.tahun_fiskal = tahun;
    if (kategori && kategori !== 'ALL') filter.kategori = kategori;
    if (sub_kategori && sub_kategori !== 'ALL') filter.sub_kategori = sub_kategori;

    // Determine which collection to use (Transaksi or ThFinance)
    let Model: any = Transaksi;
    if (tahun) {
      const fiscalConfig = await FiscalConfig.findOne({ key: 'fiscal' });
      if (fiscalConfig && Number(tahun) < Number(fiscalConfig.active_year)) {
        Model = ThFinance;
      }
    }

    if (doFlatten) {
      // Aggregate to return flattened data_bulanan rows with pagination
      const matchStage = Object.keys(filter).length ? [{ $match: filter }] : [];
      // Unwind and project useful fields
      const sortStage: any = {};
      if (sortKategori === 'asc') sortStage.kategori = 1;
      else if (sortKategori === 'desc') sortStage.kategori = -1;
      sortStage.akun = 1;
      sortStage.sub_kategori = 1;
      sortStage.bulan = 1;
      const bulanStr = bulan ? String(bulan) : null;
      const pipeline: any[] = [
        ...matchStage,
        { $unwind: '$data_bulanan' },
        ...(bulanStr ? [{ $match: { $or: [
          { 'data_bulanan.bulan': bulanStr },
          { 'data_bulanan.bulan': bulanStr.replace(/\s*-\s*/, '-') },
          { 'data_bulanan.bulan': bulanStr.replace(/\s*-\s*/, ' - ') }
        ] } }] : []),
        {
          $project: {
            kategori: 1,
            sub_kategori: 1,
            akun: 1,
            input_by: 1,
            tahun_fiskal: 1,
            bulan: '$data_bulanan.bulan',
            nilai: '$data_bulanan.nilai',
            parentId: '$_id',
          },
        },
        { $sort: sortStage },
        {
          $facet: {
            pagedResults: [
              { $skip: (pageNum - 1) * limitNum },
              { $limit: limitNum },
            ],
            totalCount: [
              { $count: 'count' }
            ],
            totalSum: [
              { $group: { _id: null, sum: { $sum: '$nilai' } } }
            ]
          }
        }
      ];

      const aggRes = await Model.aggregate(pipeline).allowDiskUse(true).exec();
      const paged = aggRes[0]?.pagedResults || [];
      const total = (aggRes[0]?.totalCount && aggRes[0].totalCount[0] && aggRes[0].totalCount[0].count) || 0;
      const totalSum = (aggRes[0]?.totalSum && aggRes[0].totalSum[0] && aggRes[0].totalSum[0].sum) || 0;
      const totalPages = Math.ceil(total / limitNum) || 1;
      return res.json({ data: paged, total, totalNilai: totalSum, page: pageNum, totalPages });
    }

    // Default: return paginated documents (grouped per transaksi)
    const total = await Model.countDocuments(filter);
    const totalPages = Math.ceil(total / limitNum) || 1;
    const sumAgg = await Model.aggregate([
      { $match: filter },
      { $group: { _id: null, sum: { $sum: '$total_tahunan' } } }
    ]).exec();
    const totalSum = sumAgg[0]?.sum || 0;
    const sortObj: any = {};
    if (sortKategori === 'asc') sortObj.kategori = 1;
    else if (sortKategori === 'desc') sortObj.kategori = -1;
    sortObj.akun = 1;
    sortObj.sub_kategori = 1;
    const list = await Model.find(filter)
      .sort(sortObj)
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    res.json({ data: list, total, totalNilai: totalSum, page: pageNum, totalPages });
  } catch (error) {
    next(error);
  }
};

export const updateTransaksi = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { kategori, sub_kategori, akun, bulan, nilai, input_by, tahun_fiskal, tanggal, keterangan, kode_perusahaan, nama_perusahaan, kode_bank, no_rekening } = req.body;
    // Cari detail transaksi di tt_finance_detail
    const detail = await TtFinanceDetail.findById(id);
    if (!detail) return res.status(404).json({ message: 'Transaksi detail not found' });
    if (detail.is_validated) {
      return res.status(400).json({ message: 'Transaksi sudah divalidasi, tidak bisa diedit.' });
    }
    // --- Fiscal year validation for update ---
    // Determine fiscal year from new bulan or tahun_fiskal
    let fiscalYearInput = tahun_fiskal;
    let bulanInput = bulan || detail.bulan;
    if (!fiscalYearInput && bulanInput) {
      const match = bulanInput.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        fiscalYearInput = bulanAngka >= 12 ? (tahunNum + 1) : tahunNum;
      }
    }
    // Get active year from FiscalConfig
    const fiscalConfig = await FiscalConfig.findOne({ key: 'fiscal' });
    const activeYear = fiscalConfig?.active_year ? Number(fiscalConfig.active_year) : null;
    if (activeYear !== null && Number(fiscalYearInput) > activeYear) {
      return res.status(400).json({ message: `Tahun fiskal ${fiscalYearInput} melebihi tahun aktif ${activeYear}. Input/edit ditolak.` });
    }

    // Save old values before update (declare only once)
    const oldKategori = detail.kategori;
    const oldSubKategori = detail.sub_kategori;
    const oldAkun = detail.akun;
    const oldBulan = detail.bulan;
    const oldNilai = detail.nilai;
    const oldTanggal = detail.tanggal; // simpan tanggal lama sebelum update
    const oldTahunFiskal = tahun_fiskal || (() => {
      const match = detail.bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        return bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
      return undefined;
    })();

    // 1. Soft delete old detail
    detail.status_deleted = true;
    detail.deleted_at = new Date();
    detail.deleted_by = input_by || 'SYSTEM';
    await detail.save();

    // 2. Decrement/rekap tt_finance_daily untuk tanggal lama (aggregate ulang)
    if (oldTanggal && oldKategori && oldSubKategori && oldAkun && oldBulan && oldNilai && oldTahunFiskal) {
      const [yyyyOld, mmOld, ddOld] = oldTanggal.split('-');
      const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
      const monthIdxOld = parseInt(mmOld, 10) - 1;
      const bulanFiskalOld = `${monthNames[monthIdxOld]}-${yyyyOld.slice(2)}`;
      // Aggregate ulang nilai detail yang status_deleted=false
      const sumDetail = await TtFinanceDetail.aggregate([
        { $match: {
            tanggal: oldTanggal,
            kategori: oldKategori,
            sub_kategori: oldSubKategori,
            akun: oldAkun,
            status_deleted: { $ne: true }
        } },
        { $group: { _id: null, total: { $sum: "$nilai" } } }
      ]);
      const totalNilaiBaru = sumDetail[0]?.total || 0;
      await TtFinanceDaily.findOneAndUpdate(
        {
          tanggal: oldTanggal,
          bulan_fiskal: bulanFiskalOld,
          tahun_fiskal: oldTahunFiskal,
          kategori: oldKategori,
          sub_kategori: oldSubKategori,
          akun: oldAkun
        },
        {
          $set: { total_nilai: totalNilaiBaru }
        },
        { new: true }
      );
    }

    // Hitung tahun fiskal dari bulan baru
    let tahunFiskal = tahun_fiskal;
    if (!tahunFiskal && detail.bulan) {
      const match = detail.bulan.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        tahunFiskal = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
    }

    // Try to find tt_finance by new values first
    let doc = await Transaksi.findOne({ kategori: detail.kategori, sub_kategori: detail.sub_kategori, akun: detail.akun, tahun_fiskal: tahunFiskal });
    // If not found, try by old values
    if (!doc) {
      doc = await Transaksi.findOne({ kategori: oldKategori, sub_kategori: oldSubKategori, akun: oldAkun, tahun_fiskal: oldTahunFiskal });
    }
    if (!doc) {
      // Buat dokumen baru jika tidak ditemukan
      doc = new Transaksi({
        kategori: kategori || detail.kategori,
        sub_kategori: sub_kategori || detail.sub_kategori,
        akun: akun || detail.akun,
        data_bulanan: [],
        total_tahunan: 0,
        input_by: input_by || detail.created_by || 'system',
        tahun_fiskal: tahunFiskal,
        attachments: [],
        created_at: new Date(),
        updated_at: new Date(),
      });
      await doc.save();
    }
    if (!doc) return res.status(404).json({ message: 'Transaksi not found' });

    // 1. Soft delete old detail
    detail.status_deleted = true;
    detail.deleted_at = new Date();
    detail.deleted_by = input_by || 'SYSTEM';
    await detail.save();

    // 2. Create new detail (like add)
    const newDetail = new TtFinanceDetail({
      tanggal: tanggal || detail.tanggal,
      bulan: bulan || detail.bulan,
      kategori: kategori || detail.kategori,
      sub_kategori: sub_kategori || detail.sub_kategori,
      akun: akun || detail.akun,
      nilai: nilai !== undefined ? nilai : detail.nilai,
      keterangan: keterangan && keterangan.trim() !== '' ? keterangan.toUpperCase() : '-',
      created_by: input_by || detail.created_by,
      created_at: new Date(),
      kode_perusahaan: kode_perusahaan || '',
      nama_perusahaan: nama_perusahaan || '',
      kode_bank: kode_bank && kode_bank.trim() !== '' ? kode_bank : '-',
      no_rekening: no_rekening && no_rekening.trim() !== '' ? no_rekening : '-',
      attachments: detail.attachments && detail.attachments.length > 0 ? [...detail.attachments] : [],
    });
    await newDetail.save();

    // 3. Update tt_finance aggregation for old and new bulan
    // Find doc for old values
    let tahunFiskalOld = oldTahunFiskal;
    let docOld = null;
    if (tahunFiskalOld) {
      docOld = await Transaksi.findOne({ kategori: oldKategori, sub_kategori: oldSubKategori, akun: oldAkun, tahun_fiskal: tahunFiskalOld });
    }
    if (!docOld) {
      docOld = await Transaksi.findOne({ kategori: oldKategori, sub_kategori: oldSubKategori, akun: oldAkun });
      if (docOld) tahunFiskalOld = docOld.tahun_fiskal;
    }
    if (docOld) {
      // Only sum nilai where status_deleted != true
      const sumOld = await TtFinanceDetail.aggregate([
        { $match: {
          kategori: oldKategori,
          sub_kategori: oldSubKategori,
          akun: oldAkun,
          bulan: oldBulan,
          status_deleted: { $ne: true }
        } },
        { $group: { _id: null, total: { $sum: "$nilai" } } }
      ]);
      const totalBulanOld = sumOld[0]?.total || 0;
      const idxOld = docOld.data_bulanan.findIndex((d: any) => d.bulan === oldBulan);
      if (idxOld >= 0) {
        if (totalBulanOld > 0) {
          docOld.data_bulanan[idxOld].nilai = totalBulanOld;
        } else {
          docOld.data_bulanan.splice(idxOld, 1);
        }
      }
      docOld.total_tahunan = docOld.data_bulanan.reduce((sum: number, d: any) => sum + d.nilai, 0);
      docOld.updated_at = new Date();
      await docOld.save();
    }

    // HAPUS seluruh blok berikut:
    // Update/create docNew untuk new values (tt_finance)
    // const sumNew = await TtFinanceDetail.aggregate([...]);
    // const totalBulanNew = sumNew[0]?.total || 0;
    // if (docNew) { ... } else { ... }

    // Find doc for new values
    let tahunFiskalNew = tahun_fiskal;
    let docNew = null;
    // Pastikan tahunFiskalNew selalu terisi dari bulan baru ATAU bulan lama detail
    const bulanRef = bulan || detail.bulan;
    if (!tahunFiskalNew && bulanRef) {
      const match = bulanRef.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        tahunFiskalNew = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
    }
    if (tahunFiskalNew) {
      docNew = await Transaksi.findOne({ kategori: kategori || detail.kategori, sub_kategori: sub_kategori || detail.sub_kategori, akun: akun || detail.akun, tahun_fiskal: tahunFiskalNew });
    }
    if (!docNew) {
      docNew = await Transaksi.findOne({ kategori: kategori || detail.kategori, sub_kategori: sub_kategori || detail.sub_kategori, akun: akun || detail.akun });
      if (docNew) tahunFiskalNew = docNew.tahun_fiskal;
    }
    // Always aggregate and update/create docNew for new values
    // const sumNew = await TtFinanceDetail.aggregate([...]);
    // const totalBulanNew = sumNew[0]?.total || 0;
    // if (docNew) { ... } else { ... }

    // Buat dokumen baru jika belum ada
    if (!tahunFiskalNew) {
      // Safety net: derive from bulan detail jika masih kosong
      const match = (bulan || detail.bulan)?.match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
      if (match) {
        const bulanStr = match[1].toUpperCase();
        let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
        const bulanMap: Record<string, number> = {
          JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
          JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
        };
        const bulanAngka = bulanMap[bulanStr] || 1;
        tahunFiskalNew = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
      }
    }

    if (!tahunFiskalNew) {
      return res.status(400).json({ message: 'Gagal menentukan tahun_fiskal untuk transaksi baru.' });
    }
    // const newTransaksi = new Transaksi({
    //   kategori: kategori || detail.kategori,
    //   sub_kategori: sub_kategori || detail.sub_kategori,
    //   akun: akun || detail.akun,
    //   data_bulanan: [{ bulan: bulan || detail.bulan, nilai: totalBulanNew }],
    //   total_tahunan: totalBulanNew,
    //   input_by: input_by || detail.created_by || 'system',
    //   tahun_fiskal: tahunFiskalNew,
    //   created_at: new Date(),
    //   updated_at: new Date(),
    // });
    // await newTransaksi.save();

    res.json({ old_detail: detail, new_detail: newDetail });
  } catch (error) {
    next(error);
  }
};

// Batch insert transaksi - menerima array of transaksi objects
export const batchCreateTransaksi = async (req: Request, res: Response, next: NextFunction) => {
    // Get active year from FiscalConfig (sekali saja)
    const fiscalConfig = await FiscalConfig.findOne({ key: 'fiscal' });
    const activeYear = fiscalConfig?.active_year ? Number(fiscalConfig.active_year) : null;
  try {
    const transaksiArray = req.body;

    // Validasi input harus berupa array
    if (!Array.isArray(transaksiArray)) {
      return res.status(400).json({ message: 'Input harus berupa array of transaksi objects' });
    }

    // Validasi array tidak kosong
    if (transaksiArray.length === 0) {
      return res.status(400).json({ message: 'Array transaksi tidak boleh kosong' });
    }

    const results = {
      success: [] as any[],
      errors: [] as any[],
      total: transaksiArray.length,
      successCount: 0,
      errorCount: 0
    };

    // Process each transaksi item
    for (let i = 0; i < transaksiArray.length; i++) {
      const item = transaksiArray[i];
      const itemIndex = i + 1;

      try {
        const { kategori, sub_kategori, akun, bulan, nilai, input_by, tahun_fiskal } = item;

        // Validasi required fields
        if (!kategori || !sub_kategori || !akun || !bulan || nilai === undefined) {
          results.errors.push({
            index: itemIndex,
            data: item,
            error: 'kategori, sub_kategori, akun, bulan, nilai required'
          });
          results.errorCount++;
          continue;
          // ...existing code...
        }

        // Derive tahun fiskal dari input atau dari bulan (DEC -> tahun+1; lainnya -> tahun)
        let tahunFiskal: string | undefined = tahun_fiskal;
        if (!tahunFiskal && bulan) {
          const match = String(bulan).match(/([A-Z]+)\s*-\s*(\d{2,4})$/i);
          if (match) {
            const bulanStr = match[1].toUpperCase();
            let tahunNum = match[2].length === 2 ? 2000 + parseInt(match[2]) : parseInt(match[2]);
            const bulanMap: Record<string, number> = {
              JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6,
              JUL: 7, AUG: 8, SEP: 9, OCT: 10, NOV: 11, DEC: 12
            };
            const bulanAngka = bulanMap[bulanStr] || 1;
            tahunFiskal = bulanAngka >= 12 ? (tahunNum + 1).toString() : tahunNum.toString();
          }
        }
        if (!tahunFiskal) {
          throw new Error('tahun_fiskal tidak dapat ditentukan dari bulan');
        }

        // Cari dokumen tt_finance berdasarkan kategori, sub_kategori, akun, tahun_fiskal
        let doc = await Transaksi.findOne({ kategori, sub_kategori, akun, tahun_fiskal: tahunFiskal });

        if (!doc) {
          // Buat baru jika belum ada
          doc = new Transaksi({
            kategori,
            sub_kategori,
            akun,
            data_bulanan: [{ bulan, nilai }],
            total_tahunan: nilai,
            input_by: input_by || 'system',
            tahun_fiskal: tahunFiskal,
            created_at: new Date(),
            updated_at: new Date(),
          });
        } else {
          // Update data_bulanan jika sudah ada
          const idx = doc.data_bulanan.findIndex((d: any) => d.bulan === bulan);
          if (idx >= 0) {
            doc.data_bulanan[idx].nilai = nilai;
          } else {
            doc.data_bulanan.push({ bulan, nilai });
          }
          // Hitung total tahunan
          doc.total_tahunan = doc.data_bulanan.reduce((sum: number, d: any) => sum + d.nilai, 0);
          doc.updated_at = new Date();
          doc.tahun_fiskal = tahunFiskal;
        }

        await doc.save();
        results.success.push({
          index: itemIndex,
          data: item,
          result: doc
        });
        results.successCount++;

      } catch (itemError) {
        results.errors.push({
          index: itemIndex,
          data: item,
          error: itemError instanceof Error ? itemError.message : 'Unknown error'
        });
        results.errorCount++;
      }
    }

    // Return summary
    const statusCode = results.errorCount === 0 ? 200 : results.errorCount === results.total ? 400 : 207; // 207 = Multi-Status

    res.status(statusCode).json({
      message: `Batch insert completed. Success: ${results.successCount}, Errors: ${results.errorCount}`,
      results
    });

  } catch (error) {
    next(error);
  }
};

// Get riwayat saldo rekening
export const getRiwayatSaldoRekening = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kode_bank, no_rekening, start_date, end_date, page = '1', limit = '10' } = req.query;
    const pageNum = parseInt(page as string, 10) || 1;
    const limitNum = parseInt(limit as string, 10) || 10;
    const skip = (pageNum - 1) * limitNum;

    const filter: any = {};
    if (kode_bank) filter.kode_bank = kode_bank;
    if (no_rekening) filter.no_rekening = no_rekening;
    
    // Filter by date range
    if (start_date || end_date) {
      filter.tanggal = {};
      if (start_date) {
        filter.tanggal.$gte = new Date(start_date as string);
      }
      if (end_date) {
        filter.tanggal.$lte = new Date(end_date as string + 'T23:59:59.999Z'); // End of day
      }
    }

    const total = await RiwayatSaldoRekening.countDocuments(filter);
    const riwayat = await RiwayatSaldoRekening.find(filter)
      .sort({ createdAt: -1 }) // Sort by createdAt descending (paling lama di atas)
      .skip(skip)
      .limit(limitNum);

    res.json(riwayat);
  } catch (error) {
    next(error);
  }
};

// Get saldo rekening saat ini
export const getSaldoRekening = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { kode_bank, no_rekening } = req.query;

    if (!kode_bank || !no_rekening) {
      return res.status(400).json({ message: 'kode_bank dan no_rekening diperlukan' });
    }

    const rekening = await Rekening.findOne({
      kode_bank: kode_bank,
      no_rekening: no_rekening
    }).populate('bank_id', 'nama_bank');

    if (!rekening) {
      return res.status(404).json({ message: 'Rekening tidak ditemukan' });
    }

    res.json({
      kode_bank: rekening.kode_bank,
      no_rekening: rekening.no_rekening,
      saldo: rekening.saldo,
      nama_rekening: rekening.nama_rekening,
      nama_bank: rekening.bank_id ? (rekening.bank_id as any).nama_bank : rekening.kode_bank
    });
  } catch (error) {
    next(error);
  }
};
