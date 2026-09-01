import axiosInstance from './axiosInstance';

export interface OrderConfirmationNoOkOption {
  id: string;
  no_ok: string;
  tanggal?: string;
  status?: string[];
  customer?: {
    kode_customer?: string;
    nama_customer?: string;
    kota?: string;
    alamat?: string;
    kontak?: string;
    no_hp?: string;
    nama_owner?: string;
    no_hp_owner?: string;
    gender_owner?: 'LAKI-LAKI' | 'PEREMPUAN' | '';
    nama_pic?: string;
    no_hp_pic?: string;
    gender_pic?: 'LAKI-LAKI' | 'PEREMPUAN' | '';
  };
  sales?: {
    user_id?: string;
    nama?: string;
  };
  grand_total?: number;
  products?: Array<{
    id?: string;
    jenis?: string;
    nama_barang?: string;
    qty?: number;
    satuan?: string;
    harga?: number;
    subtotal?: number;
  }>;
}

export const fetchOrderConfirmationNoOkOptions = async (params?: {
  search?: string;
  page?: number;
  limit?: number;
}) => {
  const searchParams = new URLSearchParams({
    status: 'Validated',
    page: String(params?.page || 1),
    limit: String(params?.limit || 100),
  });

  if (params?.search?.trim()) {
    searchParams.set('search', params.search.trim());
  }

  const { data } = await axiosInstance.get(`/integrations/order-confirmation/no-ok/search?${searchParams.toString()}`);
  return (data?.data || []) as OrderConfirmationNoOkOption[];
};

export const fetchOrderConfirmationNoOkDetail = async (noOk: string) => {
  const searchParams = new URLSearchParams({ no_ok: noOk });
  const { data } = await axiosInstance.get(`/integrations/order-confirmation/no-ok/detail?${searchParams.toString()}`);
  return data?.data as OrderConfirmationNoOkOption;
};
