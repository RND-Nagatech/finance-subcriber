import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, LabelList, ReferenceLine } from 'recharts';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ChartDonut } from '@/components/ChartDonut';
import { ChartBar } from '@/components/ChartBar';
import StackedBarKategori from '@/components/StackedBarKategori';
import LineChartKategori from '@/components/LineChartKategori';
import { SubscriberCombinedChart } from '@/components/SubscriberCombinedChart';
import { SubscriberByProgramChart } from '@/components/SubscriberByProgramChart';
import axiosInstance from '@/api/axiosInstance';
import { fetchAggregatesByPeriode } from '@/api/ttvps';
import { fetchSubscriberCombined, fetchSubscriberByProgram } from '@/api/fiscal';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { useAppStore } from '@/store/useAppStore';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const MONTH_OPTIONS = [
  { value: 'ANNUAL', label: 'Annual' },
  { value: 'DEC', label: 'December' },
  { value: 'JAN', label: 'January' },
  { value: 'FEB', label: 'February' },
  { value: 'MAR', label: 'March' },
  { value: 'APR', label: 'April' },
  { value: 'MAY', label: 'May' },
  { value: 'JUN', label: 'June' },
  { value: 'JUL', label: 'July' },
  { value: 'AUG', label: 'August' },
  { value: 'SEP', label: 'September' },
  { value: 'OCT', label: 'October' },
  { value: 'NOV', label: 'November' },
];
const FISCAL_MONTH_ORDER = ['DEC', 'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV'];

export default function Dashboard() {
  const { user } = useAppStore();
  // Year state; start empty then set to latest fiscal year when list arrives
  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<string>(new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase());
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');
  const [vpsMetric, setVpsMetric] = useState<'estimasi' | 'realisasi'>('estimasi');
  const [showRekeningDetail, setShowRekeningDetail] = useState(false);
  const [exporting, setExporting] = useState<boolean>(false);
  const userSelectedYearRef = useRef(false);
  const vpsCardRef = useRef<HTMLDivElement | null>(null);

  // Helper function to check if user can view restricted content
  const canViewRestrictedContent = () => {
    return user?.role === 'corsec' || user?.role === 'superuser';
  };

  // Helper: load image from URL as data URL with original dimensions
  const loadImageAsDataURL = (url: string): Promise<{ dataUrl: string; width: number; height: number } | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0);
        const dataUrl = canvas.toDataURL('image/png');
        resolve({ dataUrl, width: img.naturalWidth, height: img.naturalHeight });
      };
      img.onerror = () => resolve(null);
      img.src = url;
    });
  };

  const handleExportPDF = async () => {
    if (!vpsCardRef.current) return;
    try {
      setExporting(true);
      const canvas = await html2canvas(vpsCardRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        onclone: (doc) => {
          doc.querySelectorAll('.no-export-pdf').forEach((el) => {
            (el as HTMLElement).style.display = 'none';
          });
          const card = doc.querySelector('.vps-card') as HTMLElement | null;
          const totalWrap = doc.querySelector('.vps-total-caption') as HTMLElement | null;
          const totalVal = doc.querySelector('.vps-total-value') as HTMLElement | null;
          const avgVal = doc.querySelector('.vps-average-value') as HTMLElement | null;
          if (card && totalWrap) {
            // Position the totals/average at the top-right and style for PDF
            card.style.position = 'relative';
            totalWrap.style.position = 'absolute';
            totalWrap.style.top = '16px';
            totalWrap.style.right = '24px';
            totalWrap.style.margin = '0';
            totalWrap.style.textAlign = 'right';
            if (totalVal) {
              totalVal.style.display = 'block';
              totalVal.style.fontSize = '18px';
              totalVal.style.fontWeight = '700';
              totalVal.style.margin = '0';
            }
            if (avgVal) {
              avgVal.style.display = 'block';
              avgVal.style.fontSize = '16px';
              avgVal.style.fontWeight = '600';
              avgVal.style.marginTop = '4px';
              avgVal.style.marginBottom = '0';
            }
          }
        },
      });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 24; // 24pt (~8.5mm)
      const contentWidth = pageWidth - margin * 2;
      const contentHeight = pageHeight - margin * 2;
      // Reserve space for PDF header (may grow if logo is taller)
      let headerHeight = 80; // pt
      const centerX = pageWidth / 2;

      // Try to load and render logo to the left of the centered header (use local asset to avoid CORS)
      const logoUrl = '/nsi-logo-min.png';
      const logo = await loadImageAsDataURL(logoUrl);
      if (logo) {
        const desiredWidth = 100; // pt (smaller logo)
        const aspect = logo.height / logo.width;
        const desiredHeight = Math.round(desiredWidth * aspect);
        pdf.addImage(logo.dataUrl, 'PNG', margin, margin, desiredWidth, desiredHeight);
        headerHeight = Math.max(headerHeight, desiredHeight + 20);
      }
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const scale = Math.min(contentWidth / imgWidth, (contentHeight - headerHeight) / imgHeight);
      const renderWidth = imgWidth * scale;
      const renderHeight = imgHeight * scale;
      const x = margin + (contentWidth - renderWidth) / 2;
      const topGap = 8; // pt gap below header
      const y = margin + headerHeight + topGap;
      // Add header text
        pdf.setFont('times', 'bold');
      pdf.setFontSize(18);
      pdf.text('DATA PEROLEHAN VPS', centerX, margin + 22, { align: 'center' });
        pdf.setFont('times', 'normal');
      pdf.setFontSize(14);
      pdf.text('PT NAGATECH SISTEM INTEGRATOR', centerX, margin + 42, { align: 'center' });
      pdf.addImage(imgData, 'PNG', x, y, renderWidth, renderHeight);
      const filename = `Perolehan_VPS_${year}_${vpsMetric}.pdf`;
      pdf.save(filename);
    } catch (err) {
      console.error('Export PDF failed', err);
    } finally {
      setExporting(false);
    }
  };
  const handleYearChange = (val: string) => {
    userSelectedYearRef.current = true;
    setYear(val);
  };
  const handleMonthChange = (val: string) => {
    setMonth(val);
  };
  // Fetch fiscal years dari backend
  const { data: fiscalYearsData, isLoading: isYearsLoading } = useQuery({
    queryKey: ['fiscal-years'],
    queryFn: async () => {
      const res = await axiosInstance.get('/fiscal/years');
      return res.data.years || [];
    },
  });

  // Once fiscal years loaded, pick the latest (max) if user hasn't chosen yet
  useEffect(() => {
    if (!userSelectedYearRef.current && fiscalYearsData && fiscalYearsData.length > 0) {
      const latest = Math.max(...fiscalYearsData);
      if (year !== latest.toString()) setYear(latest.toString());
    }
  }, [fiscalYearsData, year]);

  const { data, isLoading, error } = useQuery({
    queryKey: ['dashboard', year, month],
    queryFn: async () => {
      const baseUrl = `/dashboard/rekap-aggregate?tahun=${year}`;
      const url = month === 'ANNUAL' ? baseUrl : `${baseUrl}&bulan=${month}`;
      const response = await axiosInstance.get(url);
      return response.data;
    },
    enabled: !!year,
  });

  // VPS monthly aggregates (Dec–Nov fiscal year)
  const { data: vpsMonthlyData } = useQuery({
    queryKey: ['vps-tt-aggregates', year],
    enabled: !!year,
    queryFn: async () => {
      const yr = parseInt(year, 10);
      const months = [
        { label: 'DEC', period: `${yr - 1}-12` },
        { label: 'JAN', period: `${yr}-01` },
        { label: 'FEB', period: `${yr}-02` },
        { label: 'MAR', period: `${yr}-03` },
        { label: 'APR', period: `${yr}-04` },
        { label: 'MAY', period: `${yr}-05` },
        { label: 'JUN', period: `${yr}-06` },
        { label: 'JUL', period: `${yr}-07` },
        { label: 'AUG', period: `${yr}-08` },
        { label: 'SEP', period: `${yr}-09` },
        { label: 'OCT', period: `${yr}-10` },
        { label: 'NOV', period: `${yr}-11` },
      ];
      const results = await Promise.all(months.map(m => fetchAggregatesByPeriode(m.period)));
      return months.map((m, idx) => {
        const periodYear = parseInt(m.period.slice(0, 4), 10);
        const yy = String(periodYear % 100).padStart(2, '0');
        const labelWithYear = `${m.label}-${yy}`;
        return { label: labelWithYear, agg: results[idx] };
      });
    }
  });

  // Query untuk subscriber combined data
  const { data: subscriberCombinedData, isLoading: isSubscriberCombinedLoading } = useQuery({
    queryKey: ['subscriber-combined', year],
    queryFn: () => fetchSubscriberCombined(year),
    enabled: !!year,
  });

  // Query untuk subscriber by program
  const { data: subscriberByProgramData, isLoading: isSubscriberByProgramLoading } = useQuery({
    queryKey: ['subscriber-by-program', year, month],
    queryFn: () => fetchSubscriberByProgram(year, month),
    enabled: !!year,
  });

  // Query untuk pendapatan harian (jika bulan tidak ANNUAL)
  const { data: pendapatanHarianData } = useQuery({
    queryKey: ['pendapatan-harian', year, month],
    queryFn: async () => {
      const response = await axiosInstance.get(`/dashboard/pendapatan-harian?tahun=${year}&bulan=${month}`);
      return response.data;
    },
    enabled: !!year && month !== 'ANNUAL',
  });

  const { data: rekeningDashboardList = [], isLoading: isRekeningDashboardLoading } = useQuery({
    queryKey: ['dashboard-rekening-saldo'],
    queryFn: async () => {
      const response = await axiosInstance.get('/master/rekening?all=true');
      const list = Array.isArray(response.data) ? response.data : [];
      return list.filter((r: any) => (r?.status_aktv ?? r?.active ?? true) !== false);
    },
  });

  const totalAkumulasiSaldoRekening = rekeningDashboardList.reduce(
    (sum: number, item: any) => sum + Number(item?.saldo || 0),
    0
  );

  const subscriberAverageAddition = (() => {
    if (!subscriberCombinedData || subscriberCombinedData.length === 0) {
      return { avg: 0, divisor: 0, totalGrowth: 0, endMonth: '-' };
    }
    const currentMonthLabel = new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const cutoffIdx = FISCAL_MONTH_ORDER.indexOf(currentMonthLabel);
    const safeCutoffIdx = cutoffIdx >= 0 ? cutoffIdx : FISCAL_MONTH_ORDER.length - 1;
    const effectiveRows = subscriberCombinedData.filter((row: any) =>
      FISCAL_MONTH_ORDER.indexOf(String(row?.bulan || '').toUpperCase()) <= safeCutoffIdx
    );
    const totalGrowth = effectiveRows.reduce((sum: number, row: any) => sum + Number(row?.count || 0), 0);
    const divisor = safeCutoffIdx + 1;
    const avg = divisor > 0 ? Math.floor(totalGrowth / divisor) : 0;
    return {
      avg,
      divisor,
      totalGrowth,
      endMonth: FISCAL_MONTH_ORDER[safeCutoffIdx] || '-',
    };
  })();

  // Mapping backend response to chartData dan tableData
  const rekapData = data?.data || [];
  const asetDanGajiData = data?.asetDanGaji || [];
  const biayaBiayaData = data?.biayaBiaya || [];
  const pertahunData = data?.pertahun || [];
  const asetDanGajiTahunanData = data?.asetDanGajiTahunan || [];
  const implementasiMarketingLainnyaTahunanData = data?.implementasiMarketingLainnyaTahunan || [];
  const biayaBiayaTahunanData = data?.biayaBiayaTahunan || [];
  const grossMarginTahunanData = data?.grossMarginTahunan || [];
  const subscriberData = data?.subscriber || [];
  
  // Data untuk pendapatan harian chart (jika bulan tidak ANNUAL)
  const pendapatanHarianChartData = (() => {
    if (!pendapatanHarianData || month === 'ANNUAL') return [];
    const hariMap: { [hari: string]: { [key: string]: number } } = {};
    const subKategories: string[] = [];
    pendapatanHarianData.forEach((item: any) => {
      if (!subKategories.includes(item.sub_kategori)) subKategories.push(item.sub_kategori);
      if (!hariMap[item.hari]) hariMap[item.hari] = {};
      hariMap[item.hari][item.sub_kategori] = item.total;
    });
    return Object.keys(hariMap).map(hari => ({
      kategori: hari,
      subs: subKategories.map(sub => ({
        name: sub,
        total: hariMap[hari][sub] || 0
      }))
    }));
  })();
  
  // Data untuk line chart kategori PEMBELIAN
  const pembelianData = pertahunData.find((item: any) => item.kategori === 'PEMBELIAN');
  const pembelianLineData = pembelianData ? pembelianData.data_bulanan
    .map((bulanData: any) => ({
      bulan: bulanData.bulan,
      nominal: bulanData.total
    })) : [];

  // Data untuk stacked bar aset dan gaji tahunan
  const asetDanGajiTahunanChartData = (() => {
    const bulanMap: { [bulan: string]: { ASET: number; GAJI: number } } = {};
    asetDanGajiTahunanData.forEach((group: any) => {
      group.data_bulanan.forEach((b: any) => {
        if (!bulanMap[b.bulan]) bulanMap[b.bulan] = { ASET: 0, GAJI: 0 };
        bulanMap[b.bulan][group.group] = b.total;
      });
    });
    return Object.keys(bulanMap).map(bulan => ({
      kategori: bulan,
      subs: [
        { name: "ASET", total: bulanMap[bulan].ASET },
        { name: "GAJI", total: bulanMap[bulan].GAJI }
      ]
    }))
  })();

  // Data untuk stacked bar biaya lain tahunan
  const implementasiMarketingLainnyaTahunanChartData = (() => {
    const bulanMap: { [bulan: string]: { [key: string]: number } } = {};
    const subKategories: string[] = [];
    implementasiMarketingLainnyaTahunanData.forEach((item: any) => {
      if (!subKategories.includes(item.sub_kategori)) subKategories.push(item.sub_kategori);
      item.data_bulanan.forEach((b: any) => {
        if (!bulanMap[b.bulan]) bulanMap[b.bulan] = {};
        bulanMap[b.bulan][item.sub_kategori] = b.total;
      });
    });
    return Object.keys(bulanMap).map(bulan => ({
      kategori: bulan,
      subs: subKategories.map(sub => ({
        name: sub,
        total: bulanMap[bulan][sub] || 0
      }))
    }))
  })();

  // Data untuk stacked bar biaya biaya tahunan
  const biayaBiayaTahunanChartData = (() => {
    const bulanMap: { [bulan: string]: { [key: string]: number } } = {};
    const subKategories: string[] = [];
    biayaBiayaTahunanData.forEach((item: any) => {
      if (!subKategories.includes(item.sub_kategori)) subKategories.push(item.sub_kategori);
      item.data_bulanan.forEach((b: any) => {
        if (!bulanMap[b.bulan]) bulanMap[b.bulan] = {};
        bulanMap[b.bulan][item.sub_kategori] = b.total;
      });
    });
    return Object.keys(bulanMap).map(bulan => ({
      kategori: bulan,
      subs: subKategories.map(sub => ({
        name: sub,
        total: bulanMap[bulan][sub] || 0
      }))
    }))
  })();

  // Totals for stacked bar sections
  const asetDanGajiTotal = asetDanGajiTahunanChartData.reduce((sum, row) => {
    return sum + row.subs.reduce((s, sub) => s + (sub.total || 0), 0);
  }, 0);
  const implementasiMarketingLainnyaTotal = implementasiMarketingLainnyaTahunanChartData.reduce((sum, row) => {
    return sum + row.subs.reduce((s, sub) => s + (sub.total || 0), 0);
  }, 0);
  const biayaBiayaTotal = biayaBiayaTahunanChartData.reduce((sum, row) => {
    return sum + row.subs.reduce((s, sub) => s + (sub.total || 0), 0);
  }, 0);

  // Data untuk line chart gross margin tahunan
  const grossMarginTahunanLineData = grossMarginTahunanData
    .map((bulanData: any) => ({
      bulan: bulanData.bulan,
      nominal: bulanData.gross_margin
    }));

  // Data untuk subscriber per program chart
  const subscriberChartData = subscriberData.map((programData: any) => ({
    program: programData.program,
    total_biaya_tahunan: programData.total_biaya_tahunan,
    total_subscriber_tahunan: programData.total_subscriber_tahunan,
    data_bulanan: programData.data_bulanan
  }));
  // Data untuk stacked bar: kategori (x-axis) dengan sub kategori sebagai bar yang ditumpuk
  const stackedBarData = rekapData.map((item: any) => ({
    kategori: item.kategori,
    subs: (item.subs || []).map((s: any) => ({
      name: s.sub_kategori || s.subKategori,
      total: s.total,
    }))
  }));

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(value);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 relative overflow-hidden">
      {/* Background decorative elements */}
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      <div className="absolute top-0 right-0 -z-10">
        <div className="w-72 h-72 bg-gradient-to-bl from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl" />
      </div>
      <div className="absolute bottom-0 left-0 -z-10">
        <div className="w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-purple-600/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 py-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Financial Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Monitor your financial performance and insights</p>
          </div>
          <div className="flex flex-col items-end space-y-3">
            <div className="flex items-center gap-3">
              <div className="flex flex-col items-end">
                <label className="text-sm font-medium text-gray-700 mb-1">Bulan</label>
                <Select value={month} onValueChange={handleMonthChange}>
                  <SelectTrigger className="w-40 h-12 bg-white backdrop-blur-sm border-gray-300 hover:border-blue-500 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 shadow-lg">
                    <SelectValue placeholder="Select Month" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-xl">
                    {MONTH_OPTIONS.map((monthOption) => (
                      <SelectItem key={monthOption.value} value={monthOption.value} className="hover:bg-blue-50 focus:bg-blue-50">
                        {monthOption.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col items-end">
                <label className="text-sm font-medium text-gray-700 mb-1">Tahun</label>
                <Select value={year} onValueChange={handleYearChange}>
                  <SelectTrigger className="w-32 h-12 bg-white backdrop-blur-sm border-gray-300 hover:border-blue-500 focus:border-blue-500 focus:ring-blue-500 transition-all duration-200 shadow-lg">
                    <SelectValue placeholder="Select Year" />
                  </SelectTrigger>
                  <SelectContent className="max-h-56 overflow-y-auto bg-white/95 backdrop-blur-sm border-gray-200 shadow-xl">
                    {isYearsLoading ? (
                      <SelectItem value={year || 'loading'}>{year || 'Loading...'}</SelectItem>
                    ) : (
                      fiscalYearsData?.map((th: number) => (
                        <SelectItem key={th} value={th.toString()} className="hover:bg-blue-50 focus:bg-blue-50">{th}</SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </div>

        <Card className="border-2 border-dashed border-emerald-200 bg-white backdrop-blur-sm hover:border-emerald-400 transition-all duration-300">
          <CardHeader>
            <CardTitle>Total Akumulasi Saldo Rekening</CardTitle>
            <CardDescription>Ringkasan saldo terkini seluruh rekening aktif dan detail per rekening.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="mb-4">
              <p className="text-3xl font-bold text-emerald-700">{formatCurrency(totalAkumulasiSaldoRekening)}</p>
              <p className="text-sm text-gray-500 mt-1">Total rekening aktif: {rekeningDashboardList.length}</p>
            </div>
            <div className="mb-2">
              <button
                type="button"
                onClick={() => setShowRekeningDetail((prev) => !prev)}
                className="inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                {showRekeningDetail ? 'Sembunyikan Detail' : 'Tampilkan Detail'}
              </button>
            </div>
            {showRekeningDetail && (
              <div className="overflow-x-auto rounded-lg border border-slate-200">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-semibold">Kode Bank</th>
                      <th className="text-left px-3 py-2 font-semibold">No Rekening</th>
                      <th className="text-left px-3 py-2 font-semibold">Nama Rekening</th>
                      <th className="text-right px-3 py-2 font-semibold">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {isRekeningDashboardLoading ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-gray-500">Memuat data rekening...</td>
                      </tr>
                    ) : rekeningDashboardList.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-3 py-6 text-center text-gray-500">Belum ada data rekening.</td>
                      </tr>
                    ) : (
                      rekeningDashboardList.map((rekening: any) => (
                        <tr key={rekening._id} className="border-t border-slate-100">
                          <td className="px-3 py-2">{rekening.kode_bank || '-'}</td>
                          <td className="px-3 py-2">{rekening.no_rekening || '-'}</td>
                          <td className="px-3 py-2">{rekening.nama_rekening || '-'}</td>
                          <td className="px-3 py-2 text-right font-medium">{formatCurrency(Number(rekening.saldo || 0))}</td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>

        {isLoading ? (
          <div className="h-[400px] flex items-center justify-center">
            <Card className="w-full max-w-md border-2 border-dashed border-blue-200 bg-white backdrop-blur-sm">
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-600 font-medium">Loading dashboard data...</p>
              </CardContent>
            </Card>
          </div>
        ) : rekapData.length === 0 && asetDanGajiData.length === 0 && biayaBiayaData.length === 0 && pertahunData.length === 0 && pembelianLineData.length === 0 && asetDanGajiTahunanChartData.length === 0 && implementasiMarketingLainnyaTahunanChartData.length === 0 && biayaBiayaTahunanChartData.length === 0 && grossMarginTahunanLineData.length === 0 && subscriberChartData.length === 0 ? (
          <Card className="border-2 border-dashed border-blue-200 bg-white backdrop-blur-sm">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-16 h-16 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center mb-4">
                <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Data Available</h3>
              <p className="text-gray-600 text-center">Start adding transactions to see your financial insights</p>
            </CardContent>
          </Card>
        ) : (
          <>
            {/* VPS Monthly Aggregates (rendered later after Subscriber by Program) */}

            {/* Monthly trend chart per kategori */}
            {pertahunData.length > 0 && (
              <div className="mb-6">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  {pertahunData
                    .sort((a, b) => {
                      const order = ['PENDAPATAN', 'PEMBELIAN', 'BIAYA'];
                      const aIndex = order.indexOf(a.kategori);
                      const bIndex = order.indexOf(b.kategori);
                      // Jika kategori tidak ada di order array, letakkan di akhir
                      const aOrder = aIndex === -1 ? order.length : aIndex;
                      const bOrder = bIndex === -1 ? order.length : bIndex;
                      return aOrder - bOrder;
                    })
                    .map((kategoriData: any, idx: number) => (
                    <div key={idx} className="relative">
                      <Card className="border-2 border-dashed border-purple-200 bg-white backdrop-blur-sm hover:border-purple-400 transition-all duration-300">
                        <CardHeader className="pb-3">
                          <CardTitle className="text-lg font-bold text-gray-900">{kategoriData.kategori == "PENDAPATAN" ? "PENJUALAN" : kategoriData.kategori}</CardTitle>
                          {month === 'ANNUAL' && (
                            <CardDescription className="text-gray-400 text-sm">
                            {month === 'ANNUAL' ? (
                              <>Monthly breakdown in {year}</>
                            ) : (
                              <>Daily breakdown in {month} {year}</>
                            )}
                          </CardDescription>
                          )}
                        </CardHeader>
                        <CardContent className="pt-0">
                          <div className="mb-3">
                            <span className="text-m text-purple-600 font-bold">
                              Total: {formatCurrency(kategoriData.total_tahunan)}
                            </span>
                          </div>
                          {month === 'ANNUAL' ? (
                            <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-2 gap-2">
                            {kategoriData.data_bulanan
                              .map((bulanData: any, bulanIdx: number) => {
                                // Format label: jika YYYY-MM-DD, tampilkan hanya hari (DD)
                                const formattedBulan = typeof bulanData.bulan === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(bulanData.bulan) 
                                  ? bulanData.bulan.split('-')[2] 
                                  : bulanData.bulan;
                                
                                return (
                                  <div key={bulanIdx} className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-md p-2 text-center">
                                    <div className="text-xs font-medium text-purple-700 mb-1">{formattedBulan}</div>
                                    <div className="text-xs font-bold text-purple-900">Rp {bulanData.total.toLocaleString('id-ID')}</div>
                                  </div>
                                );
                              })}
                          </div>
                          ) : <></>}
                        </CardContent>
                      </Card>
                      {!canViewRestrictedContent() && (
                        <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                          <div className="text-center">
                            <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                            <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                            <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {/* Stacked bar chart untuk Pendapatan per hari (jika bulan tidak ANNUAL) */}
            {pendapatanHarianChartData.length > 0 && month !== 'ANNUAL' && (
              <div className="mb-8">
                <div className="relative">
                  <Card className="border-2 border-dashed border-green-200 bg-white backdrop-blur-sm hover:border-green-400 transition-all duration-300">
                    <CardContent className='pt-6'>
                      <StackedBarKategori
                        data={pendapatanHarianChartData}
                        title={`Penjualan Daily Breakdown - ${month} ${year}`}
                        description="Daily breakdown of income transactions by subcategory"
                      />
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Line chart untuk Margin per bulan */}
            {grossMarginTahunanLineData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className="border-2 border-dashed border-teal-200 bg-white backdrop-blur-sm hover:border-teal-400 transition-all duration-300">
                    <CardContent className='pt-6'>
                      <LineChartKategori 
                        data={grossMarginTahunanLineData} 
                        title={`Margin - ${year}`}
                        description="Monthly gross margin trend (Omzet - Biaya - Pembelian)"
                      />
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
            {/* Line chart untuk kategori PEMBELIAN */}
            {pembelianLineData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className="border-2 border-dashed border-green-200 bg-white backdrop-blur-sm hover:border-green-400 transition-all duration-300">
                    <CardContent className='pt-6'>
                      <LineChartKategori 
                        data={pembelianLineData} 
                        title={`PEMBELIAN Monthly Trend - ${year}`}
                        description="Monthly purchasing trend throughout the year"
                      />
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stacked bar chart untuk Aset dan Gaji per bulan */}
            {asetDanGajiTahunanChartData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className="border-2 border-dashed border-orange-200 bg-white backdrop-blur-sm hover:border-orange-400 transition-all duration-300">
                    <CardContent className='pt-6'>
                      <StackedBarKategori
                        data={asetDanGajiTahunanChartData}
                        title="Aset dan Gaji Monthly Breakdown"
                        description="Monthly comparison of assets and salary expenses"
                      />
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stacked bar chart untuk Biaya Lain per bulan */}
            {implementasiMarketingLainnyaTahunanChartData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className="border-2 border-dashed border-purple-200 bg-white backdrop-blur-sm hover:border-purple-400 transition-all duration-300">
                    <CardContent className='pt-6'>
                      <StackedBarKategori
                        data={implementasiMarketingLainnyaTahunanChartData}
                        title="Implementasi, Marketing & Lainnya Monthly Breakdown"
                        description="Monthly breakdown of implementation, marketing, and other expenses"
                      />
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Stacked bar chart untuk Biaya Biaya per bulan */}
            {biayaBiayaTahunanChartData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className="border-2 border-dashed border-red-200 bg-white backdrop-blur-sm hover:border-red-400 transition-all duration-300">
                    <CardContent className='pt-6'>
                      <StackedBarKategori
                        data={biayaBiayaTahunanChartData}
                        title="Biaya Biaya Monthly Breakdown"
                        description="Monthly breakdown of PPH21, VPS, RND, BPJS, and return sales expenses"
                      />
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Subscriber per Program Chart */}
            {subscriberChartData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className="border-2 border-dashed border-cyan-200 bg-white backdrop-blur-sm hover:border-cyan-400 transition-all duration-300">
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl font-bold text-gray-900">Subscriber Program Overview</CardTitle>
                      <CardDescription className="text-gray-600 text-sm">
                        Cumulative subscribers and costs per program in {year} (accumulated from start of year)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {subscriberChartData.map((program: any, idx: number) => (
                          <div key={idx} className="bg-gradient-to-br from-cyan-50 to-cyan-100 rounded-lg p-4 border border-cyan-200">
                            <h4 className="font-semibold text-cyan-900 mb-2">{program.program}</h4>
                            <div className="space-y-2">
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-cyan-700">Total Subscribers (Cumulative):</span>
                                <span className="font-bold text-cyan-900">{program.total_subscriber_tahunan}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-cyan-700">Total Cost (Cumulative):</span>
                                <span className="font-bold text-cyan-900">Rp {program.total_biaya_tahunan.toLocaleString('id-ID')}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-cyan-700">Avg Cost/Subscriber:</span>
                                <span className="font-bold text-cyan-900">
                                  Rp {(program.total_biaya_tahunan / program.total_subscriber_tahunan).toLocaleString('id-ID')}
                                </span>
                              </div>
                            </div>
                            {/* Monthly cumulative breakdown */}
                            <div className="mt-3 pt-3 border-t border-cyan-200">
                              <div className="text-xs text-cyan-700 mb-2">Cumulative by Month:</div>
                              <div className="grid grid-cols-3 gap-1">
                                {program.data_bulanan.map((bulanData: any, bulanIdx: number) => (
                                  <div key={bulanIdx} className="text-center">
                                    <div className="text-xs font-medium text-cyan-800">{bulanData.bulan}</div>
                                    <div className="text-xs text-cyan-600">{bulanData.jumlah_subscriber}</div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Subscriber Combined Chart */}
            {subscriberCombinedData && subscriberCombinedData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className="border-2 border-dashed border-emerald-200 bg-white backdrop-blur-sm hover:border-emerald-400 transition-all duration-300">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold text-gray-900">Subscriber Analytics</CardTitle>
                        <div className="flex flex-col items-end space-y-1">
                          <span className="font-semibold text-blue-600">
                            Total Growth: {subscriberCombinedData.reduce((sum, item) => sum + item.count, 0).toLocaleString('id-ID')} subscribers
                          </span>
                          <span className="font-semibold text-indigo-600">
                            Rata-rata Penambahan (DEC-{subscriberAverageAddition.endMonth}): {subscriberAverageAddition.avg.toLocaleString('id-ID')} / bulan
                          </span>
                          <span className="font-semibold text-green-600">
                            Total Subscribers: {subscriberCombinedData[subscriberCombinedData.length - 1]?.total.toLocaleString('id-ID') || 0}
                          </span>
                        </div>
                      </div>
                      <CardDescription className="text-gray-600 text-sm">
                        Combined view: Monthly additions (bars) & cumulative total (line) in {year} (fiscal year starting December)
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SubscriberCombinedChart data={subscriberCombinedData} />
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}


            {/* VPS Monthly Aggregates (single-series with radio toggle, placed after Subscriber by Program) */}
            {/* Subscriber by Program Chart */}
            {subscriberByProgramData && subscriberByProgramData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className="border-2 border-dashed border-purple-200 bg-white backdrop-blur-sm hover:border-purple-400 transition-all duration-300">
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold text-gray-900">Subscriber by Program</CardTitle>
                        <span className="font-semibold text-blue-600">
                          Total Subscribers: {subscriberByProgramData.reduce((sum, item) => sum + item.total_subscriber, 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                      <CardDescription className="text-gray-600 text-sm">
                        Cumulative subscribers by program up to {month} {year}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <SubscriberByProgramChart data={subscriberByProgramData} />
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {vpsMonthlyData && vpsMonthlyData.length > 0 && (
              <div className="mb-8" ref={vpsCardRef}>
                <div className="relative">
                  <Card className="vps-card border-2 border-dashed border-blue-200 bg-white backdrop-blur-sm hover:border-blue-400 transition-all duration-300">
                    <CardHeader className="vps-card-header pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold text-gray-900">Perolehan VPS {year}</CardTitle>
                        {/* Actions: radio toggle & export */}
                        <div className="flex items-center gap-3 no-export-pdf">
                          {(() => {
                            return (
                              <div className="flex items-center gap-2 bg-gray-100/50 rounded-lg p-1">
                                <button onClick={() => setVpsMetric('estimasi')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${ (vpsMetric === 'estimasi') ? 'bg-blue-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200' }`}>
                                  Estimasi
                                </button>
                                <button onClick={() => setVpsMetric('realisasi')} className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 ${ (vpsMetric === 'realisasi') ? 'bg-green-600 text-white shadow-md' : 'text-gray-600 hover:bg-gray-200' }`}>
                                  Realisasi
                                </button>
                              </div>
                            );
                          })()}
                          <button
                            onClick={handleExportPDF}
                            disabled={exporting}
                            className={`px-3 py-2 rounded-md text-sm font-medium transition-all duration-200 border border-blue-300 ${exporting ? 'bg-gray-200 text-gray-500 cursor-not-allowed' : 'bg-white text-blue-700 hover:bg-blue-50'}`}
                            title="Export chart as PDF"
                          >
                            Export PDF
                          </button>
                        </div>
                      </div>
                      <CardDescription className="text-gray-600 text-sm">
                        Data Estimasi & Realisasi VPS
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      {(() => {
                        const chartData = vpsMonthlyData.map(({ label, agg }) => ({
                          name: label,
                          estimasi: agg?.estimasi || 0,
                          realisasi: agg?.realisasi || 0,
                        }));

                        const selectedKey = (typeof vpsMetric !== 'undefined' ? vpsMetric : 'estimasi');
                        const total = chartData.reduce((sum, item) => sum + (item as any)[selectedKey], 0);
                        const average = Math.round(total / 12);
                        const color = selectedKey === 'estimasi' ? '#3b82f6' : '#10b981';
                        const maxSelected = Math.max(
                          0,
                          ...chartData.map((item) => Number((item as any)[selectedKey]) || 0)
                        );
                        const step = 500_000_000; // 500M step as requested
                        const minMaxTick = 1_500_000_000; // Ensure at least up to 1.5B
                        const maxTick = Math.max(minMaxTick, Math.ceil(maxSelected / step) * step);
                        const ticks = Array.from({ length: Math.floor(maxTick / step) + 1 }, (_, i) => i * step);

                        return (
                          <div>
                            <div className="vps-total-caption mb-3 text-right">
                              <div className={`vps-total-value text-sm font-medium ${selectedKey === 'estimasi' ? 'text-blue-600' : 'text-green-600'}`}>
                                Total {selectedKey === 'estimasi' ? 'Estimasi' : 'Realisasi'}: Rp {formatCurrency(total)}
                              </div>
                              <div className="vps-average-value text-xs font-medium text-gray-700">
                                Rata-Rata: Rp {average.toLocaleString('id-ID')}
                              </div>
                            </div>
                            <ResponsiveContainer width="100%" height={400}>
                              <BarChart data={chartData} margin={{ top: 20, right: 30, left: 55, bottom: 20 }}>
                                <XAxis
                                  dataKey="name"
                                  interval={0}
                                  tick={{ fontSize: 12, fill: '#374151' }}
                                />
                                <YAxis
                                  width={70}
                                  tickMargin={6}
                                  ticks={ticks}
                                  domain={[0, maxTick]}
                                  allowDecimals={false}
                                  tickFormatter={(value) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value))}
                                  fontSize={12}
                                />
                                <Tooltip
                                  formatter={(value: any) => new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value))}
                                />
                                <Bar dataKey={selectedKey} name={selectedKey === 'estimasi' ? 'Estimasi' : 'Realisasi'} fill={color} radius={[4,4,0,0]} barSize={50}>
                                  <LabelList dataKey={selectedKey} position="top" offset={10} formatter={(value: number) => `Rp ${value.toLocaleString('id-ID')}`} style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }} />
                                </Bar>
                                <ReferenceLine
                                  y={average}
                                  stroke="#2563eb"
                                  strokeDasharray="8 6"
                                  strokeWidth={2}
                                  isFront
                                />
                              </BarChart>
                            </ResponsiveContainer>
                          </div>
                        );
                      })()}
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
             <div className="flex justify-center mb-4">
                        <div className="flex items-center gap-2 bg-gray-100/50 rounded-lg p-1">
                          <button
                            onClick={() => setChartType('donut')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                              chartType === 'donut'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Donut Chart
                          </button>
                          <button
                            onClick={() => setChartType('bar')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all duration-200 ${
                              chartType === 'bar'
                                ? 'bg-blue-600 text-white shadow-md'
                                : 'text-gray-600 hover:bg-gray-200'
                            }`}
                          >
                            Bar Chart
                          </button>
                        </div>
                      </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
            {[...rekapData, ...asetDanGajiData, ...biayaBiayaData].filter((a) => a.kategori != "BIAYA").map((item: any, idx: number) => {
              const isBiaya = item.kategori === 'BIAYA';
              return (
                <div key={idx} className="relative">
                  <Card className={`border-2 border-dashed border-blue-200 bg-white backdrop-blur-sm hover:border-blue-400 transition-all duration-300 ${isBiaya ? 'lg:col-span-2' : ''}`}>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl font-bold text-gray-900">{item.kategori}</CardTitle>
                      <CardDescription className="text-gray-600 text-sm">
                        Total : <span className="font-semibold text-blue-600">{formatCurrency(item.total_kategori)}</span>
                      </CardDescription>
                    </CardHeader>
                    <CardContent>

                      {chartType === 'donut' ? (
                        <ChartDonut
                          data={
                            (item.subs || []).map((sub: any) => ({
                              name: sub.sub_kategori || sub.subKategori,
                              value: sub.total,
                            }))
                          }
                          totalKategori={item.total_kategori}
                        />
                      ) : (
                        <ChartBar
                          data={
                            (item.subs || []).map((sub: any) => ({
                              name: sub.sub_kategori || sub.subKategori,
                              value: sub.total,
                            }))
                          }
                          totalKategori={item.total_kategori}
                        />
                      )}
                    </CardContent>
                  </Card>
                  {!canViewRestrictedContent() && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-md flex items-center justify-center rounded-lg">
                      <div className="text-center">
                        <img src="/restriction.png" alt="Access Restricted" className="mx-auto mb-4" width={"130px"} />
                        <div className="text-gray-500 text-lg font-semibold mb-2">Access Restricted</div>
                        <div className="text-gray-400 text-sm">Only CORSEC and Super Admin can view this content</div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
             </div>
          </>
        )}
      </div>
    </div>
  );
}
