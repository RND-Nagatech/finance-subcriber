import axiosInstance from '@/api/axiosInstance';

export interface CreateSubscriptionPayload {
  subscriber_id: string;
  tgl_mulai_tagihan: string;
  jumlah_bulan: number;
  biaya_per_bulan?: number;
  diskon?: number;
  keterangan?: string;
}

export type SubscriptionDetailStatus = 'OPEN' | 'PROCESS' | 'DONE' | 'BATAL';

export interface DokuPayment {
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
}

export interface Subscription {
  _id: string;
  periode: string;
  tahun: number;
  estimasi: number;
  realisasi: number;
  total_subscriber_estimasi: number;
  total_subscriber_realisasi: number;
  updated_at?: string;
}

export interface SubscriptionDetail {
  _id: string;
  subscription_id: string | null;
  chain_id: string;
  subscriber_id: string;
  kode_subscriber: string;
  toko: string;
  program: string;
  periode: string;
  tahun: number;
  tgl_mulai_tagihan: string;
  jumlah_bulan: number;
  tgl_berakhir_langganan: string;
  tgl_bayar_selanjutnya: string;
  biaya_per_bulan: number;
  jumlah_biaya: number;
  diskon: number;
  total_biaya: number;
  status: SubscriptionDetailStatus;
  tgl_lunas?: string | null;
  metode_bayar?: string | null;
  keterangan?: string | null;
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
    items: Array<{
      program_name: string;
      qty: number;
      unit_price: number;
      line_total: number;
      start_date?: string;
      tempo_date?: string;
    }>;
    subtotal: number;
    discount_rp: number;
    grand_total: number;
    display_date: string;
  };
  doku_payment?: DokuPayment;
}

export interface SubscriptionListResponse {
  data: Subscription[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const fetchSubscriptionList = async (params: { page: number; limit: number; search?: string; tahun?: number }) => {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });
  if (params.search?.trim()) searchParams.append('search', params.search.trim());
  if (params.tahun) searchParams.append('tahun', String(params.tahun));
  const response = await axiosInstance.get<SubscriptionListResponse>(`/subscription?${searchParams.toString()}`);
  return response.data;
};

export const fetchSubscriptionDetails = async (params: { tahun?: number; status?: string; subscription_id?: string }) => {
  const response = await axiosInstance.get<SubscriptionDetail[]>('/subscription/detail', { params });
  return response.data || [];
};

export const createSubscription = async (payload: CreateSubscriptionPayload) => {
  const response = await axiosInstance.post('/subscription', payload);
  return response.data;
};

export const lunasiSubscriptionDetail = async (params: {
  id: string;
  tgl_lunas: string;
  diskon?: number;
  metode_bayar?: string;
  keterangan?: string;
}) => {
  const { id, ...body } = params;
  const response = await axiosInstance.patch(`/subscription/detail/${id}/lunas`, body);
  return response.data;
};

export const updateSubscriptionDetail = async (params: {
  id: string;
  tgl_mulai_tagihan: string;
  jumlah_bulan: number;
  biaya_per_bulan: number;
  diskon?: number;
  keterangan?: string;
}) => {
  const { id, ...body } = params;
  const response = await axiosInstance.patch(`/subscription/detail/${id}`, body);
  return response.data;
};

export const deleteSubscriptionDetail = async (id: string) => {
  const response = await axiosInstance.delete(`/subscription/detail/${id}`);
  return response.data;
};

export const updateSubscriptionDetailStatus = async (params: {
  id: string;
  status: 'OPEN' | 'PROCESS' | 'DONE';
  tanggalLunas?: string;
}) => {
  const { id, ...body } = params;
  const response = await axiosInstance.patch(`/subscription/detail/${id}/status`, body);
  return response.data;
};

export const generateSubscriptionInvoice = async (id: string) => {
  const response = await axiosInstance.post(`/subscription/detail/${id}/invoice/generate`);
  return response.data;
};

export const generateSubscriptionDokuPaymentLink = async (id: string) => {
  const response = await axiosInstance.post(`/subscription/detail/${id}/doku/payment-link`);
  return response.data;
};
