import React, { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import axiosInstance from '@/api/axiosInstance';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { AlertTriangle, BarChart3, Calculator, CheckCircle2, Search } from 'lucide-react';

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

interface CompareGroup {
  group: string;
  dashboard_total: number;
  detail_total: number;
  rekening_only_total: number;
  diff: number;
}

interface CompareSubKategori {
  sub_kategori: string;
  group: string;
  dashboard_total: number;
  detail_total: number;
  rekening_only_total: number;
  detail_count?: number;
  rekening_only_count?: number;
  diff: number;
}

interface CompareResponse {
  success: boolean;
  source: string;
  filter: {
    tahun: string;
    bulan: string | null;
    bulan_fiskal: string | null;
    tanggal: string | null;
    detail_basis: string;
    dashboard_basis: string;
  };
  margin: {
    dashboard: { pendapatan: number; biaya: number; pembelian: number; gross_margin: number };
    detail: { pendapatan: number; biaya: number; pembelian: number; gross_margin: number };
    diff: {
      pendapatan: number;
      biaya: number;
      pembelian: number;
      gross_margin: number;
      expected_margin: number | null;
      expected_margin_diff: number | null;
    };
  };
  transaksi_rekening_only_excluded: {
    pendapatan: number;
    biaya: number;
    pembelian: number;
    gross_margin_effect_if_included: number;
  };
  biaya_compare: {
    dashboard_total: number;
    detail_total: number;
    diff: number;
    groups: CompareGroup[];
    by_sub_kategori: CompareSubKategori[];
  };
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumberInput(value: string) {
  const onlyNumber = value.replace(/\D/g, '');
  if (!onlyNumber) return '';
  return new Intl.NumberFormat('id-ID').format(Number(onlyNumber));
}

function parseNumberInput(value: string) {
  const parsed = Number(String(value || '').replace(/\D/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

function diffClass(value: number) {
  if (Math.abs(Number(value || 0)) === 0) return 'text-emerald-700';
  return Number(value || 0) > 0 ? 'text-rose-700' : 'text-amber-700';
}

function groupLabel(group: string) {
  const labels: Record<string, string> = {
    'ASET_GAJI:ASET': 'Aset',
    'ASET_GAJI:GAJI': 'Gaji',
    IMPLEMENTASI_MARKETING_LAINNYA: 'Implementasi, Marketing & Lainnya',
    BIAYA_BIAYA: 'Biaya-biaya',
    BIAYA_LAINNYA: 'Biaya lainnya',
  };
  return labels[group] || group;
}

export default function FinanceDailyCompare() {
  const { fiscalYear } = useAppStore();
  const [tahun, setTahun] = useState(String(fiscalYear || new Date().getFullYear()));
  const [bulan, setBulan] = useState('APR');
  const [tanggal, setTanggal] = useState('2026-04-30');
  const [expectedMarginInput, setExpectedMarginInput] = useState('146.209.814');
  const [includeDetails, setIncludeDetails] = useState(false);
  const [searchTrigger, setSearchTrigger] = useState(0);

  const expectedMargin = useMemo(() => parseNumberInput(expectedMarginInput), [expectedMarginInput]);

  const { data, isFetching } = useQuery<CompareResponse>({
    queryKey: ['finance-daily-compare', tahun, bulan, tanggal, expectedMargin, includeDetails, searchTrigger],
    queryFn: async () => {
      const params: Record<string, string | number | boolean> = {
        tahun,
        bulan,
        expected_margin: expectedMargin,
        include_details: includeDetails,
      };
      if (tanggal) params.tanggal = tanggal;
      const res = await axiosInstance.get('/dashboard/finance-daily-compare', { params });
      return res.data;
    },
    enabled: searchTrigger > 0,
  });

  const mainDiffAbs = Math.abs(Number(data?.margin?.diff?.gross_margin || 0));
  const biayaDiffAbs = Math.abs(Number(data?.biaya_compare?.diff || 0));

  const handleCompare = () => {
    if (!tahun || !bulan) {
      toast.error('Tahun dan bulan wajib diisi.');
      return;
    }
    setSearchTrigger((value) => value + 1);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="border-b border-slate-200 bg-white">
        <div className="mx-auto max-w-7xl px-6 py-6">
          <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
                <BarChart3 className="h-4 w-4" />
                Finance Reconciliation
              </div>
              <h1 className="mt-2 text-3xl font-bold text-slate-950">Compare Dashboard vs Transaksi</h1>
              <p className="mt-2 max-w-3xl text-sm text-slate-600">
                Audit selisih margin dan biaya antara angka dashboard dari daily aggregation dengan detail transaksi aktif.
              </p>
            </div>
            {data && (
              <div className="rounded-md border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
                Basis dashboard: <span className="font-semibold text-slate-900">{data.filter.dashboard_basis}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-6 space-y-6">
        <Card className="border-slate-200 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-slate-950">
              <Search className="h-5 w-5 text-blue-700" />
              Filter Compare
            </CardTitle>
            <CardDescription>Pilih periode yang ingin dibandingkan. Kosongkan tanggal untuk compare satu bulan.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-6">
              <div className="space-y-2">
                <Label>Tahun Fiskal</Label>
                <Input value={tahun} onChange={(event) => setTahun(event.target.value)} />
              </div>
              <div className="space-y-2">
                <Label>Bulan</Label>
                <Select value={bulan} onValueChange={setBulan}>
                  <SelectTrigger>
                    <SelectValue placeholder="Pilih bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((month) => (
                      <SelectItem key={month} value={month}>{month}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tanggal</Label>
                <Input type="date" value={tanggal} onChange={(event) => setTanggal(event.target.value)} />
              </div>
              <div className="space-y-2 xl:col-span-2">
                <Label>Expected Margin</Label>
                <Input
                  value={expectedMarginInput}
                  onChange={(event) => setExpectedMarginInput(formatNumberInput(event.target.value))}
                  placeholder="146.209.814"
                />
              </div>
              <div className="flex items-end">
                <Button onClick={handleCompare} disabled={isFetching} className="w-full bg-slate-950 hover:bg-slate-800">
                  <Calculator className="mr-2 h-4 w-4" />
                  {isFetching ? 'Membandingkan...' : 'Compare'}
                </Button>
              </div>
            </div>
            <label className="mt-4 flex items-center gap-2 text-sm text-slate-600">
              <input
                type="checkbox"
                checked={includeDetails}
                onChange={(event) => setIncludeDetails(event.target.checked)}
                className="h-4 w-4 rounded border-slate-300"
              />
              Sertakan raw detail item biaya di response browser network
            </label>
          </CardContent>
        </Card>

        {data ? (
          <>
            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-500">Selisih Margin</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${diffClass(data.margin.diff.gross_margin)}`}>
                    {formatCurrency(data.margin.diff.gross_margin)}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Dashboard {formatCurrency(data.margin.dashboard.gross_margin)} vs detail {formatCurrency(data.margin.detail.gross_margin)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-500">Selisih Biaya</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className={`text-3xl font-bold ${diffClass(data.biaya_compare.diff)}`}>
                    {formatCurrency(data.biaya_compare.diff)}
                  </div>
                  <p className="mt-2 text-sm text-slate-600">
                    Dashboard {formatCurrency(data.biaya_compare.dashboard_total)} vs detail {formatCurrency(data.biaya_compare.detail_total)}
                  </p>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold text-slate-500">Status Audit</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-3">
                    {mainDiffAbs === 0 && biayaDiffAbs === 0 ? (
                      <CheckCircle2 className="h-8 w-8 text-emerald-600" />
                    ) : (
                      <AlertTriangle className="h-8 w-8 text-amber-600" />
                    )}
                    <div>
                      <div className="text-lg font-bold text-slate-950">
                        {mainDiffAbs === 0 && biayaDiffAbs === 0 ? 'Balance' : 'Perlu dicek'}
                      </div>
                      <p className="text-sm text-slate-600">
                        {data.filter.tanggal || data.filter.bulan_fiskal} - {data.filter.tahun}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>

            <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Komponen Margin</CardTitle>
                  <CardDescription>Pendapatan, biaya, dan pembelian dari dashboard dibanding detail transaksi.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Komponen</TableHead>
                        <TableHead className="text-right">Dashboard</TableHead>
                        <TableHead className="text-right">Transaksi</TableHead>
                        <TableHead className="text-right">Selisih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {[
                        ['Pendapatan', data.margin.dashboard.pendapatan, data.margin.detail.pendapatan, data.margin.diff.pendapatan],
                        ['Biaya', data.margin.dashboard.biaya, data.margin.detail.biaya, data.margin.diff.biaya],
                        ['Pembelian', data.margin.dashboard.pembelian, data.margin.detail.pembelian, data.margin.diff.pembelian],
                        ['Gross Margin', data.margin.dashboard.gross_margin, data.margin.detail.gross_margin, data.margin.diff.gross_margin],
                      ].map(([label, dashboard, detail, diff]) => (
                        <TableRow key={String(label)}>
                          <TableCell className="font-medium text-slate-900">{label}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(dashboard))}</TableCell>
                          <TableCell className="text-right">{formatCurrency(Number(detail))}</TableCell>
                          <TableCell className={`text-right font-semibold ${diffClass(Number(diff))}`}>
                            {formatCurrency(Number(diff))}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              <Card className="border-slate-200 shadow-sm">
                <CardHeader>
                  <CardTitle>Breakdown Group Biaya</CardTitle>
                  <CardDescription>Kelompok biaya yang dipakai dashboard daily breakdown.</CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Group</TableHead>
                        <TableHead className="text-right">Dashboard</TableHead>
                        <TableHead className="text-right">Transaksi</TableHead>
                        <TableHead className="text-right">Selisih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.biaya_compare.groups.map((row) => (
                        <TableRow key={row.group}>
                          <TableCell className="font-medium text-slate-900">{groupLabel(row.group)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.dashboard_total)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.detail_total)}</TableCell>
                          <TableCell className={`text-right font-semibold ${diffClass(row.diff)}`}>
                            {formatCurrency(row.diff)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>
            </div>

            <Card className="border-slate-200 shadow-sm">
              <CardHeader>
                <CardTitle>Selisih per Sub Kategori</CardTitle>
                <CardDescription>Diurutkan dari selisih terbesar agar sumber masalah cepat terlihat.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Sub Kategori</TableHead>
                        <TableHead>Group</TableHead>
                        <TableHead className="text-right">Dashboard</TableHead>
                        <TableHead className="text-right">Transaksi</TableHead>
                        <TableHead className="text-right">Rekening Only</TableHead>
                        <TableHead className="text-right">Selisih</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.biaya_compare.by_sub_kategori.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-slate-500">
                            Belum ada data biaya untuk filter ini.
                          </TableCell>
                        </TableRow>
                      ) : data.biaya_compare.by_sub_kategori.map((row) => (
                        <TableRow key={row.sub_kategori}>
                          <TableCell className="font-semibold text-slate-900">{row.sub_kategori}</TableCell>
                          <TableCell className="text-slate-600">{groupLabel(row.group)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.dashboard_total)}</TableCell>
                          <TableCell className="text-right">
                            <div>{formatCurrency(row.detail_total)}</div>
                            <div className="text-xs text-slate-400">{row.detail_count || 0} trx</div>
                          </TableCell>
                          <TableCell className="text-right">
                            <div>{formatCurrency(row.rekening_only_total)}</div>
                            <div className="text-xs text-slate-400">{row.rekening_only_count || 0} trx</div>
                          </TableCell>
                          <TableCell className={`text-right font-bold ${diffClass(row.diff)}`}>
                            {formatCurrency(row.diff)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="border-dashed border-slate-300 bg-white shadow-sm">
            <CardContent className="py-12 text-center">
              <Calculator className="mx-auto h-10 w-10 text-slate-400" />
              <h3 className="mt-4 text-lg font-semibold text-slate-950">Belum ada hasil compare</h3>
              <p className="mt-2 text-sm text-slate-600">Isi filter lalu klik Compare untuk melihat selisih dashboard dan transaksi.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
