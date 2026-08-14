import axiosInstance from './axiosInstance';

export type PatchJob = {
  id: string;
  status: 'running' | 'done' | 'error';
  mode: 'DRY_RUN' | 'APPLY';
  sourceSuffix: string;
  targetSuffix: string;
  replaceTarget: boolean;
  collections?: Record<string, string>;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  output: string;
  error?: string;
};

export const startPatchJob = async (payload: {
  apply: boolean;
  sourceSuffix: string;
  targetSuffix: string;
  replaceTarget: boolean;
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
