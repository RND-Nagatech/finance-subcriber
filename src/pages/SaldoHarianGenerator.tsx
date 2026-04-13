import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Activity, Calculator, CheckCircle2, Database, Save, Upload } from 'lucide-react';
import axiosInstance from '@/api/axiosInstance';
import {
  commitSaldoHarian,
  getReconcileComparison,
  getReconcileMonths,
  previewSaldoHarian,
  type ReconcileMonthItem,
  type ReconcileStatusRow,
  type SaldoHarianPreviewRow,
  uploadReconcilePdf,
} from '@/api/saldoHarian';
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

interface RekeningOption {
  _id: string;
  kode_bank: string;
  no_rekening: string;
  nama_rekening?: string;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

function formatNumberInput(raw: string): string {
  const cleaned = String(raw || '').replace(/[^\d-]/g, '');
  const negative = cleaned.startsWith('-');
  const digits = cleaned.replace(/-/g, '');
  const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return negative ? `-${formatted}` : formatted;
}

function parseNumberInput(raw: string): number {
  const normalized = String(raw || '').replace(/\./g, '');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function SaldoHarianGenerator() {
  const navigate = useNavigate();
  const { user } = useAppStore();

  const [rekeningKey, setRekeningKey] = useState('');
  const [startDate, setStartDate] = useState('');
  const [startBalanceInputText, setStartBalanceInputText] = useState('0');
  const [startBalanceValidatedText, setStartBalanceValidatedText] = useState('0');

  const [previewRows, setPreviewRows] = useState<SaldoHarianPreviewRow[]>([]);
  const [previewMeta, setPreviewMeta] = useState<any>(null);
  const [reconcileMonth, setReconcileMonth] = useState('');
  const [reconcilePassword, setReconcilePassword] = useState('');
  const [reconcileFile, setReconcileFile] = useState<File | null>(null);
  const [reconcileStatusMap, setReconcileStatusMap] = useState<Record<string, ReconcileStatusRow>>({});

  const { data: rekeningList = [], isLoading: rekeningLoading } = useQuery<RekeningOption[]>({
    queryKey: ['rekening-generator-all'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/rekening?all=true');
      return res.data || [];
    },
  });

  const selectedRekening = useMemo(() => {
    if (!rekeningKey) return null;
    const [kode_bank, no_rekening] = rekeningKey.split('||');
    return {
      kode_bank,
      no_rekening,
      label: `${kode_bank} - ${no_rekening}`,
    };
  }, [rekeningKey]);

  useEffect(() => {
    setPreviewRows([]);
    setPreviewMeta(null);
    setReconcileStatusMap({});
    setReconcileMonth('');
    setReconcilePassword('');
    setReconcileFile(null);
  }, [rekeningKey]);

  const { data: reconcileMonthsResp, refetch: refetchReconcileMonths } = useQuery({
    queryKey: ['saldo-harian-reconcile-months', selectedRekening?.kode_bank, selectedRekening?.no_rekening],
    queryFn: async () => {
      if (!selectedRekening) return { success: true, data: [] as ReconcileMonthItem[] };
      return getReconcileMonths({
        kode_bank: selectedRekening.kode_bank,
        no_rekening: selectedRekening.no_rekening,
      });
    },
    enabled: !!selectedRekening,
  });

  const uploadedMonths = reconcileMonthsResp?.data || [];

  const loadReconcileStatuses = async (start: string, end: string) => {
    if (!selectedRekening || !start || !end) return;
    const res = await getReconcileComparison({
      kode_bank: selectedRekening.kode_bank,
      no_rekening: selectedRekening.no_rekening,
      start_date: start,
      end_date: end,
      basis: 'input',
    });
    const map: Record<string, ReconcileStatusRow> = {};
    (res.statuses || []).forEach((s) => {
      map[s.tanggal] = s;
    });
    setReconcileStatusMap(map);
  };

  const previewMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRekening) throw new Error('Pilih rekening terlebih dahulu');
      if (!startDate) throw new Error('Tanggal awal wajib diisi');

      const payload = {
        kode_bank: selectedRekening.kode_bank,
        no_rekening: selectedRekening.no_rekening,
        start_date: startDate,
        start_balance_input: parseNumberInput(startBalanceInputText),
        start_balance_validated: parseNumberInput(startBalanceValidatedText),
      };

      return previewSaldoHarian(payload);
    },
    onSuccess: (data) => {
      setPreviewRows(data.rows || []);
      setPreviewMeta(data);
      setReconcileStatusMap({});
      loadReconcileStatuses(data.start_date, data.end_date).catch(() => {
        // no-op: status reconcile optional
      });
      toast.success(`Preview berhasil digenerate (${data.affected_days} hari).`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Gagal generate preview.');
    },
  });

  const commitMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRekening) throw new Error('Pilih rekening terlebih dahulu');
      if (!startDate) throw new Error('Tanggal awal wajib diisi');

      return commitSaldoHarian({
        kode_bank: selectedRekening.kode_bank,
        no_rekening: selectedRekening.no_rekening,
        start_date: startDate,
        start_balance_input: parseNumberInput(startBalanceInputText),
        start_balance_validated: parseNumberInput(startBalanceValidatedText),
        confirm: true,
      });
    },
    onSuccess: (data) => {
      toast.success(`${data.message} (${data.affected_days} hari).`);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Gagal menyimpan saldo harian.');
    },
  });

  const uploadReconcileMutation = useMutation({
    mutationFn: async () => {
      if (!selectedRekening) throw new Error('Pilih rekening terlebih dahulu');
      if (!reconcileMonth) throw new Error('Pilih bulan acuan rekening koran');
      if (!reconcileFile) throw new Error('Pilih file PDF rekening koran');
      return uploadReconcilePdf({
        kode_bank: selectedRekening.kode_bank,
        no_rekening: selectedRekening.no_rekening,
        acuan_bulan: reconcileMonth,
        pdf_password: reconcilePassword || undefined,
        file: reconcileFile,
      });
    },
    onSuccess: async (data) => {
      toast.success(`${data.message} (${data.summary.total_days} hari ditemukan).`);
      await refetchReconcileMonths();
      if (previewMeta?.start_date && previewMeta?.end_date) {
        await loadReconcileStatuses(previewMeta.start_date, previewMeta.end_date);
      }
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Gagal upload rekening koran PDF.');
    },
  });

  const monthOptions = useMemo(() => {
    const options: string[] = [];
    const start = startDate || previewMeta?.start_date;
    const end = previewMeta?.end_date || new Date().toISOString().slice(0, 10);
    if (!start || !end) return options;
    const s = new Date(`${start}T00:00:00`);
    const e = new Date(`${end}T00:00:00`);
    const d = new Date(s.getFullYear(), s.getMonth(), 1);
    while (d <= e) {
      options.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
      d.setMonth(d.getMonth() + 1);
    }
    return options;
  }, [startDate, previewMeta]);

  const summary = useMemo(() => {
    const rows = previewRows || [];
    const totalDebitInput = rows.reduce((sum, r) => sum + Number((r as any).debit_input || 0), 0);
    const totalCreditInput = rows.reduce((sum, r) => sum + Number((r as any).credit_input || 0), 0);
    const totalInput = rows.reduce((sum, r) => sum + Number(r.total_transaksi_input || 0), 0);
    const totalDebitValidated = rows.reduce((sum, r) => sum + Number((r as any).debit_validated || 0), 0);
    const totalCreditValidated = rows.reduce((sum, r) => sum + Number((r as any).credit_validated || 0), 0);
    const totalValidated = rows.reduce((sum, r) => sum + Number(r.total_transaksi_validated || 0), 0);
    const finalGap = rows.length ? Number(rows[rows.length - 1].gap_kumulatif || 0) : 0;
    return {
      days: rows.length,
      totalDebitInput,
      totalCreditInput,
      totalInput,
      totalDebitValidated,
      totalCreditValidated,
      totalValidated,
      finalGap,
    };
  }, [previewRows]);

  if (!user || user.role !== 'superuser') {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 p-6">
        <Card className="max-w-2xl mx-auto border-red-200">
          <CardHeader>
            <CardTitle>Akses Ditolak</CardTitle>
            <CardDescription>Menu generator saldo harian hanya untuk role superuser.</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate('/dashboard')}>Kembali ke Dashboard</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.65))] -z-10" />
      <div className="absolute top-0 right-0 -z-10">
        <div className="w-80 h-80 bg-gradient-to-bl from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl" />
      </div>
      <div className="absolute bottom-0 left-0 -z-10">
        <div className="w-96 h-96 bg-gradient-to-tr from-cyan-400/20 to-blue-600/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Generator Saldo Harian
          </h1>
          <p className="text-gray-600 mt-2">Generate preview proyeksi saldo harian rekening sebelum commit ke database.</p>
        </div>

        <Card className="bg-white/70 border-2 border-dashed border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Calculator className="w-5 h-5 text-blue-700" />
              Parameter Proyeksi
            </CardTitle>
            <CardDescription>Pilih rekening, tanggal awal, dan dua saldo awal (input vs validated).</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <div className="space-y-2 xl:col-span-2">
                <Label>Rekening</Label>
                <Select value={rekeningKey} onValueChange={setRekeningKey} disabled={rekeningLoading}>
                  <SelectTrigger className="border-2 border-gray-200">
                    <SelectValue placeholder={rekeningLoading ? 'Memuat rekening...' : 'Pilih rekening'} />
                  </SelectTrigger>
                  <SelectContent>
                    {rekeningList.map((r) => {
                      const key = `${r.kode_bank}||${r.no_rekening}`;
                      return (
                        <SelectItem key={`${r._id}-${key}`} value={key}>
                          {r.kode_bank} - {r.no_rekening} {r.nama_rekening ? `(${r.nama_rekening})` : ''}
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Tanggal Awal</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="border-2 border-gray-200"
                />
              </div>

              <div className="space-y-2">
                <Label>Saldo Awal Input</Label>
                <Input
                  type="text"
                  value={startBalanceInputText}
                  onChange={(e) => setStartBalanceInputText(formatNumberInput(e.target.value))}
                  placeholder="Contoh: 1.000.000"
                  className="border-2 border-gray-200"
                />
              </div>

              <div className="space-y-2">
                <Label>Saldo Awal Validated</Label>
                <Input
                  type="text"
                  value={startBalanceValidatedText}
                  onChange={(e) => setStartBalanceValidatedText(formatNumberInput(e.target.value))}
                  placeholder="Contoh: 1.000.000"
                  className="border-2 border-gray-200"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-3 pt-2">
              <Button
                onClick={() => previewMutation.mutate()}
                disabled={previewMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
              >
                <Activity className="w-4 h-4 mr-2" />
                {previewMutation.isPending ? 'Generating...' : 'Generate Preview'}
              </Button>

              <Button
                onClick={() => commitMutation.mutate()}
                disabled={commitMutation.isPending || previewRows.length === 0}
                className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800"
              >
                <Save className="w-4 h-4 mr-2" />
                {commitMutation.isPending ? 'Menyimpan...' : 'Simpan ke Database'}
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 border-2 border-dashed border-emerald-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-gray-900">
              <Upload className="w-5 h-5 text-emerald-700" />
              Validator Rekening Koran (PDF)
            </CardTitle>
            <CardDescription>
              Upload PDF rekening koran per bulan acuan untuk mencocokkan debit/credit harian (basis Input, toleransi Rp100).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-2">
                <Label>Bulan Acuan</Label>
                <Select value={reconcileMonth} onValueChange={setReconcileMonth}>
                  <SelectTrigger className="border-2 border-gray-200">
                    <SelectValue placeholder="Pilih bulan (YYYY-MM)" />
                  </SelectTrigger>
                  <SelectContent>
                    {monthOptions.map((m) => (
                      <SelectItem key={m} value={m}>
                        {m}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>Password PDF (Opsional)</Label>
                <Input
                  type="password"
                  value={reconcilePassword}
                  onChange={(e) => setReconcilePassword(e.target.value)}
                  placeholder="Isi jika PDF berpassword"
                  className="border-2 border-gray-200"
                />
              </div>

              <div className="space-y-2">
                <Label>File PDF Rekening Koran</Label>
                <Input
                  type="file"
                  accept="application/pdf,.pdf"
                  onChange={(e) => setReconcileFile(e.target.files?.[0] || null)}
                  className="border-2 border-gray-200"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={() => uploadReconcileMutation.mutate()}
                disabled={uploadReconcileMutation.isPending}
                className="bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800"
              >
                <Upload className="w-4 h-4 mr-2" />
                {uploadReconcileMutation.isPending ? 'Uploading...' : 'Upload & Cocokkan'}
              </Button>

              <Button
                variant="outline"
                onClick={() => {
                  if (previewMeta?.start_date && previewMeta?.end_date) {
                    loadReconcileStatuses(previewMeta.start_date, previewMeta.end_date).catch(() => {
                      toast.error('Gagal refresh status rekonsiliasi.');
                    });
                  }
                }}
                disabled={!previewMeta?.start_date || !previewMeta?.end_date}
              >
                Refresh Status
              </Button>
            </div>

            <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
              <div className="text-sm font-semibold text-slate-700 mb-2">Bulan Terupload</div>
              {uploadedMonths.length === 0 ? (
                <div className="text-sm text-slate-500">Belum ada data rekening koran terupload untuk rekening ini.</div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {uploadedMonths.map((m) => (
                    <span
                      key={m.acuan_bulan}
                      className="inline-flex items-center rounded-md border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-800"
                    >
                      {m.acuan_bulan} • Tx {m.total_tx_count}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {previewRows.length > 0 && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
              <Card className="bg-white/70 border-blue-100">
                <CardHeader className="pb-2">
                  <CardDescription>Jumlah Hari</CardDescription>
                  <CardTitle>{summary.days}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-white/70 border-blue-100">
                <CardHeader className="pb-2">
                  <CardDescription>Total Debit Input</CardDescription>
                  <CardTitle className="text-base text-emerald-700">{formatCurrency(summary.totalDebitInput)}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-white/70 border-blue-100">
                <CardHeader className="pb-2">
                  <CardDescription>Total Credit Input</CardDescription>
                  <CardTitle className="text-base text-rose-700">{formatCurrency(summary.totalCreditInput)}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-white/70 border-blue-100">
                <CardHeader className="pb-2">
                  <CardDescription>Net Input</CardDescription>
                  <CardTitle className="text-base">{formatCurrency(summary.totalInput)}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-white/70 border-blue-100">
                <CardHeader className="pb-2">
                  <CardDescription>Total Debit Validated</CardDescription>
                  <CardTitle className="text-base text-emerald-700">{formatCurrency(summary.totalDebitValidated)}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-white/70 border-blue-100">
                <CardHeader className="pb-2">
                  <CardDescription>Total Credit Validated</CardDescription>
                  <CardTitle className="text-base text-rose-700">{formatCurrency(summary.totalCreditValidated)}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-white/70 border-blue-100">
                <CardHeader className="pb-2">
                  <CardDescription>Net Validated</CardDescription>
                  <CardTitle className="text-base">{formatCurrency(summary.totalValidated)}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-white/70 border-blue-100">
                <CardHeader className="pb-2">
                  <CardDescription>Gap Kumulatif Akhir</CardDescription>
                  <CardTitle className={`text-base ${summary.finalGap >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                    {formatCurrency(summary.finalGap)}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>

            <Card className="bg-white/70 border-2 border-dashed border-blue-200">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-gray-900">
                  <Database className="w-5 h-5 text-blue-700" />
                  Preview Proyeksi Harian
                </CardTitle>
                <CardDescription>
                  {previewMeta?.rekening?.kode_bank} - {previewMeta?.rekening?.no_rekening}
                  {previewMeta?.rekening?.nama_rekening ? ` (${previewMeta.rekening.nama_rekening})` : ''}
                  {' • '}
                  {previewMeta?.start_date} s/d {previewMeta?.end_date}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-auto rounded-lg border border-slate-200 max-h-[calc(100vh-260px)]">
                  <table className="w-full min-w-[2100px] border-collapse text-sm">
                    <thead className="sticky top-0 z-40 bg-slate-50 shadow-sm">
                      <tr className="border-b border-slate-200">
                        <th className="min-w-[160px] px-4 py-3 text-left font-semibold">Tanggal</th>
                        <th className="min-w-[180px] px-4 py-3 text-left font-semibold">Status Rekonsiliasi</th>
                        <th className="min-w-[180px] px-4 py-3 text-right font-semibold">Saldo Awal Input</th>
                        <th className="min-w-[170px] px-4 py-3 text-right font-semibold">Debit Input</th>
                        <th className="min-w-[170px] px-4 py-3 text-right font-semibold">Credit Input</th>
                        <th className="min-w-[170px] px-4 py-3 text-right font-semibold">Net Input</th>
                        <th className="min-w-[180px] px-4 py-3 text-right font-semibold">Saldo Akhir Input</th>
                        <th className="min-w-[200px] px-4 py-3 text-right font-semibold">Saldo Awal Validated</th>
                        <th className="min-w-[180px] px-4 py-3 text-right font-semibold">Debit Validated</th>
                        <th className="min-w-[180px] px-4 py-3 text-right font-semibold">Credit Validated</th>
                        <th className="min-w-[180px] px-4 py-3 text-right font-semibold">Net Validated</th>
                        <th className="min-w-[200px] px-4 py-3 text-right font-semibold">Saldo Akhir Validated</th>
                        <th className="min-w-[140px] px-4 py-3 text-right font-semibold">Gap Harian</th>
                        <th className="min-w-[160px] px-4 py-3 text-right font-semibold">Gap Kumulatif</th>
                        <th className="min-w-[120px] px-4 py-3 text-right font-semibold">Count Input</th>
                        <th className="min-w-[140px] px-4 py-3 text-right font-semibold">Count Validated</th>
                      </tr>
                    </thead>
                    <tbody>
                      {previewRows.map((row) => {
                        const reconcile = reconcileStatusMap[row.tanggal];
                        const isMatched = reconcile?.status === 'matched';
                        return (
                        <tr key={row.tanggal} className={`border-b border-slate-100 last:border-b-0 ${isMatched ? 'bg-emerald-50/70' : ''}`}>
                          <td className="px-4 py-3 font-medium">{row.tanggal}</td>
                          <td className="px-4 py-3">
                            {reconcile?.status === 'matched' ? (
                              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-100 px-2 py-1 text-xs font-semibold text-emerald-800">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                Cocok
                              </span>
                            ) : reconcile?.status === 'unmatched' ? (
                              <span className="inline-flex items-center rounded-full border border-slate-300 bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                                Belum Cocok
                              </span>
                            ) : (
                              <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2 py-1 text-xs text-slate-500">
                                Belum Ada PDF
                              </span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-right">{formatCurrency(row.saldo_awal_input)}</td>
                          <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency((row as any).debit_input || 0)}</td>
                          <td className="px-4 py-3 text-right text-rose-700">{formatCurrency((row as any).credit_input || 0)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(row.total_transaksi_input)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(row.saldo_akhir_input)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(row.saldo_awal_validated)}</td>
                          <td className="px-4 py-3 text-right text-emerald-700">{formatCurrency((row as any).debit_validated || 0)}</td>
                          <td className="px-4 py-3 text-right text-rose-700">{formatCurrency((row as any).credit_validated || 0)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(row.total_transaksi_validated)}</td>
                          <td className="px-4 py-3 text-right">{formatCurrency(row.saldo_akhir_validated)}</td>
                          <td className={`px-4 py-3 text-right ${row.gap_harian >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                            {formatCurrency(row.gap_harian)}
                          </td>
                          <td className={`px-4 py-3 text-right font-semibold ${row.gap_kumulatif >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                            {formatCurrency(row.gap_kumulatif)}
                          </td>
                          <td className="px-4 py-3 text-right">{row.count_transaksi_input}</td>
                          <td className="px-4 py-3 text-right">{row.count_transaksi_validated}</td>
                        </tr>
                      )})}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
