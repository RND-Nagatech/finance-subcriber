import axiosInstance from './axiosInstance';

export type TTVpsStatus = 'OPEN' | 'PROCESS' | 'DONE';

export interface TTVpsDetailItemDTO {
  _id: string;
  ref_id?: string;
  toko: string;
  program: string;
  daerah: string;
  start: string; // YYYY-MM-DD
  bulan: number;
  tempo: string; // YYYY-MM-DD
  harga: number;
  jumlah_harga: number;
  diskon: number;
  diskon_percent: number;
  total_harga: number;
  is_active?: boolean;
  status: TTVpsStatus;
  tgl_lunas?: string;
  invoice_meta?: {
    invoice_number: string;
    generated_at: string;
    generated_by: string;
    sender: {
      name: string;
      address: string;
      phone: string;
    };
    customer: {
      name: string;
      address: string;
      phone: string;
    };
    payment_accounts?: Array<{
      kode_bank?: string;
      no_rekening?: string;
      nama_rekening?: string;
    }>;
    items: Array<{
      program_name: string;
      qty: number;
      unit_price: number;
      line_total: number;
      start_date?: string;
      tempo_date?: string;
    }>;
    subtotal: number;
    discount_label?: string;
    discount_percent: number;
    discount_rp: number;
    extra_deduction_rp?: number;
    grand_total: number;
    notes?: string;
    display_date: string;
    pdf_original_url?: string;
    pdf_paid_url?: string;
  };
  doku_payment?: DokuPaymentDTO;
}

export interface DokuPaymentDTO {
  invoice_number: string;
  payment_url: string;
  token_id?: string;
  expired_date?: string;
  amount: number;
  request_id: string;
  generated_at: string;
  generated_by: string;
  status?: 'PENDING' | 'SUCCESS';
  paid_at?: string;
  notification_request_id?: string;
  transaction_original_request_id?: string;
  channel_id?: string;
  callback_verified_at?: string;
  customer?: {
    id?: string;
    name: string;
    phone?: string;
    address?: string;
    city?: string;
    country?: string;
  };
}

export async function fetchDetailsByPeriode(periode: string): Promise<TTVpsDetailItemDTO[]> {
  const { data } = await axiosInstance.get('/tt-vps/details', { params: { periode } });
  // Backend returns an array of transaction documents for the periode
  return Array.isArray(data) ? data : [];
}

export async function fetchDetailsByToko(toko: string): Promise<TTVpsDetailItemDTO[]> {
  const { data } = await axiosInstance.get('/tt-vps/details-by-toko', { params: { toko } });
  return Array.isArray(data) ? data : [];
}

export interface SubscriberDTO {
  kode?: string;
  _id: string;
  toko: string;
  program: string;
  daerah: string;
  biaya: number;
  alamat?: string | null;
  no_ok?: string | null;
  nomor_telepon?: string | null;
}
export async function fetchSubscribers(all = true): Promise<SubscriberDTO[]> {
  const params = all ? { all: 1, limit: 10000 } : {};
  const resp = await axiosInstance.get('/subscriber', { params });
  const payload = resp?.data;
  // Backend returns { data: [...], pagination: {...} }
  if (payload && Array.isArray(payload.data)) return payload.data as SubscriberDTO[];
  // Fallback: if API returned array directly
  if (Array.isArray(payload)) return payload as SubscriberDTO[];
  return [];
}

export async function fetchAggregatesByPeriode(periode: string) {
  const { data } = await axiosInstance.get('/tt-vps/aggregate', { params: { periode } });
  return data as { _id: string; periode: string; estimasi: number; realisasi: number; total_toko_estimasi: number; total_toko_realisasi: number } | null;
}

export async function createSchedule(payload: { subscriber_id?: string; toko?: string; program?: string; harga?: number; start: string; bulan: number; diskon?: number; diskon_percent?: number; daerah?: string; keterangan?: string; }) {
  const { data } = await axiosInstance.post('/tt-vps/schedule', payload);
  return data;
}

export async function updateItemStatus(params: { periode: string; itemId: string; status: TTVpsStatus; tanggalLunas?: string }) {
  const { periode, itemId, status, tanggalLunas } = params;
  const body: Record<string, unknown> = { status };
  if (tanggalLunas) body.tanggalLunas = tanggalLunas;
  const { data } = await axiosInstance.patch(`/tt-vps/details/${encodeURIComponent(periode)}/item/${itemId}/status`, body);
  return data;
}

export async function deleteItem(params: { periode: string; itemId: string }) {
  const { periode, itemId } = params;
  const { data } = await axiosInstance.delete(`/tt-vps/details/${encodeURIComponent(periode)}/item/${itemId}`);
  return data;
}

export interface VpsSubscriberOption {
  _id: string;
  toko: string;
  biaya: number;
  program: string;
  daerah: string;
}

export async function fetchAvailableSubscribers(): Promise<VpsSubscriberOption[]> {
  const { data } = await axiosInstance.get('/vps/available-subscribers');
  return data?.data || [];
}

export async function updateItem(params: { periode: string; itemId: string; start?: string; bulan?: number; harga?: number; diskon?: number; diskon_percent?: number; status?: TTVpsStatus; keterangan?: string }) {
  const { periode, itemId, ...body } = params;
  const { data } = await axiosInstance.patch(`/tt-vps/details/${encodeURIComponent(periode)}/item/${itemId}`, body);
  return data;
}

export async function updateItemActive(params: { periode: string; itemId: string; is_active: boolean }) {
  const { periode, itemId, is_active } = params;
  const { data } = await axiosInstance.patch(`/tt-vps/details/${encodeURIComponent(periode)}/item/${itemId}/active`, { is_active });
  return data;
}

export async function generateDokuPaymentLink(params: { periode: string; itemId: string }): Promise<{
  message: string;
  reused: boolean;
  payment: DokuPaymentDTO;
}> {
  const { periode, itemId } = params;
  const { data } = await axiosInstance.post(
    `/tt-vps/details/${encodeURIComponent(periode)}/item/${itemId}/doku/payment-link`
  );
  return data;
}

export async function fetchLastPeriod(): Promise<string | null> {
  const { data } = await axiosInstance.get('/tt-vps/last-period');
  return data?.periode || null;
}

export async function generateNextFiscal(): Promise<{ message: string; nextFiscalLabel: number; affected: string[] }> {
  const { data } = await axiosInstance.post('/tt-vps/generate-next-year');
  return data;
}

export async function startGenerateNextFiscal(): Promise<{ jobId: string; nextFiscalLabel: number; total: number }> {
  const { data } = await axiosInstance.post('/tt-vps/generate-next-year/start');
  return data;
}

export async function getGenerateStatus(jobId: string): Promise<{ status: 'running'|'done'|'error'; nextFiscalLabel: number; total: number; done: number; startedAt: number; finishedAt?: number; error?: string }> {
  const { data } = await axiosInstance.get('/tt-vps/generate-next-year/status', { params: { jobId } });
  return data;
}

export interface GenerateInvoiceVpsPayload {
  target_items?: Array<{
    periode: string;
    item_id: string;
  }>;
  customer: {
    name: string;
    address: string;
    phone: string;
  };
  payment_accounts?: Array<{
    kode_bank?: string;
    no_rekening?: string;
    nama_rekening?: string;
  }>;
  items: Array<{
    program_name: string;
    qty: number;
    unit_price: number;
    line_total?: number;
  }>;
  discount_label?: string;
  discount_percent: number;
  discount_rp: number;
  extra_deduction_rp?: number;
  subtotal: number;
  grand_total: number;
  notes?: string;
  display_date?: string;
}

export interface GenerateInvoiceVpsResponse {
  message: string;
  status: TTVpsStatus;
  periode: string;
  item_id: string;
  affected_items?: Array<{
    periode: string;
    item_id: string;
  }>;
  affected_periodes?: string[];
  invoice: NonNullable<TTVpsDetailItemDTO['invoice_meta']>;
  doku_payment: DokuPaymentDTO;
}

export async function generateInvoiceVps(params: { payload: GenerateInvoiceVpsPayload; periode?: string; itemId?: string }): Promise<GenerateInvoiceVpsResponse> {
  const { payload, periode, itemId } = params;
  const endpoint = periode && itemId
    ? `/tt-vps/details/${encodeURIComponent(periode)}/item/${itemId}/invoice/generate`
    : '/tt-vps/invoice/generate';
  const { data } = await axiosInstance.post(endpoint, payload);
  return data;
}

export async function uploadInvoiceVpsPdfs(params: {
  invoiceNumber: string;
  original: Blob;
  originalFileName: string;
  paid: Blob;
  paidFileName: string;
}): Promise<{ pdf_original_url: string; pdf_paid_url: string }> {
  const form = new FormData();
  form.append('original', params.original, params.originalFileName);
  form.append('paid', params.paid, params.paidFileName);
  const { data } = await axiosInstance.post(
    `/tt-vps/invoice/${encodeURIComponent(params.invoiceNumber)}/pdf`,
    form,
    {
      headers: { 'Content-Type': 'multipart/form-data' },
    }
  );
  return data;
}

export async function updateSubscriberPhoneByKode(params: { kode: string; nomor_telepon: string }) {
  const { kode, nomor_telepon } = params;
  const { data } = await axiosInstance.put(`/subscriber/${encodeURIComponent(kode)}`, { nomor_telepon });
  return data;
}
