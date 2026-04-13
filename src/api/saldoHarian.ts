import axiosInstance from './axiosInstance';

export interface SaldoHarianGeneratorPayload {
  kode_bank: string;
  no_rekening: string;
  start_date: string;
  start_balance_input: number;
  start_balance_validated: number;
}

export interface SaldoHarianPreviewRow {
  tanggal: string;
  saldo_awal_input: number;
  debit_input: number;
  credit_input: number;
  total_transaksi_input: number;
  saldo_akhir_input: number;
  saldo_awal_validated: number;
  debit_validated: number;
  credit_validated: number;
  total_transaksi_validated: number;
  saldo_akhir_validated: number;
  gap_harian: number;
  gap_kumulatif: number;
  count_transaksi_input: number;
  count_transaksi_validated: number;
}

export interface SaldoHarianPreviewResponse {
  rekening: {
    kode_bank: string;
    no_rekening: string;
    nama_rekening?: string;
  };
  start_date: string;
  end_date: string;
  affected_days: number;
  summary: {
    first_day: SaldoHarianPreviewRow | null;
    last_day: SaldoHarianPreviewRow | null;
    total_debit_input: number;
    total_credit_input: number;
    total_input: number;
    total_debit_validated: number;
    total_credit_validated: number;
    total_validated: number;
    final_gap: number;
  };
  rows: SaldoHarianPreviewRow[];
}

export interface SaldoHarianCommitResponse {
  success: boolean;
  message: string;
  rekening: {
    kode_bank: string;
    no_rekening: string;
    nama_rekening?: string;
  };
  start_date: string;
  end_date: string;
  affected_days: number;
  summary: {
    total_debit_input: number;
    total_credit_input: number;
    total_input: number;
    total_debit_validated: number;
    total_credit_validated: number;
    total_validated: number;
    final_saldo_input: number;
    final_saldo_validated: number;
    final_gap: number;
  };
}

export interface ReconcileMonthItem {
  acuan_bulan: string;
  uploaded_at: string;
  uploaded_by: string;
  total_tx_count: number;
  total_debit: number;
  total_credit: number;
}

export interface ReconcileMonthListResponse {
  success: boolean;
  data: ReconcileMonthItem[];
}

export interface ReconcileStatusRow {
  tanggal: string;
  status: 'matched' | 'unmatched' | 'not_covered';
  input_debit: number;
  input_credit: number;
  pdf_debit: number;
  pdf_credit: number;
  diff_debit: number;
  diff_credit: number;
  tolerance: number;
}

export interface ReconcileComparisonResponse {
  success: boolean;
  rekening: { kode_bank: string; no_rekening: string };
  range: { start_date: string; end_date: string };
  basis: 'input';
  tolerance: number;
  uploaded_months: string[];
  statuses: ReconcileStatusRow[];
}

export interface ReconcileUploadResponse {
  success: boolean;
  message: string;
  rekening: { kode_bank: string; no_rekening: string };
  acuan_bulan: string;
  summary: {
    total_days: number;
    total_tx_count: number;
    total_debit: number;
    total_credit: number;
  };
}

export async function previewSaldoHarian(payload: SaldoHarianGeneratorPayload) {
  const res = await axiosInstance.post('/transaksi/saldo-harian-rekening/preview', payload);
  return res.data as SaldoHarianPreviewResponse;
}

export async function commitSaldoHarian(payload: SaldoHarianGeneratorPayload & { confirm: true }) {
  const res = await axiosInstance.post('/transaksi/saldo-harian-rekening/commit', payload);
  return res.data as SaldoHarianCommitResponse;
}

export async function uploadReconcilePdf(payload: {
  kode_bank: string;
  no_rekening: string;
  acuan_bulan: string;
  pdf_password?: string;
  file: File;
}) {
  const form = new FormData();
  form.append('kode_bank', payload.kode_bank);
  form.append('no_rekening', payload.no_rekening);
  form.append('acuan_bulan', payload.acuan_bulan);
  if (payload.pdf_password) form.append('pdf_password', payload.pdf_password);
  form.append('file', payload.file);

  const res = await axiosInstance.post('/transaksi/saldo-harian-rekening/reconcile/upload', form, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data as ReconcileUploadResponse;
}

export async function getReconcileMonths(params: {
  kode_bank: string;
  no_rekening: string;
}) {
  const res = await axiosInstance.get('/transaksi/saldo-harian-rekening/reconcile/months', { params });
  return res.data as ReconcileMonthListResponse;
}

export async function getReconcileComparison(params: {
  kode_bank: string;
  no_rekening: string;
  start_date: string;
  end_date: string;
  basis?: 'input';
}) {
  const res = await axiosInstance.get('/transaksi/saldo-harian-rekening/reconcile', {
    params: {
      ...params,
      basis: params.basis || 'input',
    },
  });
  return res.data as ReconcileComparisonResponse;
}
