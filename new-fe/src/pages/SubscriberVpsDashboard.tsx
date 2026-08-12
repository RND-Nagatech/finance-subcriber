import { useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import html2canvas from "html2canvas";
import jsPDF from "jspdf";
import { Bar, BarChart, LabelList, Legend, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { fetchFiscalYears, fetchSubscriberByProgram, fetchSubscriberCombined } from "@/api/fiscal";
import { fetchSubscriptionList } from "@/api/subscription";
import { useAppStore } from "@/store/useAppStore";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SubscriberByProgramChart } from "@/components/SubscriberByProgramChart";
import { SubscriberCombinedChart } from "@/components/SubscriberCombinedChart";
import { YearSelect } from "@/components/YearSelect";
import { Eye, EyeOff } from "lucide-react";

const MONTHS = [
  { label: "DEC", month: "12" },
  { label: "JAN", month: "01" },
  { label: "FEB", month: "02" },
  { label: "MAR", month: "03" },
  { label: "APR", month: "04" },
  { label: "MAY", month: "05" },
  { label: "JUN", month: "06" },
  { label: "JUL", month: "07" },
  { label: "AUG", month: "08" },
  { label: "SEP", month: "09" },
  { label: "OCT", month: "10" },
  { label: "NOV", month: "11" },
];
const FISCAL_MONTH_ORDER = MONTHS.map((month) => month.label);

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function niceStep(rawStep: number) {
  if (rawStep <= 1) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const base = Math.pow(10, exponent);
  const fraction = rawStep / base;
  if (fraction <= 1) return base;
  if (fraction <= 2) return 2 * base;
  if (fraction <= 5) return 5 * base;
  return 10 * base;
}

function buildIntegerTicks(maxValue: number) {
  const safeMax = Math.max(1, Math.ceil(maxValue || 0));
  const step = niceStep(safeMax / 4);
  let maxTick = Math.ceil(safeMax / step) * step;
  if (maxTick <= safeMax) maxTick += step;

  const ticks: number[] = [];
  for (let value = 0; value <= maxTick; value += step) {
    ticks.push(value);
  }
  return { ticks, maxTick };
}

export default function SubscriberVpsDashboard() {
  const { fiscalYear, setFiscalYear } = useAppStore();
  const [subscriptionMetric, setSubscriptionMetric] = useState<"estimasi" | "realisasi">("estimasi");
  const [visibleAmountKeys, setVisibleAmountKeys] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState(false);
  const subscriptionCardRef = useRef<HTMLDivElement | null>(null);
  const year = String(fiscalYear || new Date().getFullYear());
  const previousFiscalYear = String((Number(year) || new Date().getFullYear()) - 1);
  const dashboardMonth = new Date().toLocaleString("en-US", { month: "short" }).toUpperCase();

  const { data: fiscalYears = [], isLoading: fiscalYearsLoading } = useQuery({
    queryKey: ["fiscal-years"],
    queryFn: fetchFiscalYears,
  });

  const { data: subscriberCombined = [], isLoading: subscriberLoading } = useQuery({
    queryKey: ["subscriber-combined", year],
    queryFn: () => fetchSubscriberCombined(year),
    enabled: !!year,
  });

  const { data: previousSubscriberCombined = [] } = useQuery({
    queryKey: ["subscriber-combined-previous", previousFiscalYear],
    queryFn: () => fetchSubscriberCombined(previousFiscalYear),
    enabled: !!year,
  });

  const { data: subscriberByProgram = [] } = useQuery({
    queryKey: ["subscriber-by-program", year, dashboardMonth],
    queryFn: () => fetchSubscriberByProgram(year, dashboardMonth),
    enabled: !!year,
  });

  const { data: subscriptionList } = useQuery({
    queryKey: ["subscription-dashboard-rekap-bulanan", year],
    enabled: !!year,
    queryFn: () => fetchSubscriptionList({ page: 1, limit: 100, tahun: Number(year) }),
  });

  const subscriberTotals = useMemo(() => {
    const totalGrowth = subscriberCombined.reduce((sum: number, item: any) => sum + Number(item.count || 0), 0);
    const totalSubscriber = Number(subscriberCombined[subscriberCombined.length - 1]?.total || 0);
    const totalCost = subscriberByProgram.reduce((sum: number, item: any) => sum + Number(item.total_biaya || 0), 0);
    return { totalGrowth, totalSubscriber, totalCost };
  }, [subscriberCombined, subscriberByProgram]);

  const subscriberAverageAddition = useMemo(() => {
    if (!subscriberCombined || subscriberCombined.length === 0) {
      return { avg: 0, endMonth: "-" };
    }
    const currentMonthLabel = new Date().toLocaleString("en-US", { month: "short" }).toUpperCase();
    const cutoffIdx = FISCAL_MONTH_ORDER.indexOf(currentMonthLabel);
    const safeCutoffIdx = cutoffIdx >= 0 ? cutoffIdx : FISCAL_MONTH_ORDER.length - 1;
    const effectiveRows = subscriberCombined.filter((row: any) =>
      FISCAL_MONTH_ORDER.indexOf(String(row?.bulan || "").toUpperCase()) <= safeCutoffIdx
    );
    const totalGrowth = effectiveRows.reduce((sum: number, row: any) => sum + Number(row?.count || 0), 0);
    const divisor = safeCutoffIdx + 1;
    return {
      avg: divisor > 0 ? Math.floor(totalGrowth / divisor) : 0,
      endMonth: FISCAL_MONTH_ORDER[safeCutoffIdx] || "-",
    };
  }, [subscriberCombined]);

  const subscriberByProgramVisible = useMemo(
    () => (subscriberByProgram || []).filter((item: any) => Number(item?.total_subscriber || 0) > 0),
    [subscriberByProgram]
  );
  const subscriberByProgramTotalCost = useMemo(
    () => subscriberByProgramVisible.reduce((sum: number, item: any) => sum + Number(item?.total_biaya || 0), 0),
    [subscriberByProgramVisible]
  );
  const subscriberByProgramTotalSubscriber = useMemo(
    () => subscriberByProgramVisible.reduce((sum: number, item: any) => sum + Number(item?.total_subscriber || 0), 0),
    [subscriberByProgramVisible]
  );

  const subscriberGrowthComparisonData = useMemo(() => FISCAL_MONTH_ORDER.map((bulanCode) => {
    const current = (subscriberCombined || []).find((item: any) => item.bulan === bulanCode);
    const previous = (previousSubscriberCombined || []).find((item: any) => item.bulan === bulanCode);
    return {
      bulan: bulanCode,
      current: Number(current?.count || 0),
      previous: Number(previous?.count || 0),
    };
  }), [previousSubscriberCombined, subscriberCombined]);
  const hasSubscriberGrowthComparison = useMemo(
    () => subscriberGrowthComparisonData.some((item) => item.current || item.previous),
    [subscriberGrowthComparisonData]
  );
  const subscriberGrowthComparisonAxis = useMemo(
    () => buildIntegerTicks(Math.max(0, ...subscriberGrowthComparisonData.flatMap((item) => [item.current, item.previous]))),
    [subscriberGrowthComparisonData]
  );

  const subscriptionMonthlyData = useMemo(() => {
    const rows = (subscriptionList?.data || [])
      .filter((item: any) => Number(item.tahun) === Number(year))
      .reduce((acc: Record<string, { estimasi: number; realisasi: number }>, item: any) => {
        const month = String(item?.periode || "").slice(5, 7);
        if (!month) return acc;
        if (!acc[month]) acc[month] = { estimasi: 0, realisasi: 0 };
        acc[month].estimasi += Number(item?.estimasi || 0);
        acc[month].realisasi += Number(item?.realisasi || 0);
        return acc;
      }, {});

    return MONTHS.map((month) => ({
      name: `${month.label}-${month.month === "12" ? String(Number(year) - 1).slice(-2) : year.slice(-2)}`,
      estimasi: rows[month.month]?.estimasi || 0,
      realisasi: rows[month.month]?.realisasi || 0,
    }));
  }, [subscriptionList?.data, year]);

  const subscriptionTotal = subscriptionMonthlyData.reduce((sum, item) => sum + Number(item[subscriptionMetric] || 0), 0);

  const maskCurrency = () => "Rp ••••••••••";
  const isAmountVisible = (key: string) => !!visibleAmountKeys[key];
  const toggleAmountVisibility = (key: string) => {
    setVisibleAmountKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const renderCurrencyWithToggle = (
    value: number,
    amountKey: string,
    options?: { className?: string; valueClassName?: string; buttonClassName?: string }
  ) => (
    <div className={options?.className || "flex items-center gap-2"}>
      <span className={options?.valueClassName}>
        {isAmountVisible(amountKey) ? formatCurrency(value) : maskCurrency()}
      </span>
      <button
        type="button"
        onClick={() => toggleAmountVisibility(amountKey)}
        className={`no-export-pdf ${options?.buttonClassName || "inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"}`}
        title={isAmountVisible(amountKey) ? "Sembunyikan nominal" : "Tampilkan nominal"}
        aria-label={isAmountVisible(amountKey) ? "Sembunyikan nominal" : "Tampilkan nominal"}
      >
        {isAmountVisible(amountKey) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
  const renderCompactCurrencyWithToggle = (value: number, amountKey: string, valueClassName = "font-semibold text-blue-600") =>
    renderCurrencyWithToggle(value, amountKey, {
      className: "inline-flex items-center gap-1.5",
      valueClassName,
      buttonClassName:
        "inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors",
    });

  const subscriptionChartData = useMemo(() => subscriptionMonthlyData.map((item) => ({
    name: item.name,
    estimasi: item.estimasi,
    realisasi: item.realisasi,
  })), [subscriptionMonthlyData]);

  const selectedSubscriptionKey = subscriptionMetric;
  const subscriptionSelectedTotal = subscriptionChartData.reduce((sum, item) => sum + Number((item as any)[selectedSubscriptionKey] || 0), 0);
  const subscriptionAverage = Math.round(subscriptionSelectedTotal / 12);
  const subscriptionColor = selectedSubscriptionKey === "estimasi" ? "#3b82f6" : "#10b981";
  const subscriptionMaxSelected = Math.max(0, ...subscriptionChartData.map((item) => Number((item as any)[selectedSubscriptionKey] || 0)));
  const subscriptionStep = 500_000_000;
  const subscriptionMinMaxTick = 1_500_000_000;
  const subscriptionMaxTick = Math.max(subscriptionMinMaxTick, Math.ceil(subscriptionMaxSelected / subscriptionStep) * subscriptionStep);
  const subscriptionTicks = Array.from({ length: Math.floor(subscriptionMaxTick / subscriptionStep) + 1 }, (_, i) => i * subscriptionStep);

  const loadImageAsDataURL = (url: string): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return resolve(null);
        ctx.drawImage(img, 0, 0);
        resolve({ dataUrl: canvas.toDataURL("image/png"), width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const handleExportSubscriptionPDF = async () => {
    if (!subscriptionCardRef.current) return;
    try {
      setExporting(true);
      const canvas = await html2canvas(subscriptionCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: "#ffffff",
        onclone: (doc) => {
          doc.querySelectorAll(".no-export-pdf").forEach((el) => {
            (el as HTMLElement).style.display = "none";
          });
          const card = doc.querySelector(".vps-card") as HTMLElement | null;
          const totalWrap = doc.querySelector(".vps-total-caption") as HTMLElement | null;
          const totalVal = doc.querySelector(".vps-total-value") as HTMLElement | null;
          const avgVal = doc.querySelector(".vps-average-value") as HTMLElement | null;
          if (card && totalWrap) {
            card.style.position = "relative";
            totalWrap.style.position = "absolute";
            totalWrap.style.top = "16px";
            totalWrap.style.right = "24px";
            totalWrap.style.margin = "0";
            totalWrap.style.textAlign = "right";
            if (totalVal) {
              totalVal.style.display = "block";
              totalVal.style.fontSize = "18px";
              totalVal.style.fontWeight = "700";
              totalVal.style.margin = "0";
            }
            if (avgVal) {
              avgVal.style.display = "block";
              avgVal.style.fontSize = "16px";
              avgVal.style.fontWeight = "600";
              avgVal.style.marginTop = "4px";
              avgVal.style.marginBottom = "0";
            }
          }
        },
      });
      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({ orientation: "landscape", unit: "pt", format: "a4" });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24;
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      let headerHeight = 80;
      const centerX = pageWidth / 2;

      const logo = await loadImageAsDataURL("/nsi-logo-min.png");
      if (logo) {
        const desiredWidth = 100;
        const desiredHeight = Math.round(desiredWidth * (logo.height / logo.width));
        pdf.addImage(logo.dataUrl, "PNG", margin, margin, desiredWidth, desiredHeight);
        headerHeight = Math.max(headerHeight, desiredHeight + 20);
      }

      const scale = Math.min(contentWidth / canvas.width, (contentHeight - headerHeight) / canvas.height);
      const renderWidth = canvas.width * scale;
      const renderHeight = canvas.height * scale;
      const x = margin + (contentWidth - renderWidth) / 2;
      const y = margin + headerHeight + 8;

      pdf.setFont("times", "bold");
      pdf.setFontSize(18);
      pdf.text("DATA PEROLEHAN SUBSCRIPTION", centerX, margin + 22, { align: "center" });
      pdf.setFont("times", "normal");
      pdf.setFontSize(14);
      pdf.text("PT NAGATECH SISTEM INTEGRATOR", centerX, margin + 42, { align: "center" });
      pdf.addImage(imgData, "PNG", x, y, renderWidth, renderHeight);
      pdf.save(`Perolehan_Subscription_${year}_${subscriptionMetric}.pdf`);
    } catch (error) {
      console.error("Export PDF failed", error);
    } finally {
      setExporting(false);
    }
  };

  return (
    <div className="container mx-auto px-6 py-8 space-y-8">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Dashboard Subscriber & Subscription
          </h1>
          <p className="mt-1 text-sm text-slate-600">Ringkasan subscriber dan tagihan subscription tahunan.</p>
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
            <CardDescription>Total Subscription {subscriptionMetric}</CardDescription>
            <CardTitle>{formatCurrency(subscriptionTotal)}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mb-8">
        <div className="relative">
          <Card className="border border-slate-200 bg-white shadow-sm">
            <CardHeader className="pb-4">
              <div className="flex items-center justify-between">
                <CardTitle className="text-2xl font-bold text-gray-900">Subscriber Analytics</CardTitle>
                <div className="flex flex-col items-end space-y-1">
                  <span className="font-semibold text-blue-600">
                    Total Growth: {subscriberTotals.totalGrowth.toLocaleString("id-ID")} subscribers
                  </span>
                  <span className="font-semibold text-indigo-600">
                    Rata-rata Penambahan (DEC-{subscriberAverageAddition.endMonth}): {subscriberAverageAddition.avg.toLocaleString("id-ID")} / bulan
                  </span>
                  <span className="font-semibold text-green-600">
                    Total Subscribers: {subscriberTotals.totalSubscriber.toLocaleString("id-ID")}
                  </span>
                </div>
              </div>
              <CardDescription className="text-gray-600 text-sm">
                Combined view: Monthly additions (bars) & cumulative total (line) in {year} (fiscal year starting December)
              </CardDescription>
            </CardHeader>
            <CardContent>
              {subscriberLoading ? <div className="py-20 text-center text-slate-500">Loading...</div> : <SubscriberCombinedChart data={subscriberCombined} />}
            </CardContent>
          </Card>
        </div>
      </div>

      {subscriberByProgramVisible.length > 0 && (
        <div className="mb-8">
          <div className="relative">
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold text-gray-900">Subscriber by Program</CardTitle>
                  <div className="flex flex-col items-end gap-1 text-sm">
                    <span className="font-semibold text-blue-600">
                      Total Subscribers: {subscriberByProgramTotalSubscriber.toLocaleString("id-ID")}
                    </span>
                    <span className="font-semibold text-emerald-700">
                      Total Subscriber Cost: {formatCurrency(subscriberByProgramTotalCost)}
                    </span>
                  </div>
                </div>
                <CardDescription className="text-gray-600 text-sm">
                  Cumulative subscribers by group program up to {dashboardMonth} {year}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <SubscriberByProgramChart data={subscriberByProgramVisible} />
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {hasSubscriberGrowthComparison && (
        <div className="mb-8">
          <div className="relative">
            <Card className="border border-slate-200 bg-white shadow-sm">
              <CardHeader className="pb-4">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-2xl font-bold text-gray-900">Pertumbuhan Subscriber vs Tahun Sebelumnya</CardTitle>
                  <div className="flex flex-col items-end gap-1 text-sm">
                    <span className="font-semibold text-blue-600">Tahun Aktif: {year}</span>
                    <span className="font-semibold text-slate-600">Pembanding: {previousFiscalYear}</span>
                  </div>
                </div>
                <CardDescription className="text-gray-600 text-sm">
                  Perbandingan penambahan subscriber per bulan fiskal. Data ditampilkan dalam bar chart agar mudah dibandingkan.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={subscriberGrowthComparisonData} margin={{ top: 42, right: 30, left: 20, bottom: 20 }}>
                    <XAxis dataKey="bulan" interval={0} tick={{ fontSize: 12, fill: "#374151", fontWeight: 600 }} />
                    <YAxis
                      domain={[0, subscriberGrowthComparisonAxis.maxTick]}
                      ticks={subscriberGrowthComparisonAxis.ticks}
                      tickFormatter={(value) => Number(value || 0).toLocaleString("id-ID")}
                      fontSize={12}
                      allowDecimals={false}
                    />
                    <Tooltip
                      formatter={(value: any, name: string) => {
                        const label = String(name || "").includes(year) || name === "current"
                          ? `Growth ${year}`
                          : `Growth ${previousFiscalYear}`;
                        return [Number(value || 0).toLocaleString("id-ID"), label];
                      }}
                    />
                    <Legend
                      formatter={(value) => {
                        const label = String(value || "");
                        if (label === "current" || label.includes(year)) return `Growth ${year}`;
                        return `Growth ${previousFiscalYear}`;
                      }}
                    />
                    <Bar dataKey="previous" name={`Growth ${previousFiscalYear}`} fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={28}>
                      <LabelList
                        dataKey="previous"
                        position="top"
                        offset={8}
                        formatter={(value: number) => Number(value || 0).toLocaleString("id-ID")}
                        style={{ fontSize: 10, fill: "#475569", fontWeight: 700, textShadow: "0 1px 2px rgba(255,255,255,0.9)" }}
                      />
                    </Bar>
                    <Bar dataKey="current" name={`Growth ${year}`} fill="#2563eb" radius={[4, 4, 0, 0]} barSize={28}>
                      <LabelList
                        dataKey="current"
                        position="top"
                        offset={8}
                        formatter={(value: number) => Number(value || 0).toLocaleString("id-ID")}
                        style={{ fontSize: 10, fill: "#1d4ed8", fontWeight: 700, textShadow: "0 1px 2px rgba(255,255,255,0.9)" }}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      <div ref={subscriptionCardRef}>
        <Card className="vps-card border border-slate-200 bg-white shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-2xl font-bold text-gray-900">Perolehan Subscription {year}</CardTitle>
              <div className="flex items-center gap-3 no-export-pdf">
                <div className="flex items-center gap-2 bg-gray-100/50 rounded-lg p-1">
                  <button
                    type="button"
                    onClick={() => setSubscriptionMetric("estimasi")}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      subscriptionMetric === "estimasi" ? "bg-blue-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Estimasi
                  </button>
                  <button
                    type="button"
                    onClick={() => setSubscriptionMetric("realisasi")}
                    className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                      subscriptionMetric === "realisasi" ? "bg-green-600 text-white shadow-md" : "text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    Realisasi
                  </button>
                </div>
                <button
                  type="button"
                  onClick={handleExportSubscriptionPDF}
                  disabled={exporting}
                  className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 border border-blue-300 ${
                    exporting ? "bg-gray-200 text-gray-500 cursor-not-allowed" : "bg-white text-blue-700 hover:bg-blue-50"
                  }`}
                  title="Export chart as PDF"
                >
                  Export PDF
                </button>
              </div>
            </div>
            <CardDescription className="text-gray-600 text-sm">
              Data Estimasi & Realisasi Subscription
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div>
              <div className="vps-total-caption mb-3 text-right">
                <div className={`vps-total-value text-sm font-medium ${
                  selectedSubscriptionKey === "estimasi" ? "text-blue-600" : "text-green-600"
                } flex items-center justify-end`}>
                  <span className="mr-1">Total {selectedSubscriptionKey === "estimasi" ? "Estimasi" : "Realisasi"}:</span>
                  {renderCompactCurrencyWithToggle(
                    subscriptionSelectedTotal,
                    `subscription-total-${selectedSubscriptionKey}`,
                    `font-medium ${selectedSubscriptionKey === "estimasi" ? "text-blue-600" : "text-green-600"}`
                  )}
                </div>
                <div className="vps-average-value text-xs font-medium text-gray-700 flex items-center justify-end">
                  <span className="mr-1">Rata-Rata:</span>
                  {renderCompactCurrencyWithToggle(subscriptionAverage, "subscription-average", "font-medium text-gray-700")}
                </div>
                <div className="no-export-pdf mt-1 inline-flex items-center justify-end gap-2 text-xs text-gray-600">
                  <span>Label Bar:</span>
                  <button
                    type="button"
                    onClick={() => toggleAmountVisibility("subscription-bar-labels")}
                    className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                    title={isAmountVisible("subscription-bar-labels") ? "Sembunyikan nominal bar" : "Tampilkan nominal bar"}
                    aria-label={isAmountVisible("subscription-bar-labels") ? "Sembunyikan nominal bar" : "Tampilkan nominal bar"}
                  >
                    {isAmountVisible("subscription-bar-labels") ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <ResponsiveContainer width="100%" height={400}>
                <BarChart data={subscriptionChartData} margin={{ top: 20, right: 30, left: 55, bottom: 20 }}>
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={{ fontSize: 12, fill: "#374151" }}
                  />
                  <YAxis
                    width={70}
                    tickMargin={6}
                    ticks={subscriptionTicks}
                    domain={[0, subscriptionMaxTick]}
                    allowDecimals={false}
                    tickFormatter={(value) => formatCurrency(Number(value))}
                    fontSize={12}
                  />
                  <Tooltip
                    formatter={(value: any) => (
                      isAmountVisible(`subscription-total-${selectedSubscriptionKey}`)
                        ? formatCurrency(Number(value))
                        : maskCurrency()
                    )}
                  />
                  <Bar
                    dataKey={selectedSubscriptionKey}
                    name={selectedSubscriptionKey === "estimasi" ? "Estimasi" : "Realisasi"}
                    fill={subscriptionColor}
                    radius={[4, 4, 0, 0]}
                    barSize={50}
                  >
                    <LabelList
                      dataKey={selectedSubscriptionKey}
                      position="top"
                      offset={10}
                      formatter={(value: number) => (isAmountVisible("subscription-bar-labels") ? `Rp ${Number(value || 0).toLocaleString("id-ID")}` : "")}
                      style={{ fontSize: 11, fill: "#374151", fontWeight: 600 }}
                    />
                  </Bar>
                  <ReferenceLine
                    y={subscriptionAverage}
                    stroke="#2563eb"
                    strokeDasharray="8 6"
                    strokeWidth={2}
                    isFront
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
