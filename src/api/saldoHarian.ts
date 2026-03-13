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

export async function previewSaldoHarian(payload: SaldoHarianGeneratorPayload) {
  const res = await axiosInstance.post('/transaksi/saldo-harian-rekening/preview', payload);
  return res.data as SaldoHarianPreviewResponse;
}

export async function commitSaldoHarian(payload: SaldoHarianGeneratorPayload & { confirm: true }) {
  const res = await axiosInstance.post('/transaksi/saldo-harian-rekening/commit', payload);
  return res.data as SaldoHarianCommitResponse;
}
