import axiosInstance from './axiosInstance';

export type PatchJob = {
  id: string;
  status: 'running' | 'done' | 'error';
  mode: 'DRY_RUN' | 'APPLY';
  scope: 'all' | 'subscription';
  sourceSuffix: string;
  targetSuffix: string;
  replaceTarget: boolean;
  fillMissingInactive: boolean;
  collections?: Record<string, string>;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  output: string;
  error?: string;
};

export const startPatchJob = async (payload: {
  apply: boolean;
  scope: 'all' | 'subscription';
  sourceSuffix: string;
  targetSuffix: string;
  replaceTarget: boolean;
  fillMissingInactive: boolean;
  collections?: Record<string, string>;
}) => {
  const { data } = await axiosInstance.post<{ message: string; job: PatchJob }>('/maintenance/patch/run', payload);
  return data;
};

export const fetchPatchJob = async (id: string) => {
  const { data } = await axiosInstance.get<PatchJob>(`/maintenance/patch/jobs/${id}`);
  return data;
};

export const fetchLatestPatchJob = async () => {
  const { data } = await axiosInstance.get<PatchJob | null>('/maintenance/patch/latest');
  return data;
};

export type UnverifiedSubscriptionPatchRow = {
  _id: string;
  periode: string;
  chain_id: string;
  toko: string;
  program: string;
  daerah?: string;
  start: string;
  tempo: string;
  bulan: number;
  total_harga: number;
  status: 'OPEN' | 'PROCESS' | 'DONE';
  is_active: boolean;
  patch_match_reason?: string | null;
  patch_source_toko?: string | null;
  patch_source_program?: string | null;
  candidates: Array<{
    _id: string;
    kode: string;
    toko: string;
    program: string;
    status_subscriber?: string;
  }>;
};

export const fetchUnverifiedSubscriptionPatchRows = async (params?: { search?: string; limit?: number }) => {
  const { data } = await axiosInstance.get<{ data: UnverifiedSubscriptionPatchRow[]; total: number; limit: number }>(
    '/maintenance/patch/subscription/unverified',
    { params }
  );
  return data;
};
