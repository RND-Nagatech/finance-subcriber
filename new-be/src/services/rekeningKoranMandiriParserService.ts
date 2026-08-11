import pdf from 'pdf-parse';

export interface ParsedMandiriStatementTransaction {
  tanggal: string; // YYYY-MM-DD
  debit: number; // outflow
  credit: number; // inflow
}

export interface ParsedMandiriStatementResult {
  transactions: ParsedMandiriStatementTransaction[];
  groupedDaily: Array<{ tanggal: string; debit: number; credit: number; tx_count: number }>;
}

const MONTH_MAP: Record<string, string> = {
  JAN: '01',
  FEB: '02',
  MAR: '03',
  APR: '04',
  MAY: '05',
  JUN: '06',
  JUL: '07',
  AUG: '08',
  SEP: '09',
  OCT: '10',
  NOV: '11',
  DEC: '12',
};

function normalizeAmount(raw: string): number {
  const cleaned = String(raw || '').replace(/[^0-9.,-]/g, '');
  if (!cleaned) return 0;
  const num = Number(cleaned.replace(/,/g, ''));
  return Number.isFinite(num) ? Math.abs(num) : 0;
}

function groupDaily(transactions: ParsedMandiriStatementTransaction[]) {
  const map = new Map<string, { debit: number; credit: number; tx_count: number }>();
  for (const tx of transactions) {
    const cur = map.get(tx.tanggal) || { debit: 0, credit: 0, tx_count: 0 };
    cur.debit += Number(tx.debit || 0);
    cur.credit += Number(tx.credit || 0);
    cur.tx_count += 1;
    map.set(tx.tanggal, cur);
  }
  return Array.from(map.entries())
    .map(([tanggal, v]) => ({ tanggal, debit: v.debit, credit: v.credit, tx_count: v.tx_count }))
    .sort((a, b) => a.tanggal.localeCompare(b.tanggal));
}

function isLikelyTransactionStart(line: string): boolean {
  return /^\d{2}\s+[A-Za-z]{3}\s+\d{4},/.test(String(line || '').trim());
}

function extractYmdFromStart(startLine: string): string | null {
  const m = String(startLine || '').trim().match(/^(\d{2})\s+([A-Za-z]{3})\s+(\d{4}),/);
  if (!m) return null;
  const day = m[1];
  const mon = MONTH_MAP[String(m[2] || '').toUpperCase()];
  const year = m[3];
  if (!mon) return null;
  return `${year}-${mon}-${day}`;
}

function parseChunk(acuanBulan: string, chunkLines: string[]): ParsedMandiriStatementTransaction | null {
  if (chunkLines.length === 0) return null;
  const start = chunkLines[0];
  const tanggal = extractYmdFromStart(start);
  if (!tanggal) return null;
  if (!tanggal.startsWith(`${acuanBulan}-`)) return null;

  const joined = chunkLines.join(' ').replace(/\s+/g, ' ').trim();

  // Mandiri statement rows usually expose amounts in this order:
  // debit, credit, balance (with "debit" meaning outflow).
  const amounts = joined.match(/\d+(?:,\d{3})*\.\d{2}/g) || [];
  if (amounts.length < 2) return null;

  const debit = normalizeAmount(amounts[0] ?? '');
  const credit = normalizeAmount(amounts[1] ?? '');
  if (debit <= 0 && credit <= 0) return null;

  return { tanggal, debit, credit };
}

export async function parseMandiriStatementPdf(
  buffer: Buffer,
  acuanBulan: string,
  pdfPassword?: string
): Promise<ParsedMandiriStatementResult> {
  const monthOk = /^\d{4}-\d{2}$/.test(String(acuanBulan || ''));
  if (!monthOk) throw new Error('acuan_bulan harus format YYYY-MM');

  let parsed: any;
  try {
    parsed = await (pdf as any)(buffer, pdfPassword ? { password: pdfPassword } : {});
  } catch (err: any) {
    const msg = String(err?.message || '').toLowerCase();
    if (msg.includes('password') || msg.includes('encrypted')) {
      throw new Error('Gagal membuka PDF. Password salah atau file terenkripsi.');
    }
    throw new Error('Gagal membaca PDF rekening koran.');
  }

  const text = String(parsed?.text || '');
  if (!text || text.trim().length < 20) {
    throw new Error('PDF tidak mengandung teks yang bisa diparse.');
  }
  if (!/Account Statement|kopra by mandiri|Mandiri/i.test(text)) {
    throw new Error('Format PDF tidak dikenali sebagai rekening koran Mandiri.');
  }

  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const chunks: string[][] = [];
  let current: string[] = [];

  for (const line of lines) {
    if (isLikelyTransactionStart(line)) {
      if (current.length > 0) chunks.push(current);
      current = [line];
    } else if (current.length > 0) {
      current.push(line);
    }
  }
  if (current.length > 0) chunks.push(current);

  const transactions: ParsedMandiriStatementTransaction[] = [];
  for (const chunk of chunks) {
    const tx = parseChunk(acuanBulan, chunk);
    if (tx) transactions.push(tx);
  }

  if (transactions.length === 0) {
    throw new Error('Tidak ada transaksi yang berhasil diparse dari PDF bulan acuan.');
  }

  return {
    transactions,
    groupedDaily: groupDaily(transactions),
  };
}
