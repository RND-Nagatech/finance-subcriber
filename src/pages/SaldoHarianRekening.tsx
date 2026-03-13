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
import { History, Search, Wallet } from 'lucide-react';

interface RekeningOption {
  _id: string;
  kode_bank: string;
  no_rekening: string;
  nama_rekening?: string;
}

interface SaldoHarianRow {
  _id?: string;
  tanggal: string;
  kode_bank: string;
  no_rekening: string;
  saldo_awal_input: number;
  debit_input: number;
  credit_input: number;
  total_transaksi_input: number;
  saldo_akhir_input: number;
  saldo_awal_validated: number;
  debit_validated: number;
  credit_validated: number;
  total_transaksi_validated: number;
  saldo_akhir_validated: number;
  gap_harian: number;
  gap_kumulatif: number;
  count_transaksi_input: number;
  count_transaksi_validated: number;
}

interface SaldoHarianResponse {
  data: SaldoHarianRow[];
  page: number;
  total: number;
  totalPages: number;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function SaldoHarianRekening() {
  const { user } = useAppStore();
  const [rekeningKey, setRekeningKey] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(31);
  const [searchTrigger, setSearchTrigger] = useState(0);
  const [showValidatedColumns, setShowValidatedColumns] = useState(false);

  const { data: rekeningList = [] } = useQuery<RekeningOption[]>({
    queryKey: ['rekening-saldo-harian-options'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/rekening?all=true');
      return res.data || [];
    },
  });

  const selectedRekening = useMemo(() => {
    if (!rekeningKey) return null;
    const [kode_bank, no_rekening] = rekeningKey.split('||');
    return { kode_bank, no_rekening };
  }, [rekeningKey]);

  const { data, isLoading } = useQuery<SaldoHarianResponse>({
    queryKey: ['saldo-harian-viewer', selectedRekening?.kode_bank, selectedRekening?.no_rekening, startDate, endDate, page, limit, searchTrigger],
    queryFn: async () => {
      if (!selectedRekening) {
        return { data: [], page: 1, total: 0, totalPages: 1 };
      }
      const params: any = {
        kode_bank: selectedRekening.kode_bank,
        no_rekening: selectedRekening.no_rekening,
        page,
        limit,
      };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      const res = await axiosInstance.get('/transaksi/saldo-harian-rekening', { params });
      return res.data;
    },
    enabled: !!selectedRekening && searchTrigger > 0,
  });

  const rows = data?.data || [];
  const totalPages = data?.totalPages || 1;

  const handleSearch = () => {
    if (!selectedRekening) {
      toast.error('Pilih rekening terlebih dahulu');
      return;
    }
    setPage(1);
    setSearchTrigger((v) => v + 1);
  };

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1 || nextPage > totalPages) return;
    setPage(nextPage);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      <div className="absolute top-0 right-0 -z-10">
        <div className="w-72 h-72 bg-gradient-to-bl from-blue-400/20 to-indigo-600/20 rounded-full blur-3xl" />
      </div>
      <div className="absolute bottom-0 left-0 -z-10">
        <div className="w-96 h-96 bg-gradient-to-tr from-indigo-400/20 to-cyan-500/20 rounded-full blur-3xl" />
      </div>

      <div className="container mx-auto px-6 py-8 space-y-6">
        <div>
          <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
            Saldo Harian Rekening
          </h1>
          <p className="text-gray-600 mt-2">Lihat snapshot saldo harian (input vs validated) per rekening.</p>
        </div>

        <Card className="bg-white/70 border-2 border-dashed border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5 text-blue-700" />
              Filter Data
            </CardTitle>
            <CardDescription>Pilih rekening dan rentang tanggal untuk melihat saldo harian tersimpan.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-5 gap-4">
              <div className="space-y-2 xl:col-span-2">
                <Label>Rekening</Label>
                <Select value={rekeningKey} onValueChange={setRekeningKey}>
                  <SelectTrigger className="border-2 border-gray-200">
                    <SelectValue placeholder="Pilih rekening" />
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
                <Label>Tanggal Mulai</Label>
                <Input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="border-2 border-gray-200" />
              </div>

              <div className="space-y-2">
                <Label>Tanggal Akhir</Label>
                <Input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="border-2 border-gray-200" />
              </div>

              <div className="space-y-2">
                <Label>Per Halaman</Label>
                <Select value={String(limit)} onValueChange={(v) => setLimit(Number(v))}>
                  <SelectTrigger className="border-2 border-gray-200">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="31">31</SelectItem>
                    <SelectItem value="62">62</SelectItem>
                    <SelectItem value="93">93</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Button onClick={handleSearch} className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800">
                <Search className="w-4 h-4 mr-2" />
                Tampilkan Saldo Harian
              </Button>
              {user?.role === 'superuser' && (
                <Button variant="outline" onClick={() => { window.location.assign('/saldo-harian-generator'); }}>
                  <Wallet className="w-4 h-4 mr-2" />
                  Buka Generator
                </Button>
              )}
              <label className="ml-auto flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-medium text-slate-700">
                <input
                  type="checkbox"
                  checked={showValidatedColumns}
                  onChange={(e) => setShowValidatedColumns(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                Tampilkan kolom validated
              </label>
            </div>
          </CardContent>
        </Card>

        <Card className="bg-white/70 border-2 border-dashed border-blue-200">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-700" />
              Data Saldo Harian
            </CardTitle>
            <CardDescription>
              {selectedRekening
                ? `${selectedRekening.kode_bank} - ${selectedRekening.no_rekening}`
                : 'Pilih rekening terlebih dahulu.'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-auto rounded-lg border border-slate-200 max-h-[65vh]">
              <Table>
                <TableHeader className="sticky top-0 bg-slate-50 z-10">
                  <TableRow>
                    <TableHead className="min-w-[120px]">Tanggal</TableHead>
                    <TableHead className="min-w-[180px] text-right">Saldo Awal Input</TableHead>
                    <TableHead className="min-w-[170px] text-right">Debit Input</TableHead>
                    <TableHead className="min-w-[170px] text-right">Credit Input</TableHead>
                    <TableHead className="min-w-[170px] text-right">Net Input</TableHead>
                    <TableHead className="min-w-[180px] text-right">Saldo Akhir Input</TableHead>
                    {showValidatedColumns && (
                      <>
                        <TableHead className="min-w-[200px] text-right">Saldo Awal Validated</TableHead>
                        <TableHead className="min-w-[180px] text-right">Debit Validated</TableHead>
                        <TableHead className="min-w-[180px] text-right">Credit Validated</TableHead>
                        <TableHead className="min-w-[180px] text-right">Net Validated</TableHead>
                        <TableHead className="min-w-[200px] text-right">Saldo Akhir Validated</TableHead>
                      </>
                    )}
                    <TableHead className="min-w-[140px] text-right">Gap Harian</TableHead>
                    <TableHead className="min-w-[160px] text-right">Gap Kumulatif</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={showValidatedColumns ? 13 : 8} className="text-center py-8 text-gray-500">Memuat data...</TableCell>
                    </TableRow>
                  ) : rows.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={showValidatedColumns ? 13 : 8} className="text-center py-8 text-gray-500">Belum ada data untuk filter ini.</TableCell>
                    </TableRow>
                  ) : (
                    rows.map((row) => (
                      <TableRow key={row._id || `${row.tanggal}-${row.kode_bank}-${row.no_rekening}`}>
                        <TableCell className="font-medium">{row.tanggal}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.saldo_awal_input)}</TableCell>
                        <TableCell className="text-right text-emerald-700">{formatCurrency(row.debit_input)}</TableCell>
                        <TableCell className="text-right text-rose-700">{formatCurrency(row.credit_input)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.total_transaksi_input)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(row.saldo_akhir_input)}</TableCell>
                        {showValidatedColumns && (
                          <>
                            <TableCell className="text-right">{formatCurrency(row.saldo_awal_validated)}</TableCell>
                            <TableCell className="text-right text-emerald-700">{formatCurrency(row.debit_validated)}</TableCell>
                            <TableCell className="text-right text-rose-700">{formatCurrency(row.credit_validated)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.total_transaksi_validated)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(row.saldo_akhir_validated)}</TableCell>
                          </>
                        )}
                        <TableCell className={`text-right ${row.gap_harian >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                          {formatCurrency(row.gap_harian)}
                        </TableCell>
                        <TableCell className={`text-right font-semibold ${row.gap_kumulatif >= 0 ? 'text-amber-700' : 'text-red-700'}`}>
                          {formatCurrency(row.gap_kumulatif)}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-gray-600">
                Halaman {data?.page || 1} dari {totalPages} • Total {data?.total || 0} hari
              </div>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => handlePageChange(page - 1)} disabled={page <= 1 || isLoading}>
                  Sebelumnya
                </Button>
                <Button variant="outline" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages || isLoading}>
                  Berikutnya
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
