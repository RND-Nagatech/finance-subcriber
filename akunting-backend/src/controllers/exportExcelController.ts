import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import TtFinanceDetail from '../models/TtFinanceDetail';
import Transaksi from '../models/Transaksi';
import ThFinance from '../models/ThFinance';
import FiscalConfig from '../models/FiscalConfig';
import RekeningSaldoHarian from '../models/RekeningSaldoHarian';

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function parseRupiahSearch(input: string): number | null {
  if (!input) return null;
  const normalized = String(input)
    .replace(/rp/gi, '')
    .replace(/\s+/g, '')
    .replace(/\./g, '')
    .replace(/,/g, '');
  if (!/^-?\d+$/.test(normalized)) return null;
  const parsed = Number(normalized);
  if (!Number.isFinite(parsed)) return null;
  return parsed;
}

function columnLetter(n: number): string {
  let s = '';
  while (n > 0) {
    const mod = (n - 1) % 26;
    s = String.fromCharCode(65 + mod) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export const exportTransaksiExcel = async (req: Request, res: Response) => {
  try {
    const { from, to, nama_perusahaan, kategori, sub_kategori, akun, input_by, sortKategori, flatten, tahun, bulan, special_type, q } = req.query as any;

    const limit = Number(req.query.limit) || 10000;
    const doFlatten = String(flatten) === '1' || String(flatten).toLowerCase() === 'true';

    let rows: any[] = [];
    let header: string[] = [];

    if (doFlatten) {
      const filterAgg: any = {};
      if (tahun) filterAgg.tahun_fiskal = tahun;
      if (kategori) filterAgg.kategori = kategori;
      if (sub_kategori) filterAgg.sub_kategori = sub_kategori;
      if (akun) filterAgg.akun = akun;
      if (input_by) filterAgg.input_by = input_by;
      if (special_type === 'SPECIAL') filterAgg.transaction_mode = 'SPECIAL';
      if (special_type === 'FINANCE_ONLY') filterAgg.transaction_mode = 'FINANCE_ONLY';
      if (special_type === 'NORMAL') {
        filterAgg.$or = [
          { transaction_mode: { $exists: false } },
          { transaction_mode: '' },
          { transaction_mode: null },
          { transaction_mode: 'NORMAL' },
        ];
      }

      let Model: any = Transaksi;
      if (tahun) {
        const fiscalCfg = await FiscalConfig.findOne({ key: 'fiscal' });
        if (fiscalCfg && Number(tahun) < Number(fiscalCfg.active_year)) {
          Model = ThFinance;
        }
      }

      const sortStage: any = {};
      if (sortKategori === 'asc') sortStage.kategori = 1;
      else if (sortKategori === 'desc') sortStage.kategori = -1;
      sortStage.akun = 1;
      sortStage.sub_kategori = 1;
      sortStage.bulan = 1;
      const bulanStr = bulan ? String(bulan) : null;
      const pipeline: any[] = [
        ...(Object.keys(filterAgg).length ? [{ $match: filterAgg }] : []),
        { $unwind: '$data_bulanan' },
        ...(bulanStr
          ? [{
              $match: {
                $or: [
                  { 'data_bulanan.bulan': bulanStr },
                  { 'data_bulanan.bulan': bulanStr.replace(/\s*-\s*/g, '-') },
                  { 'data_bulanan.bulan': bulanStr.replace(/\s*-\s*/g, ' - ') }
                ]
              }
            }]
          : []),
        {
          $project: {
            kategori: 1,
            sub_kategori: 1,
            akun: 1,
            input_by: 1,
            tahun_fiskal: 1,
            bulan: '$data_bulanan.bulan',
            nilai: '$data_bulanan.nilai'
          }
        },
        ...(
          q && String(q).trim() !== ''
            ? (() => {
                const qText = String(q).trim();
                const qRegex = escapeRegex(qText);
                const qAmount = parseRupiahSearch(qText);
                return [{
                  $match: {
                    $or: [
                      { kategori: { $regex: qRegex, $options: 'i' } },
                      { sub_kategori: { $regex: qRegex, $options: 'i' } },
                      { akun: { $regex: qRegex, $options: 'i' } },
                      { bulan: { $regex: qRegex, $options: 'i' } },
                      ...(qAmount !== null ? [{ nilai: qAmount }] : []),
                    ],
                  },
                }];
              })()
            : []
        ),
        { $sort: sortStage },
        { $limit: limit }
      ];
      rows = await Model.aggregate(pipeline).allowDiskUse(true).exec();
      // Rekap tidak perlu kolom Input By
      header = ['No', 'Kategori', 'Sub Kategori', 'Akun', 'Bulan Fiskal', 'Nilai', 'Tahun Fiskal'];
    } else {
      const filter: any = { status_deleted: { $ne: true }, is_special_transaction: { $ne: true } };
      const andFilters: any[] = [];
      if (from) filter.tanggal = { ...filter.tanggal, $gte: from };
      if (to) filter.tanggal = { ...filter.tanggal, $lte: to };
      if (nama_perusahaan) filter.nama_perusahaan = nama_perusahaan;
      if (kategori) filter.kategori = kategori;
      if (sub_kategori) filter.sub_kategori = sub_kategori;
      if (akun) filter.akun = akun;
      if (input_by) filter.input_by = input_by;
      if (special_type === 'SPECIAL') filter.transaction_mode = 'SPECIAL';
      if (special_type === 'FINANCE_ONLY') filter.transaction_mode = 'FINANCE_ONLY';
      if (special_type === 'NORMAL') {
        andFilters.push({
          $or: [
          { transaction_mode: { $exists: false } },
          { transaction_mode: '' },
          { transaction_mode: null },
          { transaction_mode: 'NORMAL' },
          ],
        });
      }
      if (q && String(q).trim() !== '') {
        const qText = String(q).trim();
        const rx = new RegExp(escapeRegex(qText), 'i');
        const amount = parseRupiahSearch(qText);
        andFilters.push({
          $or: [
          { kategori: rx },
          { sub_kategori: rx },
          { akun: rx },
          { bulan: rx },
          { keterangan: rx },
          { input_by: rx },
          { nama_perusahaan: rx },
          ...(amount !== null ? [{ nilai: amount }] : []),
          ],
        });
      }
      if (andFilters.length > 0) {
        filter.$and = andFilters;
      }
      let sort: any = {};
      if (sortKategori === 'asc') sort.kategori = 1;
      if (sortKategori === 'desc') sort.kategori = -1;
      if (!sortKategori) sort.tanggal = 1;
      rows = await TtFinanceDetail.find(filter).sort(sort).limit(limit).lean();
      header = ['No', 'Tanggal', 'Kategori', 'Sub Kategori', 'Akun', 'Nilai', 'Keterangan', 'Input By', 'Perusahaan', 'No Rekening', 'Kode Bank', 'Bulan Fiskal'];
    }

    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Transaksi');

    const lastCol = columnLetter(header.length);
    worksheet.mergeCells(`A1:${lastCol}1`);
    worksheet.getCell('A1').value = 'DATA TRANSAKSI';
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell('A1').font = { name: 'Calibri', bold: true, size: 14 };

    worksheet.mergeCells(`A2:${lastCol}2`);
    worksheet.getCell('A2').value = 'PT NAGATECH SISTEM INTEGRATOR';
    worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell('A2').font = { name: 'Calibri', bold: true, size: 14 };

    worksheet.mergeCells(`A3:${lastCol}3`);
    // Rekap tidak perlu header tanggal
    worksheet.getCell('A3').value = doFlatten
      ? ''
      : `Tanggal : ${from || ''}${from && to ? ' s/d ' : ''}${to || ''}`;
    worksheet.getCell('A3').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell('A3').font = { name: 'Calibri', size: 12, bold: true };

    worksheet.addRow([]);
    worksheet.addRow(header);

    let totalNilai = 0;
    const dataStartRow = 6;
    let idx = 1;
    for (const row of rows) {
      const raw = row.nilai;
      let nilaiNum: number | null = null;
      if (typeof raw === 'number') nilaiNum = raw;
      else if (typeof raw === 'string') {
        const parsed = Number(String(raw).replace(/[^0-9.-]/g, ''));
        nilaiNum = isNaN(parsed) ? null : parsed;
      }
      if (typeof nilaiNum === 'number') totalNilai += nilaiNum;

      const values = doFlatten
        ? [
            idx,
            row.kategori,
            row.sub_kategori,
            row.akun,
            row.bulan,
            typeof nilaiNum === 'number' ? nilaiNum : null,
            row.tahun_fiskal || ''
          ]
        : [
            idx,
            row.tanggal,
            row.kategori,
            row.sub_kategori,
            row.akun,
            typeof nilaiNum === 'number' ? nilaiNum : null,
            row.keterangan,
            row.created_by || '',
            row.nama_perusahaan,
            row.no_rekening,
            row.kode_bank,
            row.bulan
          ];
      const added = worksheet.addRow(values);
      const nilaiColIndex = header.findIndex(h => h === 'Nilai') + 1;
      const nilaiCell = added.getCell(nilaiColIndex);
      if (typeof nilaiNum === 'number') nilaiCell.numFmt = '"Rp" \\ #,##0';
      idx++;
    }

    for (let r = 5; r <= worksheet.rowCount; r++) {
      const nilaiColIndex = header.findIndex(h => h === 'Nilai') + 1;
      const noColIndex = header.findIndex(h => h === 'No') + 1;
      worksheet.getRow(r).getCell(nilaiColIndex).alignment = { horizontal: 'right', vertical: 'middle' };
      if (noColIndex > 0) {
        worksheet.getRow(r).getCell(noColIndex).alignment = { horizontal: 'center', vertical: 'middle' };
      }
    }

    const dataEndRow = worksheet.rowCount;
    const totalRowIdx = dataEndRow + 1;
    // Total row cells must match header length
    const totalRowValues = Array(header.length).fill('');
    totalRowValues[0] = 'TOTAL';
    // Set placeholder for 'Nilai' column
    const nilaiColIndex = header.findIndex(h => h === 'Nilai') + 1;
    totalRowValues[nilaiColIndex - 1] = null;
    worksheet.addRow(totalRowValues);
    worksheet.mergeCells(`A${totalRowIdx}:D${totalRowIdx}`);
    const totalRow = worksheet.getRow(totalRowIdx);
    const totalCell = totalRow.getCell(nilaiColIndex);
    const nilaiColLetter = columnLetter(nilaiColIndex);
    totalCell.value = { formula: `SUM(${nilaiColLetter}${dataStartRow}:${nilaiColLetter}${dataEndRow})`, result: totalNilai };
    totalCell.numFmt = '"Rp" \\ #,##0';
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { name: 'Calibri', size: 12, bold: true };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'E0E0E0' } };
      if (colNumber === nilaiColIndex || colNumber === 1) cell.alignment = { horizontal: 'right', vertical: 'middle' };
      else cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    const headerRow = worksheet.getRow(5);
    headerRow.eachCell(cell => {
      cell.font = { name: 'Calibri', size: 12, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: '7BB8FF' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 5 && rowNumber !== totalRowIdx) {
        row.eachCell(cell => {
          if (rowNumber === 5) cell.font = { name: 'Calibri', size: 12, bold: true };
          else cell.font = { name: 'Calibri', size: 11 };
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
        });
      }
    });

    for (const col of worksheet.columns) {
      if (!col) continue;
      let maxLength = 5;
      (col as any).eachCell({ includeEmpty: true }, (cell: any) => {
        const val = cell.value ? String(cell.value) : '';
        if (val.length > maxLength) maxLength = val.length;
      });
      col.width = Math.min(Math.max(maxLength + 1, 5), 22);
    }

    // Make 'No' column narrower and centered
    const noColIndex = header.findIndex(h => h === 'No') + 1;
    if (noColIndex > 0) {
      const maxNoDigits = String(rows.length).length;
      worksheet.getColumn(noColIndex).width = Math.max(maxNoDigits + 1, 3);
      worksheet.getColumn(noColIndex).alignment = { horizontal: 'center', vertical: 'middle' };
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=transaksi.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: 'Gagal export excel', error: err });
  }
};

export const exportSaldoHarianRekeningExcel = async (req: Request, res: Response) => {
  try {
    const { kode_bank, no_rekening, start_date, end_date } = req.query as any;
    if (!kode_bank || !no_rekening) {
      return res.status(400).json({ message: 'kode_bank dan no_rekening diperlukan' });
    }

    const filter: any = {
      kode_bank: String(kode_bank),
      no_rekening: String(no_rekening),
    };
    if (start_date || end_date) {
      filter.tanggal = {};
      if (start_date) filter.tanggal.$gte = String(start_date);
      if (end_date) filter.tanggal.$lte = String(end_date);
    }

    const rows = await RekeningSaldoHarian.find(filter).sort({ tanggal: 1 }).lean();
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Saldo Harian');
    const header = [
      'No',
      'Tanggal',
      'Saldo Awal Input',
      'Debit Input',
      'Credit Input',
      'Net Input',
      'Saldo Akhir Input',
      'Saldo Awal Validated',
      'Debit Validated',
      'Credit Validated',
      'Net Validated',
      'Saldo Akhir Validated',
      'Gap Harian',
      'Gap Kumulatif',
    ];

    const lastCol = columnLetter(header.length);
    worksheet.mergeCells(`A1:${lastCol}1`);
    worksheet.getCell('A1').value = 'LAPORAN SALDO HARIAN REKENING';
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell('A1').font = { name: 'Calibri', bold: true, size: 14 };

    worksheet.mergeCells(`A2:${lastCol}2`);
    worksheet.getCell('A2').value = `${String(kode_bank)} - ${String(no_rekening)}`;
    worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell('A2').font = { name: 'Calibri', bold: true, size: 12 };

    worksheet.addRow([]);
    worksheet.addRow(header);

    let idx = 1;
    for (const r of rows) {
      const debitInput = Number(r.debit_input || 0);
      const creditInput = Number(r.credit_input || 0);
      const debitValidated = Number(r.debit_validated || 0);
      const creditValidated = Number(r.credit_validated || 0);
      const netInput = Number((r.total_transaksi_input ?? (debitInput - creditInput)) || 0);
      const netValidated = Number((r.total_transaksi_validated ?? (debitValidated - creditValidated)) || 0);
      const gapHarian = netInput - netValidated;
      const gapKumulatif = Number(r.saldo_akhir_input || 0) - Number(r.saldo_akhir_validated || 0);

      const added = worksheet.addRow([
        idx,
        r.tanggal,
        Number(r.saldo_awal_input || 0),
        debitInput,
        creditInput,
        netInput,
        Number(r.saldo_akhir_input || 0),
        Number(r.saldo_awal_validated || 0),
        debitValidated,
        creditValidated,
        netValidated,
        Number(r.saldo_akhir_validated || 0),
        gapHarian,
        gapKumulatif,
      ]);
      for (let c = 3; c <= 14; c += 1) {
        added.getCell(c).numFmt = '"Rp" \\ #,##0;[Red]-"Rp" \\ #,##0';
      }
      idx += 1;
    }

    const totalDebitInput = rows.reduce((sum, r: any) => sum + Number(r.debit_input || 0), 0);
    const totalCreditInput = rows.reduce((sum, r: any) => sum + Number(r.credit_input || 0), 0);
    const totalNetInput = rows.reduce((sum, r: any) => sum + Number((r.total_transaksi_input ?? (Number(r.debit_input || 0) - Number(r.credit_input || 0))) || 0), 0);
    const totalDebitValidated = rows.reduce((sum, r: any) => sum + Number(r.debit_validated || 0), 0);
    const totalCreditValidated = rows.reduce((sum, r: any) => sum + Number(r.credit_validated || 0), 0);
    const totalNetValidated = rows.reduce((sum, r: any) => sum + Number((r.total_transaksi_validated ?? (Number(r.debit_validated || 0) - Number(r.credit_validated || 0))) || 0), 0);

    const totalRow = worksheet.addRow([
      'TOTAL',
      '',
      '',
      totalDebitInput,
      totalCreditInput,
      totalNetInput,
      '',
      '',
      totalDebitValidated,
      totalCreditValidated,
      totalNetValidated,
      '',
      '',
      '',
    ]);
    worksheet.mergeCells(`A${totalRow.number}:C${totalRow.number}`);
    for (let c = 4; c <= 11; c += 1) {
      totalRow.getCell(c).numFmt = '"Rp" \\ #,##0;[Red]-"Rp" \\ #,##0';
      totalRow.getCell(c).font = { name: 'Calibri', size: 11, bold: true };
    }
    totalRow.getCell(1).font = { name: 'Calibri', size: 11, bold: true };

    const headerRow = worksheet.getRow(4);
    headerRow.eachCell((cell) => {
      cell.font = { name: 'Calibri', size: 11, bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'DDEEFF' } };
      cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
    });

    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 4) {
        row.eachCell((cell, colNumber) => {
          cell.border = { top: { style: 'thin' }, left: { style: 'thin' }, bottom: { style: 'thin' }, right: { style: 'thin' } };
          if (colNumber >= 3) cell.alignment = { horizontal: 'right', vertical: 'middle' };
        });
      }
    });

    worksheet.getColumn(1).width = 7;
    worksheet.getColumn(2).width = 14;
    for (let c = 3; c <= 14; c += 1) worksheet.getColumn(c).width = 18;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=saldo-harian-${String(kode_bank)}-${String(no_rekening)}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: 'Gagal export excel saldo harian rekening', error: err });
  }
};
