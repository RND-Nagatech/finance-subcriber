import axiosInstance from '@/api/axiosInstance';

export interface Group {
  _id?: string;
  kode_group: string;
  nama_group: string;
  owner: string;
  no_hp: string;
  nama_owner?: string;
  no_hp_owner?: string;
  gender_owner?: 'LAKI-LAKI' | 'PEREMPUAN' | null;
  nama_pic?: string | null;
  no_hp_pic?: string | null;
  gender_pic?: 'LAKI-LAKI' | 'PEREMPUAN' | null;
  alamat: string;
  status_aktv?: boolean;
  input_by?: string;
  update_by?: string | null;
  delete_by?: string | null;
}

export interface GroupListResponse {
  data: Group[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface GroupOption extends Group {
  label: string;
  value: string;
}

export const fetchGroupList = async (params: { page: number; limit: number; search?: string }) => {
  const searchParams = new URLSearchParams({
    page: String(params.page),
    limit: String(params.limit),
  });

  if (params.search?.trim()) {
    searchParams.append('search', params.search.trim());
  }

  const response = await axiosInstance.get<GroupListResponse>(`/master/group?${searchParams.toString()}`);
  return response.data;
};

export const fetchAllGroup = async () => {
  const response = await axiosInstance.get<Group[]>('/master/group?all=true');
  return response.data || [];
};

export const fetchGroupOptions = async () => {
  const response = await axiosInstance.get<GroupOption[]>('/master/group/options');
  return response.data || [];
};

export const saveGroup = async (payload: Group, id?: string | null) => {
  if (id) {
    return axiosInstance.put(`/master/group/${id}`, payload);
  }
  return axiosInstance.post('/master/group', payload);
};

export const deleteGroup = async (id: string) => {
  return axiosInstance.delete(`/master/group/${id}`);
};
