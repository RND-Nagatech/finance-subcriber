import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchFiscalYears, fetchSubscriberByProgram, fetchSubscriberCombined } from "@/api/fiscal";
import { fetchAggregatesByPeriode } from "@/api/ttvps";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SubscriberByProgramChart } from "@/components/SubscriberByProgramChart";
import { SubscriberCombinedChart } from "@/components/SubscriberCombinedChart";
import { YearSelect } from "@/components/YearSelect";

const FISCAL_MONTHS = [
  { label: "DEC", month: "12", yearOffset: -1 },
  { label: "JAN", month: "01", yearOffset: 0 },
  { label: "FEB", month: "02", yearOffset: 0 },
  { label: "MAR", month: "03", yearOffset: 0 },
  { label: "APR", month: "04", yearOffset: 0 },
  { label: "MAY", month: "05", yearOffset: 0 },
  { label: "JUN", month: "06", yearOffset: 0 },
  { label: "JUL", month: "07", yearOffset: 0 },
  { label: "AUG", month: "08", yearOffset: 0 },
  { label: "SEP", month: "09", yearOffset: 0 },
  { label: "OCT", month: "10", yearOffset: 0 },
  { label: "NOV", month: "11", yearOffset: 0 },
];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function SubscriberVpsDashboard() {
  const { fiscalYear, setFiscalYear } = useAppStore();
  const [vpsMetric, setVpsMetric] = useState<"estimasi" | "realisasi">("estimasi");
  const year = String(fiscalYear || new Date().getFullYear());

  const { data: fiscalYears = [], isLoading: fiscalYearsLoading } = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: fetchFiscalYears,
  });

  const { data: subscriberCombined = [], isLoading: subscriberLoading } = useQuery({
    queryKey: ["subscriber-combined", year],
    queryFn: () => fetchSubscriberCombined(year),
    enabled: !!year,
  });

  const { data: subscriberByProgram = [] } = useQuery({
    queryKey: ["subscriber-by-program", year],
    queryFn: () => fetchSubscriberByProgram(year, "ANNUAL"),
    enabled: !!year,
  });

  const { data: vpsMonthlyData = [] } = useQuery({
    queryKey: ["vps-tt-aggregates", year],
    enabled: !!year,
    queryFn: async () => {
      const yr = Number(year);
      const results = await Promise.all(
        FISCAL_MONTHS.map((month) => fetchAggregatesByPeriode(`${yr + month.yearOffset}-${month.month}`))
      );
      return FISCAL_MONTHS.map((month, index) => ({
        name: `${month.label}-${String((yr + month.yearOffset) % 100).padStart(2, "0")}`,
        estimasi: Number(results[index]?.estimasi || 0),
        realisasi: Number(results[index]?.realisasi || 0),
      }));
    },
  });

  const subscriberTotals = useMemo(() => {
    const totalGrowth = subscriberCombined.reduce((sum: number, item: any) => sum + Number(item.count || 0), 0);
    const totalSubscriber = Number(subscriberCombined[subscriberCombined.length - 1]?.total || 0);
    const totalCost = subscriberByProgram.reduce((sum: number, item: any) => sum + Number(item.total_biaya || 0), 0);
    return { totalGrowth, totalSubscriber, totalCost };
  }, [subscriberCombined, subscriberByProgram]);

  const vpsTotal = vpsMonthlyData.reduce((sum: number, item: any) => sum + Number(item[vpsMetric] || 0), 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Dashboard Subscriber & VPS</h1>
          <p className="mt-1 text-sm text-slate-600">Ringkasan fiscal year DEC sampai NOV untuk subscriber dan tagihan VPS.</p>
        </div>
        <div className="w-full max-w-xs">
          <YearSelect
            value={year}
            onChange={(value) => setFiscalYear(Number(value))}
            years={fiscalYears.length ? fiscalYears.map(Number) : [Number(year)]}
            loading={fiscalYearsLoading}
            hideActiveLabel
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Subscriber Baru</CardDescription>
            <CardTitle>{subscriberTotals.totalGrowth.toLocaleString("id-ID")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Subscriber</CardDescription>
            <CardTitle>{subscriberTotals.totalSubscriber.toLocaleString("id-ID")}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total Biaya Subscriber</CardDescription>
            <CardTitle>{formatCurrency(subscriberTotals.totalCost)}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Total VPS {vpsMetric}</CardDescription>
            <CardTitle>{formatCurrency(vpsTotal)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Subscriber Analytics</CardTitle>
          <CardDescription>Penambahan bulanan dan total kumulatif subscriber.</CardDescription>
        </CardHeader>
        <CardContent>
          {subscriberLoading ? <div className="py-20 text-center text-slate-500">Loading...</div> : <SubscriberCombinedChart data={subscriberCombined} />}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Subscriber by Program</CardTitle>
          <CardDescription>Total subscriber per group program sampai akhir fiscal year.</CardDescription>
        </CardHeader>
        <CardContent>
          <SubscriberByProgramChart data={subscriberByProgram} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <CardTitle>Perolehan VPS</CardTitle>
              <CardDescription>Estimasi dan realisasi tagihan VPS per periode.</CardDescription>
            </div>
            <div className="flex gap-2">
              <Button variant={vpsMetric === "estimasi" ? "default" : "outline"} onClick={() => setVpsMetric("estimasi")}>
                Estimasi
              </Button>
              <Button variant={vpsMetric === "realisasi" ? "default" : "outline"} onClick={() => setVpsMetric("realisasi")}>
                Realisasi
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={420}>
            <BarChart data={vpsMonthlyData} margin={{ top: 24, right: 24, left: 50, bottom: 12 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="name" interval={0} tick={{ fontSize: 12 }} />
              <YAxis tickFormatter={(value) => `${Number(value || 0) / 1_000_000} jt`} width={72} />
              <Tooltip formatter={(value: number) => formatCurrency(value)} />
              <Bar dataKey={vpsMetric} fill={vpsMetric === "estimasi" ? "#2563eb" : "#059669"} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey={vpsMetric}
                  position="top"
                  formatter={(value: number) => (value ? `${Math.round(value / 1_000_000).toLocaleString("id-ID")} jt` : "")}
                  style={{ fontSize: 10, fontWeight: 700, fill: "#334155" }}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </div>
  );
}
