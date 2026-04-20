import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { fetchFiscalYears } from '@/api/fiscal';
import { DashboardPeriodMode, fetchDashboardV2CardData } from '@/api/dashboardV2';
import StackedBarKategori from '@/components/StackedBarKategori';
import LineChartKategori from '@/components/LineChartKategori';
import { SubscriberCombinedChart } from '@/components/SubscriberCombinedChart';
import { SubscriberByProgramChart } from '@/components/SubscriberByProgramChart';
import { Bar, BarChart, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

type CardKey =
  | 'pembelian_trend'
  | 'margin_trend'
  | 'aset_gaji_breakdown'
  | 'implementasi_marketing_lainnya_breakdown'
  | 'biaya_biaya_breakdown'
  | 'pendapatan_breakdown'
  | 'subscriber_analytics'
  | 'subscriber_by_program'
  | 'vps_overview';

const PERIOD_OPTIONS: Array<{ value: DashboardPeriodMode; label: string }> = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan (ISO)' },
  { value: 'monthly', label: 'Bulanan' },
  { value: 'yearly', label: 'Tahunan' },
];

const CARD_META: Array<{ key: CardKey; title: string; description: string; domain: 'financial' | 'subscriber' | 'vps' }> = [
  { key: 'pembelian_trend', title: 'Pembelian Trend', description: 'Trend pembelian per periode', domain: 'financial' },
  { key: 'margin_trend', title: 'Margin Trend', description: 'Trend margin (Pendapatan - Biaya - Pembelian)', domain: 'financial' },
  { key: 'aset_gaji_breakdown', title: 'Aset & Gaji', description: 'Breakdown aset dan gaji', domain: 'financial' },
  { key: 'implementasi_marketing_lainnya_breakdown', title: 'Implementasi / Marketing / Lainnya', description: 'Breakdown biaya implementasi, marketing, lainnya', domain: 'financial' },
  { key: 'biaya_biaya_breakdown', title: 'Biaya-Biaya', description: 'Breakdown biaya PPH/BPJS/VPS/RND/Retur', domain: 'financial' },
  { key: 'pendapatan_breakdown', title: 'Pendapatan Breakdown', description: 'Breakdown pendapatan per sub kategori', domain: 'financial' },
  { key: 'subscriber_analytics', title: 'Subscriber Analytics', description: 'Growth + cumulative subscriber', domain: 'subscriber' },
  { key: 'subscriber_by_program', title: 'Subscriber by Program', description: 'Subscriber aktif berdasarkan grouping program', domain: 'subscriber' },
  { key: 'vps_overview', title: 'VPS Overview', description: 'Estimasi vs realisasi VPS', domain: 'vps' },
];

function DashboardV2Card({
  cardKey,
  title,
  description,
  periodMode,
  onPeriodChange,
  fiscalYear,
  domain,
}: {
  cardKey: CardKey;
  title: string;
  description: string;
  periodMode: DashboardPeriodMode;
  onPeriodChange: (value: DashboardPeriodMode) => void;
  fiscalYear: string;
  domain: 'financial' | 'subscriber' | 'vps';
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['dashboard-v2-card', cardKey, periodMode, fiscalYear],
    queryFn: () =>
      fetchDashboardV2CardData({
        cardKey,
        periodMode,
        fiscalYear: domain === 'financial' ? fiscalYear : undefined,
        reference: new Date().toISOString().slice(0, 10),
      }),
    enabled: !!periodMode && (!!fiscalYear || domain !== 'financial'),
  });

  const points = data?.points || [];

  const renderContent = () => {
    if (isLoading) return <div className="text-sm text-gray-500">Memuat data...</div>;
    if (!points || points.length === 0) return <div className="text-sm text-gray-500">Belum ada data.</div>;

    if (cardKey === 'pembelian_trend' || cardKey === 'margin_trend') {
      return <LineChartKategori data={points} />;
    }
    if (
      cardKey === 'aset_gaji_breakdown' ||
      cardKey === 'implementasi_marketing_lainnya_breakdown' ||
      cardKey === 'biaya_biaya_breakdown' ||
      cardKey === 'pendapatan_breakdown'
    ) {
      return <StackedBarKategori data={points} />;
    }
    if (cardKey === 'subscriber_analytics') {
      return <SubscriberCombinedChart data={points} />;
    }
    if (cardKey === 'subscriber_by_program') {
      return <SubscriberByProgramChart data={points} />;
    }
    if (cardKey === 'vps_overview') {
      return (
        <ResponsiveContainer width="100%" height={340}>
          <BarChart data={points}>
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="estimasi" name="Estimasi" fill="#3b82f6" />
            <Bar dataKey="realisasi" name="Realisasi" fill="#10b981" />
          </BarChart>
        </ResponsiveContainer>
      );
    }
    return null;
  };

  return (
    <Card className="border-2 border-dashed border-blue-200 bg-white/80">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg">{title}</CardTitle>
            <CardDescription>{description}</CardDescription>
          </div>
          <Select value={periodMode} onValueChange={(v) => onPeriodChange(v as DashboardPeriodMode)}>
            <SelectTrigger className="w-44">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIOD_OPTIONS.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </CardHeader>
      <CardContent>{renderContent()}</CardContent>
    </Card>
  );
}

export default function DashboardV2() {
  const { data: fiscalYearsData = [], isLoading: isYearsLoading } = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: fetchFiscalYears,
  });

  const defaultYear = useMemo(() => (fiscalYearsData?.length ? String(Math.max(...fiscalYearsData)) : String(new Date().getFullYear())), [fiscalYearsData]);
  const [fiscalYear, setFiscalYear] = useState<string>('');
  const [cardPeriods, setCardPeriods] = useState<Record<CardKey, DashboardPeriodMode>>({
    pembelian_trend: 'monthly',
    margin_trend: 'monthly',
    aset_gaji_breakdown: 'monthly',
    implementasi_marketing_lainnya_breakdown: 'monthly',
    biaya_biaya_breakdown: 'monthly',
    pendapatan_breakdown: 'monthly',
    subscriber_analytics: 'monthly',
    subscriber_by_program: 'monthly',
    vps_overview: 'monthly',
  });

  const activeYear = fiscalYear || defaultYear;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100">
      <div className="container mx-auto px-6 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Dashboard V2
            </h1>
            <p className="text-gray-600 mt-2">Per-card period selector: Harian, Mingguan, Bulanan, Tahunan</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm text-gray-600">Tahun Fiskal</span>
            <Select value={activeYear} onValueChange={setFiscalYear}>
              <SelectTrigger className="w-32 bg-white">
                <SelectValue placeholder="Pilih Tahun" />
              </SelectTrigger>
              <SelectContent>
                {isYearsLoading ? (
                  <SelectItem value={activeYear || 'loading'}>{activeYear || 'Loading...'}</SelectItem>
                ) : (
                  fiscalYearsData.map((th: number) => (
                    <SelectItem key={th} value={String(th)}>
                      {th}
                    </SelectItem>
                  ))
                )}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          {CARD_META.map((card) => (
            <DashboardV2Card
              key={card.key}
              cardKey={card.key}
              title={card.title}
              description={card.description}
              periodMode={cardPeriods[card.key]}
              onPeriodChange={(value) => setCardPeriods((prev) => ({ ...prev, [card.key]: value }))}
              fiscalYear={activeYear}
              domain={card.domain}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

