import axiosInstance from './axiosInstance';

export type VpsSubscriberOption = {
  _id: string;
  toko: string;
  biaya: number;
  kode: string;
  program?: string;
  daerah?: string;
};

export type VpsItem = {
  _id: string;
  subscriber: { _id: string; toko: string; kode: string; biaya: number } | string;
  pricePerMonth: number;
  startDate: string;
  months: number;
  dueDate: string;
  grossAmount: number;
  discount: number;
  netAmount: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  periods: Array<{ month: number; year: number; startDate: string; endDate: string; amount: number; paid: boolean }>;
};

export async function fetchVpsList(): Promise<VpsItem[]> {
  const { data } = await axiosInstance.get('/vps');
  return data.data;
}

export async function fetchAvailableSubscribers(): Promise<VpsSubscriberOption[]> {
  const { data } = await axiosInstance.get('/vps/available-subscribers');
  return data.data;
}

export async function createVps(payload: { subscriberId: string; startDate: string; months: number; discount?: number; }): Promise<VpsItem> {
  const { data } = await axiosInstance.post('/vps', payload);
  return data.data;
}

export async function updateVps(id: string, payload: Partial<{ startDate: string; months: number; discount: number; status: 'ACTIVE'|'COMPLETED'|'CANCELLED' }>): Promise<VpsItem> {
  const { data } = await axiosInstance.put(`/vps/${id}`, payload);
  return data.data;
}

export async function deleteVps(id: string): Promise<void> {
  await axiosInstance.delete(`/vps/${id}`);
}
