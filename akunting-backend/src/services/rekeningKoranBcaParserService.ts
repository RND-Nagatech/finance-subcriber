import pdf from 'pdf-parse';

export interface ParsedBcaStatementTransaction {
  tanggal: string; // YYYY-MM-DD
  debit: number;
  credit: number;
}

export interface ParsedBcaStatementResult {
  transactions: ParsedBcaStatementTransaction[];
  groupedDaily: Array<{ tanggal: string; debit: number; credit: number; tx_count: number }>;
}

function normalizeAmount(raw: string): number {
  let cleaned = String(raw || '').replace(/[^0-9.,-]/g, '');
  if (!cleaned) return 0;
  // Handle merged CBG+amount artifact from some BCA e-statement lines.
  // Example: "01048,160,000.00" often means CBG "0104" + amount "8,160,000.00".
  if (/^0\d{4},\d{3},\d{3}\.\d{2}$/.test(cleaned)) {
    cleaned = cleaned.slice(4);
  } else if (/^0\d{3},\d{3},\d{3}\.\d{2}$/.test(cleaned)) {
    // Fallback variant where only 3-digit CBG is merged.
    cleaned = cleaned.slice(3);
  }
  // BCA statement generally uses 1,234,567.89
  const num = Number(cleaned.replace(/,/g, ''));
  return Number.isFinite(num) ? Math.abs(num) : 0;
}

function toYmd(acuanBulan: string, ddmm: string): string {
  const [yearStr, monthStr] = acuanBulan.split('-');
  const day = ddmm.slice(0, 2);
  const monthFromPdf = ddmm.slice(3, 5);
  // keep month by acuan (source of truth), but fallback to pdf month if mismatch guard is needed
  const month = monthStr || monthFromPdf;
  return `${yearStr}-${month}-${day}`;
}

function isLikelyTransactionStart(line: string): boolean {
  return /^\d{2}\/\d{2}/.test(line.trim());
}

function extractAmounts(chunk: string): number[] {
  const matches = chunk.match(/\d+(?:,\d{3})*(?:\.\d{2})/g) || [];
  return matches.map(normalizeAmount).filter((n) => n > 0);
}

function extractTransactionType(chunk: string): 'DB' | 'CR' | null {
  if (/SETORAN\s+TUNAI/i.test(chunk)) return 'CR';
  if (/\bDB\b/.test(chunk) || /\d(?:\.\d{2})?DB\d/.test(chunk)) return 'DB';
  if (/\bCR\b/.test(chunk)) return 'CR';
  // Some BCA rows encode markers without separator, e.g. CRBIF / DBBIF
  if (/\bDB(?=[A-Z])/.test(chunk)) return 'DB';
  if (/\bCR(?=[A-Z])/.test(chunk)) return 'CR';
  return null;
}

function extractMutationAmount(chunk: string, type: 'DB' | 'CR'): number | null {
  const normalizedChunk = chunk.replace(/\s+/g, ' ').trim();
  if (type === 'DB') {
    const dbMatch = normalizedChunk.match(/(\d+(?:,\d{3})*\.\d{2})\s*DB(?:\D|$)/i);
    if (dbMatch?.[1]) {
      const n = normalizeAmount(dbMatch[1]);
      if (n > 0) return n;
    }
  }

  if (type === 'CR') {
    // Common BCA credit row: "<mutasi><saldo>" without separator
    const pairMatch = normalizedChunk.match(/(\d+(?:,\d{3})*\.\d{2})\s*(?=\d+(?:,\d{3})*\.\d{2})/);
    if (pairMatch?.[1]) {
      const n = normalizeAmount(pairMatch[1]);
      if (n > 0) return n;
    }
  }

  const amounts = extractAmounts(normalizedChunk);
  if (amounts.length === 0) return null;
  if (amounts.length >= 2) return amounts[amounts.length - 2];
  return amounts[0];
}

function parseTransactionChunk(acuanBulan: string, chunkLines: string[]): ParsedBcaStatementTransaction | null {
  if (chunkLines.length === 0) return null;
  const joined = chunkLines.join(' ').replace(/\s+/g, ' ').trim();
  const start = chunkLines[0].trim();
  const ddmmMatch = start.match(/^(\d{2}\/\d{2})/);
  if (!ddmmMatch) return null;

  if (/SALDO AWAL/i.test(joined) || /MUTASI\s+CR/i.test(joined) || /MUTASI\s+DB/i.test(joined)) {
    return null;
  }

  const type = extractTransactionType(joined);
  if (!type) return null;

  const mutation = extractMutationAmount(joined, type);
  if (mutation === null || !Number.isFinite(mutation) || mutation <= 0) return null;

  const tanggal = toYmd(acuanBulan, ddmmMatch[1]);
  return {
    tanggal,
    debit: type === 'DB' ? mutation : 0,
    credit: type === 'CR' ? mutation : 0,
  };
}

function groupDaily(transactions: ParsedBcaStatementTransaction[]) {
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

export async function parseBcaStatementPdf(buffer: Buffer, acuanBulan: string, pdfPassword?: string): Promise<ParsedBcaStatementResult> {
  const monthOk = /^\d{4}-\d{2}$/.test(String(acuanBulan || ''));
  if (!monthOk) {
    throw new Error('acuan_bulan harus format YYYY-MM');
  }

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
  if (!/REKENING\s+GIRO|MUTASI\s+REKENING|BCA/i.test(text)) {
    throw new Error('Format PDF tidak dikenali sebagai rekening koran BCA.');
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

  const transactions: ParsedBcaStatementTransaction[] = [];
  for (const chunk of chunks) {
    const tx = parseTransactionChunk(acuanBulan, chunk);
    if (tx) {
      // only keep rows that match acuan month
      if (tx.tanggal.slice(0, 7) === acuanBulan) {
        transactions.push(tx);
      }
    }
  }

  if (transactions.length === 0) {
    throw new Error('Tidak ada transaksi yang berhasil diparse dari PDF bulan acuan.');
  }

  return {
    transactions,
    groupedDaily: groupDaily(transactions),
  };
}
