import { Request, Response } from 'express';
import ExcelJS from 'exceljs';
import TtFinanceDetail from '../models/TtFinanceDetail';

export const exportTransaksiExcel = async (req: Request, res: Response) => {
  try {
    // Ambil filter dari query, samakan dengan frontend
    const { from, to, nama_perusahaan, kategori, sub_kategori, sortKategori } = req.query;
    const filter: any = {};
    if (from) filter.tanggal = { ...filter.tanggal, $gte: from };
    if (to) filter.tanggal = { ...filter.tanggal, $lte: to };
    if (nama_perusahaan) filter.nama_perusahaan = nama_perusahaan;
    if (kategori) filter.kategori = kategori;
    if (sub_kategori) filter.sub_kategori = sub_kategori;
    // Hanya ambil data yang belum dihapus (soft delete)
    filter.status_deleted = { $ne: true };

    // Sorting sesuai frontend (opsional)
    let sort: any = {};
    if (sortKategori === 'asc') sort.kategori = 1;
    if (sortKategori === 'desc') sort.kategori = -1;
    // Urutkan tanggal default ascending jika tidak ada sortKategori
    if (!sortKategori) sort.tanggal = 1;

    // Limit data sesuai frontend (default 10.000, bisa diubah jika perlu)
    const limit = Number(req.query.limit) || 10000;

    // Query data
    const rows = await TtFinanceDetail.find(filter).sort(sort).limit(limit).lean();

    // Buat workbook dan worksheet
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet('Transaksi');

    // Header atas
    worksheet.mergeCells('A1', 'K1');
    worksheet.getCell('A1').value = 'DATA TRANSAKSI';
    worksheet.getCell('A1').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell('A1').font = { bold: true, size: 14 };
    worksheet.mergeCells('A2', 'K2');
    worksheet.getCell('A2').value = 'PT NAGATECH SISTEM INTEGRATOR';
    worksheet.getCell('A2').alignment = { horizontal: 'center', vertical: 'middle' };
    worksheet.getCell('A2').font = { bold: true, size: 14 };
    worksheet.mergeCells('A3', 'K3');
    worksheet.getCell('A3').value = `Tanggal : ${from || ''}${from && to ? ' s/d ' : ''}${to || ''}`;
    worksheet.getCell('A3').alignment = { horizontal: 'left', vertical: 'middle' };
    worksheet.getCell('A3').font = { size: 12, bold: true };

    // Header kolom
    const header = [
      'Tanggal', 'Kategori', 'Sub Kategori', 'Akun', 'Nilai', 'Keterangan', 'Input By', 'Perusahaan', 'No Rekening', 'Kode Bank', 'Bulan Fiskal'
    ];
    worksheet.addRow([]); // Row 4 kosong
    worksheet.addRow(header);

    // Data
    let totalNilai = 0;
    rows.forEach(row => {
      let nilai = row.nilai;
      if (typeof nilai === 'number') totalNilai += nilai;
      worksheet.addRow([
        row.tanggal,
        row.kategori,
        row.sub_kategori,
        row.akun,
        typeof nilai === 'number' ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(nilai) : nilai,
        row.keterangan,
        row.created_by || '',
        row.nama_perusahaan,
        row.no_rekening,
        row.kode_bank,
        row.bulan,
      ]);
    });

    // Set kolom Nilai (kolom ke-5) alignment right untuk semua baris data (termasuk header dan total)
    const nilaiColIdx = 5; // ExcelJS 1-based
    for (let i = 5; i <= worksheet.rowCount; i++) {
      worksheet.getRow(i).getCell(nilaiColIdx).alignment = { horizontal: 'right', vertical: 'middle' };
    }

    // Tambahkan baris total di bawah tabel
    const totalRowIdx = worksheet.rowCount + 1;
    worksheet.addRow([
      'TOTAL', '', '', '', new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR' }).format(totalNilai), '', '', '', '', '', ''
    ]);
    // Merge cell caption TOTAL dari kolom 1-4 (A-E adalah 1-5, jadi merge A1:D1 pada baris total)
    worksheet.mergeCells(`A${totalRowIdx}:D${totalRowIdx}`);
    const totalRow = worksheet.getRow(totalRowIdx);
    // Styling seluruh kolom baris total: bold, background abu muda, alignment sesuai tipe kolom
    totalRow.eachCell((cell, colNumber) => {
      cell.font = { bold: true };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E0E0E0' },
      };
      // Kolom Nilai (ke-5) rata kanan, lainnya rata kanan untuk caption, sisanya rata tengah
      if (colNumber === 5) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else if (colNumber === 1) {
        cell.alignment = { horizontal: 'right', vertical: 'middle' };
      } else {
        cell.alignment = { horizontal: 'center', vertical: 'middle' };
      }
    });
    // Border untuk seluruh baris total
    totalRow.eachCell(cell => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Styling header kolom
    const headerRow = worksheet.getRow(5);
    headerRow.eachCell(cell => {
      cell.font = { bold: true };
      cell.alignment = { horizontal: 'center', vertical: 'middle' };
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'BFE3FF' },
      };
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });

    // Styling border seluruh tabel
    worksheet.eachRow((row, rowNumber) => {
      if (rowNumber >= 5) {
        row.eachCell(cell => {
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' },
          };
        });
      }
    });

    // Auto width fit to value (max content length per kolom, min 5, max 22, padding 1)
    for (const col of worksheet.columns) {
      if (!col) continue;
      let maxLength = 5;
      (col as any).eachCell({ includeEmpty: true }, (cell: any) => {
        let val = cell.value ? cell.value.toString() : '';
        if (val.length > maxLength) maxLength = val.length;
      });
      col.width = Math.min(Math.max(maxLength + 1, 5), 22);
    }

    // Set response
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=transaksi.xlsx');
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    res.status(500).json({ message: 'Gagal export excel', error: err });
  }
};
