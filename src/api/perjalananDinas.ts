import axiosInstance from './axiosInstance';

export type PerjalananStatus = 'BERJALAN' | 'SEDANG_DIAUDIT' | 'SELESAI';
export type PerjalananItemAuditStatus = 'PENDING' | 'APPROVED' | 'REVISI';

export interface PerjalananSummary {
  total_inject: number;
  total_return: number;
  total_approved: number;
  total_transaksi?: number;
  sisa_dana: number;
  total_items?: number;
  item_counts?: Record<string, number>;
}

export interface PerjalananHeader {
  _id: string;
  kode_perjalanan: string;
  user_id: string;
  user_name: string;
  user_username?: string;
  tujuan: string;
  tanggal_berangkat: string;
  tanggal_pulang: string;
  catatan?: string;
  status: PerjalananStatus;
  posted_to_tt_finance?: boolean;
  return_done?: boolean;
  posting_meta?: any;
  summary?: PerjalananSummary;
}

export interface PerjalananItem {
  _id: string;
  perjalanan_id: string;
  tanggal_transaksi: string;
  nominal: number;
  keterangan: string;
  audit_status: PerjalananItemAuditStatus;
  audit_catatan_item?: string;
  attachments?: Array<{ path: string; original_name?: string }>;
}

export interface PerjalananDanaLedger {
  _id: string;
  jenis: 'INJECT' | 'RETURN';
  nominal: number;
  kode_bank: string;
  no_rekening: string;
  nama_rekening_snapshot: string;
  keterangan?: string;
  created_at: string;
}

export interface PerjalananPostingPayload {
  kategori: string;
  sub_kategori: string;
  akun: string;
  tanggal_posting: string;
  bulan: string;
  tahun_fiskal?: string;
}

export async function listPerjalananDinas(params?: any) {
  const res = await axiosInstance.get('/perjalanan-dinas', { params });
  return res.data;
}

export async function createPerjalananDinas(payload: any) {
  const res = await axiosInstance.post('/perjalanan-dinas', payload);
  return res.data;
}

export async function updatePerjalananDinas(id: string, payload: any) {
  const res = await axiosInstance.put(`/perjalanan-dinas/${id}`, payload);
  return res.data;
}

export async function getPerjalananDinasDetail(id: string) {
  const res = await axiosInstance.get(`/perjalanan-dinas/${id}`);
  return res.data;
}

export async function getPerjalananSummary(id: string) {
  const res = await axiosInstance.get(`/perjalanan-dinas/${id}/summary`);
  return res.data as PerjalananSummary;
}

export async function submitPerjalananAudit(id: string) {
  const res = await axiosInstance.post(`/perjalanan-dinas/${id}/submit-audit`);
  return res.data;
}

export async function finalizePerjalananAudit(id: string, payload?: any) {
  const res = await axiosInstance.post(`/perjalanan-dinas/${id}/finalize-audit`, payload || {});
  return res.data;
}

export async function postPerjalananToTtFinance(id: string, payload: PerjalananPostingPayload) {
  const res = await axiosInstance.post(`/perjalanan-dinas/${id}/posting`, payload);
  return res.data;
}

export async function listPerjalananItems(id: string, params?: any) {
  const res = await axiosInstance.get(`/perjalanan-dinas/${id}/items`, { params });
  return res.data as PerjalananItem[];
}

export async function createPerjalananItem(id: string, payload: any) {
  const res = await axiosInstance.post(`/perjalanan-dinas/${id}/items`, payload);
  return res.data;
}

export async function updatePerjalananItem(id: string, itemId: string, payload: any) {
  const res = await axiosInstance.put(`/perjalanan-dinas/${id}/items/${itemId}`, payload);
  return res.data;
}

export async function deletePerjalananItem(id: string, itemId: string) {
  const res = await axiosInstance.delete(`/perjalanan-dinas/${id}/items/${itemId}`);
  return res.data;
}

export async function uploadPerjalananItemAttachments(id: string, itemId: string, files: File[]) {
  const formData = new FormData();
  files.forEach((f) => formData.append('attachments', f));
  const res = await axiosInstance.post(`/perjalanan-dinas/${id}/items/${itemId}/attachments`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return res.data;
}

export async function deletePerjalananItemAttachment(id: string, itemId: string, filename: string) {
  const res = await axiosInstance.delete(`/perjalanan-dinas/${id}/items/${itemId}/attachments/${filename}`);
  return res.data;
}

export async function updatePerjalananItemAuditStatus(id: string, itemId: string, payload: { audit_status: PerjalananItemAuditStatus; audit_catatan_item?: string }) {
  const res = await axiosInstance.post(`/perjalanan-dinas/${id}/items/${itemId}/audit-status`, payload);
  return res.data;
}

export async function listPerjalananDana(id: string) {
  const res = await axiosInstance.get(`/perjalanan-dinas/${id}/dana`);
  return res.data as PerjalananDanaLedger[];
}

export async function injectPerjalananDana(id: string, payload: any) {
  const res = await axiosInstance.post(`/perjalanan-dinas/${id}/dana/inject`, payload);
  return res.data;
}

export async function returnPerjalananDana(id: string, payload: any) {
  const res = await axiosInstance.post(`/perjalanan-dinas/${id}/dana/return`, payload);
  return res.data;
}
