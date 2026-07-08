import axiosInstance from './axiosInstance';

export interface AssetType {
  _id: string;
  code: string;
  name: string;
  unit: string;
  current_price: number;
  status_aktv: boolean;
}

export interface AssetItem {
  _id: string;
  asset_code: string;
  asset_name: string;
  asset_type_id: AssetType | string;
  asset_type?: AssetType;
  perusahaan_id?: string;
  kode_perusahaan?: string;
  nama_perusahaan?: string;
  qty: number;
  unit?: string;
  harga_beli_per_unit: number;
  current_price?: number;
  total_harga_beli?: number;
  total_harga_sekarang?: number;
  growth_nominal?: number;
  growth_percent?: number;
  status_aktv: boolean;
}

export interface AssetSummary {
  total_harga_beli: number;
  total_harga_sekarang: number;
  growth_nominal: number;
  growth_percent: number;
  by_type: Array<{
    code: string;
    name: string;
    unit: string;
    qty: number;
    total_harga_beli: number;
    total_harga_sekarang: number;
    growth_nominal: number;
    growth_percent: number;
  }>;
}

export interface AssetLedger {
  _id: string;
  movement_type: 'ADD' | 'OUT' | 'ADJUSTMENT' | 'ROLLBACK';
  asset_code?: string;
  asset_name?: string;
  qty_delta: number;
  qty_before: number;
  qty_after: number;
  unit: string;
  unit_price_snapshot: number;
  ref_type?: string;
  ref_id?: string;
  tanggal?: string;
  keterangan?: string;
  created_by: string;
  created_at: string;
}

export interface AssetTransfer {
  _id: string;
  direction?: 'REKENING_TO_ASSET' | 'ASSET_TO_REKENING';
  rekening_id: string;
  asset_id: string;
  kode_bank: string;
  no_rekening: string;
  asset_code: string;
  asset_name: string;
  nominal: number;
  asset_qty: number;
  asset_unit: string;
  unit_price_snapshot: number;
  tanggal: string;
  keterangan?: string;
  created_by?: string;
  created_at: string;
}

export interface AssetTypePriceHistory {
  _id: string;
  asset_type_id: string;
  code: string;
  name: string;
  unit: string;
  old_price: number;
  new_price: number;
  changed_by: string;
  changed_at: string;
  keterangan?: string;
}

export async function fetchAssetTypes(): Promise<AssetType[]> {
  const { data } = await axiosInstance.get('/asset-types');
  return data?.data || [];
}

export async function createAssetType(payload: { code: string; name: string; unit: string; current_price: number }) {
  const { data } = await axiosInstance.post('/asset-types', payload);
  return data?.data;
}

export async function updateAssetTypeCurrentPrice(id: string, current_price: number, keterangan?: string) {
  const { data } = await axiosInstance.put(`/asset-types/${id}/current-price`, { current_price, keterangan });
  return data?.data;
}

export async function fetchAssets(): Promise<AssetItem[]> {
  const { data } = await axiosInstance.get('/assets');
  return data?.data || [];
}

export async function createAsset(payload: {
  asset_type_id: string;
  asset_name: string;
  perusahaan_id?: string;
  qty: number;
  harga_beli_per_unit: number;
}) {
  const { data } = await axiosInstance.post('/assets', payload);
  return data?.data;
}

export async function updateAsset(id: string, payload: Partial<{
  asset_type_id: string;
  asset_name: string;
  perusahaan_id: string;
  harga_beli_per_unit: number;
}>) {
  const { data } = await axiosInstance.put(`/assets/${id}`, payload);
  return data?.data;
}

export async function deleteAsset(id: string) {
  const { data } = await axiosInstance.delete(`/assets/${id}`);
  return data?.data;
}

export async function fetchAssetSummary(): Promise<AssetSummary> {
  const { data } = await axiosInstance.get('/assets/summary');
  return data?.data || { total_harga_beli: 0, total_harga_sekarang: 0, growth_nominal: 0, growth_percent: 0, by_type: [] };
}

export async function fetchAssetLedger(id: string): Promise<AssetLedger[]> {
  const { data } = await axiosInstance.get(`/assets/${id}/ledger`);
  return data?.data || [];
}

export async function fetchAssetLedgerHistory(): Promise<AssetLedger[]> {
  const { data } = await axiosInstance.get('/assets/ledger/history');
  return data?.data || [];
}

export async function fetchAssetTransfers(): Promise<AssetTransfer[]> {
  const { data } = await axiosInstance.get('/assets/transfers/history');
  return data?.data || [];
}

export async function fetchAssetTypePriceHistory(assetTypeId?: string): Promise<AssetTypePriceHistory[]> {
  const { data } = await axiosInstance.get('/asset-types/price-history', {
    params: assetTypeId ? { asset_type_id: assetTypeId } : undefined,
  });
  return data?.data || [];
}

export async function transferRekeningToAsset(payload: {
  rekening_id: string;
  asset_id: string;
  nominal: number;
  unit_price: number;
  asset_qty: number;
  tanggal: string;
  keterangan?: string;
}) {
  const { data } = await axiosInstance.post('/assets/transfer-from-rekening', payload);
  return data?.data;
}

export async function transferAssetToRekening(payload: {
  asset_id: string;
  rekening_id: string;
  nominal: number;
  unit_price: number;
  asset_qty: number;
  tanggal: string;
  keterangan?: string;
}) {
  const { data } = await axiosInstance.post('/assets/transfer-to-rekening', payload);
  return data?.data;
}

export async function reduceAssetStock(payload: {
  asset_id: string;
  qty: number;
  unit_price: number;
  tanggal: string;
  keterangan?: string;
}) {
  const { data } = await axiosInstance.post('/assets/reduce-stock', payload);
  return data?.data;
}
