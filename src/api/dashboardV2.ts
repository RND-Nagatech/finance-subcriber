import axiosInstance from './axiosInstance';

export type DashboardPeriodMode = 'daily' | 'weekly' | 'monthly' | 'yearly';

export interface DashboardV2CardResponse {
  success: boolean;
  card_key: string;
  period_mode: DashboardPeriodMode;
  reference: string;
  fiscal_year?: string;
  source_info?: {
    domain?: 'financial' | 'subscriber' | 'vps';
    collection?: string;
    fiscal_switch_applied?: boolean;
  };
  points: any[];
  totals?: Record<string, number>;
}

export async function fetchDashboardV2CardData(params: {
  cardKey: string;
  periodMode: DashboardPeriodMode;
  fiscalYear?: string;
  reference?: string;
}) {
  const q = new URLSearchParams();
  q.set('card_key', params.cardKey);
  q.set('period_mode', params.periodMode);
  q.set('reference', params.reference || new Date().toISOString().slice(0, 10));
  if (params.fiscalYear) q.set('fiscal_year', params.fiscalYear);

  const { data } = await axiosInstance.get(`/dashboard/v2/card-data?${q.toString()}`);
  return data as DashboardV2CardResponse;
}

