import { useState, useEffect, useRef } from 'react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Legend, LabelList, ReferenceLine, Line, ComposedChart } from 'recharts';
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Eye, EyeOff } from 'lucide-react';

const MONTH_OPTIONS = [
  { value: 'ALL_YEARS', label: 'Semua Tahun' },
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
const GROUPING_OPTIONS = [
  { value: 'daily', label: 'Harian' },
  { value: 'weekly', label: 'Mingguan' },
];

function getISOWeekLabel(dateStr: string): string {
  if (/^\d{4}-W\d{2}$/i.test(dateStr)) return dateStr.toUpperCase();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return dateStr;
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (isNaN(parsed.getTime())) return dateStr;
  const date = new Date(Date.UTC(parsed.getFullYear(), parsed.getMonth(), parsed.getDate()));
  const dayNum = date.getUTCDay() || 7;
  date.setUTCDate(date.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil((((date.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function normalizeDateLabelForMonthScope(params: { rawLabel: string; year: string; monthCode: string }): string {
  const { rawLabel, year, monthCode } = params;
  const label = String(rawLabel || '').trim();
  if (!label) return label;
  if (/^\d{4}-\d{2}-\d{2}$/.test(label)) return label;

  const monthNumber = {
    JAN: '01',
    FEB: '02',
    MAR: '03',
    APR: '04',
    MAY: '05',
    JUN: '06',
    JUL: '07',
    AUG: '08',
    SEP: '09',
    OCT: '10',
    NOV: '11',
    DEC: '12',
  }[monthCode] || '01';

  if (/^\d{1,2}$/.test(label)) {
    return `${year}-${monthNumber}-${label.padStart(2, '0')}`;
  }

  return label;
}

function resolveCalendarYearMonth(params: { fiscalYear: string; monthCode: string }): { year: number; month: number } {
  const { fiscalYear, monthCode } = params;
  const fy = Number(fiscalYear);
  const monthMap: Record<string, number> = {
    JAN: 1,
    FEB: 2,
    MAR: 3,
    APR: 4,
    MAY: 5,
    JUN: 6,
    JUL: 7,
    AUG: 8,
    SEP: 9,
    OCT: 10,
    NOV: 11,
    DEC: 12,
  };
  const month = monthMap[monthCode] || 1;
  const year = monthCode === 'DEC' ? fy - 1 : fy;
  return { year, month };
}

function buildMonthDateSeries(params: { fiscalYear: string; monthCode: string }): string[] {
  const { year, month } = resolveCalendarYearMonth(params);
  if (!Number.isFinite(year) || !Number.isFinite(month)) return [];
  const daysInMonth = new Date(year, month, 0).getDate();
  const pad = (n: number) => String(n).padStart(2, '0');
  return Array.from({ length: daysInMonth }, (_, i) => `${year}-${pad(month)}-${pad(i + 1)}`);
}

function extractFiscalMonthCode(label: string): string {
  const raw = String(label || '').toUpperCase();
  const match = raw.match(/(DEC|JAN|FEB|MAR|APR|MAY|JUN|JUL|AUG|SEP|OCT|NOV)/);
  return match ? match[1] : '';
}

function buildOmzetMonthlyMap(pertahunRows: any[]): Record<string, number> {
  const result: Record<string, number> = {};
  FISCAL_MONTH_ORDER.forEach((m) => {
    result[m] = 0;
  });

  const pendapatan = (pertahunRows || []).find((it: any) => it.kategori === 'PENDAPATAN');

  const pendapatanMap: Record<string, number> = {};

  (pendapatan?.data_bulanan || []).forEach((row: any) => {
    const monthCode = extractFiscalMonthCode(row?.bulan);
    if (monthCode) pendapatanMap[monthCode] = Number(row?.total || 0);
  });

  FISCAL_MONTH_ORDER.forEach((monthCode) => {
    result[monthCode] = Number(pendapatanMap[monthCode] || 0);
  });

  return result;
}

export default function DashboardV2() {
  const { user } = useAppStore();
  // Year state; start empty then set to latest fiscal year when list arrives
  const [year, setYear] = useState<string>('');
  const [month, setMonth] = useState<string>(new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase());
  const [grouping, setGrouping] = useState<'daily' | 'weekly'>('daily');
  const [chartType, setChartType] = useState<'donut' | 'bar'>('donut');
  const [vpsMetric, setVpsMetric] = useState<'estimasi' | 'realisasi'>('estimasi');
  const [showRekeningDetail, setShowRekeningDetail] = useState(false);
  const [visibleAmountKeys, setVisibleAmountKeys] = useState<Record<string, boolean>>({});
  const [exporting, setExporting] = useState<boolean>(false);
  const userSelectedYearRef = useRef(false);
  const vpsCardRef = useRef<HTMLDivElement | null>(null);
  const isAllYearsScope = month === 'ALL_YEARS';

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
    if (val === 'ANNUAL' || val === 'ALL_YEARS') {
      setGrouping('daily');
    }
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
      const url = month === 'ANNUAL' || month === 'ALL_YEARS' ? baseUrl : `${baseUrl}&bulan=${month}`;
      const response = await axiosInstance.get(url);
      return response.data;
    },
    enabled: !!year && month !== 'ALL_YEARS',
  });

  const { data: annualSelectedYearData } = useQuery({
    queryKey: ['dashboard-annual-selected-year', year],
    enabled: !!year,
    queryFn: async () => {
      const response = await axiosInstance.get(`/dashboard/rekap-aggregate?tahun=${year}`);
      return response.data;
    },
  });

  const previousYear = Number(year || 0) - 1;
  const { data: annualPreviousYearData } = useQuery({
    queryKey: ['dashboard-annual-previous-year', previousYear],
    enabled: Number.isFinite(previousYear) && previousYear > 0,
    queryFn: async () => {
      const response = await axiosInstance.get(`/dashboard/rekap-aggregate?tahun=${previousYear}`);
      return response.data;
    },
  });

  const { data: allYearsDashboardData, isLoading: isAllYearsLoading } = useQuery({
    queryKey: ['dashboard-all-years', fiscalYearsData],
    enabled: month === 'ALL_YEARS' && Array.isArray(fiscalYearsData) && fiscalYearsData.length > 0,
    queryFn: async () => {
      const years = [...fiscalYearsData].map((y: number) => String(y)).sort((a: string, b: string) => Number(a) - Number(b));
      const responses = await Promise.all(
        years.map(async (fiscalYear: string) => {
          const response = await axiosInstance.get(`/dashboard/rekap-aggregate?tahun=${fiscalYear}`);
          return { fiscalYear, data: response.data };
        })
      );
      return responses;
    },
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

  const previousFiscalYear = String((parseInt(year || '0', 10) || new Date().getFullYear()) - 1);
  const { data: previousSubscriberCombinedData } = useQuery({
    queryKey: ['subscriber-combined-previous', previousFiscalYear],
    queryFn: () => fetchSubscriberCombined(previousFiscalYear),
    enabled: !!year && !isAllYearsScope,
  });

  // Query untuk subscriber by program
  const { data: subscriberByProgramData, isLoading: isSubscriberByProgramLoading } = useQuery({
    queryKey: ['subscriber-by-program', year, month],
    queryFn: () => fetchSubscriberByProgram(year, month),
    enabled: !!year && month !== 'ALL_YEARS',
  });

  // Query untuk pendapatan harian (jika bulan tidak ANNUAL)
  const { data: pendapatanHarianData } = useQuery({
    queryKey: ['pendapatan-harian', year, month, grouping],
    queryFn: async () => {
      const response = await axiosInstance.get(`/dashboard/pendapatan-harian?tahun=${year}&bulan=${month}`);
      return response.data;
    },
    enabled: !!year && month !== 'ANNUAL' && month !== 'ALL_YEARS',
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

  const subscriberGrowthComparisonData = FISCAL_MONTH_ORDER.map((bulanCode) => {
    const current = (subscriberCombinedData || []).find((item: any) => item.bulan === bulanCode);
    const previous = (previousSubscriberCombinedData || []).find((item: any) => item.bulan === bulanCode);
    return {
      bulan: bulanCode,
      current: Number(current?.count || 0),
      previous: Number(previous?.count || 0),
    };
  });
  const hasSubscriberGrowthComparison = subscriberGrowthComparisonData.some((item) => item.current || item.previous);
  const subscriberByProgramTotalCost = (subscriberByProgramData || []).reduce(
    (sum: number, item: any) => sum + Number(item?.total_biaya || 0),
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

  const shouldUseWeeklyGrouping = month !== 'ANNUAL' && month !== 'ALL_YEARS' && grouping === 'weekly';
  const shouldPadDailyMonthScope = month !== 'ANNUAL' && month !== 'ALL_YEARS';
  const monthDateSeries = shouldPadDailyMonthScope ? buildMonthDateSeries({ fiscalYear: year, monthCode: month }) : [];

  const buildRelativeWeekLabelMap = (weekKeys: string[]) => {
    const sorted = [...weekKeys].sort();
    const map = new Map<string, string>();
    sorted.forEach((key, idx) => {
      map.set(key, `W${idx + 1}`);
    });
    return { sorted, map };
  };

  const groupLineDataByWeek = (rows: Array<{ bulan: string; nominal: number }>) => {
    const weekMap: Record<string, number> = {};
    rows.forEach((row) => {
      const weekLabel = getISOWeekLabel(row.bulan);
      weekMap[weekLabel] = (weekMap[weekLabel] || 0) + Number(row.nominal || 0);
    });
    const { sorted, map } = buildRelativeWeekLabelMap(Object.keys(weekMap));
    return sorted.map((label) => ({ bulan: map.get(label) || label, nominal: weekMap[label] }));
  };

  const groupStackedDataByWeek = (rows: Array<{ kategori: string; subs: Array<{ name: string; total: number }> }>) => {
    const map: Record<string, Record<string, number>> = {};
    rows.forEach((row) => {
      const weekLabel = getISOWeekLabel(row.kategori);
      map[weekLabel] = map[weekLabel] || {};
      (row.subs || []).forEach((sub) => {
        map[weekLabel][sub.name] = (map[weekLabel][sub.name] || 0) + Number(sub.total || 0);
      });
    });
    const { sorted, map: weekLabelMap } = buildRelativeWeekLabelMap(Object.keys(map));
    return sorted
      .map((weekLabel) => ({
        kategori: weekLabelMap.get(weekLabel) || weekLabel,
        subs: Object.keys(map[weekLabel]).map((name) => ({ name, total: map[weekLabel][name] })),
      }));
  };

  const fillMissingDailyLineRows = (rows: Array<{ bulan: string; nominal: number }>) => {
    if (!shouldPadDailyMonthScope || monthDateSeries.length === 0) return rows;
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const normalized = normalizeDateLabelForMonthScope({ rawLabel: row.bulan, year, monthCode: month });
      map.set(normalized, (map.get(normalized) || 0) + Number(row.nominal || 0));
    });
    const lastActiveIndex = (() => {
      for (let i = monthDateSeries.length - 1; i >= 0; i -= 1) {
        const value = map.get(monthDateSeries[i]) || 0;
        if (Math.abs(value) > 0) return i;
      }
      return 0;
    })();
    const effectiveSeries = monthDateSeries.slice(0, lastActiveIndex + 1);
    return effectiveSeries.map((date) => ({
      bulan: date,
      nominal: map.get(date) || 0,
    }));
  };

  const fillMissingDailyStackedRows = (
    rows: Array<{ kategori: string; subs: Array<{ name: string; total: number }> }>
  ) => {
    if (!shouldPadDailyMonthScope || monthDateSeries.length === 0) return rows;
    const subNames = Array.from(
      new Set(
        rows.flatMap((row) => (row.subs || []).map((sub) => sub.name)).filter(Boolean)
      )
    );
    const rowMap = new Map<string, Record<string, number>>();
    rows.forEach((row) => {
      const normalized = normalizeDateLabelForMonthScope({ rawLabel: row.kategori, year, monthCode: month });
      const existing = rowMap.get(normalized) || {};
      (row.subs || []).forEach((sub) => {
        existing[sub.name] = (existing[sub.name] || 0) + Number(sub.total || 0);
      });
      rowMap.set(normalized, existing);
    });
    const lastActiveIndex = (() => {
      for (let i = monthDateSeries.length - 1; i >= 0; i -= 1) {
        const date = monthDateSeries[i];
        const values = rowMap.get(date) || {};
        const dayTotal = subNames.reduce((sum, name) => sum + Math.abs(values[name] || 0), 0);
        if (dayTotal > 0) return i;
      }
      return 0;
    })();
    const effectiveSeries = monthDateSeries.slice(0, lastActiveIndex + 1);
    return effectiveSeries.map((date) => {
      const values = rowMap.get(date) || {};
      return {
        kategori: date,
        subs: subNames.map((name) => ({ name, total: values[name] || 0 })),
      };
    });
  };

  const allYearsFinancialData = (() => {
    if (!isAllYearsScope || !allYearsDashboardData) return null;
    const rows = [...allYearsDashboardData].sort((a: any, b: any) => Number(a.fiscalYear) - Number(b.fiscalYear));
    const pembelianLine = rows.map((entry: any) => {
      const pembelian = (entry?.data?.pertahun || []).find((it: any) => it.kategori === 'PEMBELIAN');
      return { bulan: String(entry.fiscalYear), nominal: Number(pembelian?.total_tahunan || 0) };
    });
    const grossMarginLine = rows.map((entry: any) => ({
      bulan: String(entry.fiscalYear),
      nominal: Number((entry?.data?.grossMarginTahunan || []).reduce((sum: number, it: any) => sum + Number(it.gross_margin || 0), 0)),
    }));
    const buildStack = (selector: string) =>
      rows.map((entry: any) => ({
        kategori: String(entry.fiscalYear),
        subs: (entry?.data?.[selector] || []).map((it: any) => ({
          name: it.group || it.sub_kategori,
          total: Number(it.total_tahunan || 0),
        })),
      }));
    return {
      pembelianLine,
      grossMarginLine,
      asetGaji: buildStack('asetDanGajiTahunan'),
      implementasi: buildStack('implementasiMarketingLainnyaTahunan'),
      biayaBiaya: buildStack('biayaBiayaTahunan'),
    };
  })();

  // Data untuk pendapatan harian chart
  const pendapatanHarianChartData = (() => {
    if (!pendapatanHarianData || month === 'ANNUAL' || month === 'ALL_YEARS') return [];
    const hariMap: { [hari: string]: { [key: string]: number } } = {};
    const subKategories: string[] = [];
    pendapatanHarianData.forEach((item: any) => {
      if (!subKategories.includes(item.sub_kategori)) subKategories.push(item.sub_kategori);
      if (!hariMap[item.hari]) hariMap[item.hari] = {};
      hariMap[item.hari][item.sub_kategori] = item.total;
    });
    const dailyRows = Object.keys(hariMap).map((hari) => ({
      kategori: hari,
      subs: subKategories.map((sub) => ({
        name: sub,
        total: hariMap[hari][sub] || 0
      }))
    }));
    const paddedRows = fillMissingDailyStackedRows(dailyRows);
    if (!shouldUseWeeklyGrouping) return paddedRows;
    return groupStackedDataByWeek(paddedRows);
  })();

  // Data untuk line chart kategori PEMBELIAN
  const pembelianData = pertahunData.find((item: any) => item.kategori === 'PEMBELIAN');
  const pembelianLineData = isAllYearsScope
    ? (allYearsFinancialData?.pembelianLine || [])
    : (() => {
        const rawRows = (pembelianData?.data_bulanan || []).map((bulanData: any) => ({
          bulan: bulanData.bulan,
          nominal: bulanData.total
        }));
        const paddedRows = fillMissingDailyLineRows(rawRows);
        return shouldUseWeeklyGrouping ? groupLineDataByWeek(paddedRows) : paddedRows;
      })();

  // Data untuk stacked bar aset dan gaji tahunan
  const asetDanGajiTahunanChartData = (() => {
    if (isAllYearsScope) return allYearsFinancialData?.asetGaji || [];
    const bulanMap: { [bulan: string]: { ASET: number; GAJI: number } } = {};
    asetDanGajiTahunanData.forEach((group: any) => {
      group.data_bulanan.forEach((b: any) => {
        if (!bulanMap[b.bulan]) bulanMap[b.bulan] = { ASET: 0, GAJI: 0 };
        bulanMap[b.bulan][group.group] = b.total;
      });
    });
    const dailyRows = Object.keys(bulanMap).map((bulan) => ({
      kategori: bulan,
      subs: [
        { name: "ASET", total: bulanMap[bulan].ASET },
        { name: "GAJI", total: bulanMap[bulan].GAJI }
      ]
    }));
    const paddedRows = fillMissingDailyStackedRows(dailyRows);
    return shouldUseWeeklyGrouping ? groupStackedDataByWeek(paddedRows) : paddedRows;
  })();

  // Data untuk stacked bar biaya lain tahunan
  const implementasiMarketingLainnyaTahunanChartData = (() => {
    if (isAllYearsScope) return allYearsFinancialData?.implementasi || [];
    const bulanMap: { [bulan: string]: { [key: string]: number } } = {};
    const subKategories: string[] = [];
    implementasiMarketingLainnyaTahunanData.forEach((item: any) => {
      if (!subKategories.includes(item.sub_kategori)) subKategories.push(item.sub_kategori);
      item.data_bulanan.forEach((b: any) => {
        if (!bulanMap[b.bulan]) bulanMap[b.bulan] = {};
        bulanMap[b.bulan][item.sub_kategori] = b.total;
      });
    });
    const dailyRows = Object.keys(bulanMap).map((bulan) => ({
      kategori: bulan,
      subs: subKategories.map((sub) => ({
        name: sub,
        total: bulanMap[bulan][sub] || 0
      }))
    }));
    const paddedRows = fillMissingDailyStackedRows(dailyRows);
    return shouldUseWeeklyGrouping ? groupStackedDataByWeek(paddedRows) : paddedRows;
  })();

  // Data untuk stacked bar biaya biaya tahunan
  const biayaBiayaTahunanChartData = (() => {
    if (isAllYearsScope) return allYearsFinancialData?.biayaBiaya || [];
    const bulanMap: { [bulan: string]: { [key: string]: number } } = {};
    const subKategories: string[] = [];
    biayaBiayaTahunanData.forEach((item: any) => {
      if (!subKategories.includes(item.sub_kategori)) subKategories.push(item.sub_kategori);
      item.data_bulanan.forEach((b: any) => {
        if (!bulanMap[b.bulan]) bulanMap[b.bulan] = {};
        bulanMap[b.bulan][item.sub_kategori] = b.total;
      });
    });
    const dailyRows = Object.keys(bulanMap).map((bulan) => ({
      kategori: bulan,
      subs: subKategories.map((sub) => ({
        name: sub,
        total: bulanMap[bulan][sub] || 0
      }))
    }));
    const paddedRows = fillMissingDailyStackedRows(dailyRows);
    return shouldUseWeeklyGrouping ? groupStackedDataByWeek(paddedRows) : paddedRows;
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
  const grossMarginTahunanLineData = isAllYearsScope
    ? (allYearsFinancialData?.grossMarginLine || [])
    : (() => {
        const rawRows = grossMarginTahunanData.map((bulanData: any) => ({
          bulan: bulanData.bulan,
          nominal: bulanData.gross_margin
        }));
        const paddedRows = fillMissingDailyLineRows(rawRows);
        return shouldUseWeeklyGrouping ? groupLineDataByWeek(paddedRows) : paddedRows;
      })();

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
  const maskCurrency = () => 'Rp ••••••••••';
  const isAmountVisible = (key: string) => !!visibleAmountKeys[key];
  const toggleAmountVisibility = (key: string) => {
    setVisibleAmountKeys((prev) => ({ ...prev, [key]: !prev[key] }));
  };
  const renderCurrencyWithToggle = (
    value: number,
    amountKey: string,
    options?: { className?: string; valueClassName?: string; buttonClassName?: string }
  ) => (
    <div className={options?.className || 'flex items-center gap-2'}>
      <span className={options?.valueClassName}>
        {isAmountVisible(amountKey) ? formatCurrency(value) : maskCurrency()}
      </span>
      <button
        type="button"
        onClick={() => toggleAmountVisibility(amountKey)}
        className={options?.buttonClassName || 'inline-flex h-7 w-7 items-center justify-center rounded-md border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors'}
        title={isAmountVisible(amountKey) ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
        aria-label={isAmountVisible(amountKey) ? 'Sembunyikan nominal' : 'Tampilkan nominal'}
      >
        {isAmountVisible(amountKey) ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
  const renderCompactCurrencyWithToggle = (value: number, amountKey: string, valueClassName = 'font-semibold text-blue-600') =>
    renderCurrencyWithToggle(value, amountKey, {
      className: 'inline-flex items-center gap-1.5',
      valueClassName,
      buttonClassName:
        'inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors',
    });
  const penjualanTotal = Number(pertahunData.find((it: any) => it.kategori === 'PENDAPATAN')?.total_tahunan || 0);
  const pembelianTotal = Number(pertahunData.find((it: any) => it.kategori === 'PEMBELIAN')?.total_tahunan || 0);
  const biayaTotal = Number(pertahunData.find((it: any) => it.kategori === 'BIAYA')?.total_tahunan || 0);
  const dashboardCardClass = 'border border-slate-200 bg-white shadow-sm';
  const categoryCardsData = [...rekapData, ...asetDanGajiData, ...biayaBiayaData].filter((a) => a.kategori != "BIAYA");
  const omzetSelectedYearMonthlyMap = buildOmzetMonthlyMap(annualSelectedYearData?.pertahun || []);
  const omzetPrevYearMonthlyMap = buildOmzetMonthlyMap(annualPreviousYearData?.pertahun || []);
  const omzetYtdChartData = FISCAL_MONTH_ORDER.map((monthCode) => ({
    bulan: `${monthCode}-${String((monthCode === 'DEC' ? previousYear : Number(year || 0)) % 100).padStart(2, '0')}`,
    prevYearOmzet: Number(omzetPrevYearMonthlyMap[monthCode] || 0),
    currentYearOmzet: Number(omzetSelectedYearMonthlyMap[monthCode] || 0),
  })).map((row) => ({
    ...row,
    growthPercent: row.prevYearOmzet > 0 ? (row.currentYearOmzet / row.prevYearOmzet) * 100 : 0,
  }));
  const omzetPrevTotal = omzetYtdChartData.reduce((sum, row) => sum + Number(row.prevYearOmzet || 0), 0);
  const omzetCurrentTotal = omzetYtdChartData.reduce((sum, row) => sum + Number(row.currentYearOmzet || 0), 0);
  const jakartaNow = new Date(new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date()));
  const currentMonthNumber = Math.max(1, Math.min(12, jakartaNow.getMonth() + 1));
  const omzetPrevAverage = omzetPrevTotal / 12;
  const omzetCurrentAverage = omzetCurrentTotal / currentMonthNumber;
  const allAmountKeys = [
    'kpi-total-saldo',
    'kpi-penjualan',
    'kpi-pembelian',
    'kpi-biaya',
    ...subscriberChartData.flatMap((_: any, idx: number) => [
      `subscriber-program-total-${idx}`,
      `subscriber-program-avg-${idx}`,
    ]),
    'vps-total-estimasi',
    'vps-total-realisasi',
    'vps-average',
    'vps-bar-labels',
    'line-margin-total',
    'line-pembelian-total',
    'omzet-ytd-total-prev',
    'omzet-ytd-total-current',
    'omzet-ytd-avg-prev',
    'omzet-ytd-avg-current',
    'stacked-avg-pendapatan',
    'stacked-avg-aset',
    'stacked-avg-implementasi',
    'stacked-avg-biaya',
    ...categoryCardsData.map((item: any, idx: number) => `kategori-total-${item.kategori}-${idx}`),
  ];
  const areAllNominalsVisible = allAmountKeys.every((key) => !!visibleAmountKeys[key]);
  const toggleAllNominals = () => {
    if (areAllNominalsVisible) {
      const next: Record<string, boolean> = {};
      allAmountKeys.forEach((key) => {
        next[key] = false;
      });
      setVisibleAmountKeys(next);
      return;
    }
    const next: Record<string, boolean> = {};
    allAmountKeys.forEach((key) => {
      next[key] = true;
    });
    setVisibleAmountKeys(next);
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
              Financial Dashboard V2
            </h1>
            <p className="text-gray-600 mt-2">Baseline dashboard + floating filter + grouping mingguan + semua tahun</p>
          </div>
        </div>

        <div className="fixed bottom-6 right-6 z-40 left-6 md:left-auto md:w-auto">
          <Card className={`${dashboardCardClass} bg-white/95 backdrop-blur-md shadow-xl`}>
            <CardContent className="py-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="min-w-[220px]">
                  <label className="text-xs font-semibold text-slate-600 mb-1 block">Bulan/Scope</label>
                  <Select value={month} onValueChange={handleMonthChange}>
                    <SelectTrigger className="h-10 bg-white border-slate-300">
                      <SelectValue placeholder="Pilih Bulan" />
                    </SelectTrigger>
                    <SelectContent className="bg-white border-slate-200 shadow-xl">
                      {MONTH_OPTIONS.map((monthOption) => (
                        <SelectItem key={monthOption.value} value={monthOption.value}>
                          {monthOption.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {month !== 'ALL_YEARS' && (
                  <div className="min-w-[140px]">
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Tahun</label>
                    <Select value={year} onValueChange={handleYearChange}>
                      <SelectTrigger className="h-10 bg-white border-slate-300">
                        <SelectValue placeholder="Tahun" />
                      </SelectTrigger>
                      <SelectContent className="max-h-56 overflow-y-auto bg-white border-slate-200 shadow-xl">
                        {isYearsLoading ? (
                          <SelectItem value={year || 'loading'}>{year || 'Loading...'}</SelectItem>
                        ) : (
                          fiscalYearsData?.map((th: number) => (
                            <SelectItem key={th} value={th.toString()}>{th}</SelectItem>
                          ))
                        )}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {month !== 'ANNUAL' && month !== 'ALL_YEARS' && (
                  <div className="min-w-[160px]">
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Grouping</label>
                    <Select value={grouping} onValueChange={(value) => setGrouping(value as 'daily' | 'weekly')}>
                      <SelectTrigger className="h-10 bg-white border-slate-300">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="bg-white border-slate-200 shadow-xl">
                        {GROUPING_OPTIONS.map((option) => (
                          <SelectItem key={option.value} value={option.value}>
                            {option.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setMonth(new Date().toLocaleString('en-US', { month: 'short' }).toUpperCase());
                    setGrouping('daily');
                  }}
                  className="h-10 px-4 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  Reset
                </button>
                <button
                  type="button"
                  onClick={toggleAllNominals}
                  className="h-10 px-4 rounded-md border border-slate-300 text-sm font-medium text-slate-700 hover:bg-slate-100 transition-colors"
                >
                  {areAllNominalsVisible ? 'Sembunyikan Semua Nominal' : 'Tampilkan Semua Nominal'}
                </button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className={dashboardCardClass}>
            <CardContent className="p-5">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Total Saldo Rekening</p>
              <div className="mt-2">
                {renderCurrencyWithToggle(totalAkumulasiSaldoRekening, 'kpi-total-saldo', {
                  valueClassName: 'text-2xl font-bold text-emerald-700',
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Rekening aktif: {rekeningDashboardList.length}</p>
              <button
                type="button"
                onClick={() => setShowRekeningDetail(true)}
                className="mt-3 inline-flex items-center rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 hover:bg-emerald-100 transition-colors"
              >
                Lihat Detail
              </button>
            </CardContent>
          </Card>
          <Card className={dashboardCardClass}>
            <CardContent className="p-5">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Penjualan</p>
              <div className="mt-2">
                {renderCurrencyWithToggle(penjualanTotal, 'kpi-penjualan', {
                  valueClassName: 'text-2xl font-bold text-slate-900',
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Periode aktif</p>
            </CardContent>
          </Card>
          <Card className={dashboardCardClass}>
            <CardContent className="p-5">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Pembelian</p>
              <div className="mt-2">
                {renderCurrencyWithToggle(pembelianTotal, 'kpi-pembelian', {
                  valueClassName: 'text-2xl font-bold text-slate-900',
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Periode aktif</p>
            </CardContent>
          </Card>
          <Card className={dashboardCardClass}>
            <CardContent className="p-5">
              <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">Biaya</p>
              <div className="mt-2">
                {renderCurrencyWithToggle(biayaTotal, 'kpi-biaya', {
                  valueClassName: 'text-2xl font-bold text-slate-900',
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1">Periode aktif</p>
            </CardContent>
          </Card>
        </div>

        <Dialog open={showRekeningDetail} onOpenChange={setShowRekeningDetail}>
          <DialogContent className="sm:max-w-5xl">
            <DialogHeader>
              <DialogTitle>Detail Saldo Rekening Aktif</DialogTitle>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-auto rounded-lg border border-slate-200">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 sticky top-0">
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
                        <td className="px-3 py-2 text-right font-medium">
                          {isAmountVisible('kpi-total-saldo') ? formatCurrency(Number(rekening.saldo || 0)) : maskCurrency()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </DialogContent>
        </Dialog>

        {(month === 'ALL_YEARS' ? isAllYearsLoading : isLoading) ? (
          <div className="h-[400px] flex items-center justify-center">
            <Card className={`w-full max-w-md ${dashboardCardClass}`}>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-gray-600 font-medium">Loading dashboard data...</p>
              </CardContent>
            </Card>
          </div>
        ) : rekapData.length === 0 && asetDanGajiData.length === 0 && biayaBiayaData.length === 0 && pertahunData.length === 0 && pembelianLineData.length === 0 && asetDanGajiTahunanChartData.length === 0 && implementasiMarketingLainnyaTahunanChartData.length === 0 && biayaBiayaTahunanChartData.length === 0 && grossMarginTahunanLineData.length === 0 && subscriberChartData.length === 0 ? (
          <Card className={dashboardCardClass}>
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

            <div className="space-y-1">
              <h2 className="text-xl font-semibold text-slate-900">Revenue & Expense Breakdown</h2>
              <p className="text-sm text-slate-500">Ringkasan chart finansial berdasarkan filter periode aktif.</p>
            </div>
            {/* Stacked bar chart untuk Pendapatan per hari (jika bulan tidak ANNUAL) */}
            {pendapatanHarianChartData.length > 0 && month !== 'ANNUAL' && (
              <div className="mb-8">
                <div className="relative">
                  <Card className={dashboardCardClass}>
                    <CardContent className='pt-6'>
                      <StackedBarKategori
                        data={pendapatanHarianChartData}
                        title={`Penjualan ${shouldUseWeeklyGrouping ? 'Weekly' : 'Daily'} Breakdown - ${month} ${year}`}
                        description={`${shouldUseWeeklyGrouping ? 'Weekly' : 'Daily'} breakdown of income transactions by subcategory`}
                        showAverageNominal={isAmountVisible('stacked-avg-pendapatan')}
                        onToggleAverageNominal={() => toggleAmountVisibility('stacked-avg-pendapatan')}
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
            {month === 'ANNUAL' && omzetYtdChartData.length > 0 && Number.isFinite(previousYear) && previousYear > 0 && (
              <div className="mb-8">
                <Card className={dashboardCardClass}>
                  <CardHeader>
                    <CardTitle className="text-2xl font-bold text-gray-900">Omzet Year To Date</CardTitle>
                    <CardDescription className="text-gray-600">
                      Perbandingan pendapatan fiscal ({previousYear} vs {year}) + persentase pertumbuhan bulanan
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
                      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                        <div className="text-xs font-semibold text-blue-700">TOTAL {previousYear}</div>
                        {renderCompactCurrencyWithToggle(omzetPrevTotal, 'omzet-ytd-total-prev', 'text-sm font-bold text-blue-800')}
                      </div>
                      <div className="rounded-lg border border-orange-100 bg-orange-50/70 p-3">
                        <div className="text-xs font-semibold text-orange-700">TOTAL {year}</div>
                        {renderCompactCurrencyWithToggle(omzetCurrentTotal, 'omzet-ytd-total-current', 'text-sm font-bold text-orange-800')}
                      </div>
                      <div className="rounded-lg border border-blue-100 bg-blue-50/60 p-3">
                        <div className="text-xs font-semibold text-blue-700">RATA-RATA/BULAN {previousYear}</div>
                        {renderCompactCurrencyWithToggle(omzetPrevAverage, 'omzet-ytd-avg-prev', 'text-sm font-bold text-blue-800')}
                      </div>
                      <div className="rounded-lg border border-orange-100 bg-orange-50/70 p-3">
                        <div className="text-xs font-semibold text-orange-700">RATA-RATA/BULAN {year}</div>
                        {renderCompactCurrencyWithToggle(omzetCurrentAverage, 'omzet-ytd-avg-current', 'text-sm font-bold text-orange-800')}
                      </div>
                    </div>
                    <div className="w-full h-[420px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={omzetYtdChartData} margin={{ top: 16, right: 18, left: 4, bottom: 8 }}>
                          <XAxis dataKey="bulan" />
                          <YAxis tickFormatter={(value) => formatCurrency(Number(value || 0))} width={120} />
                          <YAxis
                            yAxisId="percent"
                            orientation="right"
                            domain={[0, 200]}
                            tickFormatter={(value) => `${Number(value || 0).toFixed(0)}%`}
                            width={55}
                          />
                          <Tooltip
                            formatter={(value: any, name: string) => {
                              if (name === 'growthPercent') {
                                return [`${Number(value || 0).toFixed(1)}%`, 'Pertumbuhan'];
                              }
                              const label = name === 'prevYearOmzet' ? `${previousYear}` : `${year}`;
                              return [formatCurrency(Number(value || 0)), `Pendapatan ${label}`];
                            }}
                          />
                          <Legend
                            formatter={(value: any) => {
                              if (value === 'prevYearOmzet') return `Tahun ${previousYear}`;
                              if (value === 'currentYearOmzet') return `Tahun ${year}`;
                              if (value === 'growthPercent') return 'Growth %';
                              return value;
                            }}
                          />
                          <ReferenceLine y={omzetPrevAverage} stroke="#2563eb" strokeDasharray="6 5" />
                          <ReferenceLine y={omzetCurrentAverage} stroke="#f97316" strokeDasharray="6 5" />
                          <Bar dataKey="prevYearOmzet" fill="#1d4ed8" name="prevYearOmzet" radius={[4, 4, 0, 0]} />
                          <Bar dataKey="currentYearOmzet" fill="#f97316" name="currentYearOmzet" radius={[4, 4, 0, 0]} />
                          <Line
                            yAxisId="percent"
                            type="monotone"
                            dataKey="growthPercent"
                            stroke="#16a34a"
                            strokeWidth={2}
                            dot={{ r: 3 }}
                            name="growthPercent"
                          />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                    <div className="mt-4 rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                      <div className="text-xs font-semibold text-slate-600 mb-2">Persentase Pertumbuhan Bulanan</div>
                      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2">
                        {omzetYtdChartData.map((row) => {
                          const growth = Number(row.growthPercent || 0);
                          const isPositive = growth >= 100;
                          return (
                            <div key={`growth-ledger-${row.bulan}`} className="flex items-center justify-between rounded-md border border-slate-200 bg-white px-2 py-1.5 text-xs">
                              <span className="font-medium text-slate-700">{row.bulan}</span>
                              <span className={isPositive ? 'font-semibold text-emerald-600' : 'font-semibold text-rose-600'}>
                                {growth.toFixed(1)}%
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}

            {/* Line chart untuk Margin per bulan */}
            {grossMarginTahunanLineData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className={dashboardCardClass}>
                    <CardContent className='pt-6'>
                      <LineChartKategori
                        data={grossMarginTahunanLineData}
                        title={`Margin - ${isAllYearsScope ? 'Semua Tahun' : year}`}
                        description={isAllYearsScope ? 'Yearly gross margin trend (Omzet - Biaya - Pembelian)' : `${shouldUseWeeklyGrouping ? 'Weekly' : month === 'ANNUAL' ? 'Monthly' : 'Daily'} gross margin trend (Omzet - Biaya - Pembelian)`}
                        showNominal={isAmountVisible('line-margin-total')}
                        onToggleNominal={() => toggleAmountVisibility('line-margin-total')}
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
                  <Card className={dashboardCardClass}>
                    <CardContent className='pt-6'>
                      <LineChartKategori
                        data={pembelianLineData}
                        title={`PEMBELIAN ${isAllYearsScope ? 'Yearly' : shouldUseWeeklyGrouping ? 'Weekly' : month === 'ANNUAL' ? 'Monthly' : 'Daily'} Trend - ${isAllYearsScope ? 'Semua Tahun' : year}`}
                        description={isAllYearsScope ? 'Yearly purchasing trend across all fiscal years' : `${shouldUseWeeklyGrouping ? 'Weekly' : month === 'ANNUAL' ? 'Monthly' : 'Daily'} purchasing trend`}
                        showNominal={isAmountVisible('line-pembelian-total')}
                        onToggleNominal={() => toggleAmountVisibility('line-pembelian-total')}
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
                  <Card className={dashboardCardClass}>
                    <CardContent className='pt-6'>
                      <StackedBarKategori
                        data={asetDanGajiTahunanChartData}
                        title={`Aset dan Gaji ${isAllYearsScope ? 'Yearly' : shouldUseWeeklyGrouping ? 'Weekly' : month === 'ANNUAL' ? 'Monthly' : 'Daily'} Breakdown`}
                        description={`${isAllYearsScope ? 'Yearly' : shouldUseWeeklyGrouping ? 'Weekly' : month === 'ANNUAL' ? 'Monthly' : 'Daily'} comparison of assets and salary expenses`}
                        showAverageNominal={isAmountVisible('stacked-avg-aset')}
                        onToggleAverageNominal={() => toggleAmountVisibility('stacked-avg-aset')}
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
                  <Card className={dashboardCardClass}>
                    <CardContent className='pt-6'>
                      <StackedBarKategori
                        data={implementasiMarketingLainnyaTahunanChartData}
                        title={`Implementasi, Marketing & Lainnya ${isAllYearsScope ? 'Yearly' : shouldUseWeeklyGrouping ? 'Weekly' : month === 'ANNUAL' ? 'Monthly' : 'Daily'} Breakdown`}
                        description={`${isAllYearsScope ? 'Yearly' : shouldUseWeeklyGrouping ? 'Weekly' : month === 'ANNUAL' ? 'Monthly' : 'Daily'} breakdown of implementation, marketing, and other expenses`}
                        showAverageNominal={isAmountVisible('stacked-avg-implementasi')}
                        onToggleAverageNominal={() => toggleAmountVisibility('stacked-avg-implementasi')}
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
                  <Card className={dashboardCardClass}>
                    <CardContent className='pt-6'>
                      <StackedBarKategori
                        data={biayaBiayaTahunanChartData}
                        title={`Biaya Biaya ${isAllYearsScope ? 'Yearly' : shouldUseWeeklyGrouping ? 'Weekly' : month === 'ANNUAL' ? 'Monthly' : 'Daily'} Breakdown`}
                        description={`${isAllYearsScope ? 'Yearly' : shouldUseWeeklyGrouping ? 'Weekly' : month === 'ANNUAL' ? 'Monthly' : 'Daily'} breakdown of PPH21, VPS, RND, BPJS, and return sales expenses`}
                        showAverageNominal={isAmountVisible('stacked-avg-biaya')}
                        onToggleAverageNominal={() => toggleAmountVisibility('stacked-avg-biaya')}
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
                  <Card className={dashboardCardClass}>
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
                                {renderCompactCurrencyWithToggle(
                                  Number(program.total_biaya_tahunan || 0),
                                  `subscriber-program-total-${idx}`,
                                  'font-bold text-cyan-900'
                                )}
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-sm text-cyan-700">Avg Cost/Subscriber:</span>
                                {renderCompactCurrencyWithToggle(
                                  Number(program.total_subscriber_tahunan || 0) > 0
                                    ? Number(program.total_biaya_tahunan || 0) / Number(program.total_subscriber_tahunan || 1)
                                    : 0,
                                  `subscriber-program-avg-${idx}`,
                                  'font-bold text-cyan-900'
                                )}
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
            {!isAllYearsScope && subscriberCombinedData && subscriberCombinedData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className={dashboardCardClass}>
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
            {!isAllYearsScope && subscriberByProgramData && subscriberByProgramData.length > 0 && (
              <div className="mb-8">
                <div className="relative">
                  <Card className={dashboardCardClass}>
                    <CardHeader className="pb-4">
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-2xl font-bold text-gray-900">Subscriber by Program</CardTitle>
                        <div className="flex flex-col items-end gap-1 text-sm">
                          <span className="font-semibold text-blue-600">
                            Total Subscribers: {subscriberByProgramData.reduce((sum, item) => sum + item.total_subscriber, 0).toLocaleString('id-ID')}
                          </span>
                          <span className="font-semibold text-emerald-700">
                            Total Subscriber Cost: {formatCurrency(subscriberByProgramTotalCost)}
                          </span>
                        </div>
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

            {!isAllYearsScope && hasSubscriberGrowthComparison && (
              <div className="mb-8">
                <div className="relative">
                  <Card className={dashboardCardClass}>
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
                        <BarChart data={subscriberGrowthComparisonData} margin={{ top: 26, right: 30, left: 20, bottom: 20 }}>
                          <XAxis dataKey="bulan" interval={0} tick={{ fontSize: 12, fill: '#374151', fontWeight: 600 }} />
                          <YAxis tickFormatter={(value) => Number(value || 0).toLocaleString('id-ID')} fontSize={12} allowDecimals={false} />
                          <Tooltip formatter={(value: any, name: string) => [Number(value || 0).toLocaleString('id-ID'), name === 'current' ? `Growth ${year}` : `Growth ${previousFiscalYear}`]} />
                          <Legend formatter={(value) => value === 'current' ? `Growth ${year}` : `Growth ${previousFiscalYear}`} />
                          <Bar dataKey="previous" name={`Growth ${previousFiscalYear}`} fill="#94a3b8" radius={[4, 4, 0, 0]} barSize={28}>
                            <LabelList
                              dataKey="previous"
                              position="top"
                              offset={8}
                              formatter={(value: number) => Number(value || 0).toLocaleString('id-ID')}
                              style={{ fontSize: 10, fill: '#475569', fontWeight: 700, textShadow: '0 1px 2px rgba(255,255,255,0.9)' }}
                            />
                          </Bar>
                          <Bar dataKey="current" name={`Growth ${year}`} fill="#2563eb" radius={[4, 4, 0, 0]} barSize={28}>
                            <LabelList
                              dataKey="current"
                              position="top"
                              offset={8}
                              formatter={(value: number) => Number(value || 0).toLocaleString('id-ID')}
                              style={{ fontSize: 10, fill: '#1d4ed8', fontWeight: 700, textShadow: '0 1px 2px rgba(255,255,255,0.9)' }}
                            />
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
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

            {!isAllYearsScope && vpsMonthlyData && vpsMonthlyData.length > 0 && (
              <div className="mb-8" ref={vpsCardRef}>
                <div className="relative">
                  <Card className={`vps-card ${dashboardCardClass}`}>
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
                              <div className={`vps-total-value text-sm font-medium ${selectedKey === 'estimasi' ? 'text-blue-600' : 'text-green-600'} flex items-center justify-end`}>
                                <span className="mr-1">Total {selectedKey === 'estimasi' ? 'Estimasi' : 'Realisasi'}:</span>
                                {renderCompactCurrencyWithToggle(
                                  total,
                                  `vps-total-${selectedKey}`,
                                  `font-medium ${selectedKey === 'estimasi' ? 'text-blue-600' : 'text-green-600'}`
                                )}
                              </div>
                              <div className="vps-average-value text-xs font-medium text-gray-700 flex items-center justify-end">
                                <span className="mr-1">Rata-Rata:</span>
                                {renderCompactCurrencyWithToggle(average, 'vps-average', 'font-medium text-gray-700')}
                              </div>
                              <div className="mt-1 inline-flex items-center justify-end gap-2 text-xs text-gray-600">
                                <span>Label Bar:</span>
                                <button
                                  type="button"
                                  onClick={() => toggleAmountVisibility('vps-bar-labels')}
                                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700 transition-colors"
                                  title={isAmountVisible('vps-bar-labels') ? 'Sembunyikan nominal bar' : 'Tampilkan nominal bar'}
                                  aria-label={isAmountVisible('vps-bar-labels') ? 'Sembunyikan nominal bar' : 'Tampilkan nominal bar'}
                                >
                                  {isAmountVisible('vps-bar-labels') ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                </button>
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
                                  formatter={(value: any) => (
                                    isAmountVisible(`vps-total-${selectedKey}`)
                                      ? new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value))
                                      : 'Rp ••••••••••'
                                  )}
                                />
                                <Bar dataKey={selectedKey} name={selectedKey === 'estimasi' ? 'Estimasi' : 'Realisasi'} fill={color} radius={[4,4,0,0]} barSize={50}>
                                  <LabelList
                                    dataKey={selectedKey}
                                    position="top"
                                    offset={10}
                                    formatter={(value: number) => (isAmountVisible('vps-bar-labels') ? `Rp ${value.toLocaleString('id-ID')}` : '')}
                                    style={{ fontSize: 11, fill: '#374151', fontWeight: 600 }}
                                  />
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
            {categoryCardsData.map((item: any, idx: number) => {
              const isBiaya = item.kategori === 'BIAYA';
              return (
                <div key={idx} className="relative">
                  <Card className={`${dashboardCardClass} ${isBiaya ? 'lg:col-span-2' : ''}`}>
                    <CardHeader className="pb-4">
                      <CardTitle className="text-2xl font-bold text-gray-900">{item.kategori}</CardTitle>
                      <CardDescription className="text-gray-600 text-sm">
                        <span className="mr-1">Total :</span>
                        {renderCompactCurrencyWithToggle(
                          Number(item.total_kategori || 0),
                          `kategori-total-${item.kategori}-${idx}`,
                          'font-semibold text-blue-600'
                        )}
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
                          showNominal={isAmountVisible(`kategori-total-${item.kategori}-${idx}`)}
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
                          showNominal={isAmountVisible(`kategori-total-${item.kategori}-${idx}`)}
                          showAverageNominal={isAmountVisible(`kategori-total-${item.kategori}-${idx}`)}
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
