import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import axiosInstance from '@/api/axiosInstance';
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
import { Search, Eye, Wallet, History } from 'lucide-react';
import { format } from 'date-fns';
import { id } from 'date-fns/locale';

interface RiwayatSaldoRekening {
  _id: string;
  kode_bank: string;
  no_rekening: string;
  nama_rekening?: string;
  nama_bank?: string;
  saldo_awal: number;
  saldo_masuk: number;
  saldo_keluar: number;
  saldo_akhir: number;
  keterangan: string;
  tanggal: string;
  created_at?: string;
}

interface RekeningOption {
  kode_bank: string;
  no_rekening: string;
  nama_rekening: string;
  nama_bank: string;
  saldo: number;
}

const RiwayatSaldoRekening: React.FC = () => {
  const [selectedKodeBank, setSelectedKodeBank] = useState<string>('');
  const [selectedNoRekening, setSelectedNoRekening] = useState<string>('');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [rekeningOptions, setRekeningOptions] = useState<RekeningOption[]>([]);

  // Fetch rekening options
  const { data: rekeningData, isLoading: isLoadingRekening } = useQuery({
    queryKey: ['rekening-options'],
    queryFn: async () => {
      const response = await axiosInstance.get('/master/rekening');
      return response.data;
    },
  });

  // Fetch riwayat saldo
  const { data: riwayatData, isLoading: isLoadingRiwayat, refetch } = useQuery({
    queryKey: ['riwayat-saldo', selectedKodeBank, selectedNoRekening, startDate, endDate],
    queryFn: async () => {
      if (!selectedKodeBank || !selectedNoRekening) return [];
      const params: any = { 
        kode_bank: selectedKodeBank, 
        no_rekening: selectedNoRekening 
      };
      if (startDate) params.start_date = startDate;
      if (endDate) params.end_date = endDate;
      
      const response = await axiosInstance.get('/transaksi/riwayat-saldo-rekening', { params });
      return response.data;
    },
    enabled: !!(selectedKodeBank && selectedNoRekening),
  });

  useEffect(() => {
    if (rekeningData) {
      const processedData = rekeningData.map((rekening: any) => ({
        kode_bank: rekening.kode_bank,
        no_rekening: rekening.no_rekening,
        nama_rekening: rekening.nama_rekening,
        nama_bank: rekening.bank_id?.nama_bank || rekening.kode_bank,
        saldo: rekening.saldo
      }));
      setRekeningOptions(processedData);
    }
  }, [rekeningData]);

  const handleSearch = () => {
    if (!selectedKodeBank || !selectedNoRekening) {
      toast.error('Pilih kode bank dan nomor rekening terlebih dahulu');
      return;
    }
    refetch();
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatSignedCurrency = (amount: number) => {
    const n = Number(amount || 0);
    const sign = n > 0 ? '+' : n < 0 ? '-' : '';
    return `${sign}${formatCurrency(Math.abs(n))}`;
  };

  const formatDate = (dateString: string) => {
    try {
      if (!dateString) return '-';
      return format(new Date(dateString), 'dd MMM yyyy HH:mm', { locale: id });
    } catch (error) {
      console.error('Error formatting date:', dateString, error);
      return dateString || '-';
    }
  };

  const selectedRekening = rekeningOptions.find(
    r => r.kode_bank === selectedKodeBank && r.no_rekening === selectedNoRekening
  );

  // Sort riwayat data descending by createdAt
  const sortedRiwayatData = riwayatData ? [...riwayatData].sort((a, b) => 
    new Date(b.createdAt || b.tanggal).getTime() - new Date(a.createdAt || a.tanggal).getTime()
  ) : [];

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
        <div className="flex items-center gap-2">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Riwayat Saldo Rekening
            </h1>
            <p className="text-gray-600 mt-2">Pantau perubahan saldo rekening dari waktu ke waktu</p>
          </div>
        </div>

        {/* Filter and Balance Section */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Filter Section */}
          <div className="bg-white/50 rounded-lg p-6 border-2 border-dashed border-blue-200">
            <div className="space-y-4">
              <div className="flex items-center gap-2 mb-4">
                <Search className="w-5 h-5 text-blue-600" />
                <h3 className="text-lg font-semibold text-gray-900">Pilih Rekening</h3>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="kode_bank" className="text-sm text-gray-700">Kode Bank</Label>
                  <Select value={selectedKodeBank} onValueChange={setSelectedKodeBank}>
                    <SelectTrigger className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                      <SelectValue placeholder="Pilih kode bank" />
                    </SelectTrigger>
                    <SelectContent>
                      {[...new Set(rekeningOptions.map(r => r.kode_bank))].map((kode) => (
                        <SelectItem key={kode} value={kode}>
                          {kode}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="no_rekening" className="text-sm text-gray-700">Nomor Rekening</Label>
                  <Select
                    value={selectedNoRekening}
                    onValueChange={setSelectedNoRekening}
                    disabled={!selectedKodeBank}
                  >
                    <SelectTrigger className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                      <SelectValue placeholder="Pilih nomor rekening" />
                    </SelectTrigger>
                    <SelectContent>
                      {rekeningOptions
                        .filter(r => r.kode_bank === selectedKodeBank)
                        .map((rekening) => (
                          <SelectItem key={rekening.no_rekening} value={rekening.no_rekening}>
                            {rekening.no_rekening} - {rekening.nama_rekening}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Date Range Filter */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="start_date" className="text-sm text-gray-700">Tanggal Mulai</Label>
                  <Input
                    id="start_date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="end_date" className="text-sm text-gray-700">Tanggal Akhir</Label>
                  <Input
                    id="end_date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
              </div>

              <Button
                onClick={handleSearch}
                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                <Search className="w-4 h-4 mr-2" />
                Cari Riwayat
              </Button>
            </div>
          </div>

          {/* Current Balance Info */}
          <div className="bg-white/50 rounded-lg p-6 border-2 border-dashed border-green-200">
            {selectedRekening ? (
              <>
                <div className="flex items-center gap-2 mb-4">
                  <Eye className="w-5 h-5 text-green-600" />
                  <h3 className="text-lg font-semibold text-gray-900">Informasi Rekening</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200/50">
                    <Label className="text-xs text-green-700 font-medium">Kode Bank</Label>
                    <p className="font-bold text-green-900 text-lg">{selectedRekening.kode_bank}</p>
                  </div>
                  <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-200/50">
                    <Label className="text-xs text-green-700 font-medium">Nomor Rekening</Label>
                    <p className="font-bold text-green-900 text-lg">{selectedRekening.no_rekening}</p>
                  </div>
                  <div className="md:col-span-2 bg-gradient-to-r from-emerald-100 to-green-100 p-5 rounded-lg border border-emerald-300/60">
                    <Label className="text-xs text-green-700 font-medium">Saldo Saat Ini</Label>
                    <p className="font-bold text-green-900 text-3xl tracking-tight">{formatCurrency(selectedRekening.saldo)}</p>
                  </div>
                </div>
              </>
            ) : (
              <div className="text-center py-12">
                <Eye className="w-8 h-8 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">Pilih rekening untuk melihat informasi</p>
              </div>
            )}
          </div>
        </div>

        {/* Riwayat Table */}
        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <div className="p-5 border-b border-blue-200/50">
            <div className="flex items-center gap-2">
              <History className="w-5 h-5 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Riwayat Perubahan Saldo</h3>
            </div>
            <p className="text-gray-600 mt-1">Daftar perubahan saldo rekening dari waktu ke waktu</p>
          </div>

          {isLoadingRiwayat ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
              <p className="text-gray-600 mt-4">Memuat data riwayat...</p>
            </div>
          ) : sortedRiwayatData && sortedRiwayatData.length > 0 ? (
            <div className="overflow-x-auto">
              <Table className="w-full">
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                    <TableHead className="px-6 py-4 font-semibold text-gray-900">Tanggal</TableHead>
                    <TableHead className="px-6 py-4 font-semibold text-gray-900">Keterangan</TableHead>
                    <TableHead className="px-6 py-4 text-right font-semibold text-gray-900">Saldo Awal</TableHead>
                    <TableHead className="px-6 py-4 text-right font-semibold text-gray-900">Masuk</TableHead>
                    <TableHead className="px-6 py-4 text-right font-semibold text-gray-900">Keluar</TableHead>
                    <TableHead className="px-6 py-4 text-right font-semibold text-gray-900">Saldo Akhir</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sortedRiwayatData.map((item: RiwayatSaldoRekening) => (
                    <TableRow key={item._id} className="hover:bg-blue-50/50 transition-colors duration-150">
                      <TableCell className="px-6 py-4 text-gray-900 font-medium">{formatDate(item.created_at)}</TableCell>
                      <TableCell className="px-6 py-4 text-gray-700">{item.keterangan}</TableCell>
                      <TableCell className="px-6 py-4 text-right text-gray-900 font-medium">{formatCurrency(item.saldo_awal)}</TableCell>
                      <TableCell className={`px-6 py-4 text-right font-semibold ${Number(item.saldo_masuk || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {formatSignedCurrency(item.saldo_masuk)}
                      </TableCell>
                      <TableCell className={`px-6 py-4 text-right font-semibold ${Number(item.saldo_keluar || 0) >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {formatSignedCurrency(-Number(item.saldo_keluar || 0))}
                      </TableCell>
                      <TableCell className="px-6 py-4 text-right text-gray-900 font-bold">{formatCurrency(item.saldo_akhir)}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <History className="w-8 h-8 text-blue-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Belum ada riwayat</h3>
              <p className="text-gray-600">
                {selectedKodeBank && selectedNoRekening
                  ? 'Tidak ada riwayat saldo untuk rekening ini'
                  : 'Pilih rekening untuk melihat riwayat saldo'
                }
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default RiwayatSaldoRekening;
