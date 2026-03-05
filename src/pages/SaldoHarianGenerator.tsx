import React, { useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { useNavigate } from 'react-router-dom';
import { Activity, Calculator, Database, Save } from 'lucide-react';
import axiosInstance from '@/api/axiosInstance';
import { commitSaldoHarian, previewSaldoHarian, type SaldoHarianPreviewRow } from '@/api/saldoHarian';
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

  const summary = useMemo(() => {
    const rows = previewRows || [];
    const totalInput = rows.reduce((sum, r) => sum + Number(r.total_transaksi_input || 0), 0);
    const totalValidated = rows.reduce((sum, r) => sum + Number(r.total_transaksi_validated || 0), 0);
    const finalGap = rows.length ? Number(rows[rows.length - 1].gap_kumulatif || 0) : 0;
    return {
      days: rows.length,
      totalInput,
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
                  <CardDescription>Total Transaksi Input</CardDescription>
                  <CardTitle className="text-base">{formatCurrency(summary.totalInput)}</CardTitle>
                </CardHeader>
              </Card>
              <Card className="bg-white/70 border-blue-100">
                <CardHeader className="pb-2">
                  <CardDescription>Total Transaksi Validated</CardDescription>
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
                <div className="overflow-auto rounded-lg border border-slate-200 max-h-[65vh]">
                  <Table>
                    <TableHeader className="sticky top-0 bg-slate-50 z-10">
                      <TableRow>
                        <TableHead className="min-w-[120px]">Tanggal</TableHead>
                        <TableHead className="min-w-[180px] text-right">Saldo Awal Input</TableHead>
                        <TableHead className="min-w-[200px] text-right">Saldo Awal Validated</TableHead>
                        <TableHead className="min-w-[170px] text-right">Total Input</TableHead>
                        <TableHead className="min-w-[180px] text-right">Total Validated</TableHead>
                        <TableHead className="min-w-[180px] text-right">Saldo Akhir Input</TableHead>
                        <TableHead className="min-w-[200px] text-right">Saldo Akhir Validated</TableHead>
                        <TableHead className="min-w-[140px] text-right">Gap Harian</TableHead>
                        <TableHead className="min-w-[160px] text-right">Gap Kumulatif</TableHead>
                        <TableHead className="min-w-[120px] text-right">Count Input</TableHead>
                        <TableHead className="min-w-[140px] text-right">Count Validated</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row) => (
                        <TableRow key={row.tanggal}>
                          <TableCell className="font-medium">{row.tanggal}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.saldo_awal_input)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.saldo_awal_validated)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.total_transaksi_input)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.total_transaksi_validated)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.saldo_akhir_input)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(row.saldo_akhir_validated)}</TableCell>
                          <TableCell className={`text-right ${row.gap_harian >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                            {formatCurrency(row.gap_harian)}
                          </TableCell>
                          <TableCell className={`text-right font-semibold ${row.gap_kumulatif >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                            {formatCurrency(row.gap_kumulatif)}
                          </TableCell>
                          <TableCell className="text-right">{row.count_transaksi_input}</TableCell>
                          <TableCell className="text-right">{row.count_transaksi_validated}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </div>
  );
}
