import axiosInstance from '@/api/axiosInstance';

export interface Karyawan {
  _id?: string;
  kode_karyawan: string;
  nama_karyawan: string;
  jabatan?: string | null;
  divisi?: string | null;
  no_hp?: string | null;
  email?: string | null;
  status_aktv?: boolean;
  input_by?: string;
  update_by?: string | null;
  delete_by?: string | null;
}

export interface KaryawanOption extends Karyawan {
  value: string;
  label: string;
}

export interface KaryawanListResponse {
  data: Karyawan[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const fetchKaryawanList = async (params: { page: number; limit: number; search?: string }) => {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });

  if (params.search?.trim()) {
    searchParams.append('search', params.search.trim());
  }

  const response = await axiosInstance.get<KaryawanListResponse>(`/master/karyawan?${searchParams.toString()}`);
  return response.data;
};

export const fetchAllKaryawan = async () => {
  const response = await axiosInstance.get<Karyawan[]>('/master/karyawan?all=true');
  return response.data || [];
};

export const fetchKaryawanOptions = async () => {
  const response = await axiosInstance.get<KaryawanOption[]>('/master/karyawan/options');
  return response.data || [];
};

export const saveKaryawan = async (payload: Karyawan, id?: string | null) => {
  if (id) {
    return axiosInstance.put(`/master/karyawan/${id}`, payload);
  }
  return axiosInstance.post('/master/karyawan', payload);
};

export const deleteKaryawan = async (id: string) => {
  return axiosInstance.delete(`/master/karyawan/${id}`);
};
