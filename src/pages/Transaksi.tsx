import { useState, useEffect } from 'react';
// Helper: extract year from fiscal month string (e.g. 'JAN-25' or 'JAN - 25')
function getFiscalMonthYear(bulanFiskal: string): number | null {
  if (!bulanFiskal) return null;
  const match = bulanFiskal.match(/\d{2}$/);
  if (!match) return null;
  // Assume fiscalYear is always 20xx, so '25' means 2025
  const year2Digit = parseInt(match[0], 10);
  return 2000 + year2Digit;
}
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import axiosInstance from '@/api/axiosInstance';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import {
  Pagination,
  PaginationContent,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination';
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
import { Plus } from 'lucide-react';
import { log } from 'console';

interface Transaksi {
  _id?: string;
  kategori_id: string;
  kategori_nama?: string;
  subkategori_id: string;
  subkategori_nama?: string;
  akun_id: string;
  akun_nama?: string;
  bulan_fiskal: string;
  nilai: number;
  input_by: string;
  keterangan?: string;
  created_at?: string;
  tanggal?: string; // tambahkan tanggal untuk date picker
}


interface Option {
  _id: string;
  nama: string;
}

// Bulan fiskal dinamis dari backend
const currentYear = new Date().getFullYear();

export default function Transaksi() {
  // Tahun fiskal global dari store
  const { fiscalYear } = useAppStore();

  // ...existing state declarations...

  // ...existing state declarations...

  // ...existing state declarations...

  // Place fiscal month validation hooks here, after all state declarations:
  // (already declared below after formData, editModalOpen, editData)



  // Sorting state for Kategori
  const [kategoriSort, setKategoriSort] = useState<'asc' | 'desc' | null>(null);

  // Handler for sorting Kategori
  const handleSortKategori = () => {
    setKategoriSort((prev) => {
      if (prev === 'asc') return 'desc';
      if (prev === 'desc') return null;
      return 'asc';
    });
  };
        // State for view keterangan modal
        const [viewKeteranganOpen, setViewKeteranganOpen] = useState(false);
        const [viewKeteranganText, setViewKeteranganText] = useState<string | null>(null);

        // Handler to open keterangan modal
        const handleViewKeterangan = (row: any) => {
          setViewKeteranganText(row.keterangan || '-');
          setViewKeteranganOpen(true);
        };
      // Filter states
  const [typeData, setTypeData] = useState<'Detail' | 'Rekap'>('Detail');
  const [filterTanggalDari, setFilterTanggalDari] = useState('');
  const [filterTanggalSampai, setFilterTanggalSampai] = useState('');

  // Helper: get fiscal month date range (calendar month: 1..end-of-month)
  function getFiscalMonthRange(now: Date) {
    const year = now.getFullYear();
    const month = now.getMonth(); // 0-based
    const pad = (n: number) => n.toString().padStart(2, '0');
    const dari = `${year}-${pad(month + 1)}-01`;
    // last day of month: create date of first day next month, subtract 1 day
    const nextMonth = new Date(year, month + 1, 1);
    const lastDayDate = new Date(nextMonth.getTime() - 24 * 60 * 60 * 1000);
    const sampai = `${lastDayDate.getFullYear()}-${pad(lastDayDate.getMonth() + 1)}-${pad(lastDayDate.getDate())}`;
    return { dari, sampai };
  }



  // Set default filter tanggal for Detail mode to current fiscal month
  useEffect(() => {
    if (typeData === 'Detail') {
      const { dari, sampai } = getFiscalMonthRange(new Date());
      setFilterTanggalDari(dari);
      setFilterTanggalSampai(sampai);
    }
  }, [typeData, fiscalYear]);

  const [filterBulan, setFilterBulan] = useState('ALL');
  const [filterTahun, setFilterTahun] = useState(currentYear.toString());
  const [filterKategori, setFilterKategori] = useState('');
  const [filterSubKategori, setFilterSubKategori] = useState('');
    // Helper untuk menentukan bulan fiskal dari tanggal (calendar month)
    function getFiscalMonthFromDate(dateStr: string): string {
      if (!dateStr) return '';
      const date = new Date(dateStr);
      const month = date.getMonth(); // 0-based
      const year = date.getFullYear();
      const monthShorts = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
      return `${monthShorts[month]}-${String(year).slice(-2)}`;
    }
  const [addModalOpen, setAddModalOpen] = useState(false);
  // Fetch fiscal months dari backend
  const {
    data: fiscalMonthsData,
    isLoading: isMonthsLoading,
    refetch: refetchFiscalMonths
  } = useQuery({
    queryKey: ['fiscal-months', fiscalYear],
    queryFn: async () => {
      const res = await axiosInstance.get(`/fiscal/months?tahun=${fiscalYear}`);
      return res.data.months || [];
    },
  });

  // Refresh fiscal months setiap tahun fiskal berubah
  useEffect(() => {
    refetchFiscalMonths();
  }, [fiscalYear, refetchFiscalMonths]);
  // Reset bulan fiskal di form ketika tahun fiskal berubah agar tidak memegang nilai lama
  useEffect(() => {
    setFormData(prev => ({ ...prev, bulan_fiskal: '' }));
  }, [fiscalYear]);
      const [editModalOpen, setEditModalOpen] = useState(false);
      const [editData, setEditData] = useState<any>(null);
      const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
      const [deleteData, setDeleteData] = useState<any>(null);

      // Handler edit transaksi (open modal) for flattened row
      const handleEdit = async (row: any) => {
        // Fetch detail data from tt_finance_detail by _id
        try {
          const res = await axiosInstance.get(`/transaksi/tt-finance-detail?id=${row._id}`);
          // Find the correct detail by _id
          let detail = null;
          if (res.data.data && Array.isArray(res.data.data)) {
            detail = res.data.data.find((d: any) => d._id === row._id) || row;
          } else {
            detail = row;
          }
          // Use bulan from detail, not from fiscalMonthsData
          const formattedValue = formatNumberInput(detail.nilai?.toString() || '0');
          setEditFormattedNilai(formattedValue);
          setEditData({
            id: detail._id,
            kategori: detail.kategori,
            sub_kategori: detail.sub_kategori,
            akun: detail.akun,
            bulan: getFiscalMonthFromDate(detail.tanggal || ''),
            nilai: detail.nilai,
            input_by: detail.input_by || detail.created_by,
            tanggal: detail.tanggal || '',
            keterangan: detail.keterangan || '',
          });
          setEditModalOpen(true);
        } catch (err) {
          toast.error('Gagal mengambil detail transaksi.');
        }
      };

      // Reset bulan fiskal in edit modal when tahun fiskal changes
      useEffect(() => {
        if (editModalOpen) {
          setEditData((prev) => prev ? { ...prev, bulan: '' } : prev);
        }
      }, [fiscalYear, editModalOpen]);

      // Handler simpan edit
      const handleEditSave = async () => {
        try {
          // Pastikan field sama dengan tambah data
          const payload = {
            kategori: editData.kategori,
            sub_kategori: editData.sub_kategori,
            akun: editData.akun,
            bulan: editData.bulan,
            nilai: editData.nilai,
            input_by: editData.input_by,
            tanggal: editData.tanggal,
            keterangan: editData.keterangan,
          };
          await axiosInstance.put(`/transaksi/${editData.id}`, payload);
          setEditModalOpen(false);
          setEditData(null);
          queryClient.invalidateQueries({ queryKey: ['transaksi'] });
          toast.success('Transaksi berhasil diupdate!');
        } catch (err: any) {
          const msg = err?.response?.data?.message || 'Gagal update transaksi.';
          toast.error(msg);
        }
      };

      // Handler hapus transaksi bulanan - open confirmation dialog
      const handleDelete = (row: any) => {
        setDeleteData(row);
        setDeleteDialogOpen(true);
      };

      // Handler konfirmasi hapus
      const handleConfirmDelete = async () => {
        if (!deleteData) return;
        try {
          const parentId = deleteData.parentId || deleteData._id;
          await axiosInstance.delete(`/transaksi/${parentId}`, {
            data: { deleted_by: user?.name || 'SYSTEM' }
          });
          queryClient.invalidateQueries({ queryKey: ['transaksi'] });
          toast.success('Transaksi berhasil dihapus!');
          setDeleteDialogOpen(false);
          setDeleteData(null);
        } catch {
          toast.error('Gagal menghapus transaksi.');
        }
      };
        // ...existing code...
      const queryClient = useQueryClient();
      const [page, setPage] = useState<number>(1);
      const [pageSize, setPageSize] = useState<number>(10);

  const [formData, setFormData] = useState<Transaksi>({
    kategori_id: '',
    subkategori_id: '',
    akun_id: '',
    bulan_fiskal: '',
    nilai: 0,
    input_by: '',
    keterangan: '',
    tanggal: '', // tambahkan tanggal untuk date picker
  });

  // Fiscal month validation hooks (must be after formData, editModalOpen, editData)
  const [fiscalMonthInvalid, setFiscalMonthInvalid] = useState(false);
  const [fiscalMonthAlert, setFiscalMonthAlert] = useState('');

  useEffect(() => {
    if (!formData?.bulan_fiskal) {
      setFiscalMonthInvalid(false);
      setFiscalMonthAlert('');
      return;
    }
    const fiscalMonthYear = getFiscalMonthYear(formData.bulan_fiskal);
    if (fiscalMonthYear && fiscalMonthYear > fiscalYear) {
      setFiscalMonthInvalid(true);
      setFiscalMonthAlert('Bulan fiskal melebihi tahun fiskal yang diizinkan. Simpan dinonaktifkan.');
    } else {
      setFiscalMonthInvalid(false);
      setFiscalMonthAlert('');
    }
  }, [formData?.bulan_fiskal, fiscalYear]);

  useEffect(() => {
    if (!editModalOpen || !editData?.tanggal) {
      setFiscalMonthInvalid(false);
      setFiscalMonthAlert('');
      return;
    }
    const bulanFiskal = getFiscalMonthFromDate(editData.tanggal);
    const fiscalMonthYear = getFiscalMonthYear(bulanFiskal);
    if (fiscalMonthYear && fiscalMonthYear > fiscalYear) {
      setFiscalMonthInvalid(true);
      setFiscalMonthAlert('Bulan fiskal melebihi tahun fiskal yang diizinkan. Simpan dinonaktifkan.');
    } else {
      setFiscalMonthInvalid(false);
      setFiscalMonthAlert('');
    }
  }, [editModalOpen, editData?.tanggal, fiscalYear]);

  // Formatted input values for display
  const [formattedNilai, setFormattedNilai] = useState('');
  const [editFormattedNilai, setEditFormattedNilai] = useState('');

  // Persist selected bulan per fiscal year in localStorage so refresh keeps selection
  const selectedMonthKey = `transaksi_selected_bulan_${fiscalYear}`;

  // When fiscalMonthsData loads, pick a sensible default (stored selection or first month)
  useEffect(() => {
    if (!fiscalMonthsData || fiscalMonthsData.length === 0) return;
    const stored = localStorage.getItem(selectedMonthKey);
    // Normalize comparison to avoid issues with spacing/formatting
    const monthsNormalized = fiscalMonthsData.map((m: string) => (m || '').trim());
    if (stored) {
      const storedNorm = stored.trim();
      const matchIndex = monthsNormalized.findIndex((m: string) => m === storedNorm);
      if (matchIndex !== -1) {
        const matched = fiscalMonthsData[matchIndex];
        setFormData(prev => ({ ...prev, bulan_fiskal: matched }));
        return;
      }
    }
    // Prefer current month (formatted as e.g. 'MAR - 25') if present, otherwise default to first
    const now = new Date();
    const monthShorts = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
    const prefer = `${monthShorts[now.getMonth()]} - ${now.getFullYear().toString().slice(-2)}`;
    const preferIndex = monthsNormalized.findIndex((m: string) => m === prefer);
    const defaultMonth = preferIndex !== -1 ? fiscalMonthsData[preferIndex] : fiscalMonthsData[0];
    setFormData(prev => ({ ...prev, bulan_fiskal: defaultMonth }));
    localStorage.setItem(selectedMonthKey, defaultMonth);
  }, [fiscalMonthsData, selectedMonthKey]);

  // Save user's selection when bulan_fiskal changes
  useEffect(() => {
    if (formData.bulan_fiskal) {
      localStorage.setItem(selectedMonthKey, formData.bulan_fiskal);
    }
  }, [formData.bulan_fiskal, selectedMonthKey]);
  // ...existing code...
  const { user } = useAppStore();

  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['kategori'],
    queryFn: async () => {
      const response = await axiosInstance.get('/master/kategori');
      return response.data || [];
    },
  });

  // Fetch all subcategories (no filter)
  const { data: subCategories = [] } = useQuery({
    queryKey: ['subkategori'],
    queryFn: async () => {
      const response = await axiosInstance.get('/master/subkategori');
      return response.data || [];
    },
  });

  // Fetch all akun (no filter)
  const { data: accounts = [] } = useQuery({
    queryKey: ['akun'],
    queryFn: async () => {
      const response = await axiosInstance.get('/master/akun');
      return response.data || [];
    },
  });

  // Filter sub kategori sesuai kategori yang dipilih (backend: kategori = nama)
  const filteredSubCategories = formData.kategori_id
    ? subCategories.filter((sub) => {
        const selectedKategori = categories.find((cat) => cat._id === formData.kategori_id)?.kategori;
        return sub.kategori === selectedKategori;
      })
    : [];

  // Filter akun sesuai sub kategori yang dipilih (backend: sub_kategori = nama)
  const filteredAccounts = formData.subkategori_id && formData.kategori_id
    ? accounts.filter((acc) => {
      
        const selectedSubKategori = subCategories.find((sk) => sk._id === formData.subkategori_id);
        const selectedKategori = categories.find((cat) => cat._id === formData.kategori_id)?.kategori;
        console.log(selectedKategori);
        console.log(selectedSubKategori);
        console.log("MENCARI", selectedSubKategori?.sub_kategori);
        console.log("SUB KAREGORI KODE", selectedSubKategori?.kode);
        
        console.log(acc.sub_kategori === selectedSubKategori?.sub_kategori);
        console.log(acc.kategori === selectedKategori);
        console.log(acc.sub_kategori_kode === selectedSubKategori?.kode);
        
        console.log( acc.sub_kategori === selectedSubKategori?.sub_kategori &&
          acc.kategori === selectedKategori &&
          acc.sub_kategori_kode === selectedSubKategori?.kode);
        
        return (
          acc.sub_kategori === selectedSubKategori?.sub_kategori &&
          acc.kategori === selectedKategori &&
          acc.sub_kategori_kode === selectedSubKategori?.kode
        );
      })
    : [];

  // Filter untuk edit modal
  const editFilteredSubCategories = editData?.kategori
    ? subCategories.filter((sub) => sub.kategori === editData.kategori)
    : [];

  const editFilteredAccounts = editData?.sub_kategori && editData?.kategori
    ? accounts.filter((acc) => {
        const selectedSubKategori = subCategories.find((sk) => sk.sub_kategori === editData.sub_kategori);
        return (
          acc.sub_kategori === editData.sub_kategori &&
          acc.kategori === editData.kategori &&
          acc.sub_kategori_kode === selectedSubKategori?.kode
        );
      })
    : [];

  // Fetch data based on filter type
  const {
    data: transaksiResp,
    isLoading,
    error
  } = useQuery({
    queryKey: [
      'transaksi',
      typeData,
      page,
      pageSize,
      filterTanggalDari,
      filterTanggalSampai,
      filterBulan,
      filterTahun,
      filterKategori,
      filterSubKategori,
      fiscalYear,
      kategoriSort,
    ],
    queryFn: async () => {
      if (typeData === 'Detail') {
        // Query tt_finance_detail
        const params = new URLSearchParams();
        if (filterTanggalDari) params.append('from', filterTanggalDari);
        if (filterTanggalSampai) params.append('to', filterTanggalSampai);
        if (filterKategori && filterKategori !== 'ALL') params.append('kategori', filterKategori);
        if (filterSubKategori && filterSubKategori !== 'ALL') params.append('sub_kategori', filterSubKategori);
        params.append('page', String(page));
        params.append('limit', String(pageSize));
        if (kategoriSort) params.append('sortKategori', kategoriSort);
        const response = await axiosInstance.get(`/transaksi/tt-finance-detail?${params.toString()}`);
        return { data: response.data.data, totalPages: 1 };
      } else {
        // Query tt_finance (rekap)
        const params = new URLSearchParams();
        if (filterBulan && filterBulan !== 'ALL' && filterTahun) {
          const tahun2Digit = String(filterTahun).slice(-2);
          // Kirim dua format: "NOV-25" dan "NOV - 25" (tanpa dan dengan spasi)
          params.append('bulan', `${filterBulan}-${tahun2Digit}`);
          params.append('bulan', `${filterBulan} - ${tahun2Digit}`);
        }
        if (filterTahun) params.append('tahun', filterTahun);
        if (filterKategori && filterKategori !== 'ALL') params.append('kategori', filterKategori);
        if (filterSubKategori && filterSubKategori !== 'ALL') params.append('sub_kategori', filterSubKategori);
        params.append('flatten', '1');
        params.append('page', String(page));
        params.append('limit', String(pageSize));
        if (kategoriSort) params.append('sortKategori', kategoriSort);
        const response = await axiosInstance.get(`/transaksi?${params.toString()}`);
        return { data: response.data.data, totalPages: response.data.totalPages };
      }
    },
  });

  const transaksiList = (transaksiResp as any)?.data || [];
  // Sort ascending: Detail by tanggal, Rekap by bulan (fiscal order DEC..NOV)
  const sortedTransaksiList = (() => {
    const arr = Array.isArray(transaksiList) ? [...transaksiList] : [];
    if (typeData === 'Detail') {
      return arr.sort((a: any, b: any) => {
        const da = new Date(a.tanggal || '1970-01-01').getTime();
        const db = new Date(b.tanggal || '1970-01-01').getTime();
        return da - db;
      });
    } else {
      const order = ["DEC", "JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV"];
      const idx = (m: string) => {
        const key = (m || '').toUpperCase().replace(/\s+/g, '').substring(0,3);
        const i = order.indexOf(key);
        return i === -1 ? 999 : i;
      };
      return arr.sort((a: any, b: any) => idx(a.bulan) - idx(b.bulan));
    }
  })();
  const totalPages = (transaksiResp as any)?.totalPages || 1;
  // Reset to first page if pageSize changes
  useEffect(() => {
    setPage(1);
  }, [pageSize]);

  // Create transaksi mutation
  const createMutation = useMutation({
    mutationFn: async (payload: any) => {
      return axiosInstance.post('/transaksi', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['transaksi'] });
      toast.success('Transaksi berhasil ditambahkan!');
      setFormData({
        kategori_id: '',
        subkategori_id: '',
        akun_id: '',
        bulan_fiskal: '',
        nilai: 0,
        input_by: '',
      });
      setFormattedNilai('');
    },
    onError: (error: any) => {
      const msg = error?.response?.data?.message || 'Gagal menyimpan transaksi. Silakan coba lagi.';
      toast.error(msg);
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Ambil nama sub_kategori dan akun dari master data
    const akunObj = accounts.find((a) => a._id === formData.akun_id);
    const subKategoriObj = subCategories.find((sk) => sk._id === formData.subkategori_id);
    // Ambil tahun dari bulan_fiskal
    const kategoriObj = categories.find((k) => k._id === formData.kategori_id);
    const payload = {
      kategori: kategoriObj?.kategori || '',
      sub_kategori: subKategoriObj?.sub_kategori || '',
      akun: akunObj?.akun || '',
      bulan: formData.bulan_fiskal,
      nilai: formData.nilai,
      input_by: user?.name || 'Unknown',
      tanggal: formData.tanggal, // pastikan tanggal dikirim ke backend
      keterangan: formData.keterangan || '',
    };
    createMutation.mutate(payload);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(value);
  };

  // Format number for input display (Indonesian format: 100.000)
  const formatNumberInput = (value: string) => {
    // Remove all non-numeric characters
    const numericValue = value.replace(/[^\d]/g, '');
    // Format with dots as thousand separators
    return numericValue.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  };

  // Parse formatted input back to number
  const parseFormattedInput = (value: string) => {
    return parseFloat(value.replace(/\./g, '')) || 0;
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
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Transaksi
            </h1>
            <p className="text-gray-600 mt-2">Kelola transaksi dengan mudah dan efisien</p>
          </div>
          <Button
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
            onClick={() => setAddModalOpen(true)}
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Data
          </Button>
        </div>
        {/* FILTER BAR - moved below title, above table */}
        <div className="flex flex-wrap gap-4 items-end bg-white/80 rounded-lg shadow p-4 mb-6">
          {/* Type Data */}
          <div className="flex flex-col">
            <Label htmlFor="typeData" className="text-sm font-semibold text-gray-700 mb-1">Type Data</Label>
            <Select value={typeData} onValueChange={v => setTypeData(v as 'Detail' | 'Rekap')}>
              <SelectTrigger className="w-32 border-2 border-gray-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Detail">Detail</SelectItem>
                <SelectItem value="Rekap">Rekap</SelectItem>
              </SelectContent>
            </Select>
          </div>
          {/* Filter for Detail */}
          {typeData === 'Detail' && (
            <>
              <div className="flex flex-col">
                <Label htmlFor="tanggalDari" className="text-sm font-semibold text-gray-700 mb-1">Tanggal Dari</Label>
                <Input id="tanggalDari" type="date" value={filterTanggalDari} onChange={e => setFilterTanggalDari(e.target.value)} className="border-2 border-gray-200" />
              </div>
              <div className="flex flex-col">
                <Label htmlFor="tanggalSampai" className="text-sm font-semibold text-gray-700 mb-1">Tanggal Sampai</Label>
                <Input id="tanggalSampai" type="date" value={filterTanggalSampai} onChange={e => setFilterTanggalSampai(e.target.value)} className="border-2 border-gray-200" />
              </div>
            </>
          )}
          {/* Filter for Rekap */}
          {typeData === 'Rekap' && (
            <>
              <div className="flex flex-col">
                <Label htmlFor="filterBulan" className="text-sm font-semibold text-gray-700 mb-1">Bulan</Label>
                <Select value={filterBulan} onValueChange={setFilterBulan}>
                  <SelectTrigger className="w-32 border-2 border-gray-200">
                    <SelectValue placeholder="Pilih Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">Semua</SelectItem>
                    {['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'].map((bulan) => (
                      <SelectItem key={bulan} value={bulan}>{bulan}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col">
                <Label htmlFor="filterTahun" className="text-sm font-semibold text-gray-700 mb-1">Tahun</Label>
                <Input id="filterTahun" type="number" value={filterTahun} onChange={e => setFilterTahun(e.target.value)} className="border-2 border-gray-200 w-24" />
              </div>
            </>
          )}
          {/* Filter Kategori */}
          <div className="flex flex-col">
            <Label htmlFor="filterKategori" className="text-sm font-semibold text-gray-700 mb-1">Kategori</Label>
            <Select value={filterKategori || 'ALL'} onValueChange={v => setFilterKategori(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-40 border-2 border-gray-200">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                {categories.map((cat) => (
                  <SelectItem key={cat._id} value={cat.kategori}>{cat.kategori}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Filter Sub Kategori */}
          <div className="flex flex-col">
            <Label htmlFor="filterSubKategori" className="text-sm font-semibold text-gray-700 mb-1">Sub Kategori</Label>
            <Select value={filterSubKategori || 'ALL'} onValueChange={v => setFilterSubKategori(v === 'ALL' ? '' : v)}>
              <SelectTrigger className="w-40 border-2 border-gray-200">
                <SelectValue placeholder="Semua" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">Semua</SelectItem>
                {subCategories
                  .filter((sk) => !filterKategori || sk.kategori === filterKategori)
                  .map((sk) => (
                    <SelectItem key={sk._id} value={sk.sub_kategori}>{sk.sub_kategori}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Modal Input Transaksi */}
        {addModalOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                      Input Transaksi
                    </h3>
                    <p className="text-gray-600 mt-1">Tambah transaksi baru</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setAddModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    ✕
                  </Button>
                </div>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {fiscalMonthInvalid && fiscalMonthAlert && (
                    <div className="bg-red-100 border border-red-300 text-red-700 rounded-lg px-4 py-2 mb-2 text-sm font-semibold">
                      {fiscalMonthAlert}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tanggal */}
                    <div className="grid gap-2">
                      <Label htmlFor="tanggal" className="text-sm font-semibold text-gray-700">Tanggal</Label>
                      <Input
                        id="tanggal"
                        type="date"
                        value={formData.tanggal || ''}
                        onChange={e => {
                          const tanggal = e.target.value;
                          // Hitung bulan fiskal otomatis
                          const bulan_fiskal_otomatis = getFiscalMonthFromDate(tanggal);
                          setFormData({ ...formData, tanggal, bulan_fiskal: bulan_fiskal_otomatis });
                        }}
                        className="border-2 border-gray-200 transition-all duration-200"
                        required
                      />
                    </div>
                    {/* Bulan Fiskal */}
                    <div className="grid gap-2">
                      <Label htmlFor="bulan_fiskal" className="text-sm font-semibold text-gray-700">Bulan Fiskal</Label>
                      <Input
                        id="bulan_fiskal"
                        type="text"
                        value={formData.bulan_fiskal || ''}
                        readOnly
                        disabled
                        className="border-2 border-blue-400 bg-blue-50 font-bold text-blue-900 transition-all duration-200 cursor-not-allowed placeholder:italic placeholder:text-blue-400"
                        placeholder="Bulan fiskal akan muncul di sini setelah tanggal dipilih"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="kategori" className="text-sm font-semibold text-gray-700">Kategori</Label>
                      <Select
                        value={formData.kategori_id}
                        onValueChange={(value) => {
                          setFormData({
                            ...formData,
                            kategori_id: value,
                                      subkategori_id: '',
                                      akun_id: '',
                                    });
                                  }}
                                >
                                  <SelectTrigger className="border-2 border-gray-200 transition-all duration-200">
                                    <SelectValue placeholder="Pilih kategori" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {categories.map((cat) => (
                                      <SelectItem key={cat._id} value={cat._id}>
                                        {cat.kategori}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {/* Sub Kategori */}
                              <div className="grid gap-2">
                                <Label htmlFor="subkategori" className="text-sm font-semibold text-gray-700">Sub Kategori</Label>
                                <Select
                                  value={formData.subkategori_id}
                                  onValueChange={(value) => {
                                    setFormData({ ...formData, subkategori_id: value, akun_id: '' });
                                  }}
                                  disabled={!formData.kategori_id}
                                >
                                  <SelectTrigger className="border-2 border-gray-200 transition-all duration-200">
                                    <SelectValue placeholder="Pilih sub kategori" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {filteredSubCategories.map((sub_kategori) => (
                                      <SelectItem key={sub_kategori._id} value={sub_kategori._id}>
                                        {sub_kategori.sub_kategori}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {/* Akun */}
                              <div className="grid gap-2">
                                <Label htmlFor="akun" className="text-sm font-semibold text-gray-700">Akun</Label>
                                <Select
                                  value={formData.akun_id}
                                  onValueChange={(value) =>
                                    setFormData({ ...formData, akun_id: value })
                                  }
                                  disabled={!formData.subkategori_id}
                                >
                                  <SelectTrigger className="border-2 border-gray-200 transition-all duration-200">
                                    <SelectValue placeholder="Pilih akun" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {filteredAccounts.map((acc) => (
                                      <SelectItem key={acc._id} value={acc._id}>
                                        {acc.akun}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {/* Nilai Transaksi (Rp) */}
                              <div className="grid gap-2">
                                <Label htmlFor="nilai" className="text-sm font-semibold text-gray-700">Nilai Transaksi (Rp)</Label>
                                <Input
                                  id="nilai"
                                  type="text"
                                  value={formattedNilai}
                                  onChange={(e) => {
                                    const formatted = formatNumberInput(e.target.value);
                                    const numericValue = parseFormattedInput(formatted);
                                    setFormattedNilai(formatted);
                                    setFormData({ ...formData, nilai: numericValue });
                                  }}
                                  placeholder="0"
                                  className="border-2 border-gray-200 transition-all duration-200"
                                  required
                                />
                              </div>
                            </div>
                            {/* Keterangan */}
                            <div className="grid gap-2 mt-2">
                              <Label htmlFor="keterangan" className="text-sm font-semibold text-gray-700">Keterangan</Label>
                              <Input
                                id="keterangan"
                                type="text"
                                value={formData.keterangan || ''}
                                onChange={e => {
                                  setFormData({ ...formData, keterangan: e.target.value.toUpperCase() });
                                }}
                                placeholder="(Opsional)"
                                className="border-2 border-gray-200 transition-all duration-200"
                                style={{ textTransform: 'uppercase' }}
                              />
                            </div>
                  <div className="flex justify-end pt-4">
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                      disabled={fiscalMonthInvalid}
                    >
                      <Plus className="w-5 h-5 mr-2" />
                      Simpan Transaksi
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* Daftar Transaksi */}
        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="w-12 px-4 py-4 font-semibold text-gray-900 text-center">No</TableHead>
                {typeData === 'Detail' ? (
                  <>
                    <TableHead className="w-28 px-6 py-4 font-semibold text-gray-900">Tanggal</TableHead>
                    <TableHead className="w-24 px-6 py-4 font-semibold text-gray-900">Bulan Fiskal</TableHead>
                  </>
                ) : (
                  <TableHead className="w-24 px-6 py-4 font-semibold text-gray-900">Bulan Fiskal</TableHead>
                )}
                <TableHead
                  className="w-32 px-6 py-4 font-semibold text-gray-900 cursor-pointer select-none group"
                  onClick={handleSortKategori}
                  title="Urutkan Kategori"
                >
                  <div className="flex items-center gap-2">
                    Kategori
                    <span className="inline-block align-middle ml-2">
                      {kategoriSort === 'asc' && (
                        <svg className="w-7 h-7 text-blue-900 font-extrabold inline drop-shadow-md" fill="none" viewBox="0 0 20 20"><path d="M10 6l-4 4h8l-4-4z" fill="currentColor"/></svg>
                      )}
                      {kategoriSort === 'desc' && (
                        <svg className="w-7 h-7 text-blue-900 font-extrabold inline drop-shadow-md" fill="none" viewBox="0 0 20 20"><path d="M10 14l4-4H6l4 4z" fill="currentColor"/></svg>
                      )}
                      {!kategoriSort && (
                        <svg className="w-7 h-7 text-gray-400 inline opacity-70" fill="none" viewBox="0 0 20 20"><path d="M10 6l-4 4h8l-4-4z" fill="currentColor"/></svg>
                      )}
                    </span>
                  </div>
                </TableHead>
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Sub Kategori</TableHead>
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Akun</TableHead>
                <TableHead className="w-32 px-6 py-4 font-semibold text-gray-900 text-right">Nilai</TableHead>
                <TableHead className="w-24 px-6 py-4 font-semibold text-gray-900">Input By</TableHead>
                {typeData === 'Detail' && (
                  <TableHead className="w-32 px-6 py-4 text-right font-semibold text-gray-900">Aksi</TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-600 font-medium">Memuat data transaksi...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : transaksiList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">Belum ada data transaksi</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                sortedTransaksiList.map((row: any, idx: number) => (
                  <TableRow key={(row.parentId || row._id) + '-' + idx} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                    <TableCell className="w-12 px-4 py-4 text-center font-semibold text-gray-900">{(page - 1) * pageSize + idx + 1}</TableCell>
                    {typeData === 'Detail' ? (
                      <>
                        <TableCell className="w-28 px-6 py-4 font-semibold text-gray-900">{row.tanggal}</TableCell>
                        <TableCell className="w-24 px-6 py-4 font-semibold text-gray-900">{row.bulan}</TableCell>
                      </>
                    ) : (
                      <TableCell className="w-24 px-6 py-4 font-semibold text-gray-900">{row.bulan}</TableCell>
                    )}
                    <TableCell className="w-32 px-6 py-4 font-medium text-gray-900">{row.kategori}</TableCell>
                    <TableCell className="w-40 px-6 py-4 text-gray-700">{row.sub_kategori}</TableCell>
                    <TableCell className="w-40 px-6 py-4 text-gray-700">{row.akun}</TableCell>
                    <TableCell className="w-32 px-6 py-4 text-gray-700 text-right font-medium">
                      {formatCurrency(row.nilai)}
                    </TableCell>
                    <TableCell className="w-24 px-6 py-4 text-gray-700">{row.input_by || row.created_by}</TableCell>
                    {typeData === 'Detail' && (
                      <TableCell className="w-32 px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          {/* View action (eye icon) */}
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewKeterangan(row)}
                            className="border-gray-300 hover:bg-gray-50 transition-all duration-200 p-2"
                            title="Lihat Keterangan"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(row)}
                            className="border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
                          >
                            Edit
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(row)}
                            className="border-red-300 hover:bg-red-50 hover:border-red-400 text-red-600 hover:text-red-700 transition-all duration-200"
                          >
                            Hapus
                          </Button>
                        </div>
                      </TableCell>

                    )}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>

          <div className="flex items-center justify-between p-6 border-t border-gray-100/50">
            <div className="flex items-center gap-3">
              <div className="text-sm text-gray-600 font-medium">Per halaman</div>
              <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
                <SelectTrigger className="w-24 border-2 border-gray-200 transition-all duration-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="text-sm text-gray-600 font-medium">Halaman {page} dari {totalPages}</div>

            <div>
              <Pagination>
                <PaginationContent>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page <= 1 ? 'opacity-50 pointer-events-none' : ''}
                  />
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={page >= totalPages ? 'opacity-50 pointer-events-none' : ''}
                  />
                </PaginationContent>
              </Pagination>
            </div>
          </div>
        </div>

        {/* Edit Modal */}
        {editModalOpen && editData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <div className="p-8">
                <div className="flex justify-between items-center mb-6">
                  <div>
                    <h3 className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                      Edit Transaksi
                    </h3>
                    <p className="text-gray-600 mt-1">Ubah data transaksi</p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditModalOpen(false)}
                    className="text-gray-400 hover:text-gray-600 transition-colors duration-200"
                  >
                    ✕
                  </Button>
                </div>
                <form onSubmit={e => { e.preventDefault(); handleEditSave(); }} className="space-y-6">
                  {fiscalMonthInvalid && fiscalMonthAlert && (
                    <div className="bg-red-100 border border-red-300 text-red-700 rounded-lg px-4 py-2 mb-2 text-sm font-semibold">
                      {fiscalMonthAlert}
                    </div>
                  )}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Tanggal */}
                    <div className="grid gap-2">
                      <Label htmlFor="edit-tanggal" className="text-sm font-semibold text-gray-700">Tanggal</Label>
                      <Input
                        id="edit-tanggal"
                        type="date"
                        value={editData.tanggal || ''}
                        onChange={e => {
                          const newTanggal = e.target.value;
                          setEditData(prev => ({
                            ...prev,
                            tanggal: newTanggal,
                            bulan: getFiscalMonthFromDate(newTanggal)
                          }));
                        }}
                        className="border-2 border-gray-200 transition-all duration-200"
                        required
                      />
                    </div>
                    {/* Bulan Fiskal */}
                    <div className="grid gap-2">
                      <Label htmlFor="edit-bulan" className="text-sm font-semibold text-gray-700">Bulan Fiskal</Label>
                      <Input
                        id="edit-bulan"
                        type="text"
                        value={editData.tanggal ? getFiscalMonthFromDate(editData.tanggal) : ''}
                        readOnly
                        disabled
                        className="border-2 border-blue-400 bg-blue-50 font-bold text-blue-900 transition-all duration-200 cursor-not-allowed placeholder:italic placeholder:text-blue-400"
                        placeholder="Bulan fiskal akan muncul di sini setelah tanggal dipilih"
                      />
                    </div>
                    {/* Kategori */}
                    <div className="grid gap-2">
                      <Label htmlFor="edit-kategori" className="text-sm font-semibold text-gray-700">Kategori</Label>
                      <Select
                        value={editData.kategori}
                        onValueChange={(value) => setEditData({ ...editData, kategori: value, sub_kategori: '', akun: '' })}
                      >
                        <SelectTrigger className="border-2 border-gray-200 transition-all duration-200">
                          <SelectValue placeholder="Pilih kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          {categories.map((cat) => (
                            <SelectItem key={cat._id} value={cat.kategori}>
                              {cat.kategori}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Sub Kategori */}
                    <div className="grid gap-2">
                      <Label htmlFor="edit-subkategori" className="text-sm font-semibold text-gray-700">Sub Kategori</Label>
                      <Select
                        value={editData.sub_kategori}
                        onValueChange={(value) => setEditData({ ...editData, sub_kategori: value, akun: '' })}
                        disabled={!editData.kategori}
                      >
                        <SelectTrigger className="border-2 border-gray-200 transition-all duration-200">
                          <SelectValue placeholder="Pilih sub kategori" />
                        </SelectTrigger>
                        <SelectContent>
                          {editFilteredSubCategories.map((sub) => (
                            <SelectItem key={sub._id} value={sub.sub_kategori}>
                              {sub.sub_kategori}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Akun */}
                    <div className="grid gap-2">
                      <Label htmlFor="edit-akun" className="text-sm font-semibold text-gray-700">Akun</Label>
                      <Select
                        value={editData.akun}
                        onValueChange={(value) => setEditData({ ...editData, akun: value })}
                        disabled={!editData.sub_kategori}
                      >
                        <SelectTrigger className="border-2 border-gray-200 transition-all duration-200">
                          <SelectValue placeholder="Pilih akun" />
                        </SelectTrigger>
                        <SelectContent>
                          {editFilteredAccounts.map((acc) => (
                            <SelectItem key={acc._id} value={acc.akun}>
                              {acc.akun}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    {/* Nilai Transaksi (Rp) */}
                    <div className="grid gap-2">
                      <Label htmlFor="edit-nilai" className="text-sm font-semibold text-gray-700">Nilai Transaksi (Rp)</Label>
                      <Input
                        id="edit-nilai"
                        type="text"
                        value={editFormattedNilai}
                        onChange={(e) => {
                          const formatted = formatNumberInput(e.target.value);
                          const numericValue = parseFormattedInput(formatted);
                          setEditFormattedNilai(formatted);
                          setEditData({ ...editData, nilai: numericValue });
                        }}
                        placeholder="0"
                        className="border-2 border-gray-200 transition-all duration-200"
                      />
                    </div>
                    {/* Keterangan */}
                    <div className="grid gap-2 md:col-span-2">
                      <Label htmlFor="edit-keterangan" className="text-sm font-semibold text-gray-700">Keterangan</Label>
                      <Input
                        id="edit-keterangan"
                        type="text"
                        value={editData.keterangan || ''}
                        onChange={e => setEditData({ ...editData, keterangan: e.target.value.toUpperCase() })}
                        placeholder="(Opsional)"
                        className="border-2 border-gray-200 transition-all duration-200"
                        style={{ textTransform: 'uppercase' }}
                      />
                    </div>
                  </div>
                  <div className="flex justify-end gap-3 pt-6 border-t border-gray-100/50">
                    <Button
                      variant="outline"
                      onClick={() => setEditModalOpen(false)}
                      className="border-gray-300 hover:bg-gray-50 transition-all duration-200"
                    >
                      Batal
                    </Button>
                    <Button
                      type="submit"
                      className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                      disabled={fiscalMonthInvalid}
                    >
                      Simpan Perubahan
                    </Button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}

        {/* View Keterangan Modal - moved to end of component for valid JSX */}
        {viewKeteranganOpen && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-4">
                  <div className="w-10 h-10 bg-gradient-to-br from-blue-100 to-indigo-200 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  </div>
                  <h3 className="text-lg font-bold text-blue-900">Keterangan Transaksi</h3>
                </div>
                <div className="mb-6 text-gray-800 text-base whitespace-pre-line min-h-[40px]">
                  {viewKeteranganText}
                </div>
                <div className="flex justify-end">
                  <Button
                    variant="outline"
                    onClick={() => setViewKeteranganOpen(false)}
                    className="border-gray-300 hover:bg-gray-50 transition-all duration-200"
                  >
                    Tutup
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        {deleteDialogOpen && deleteData && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-white/95 backdrop-blur-md rounded-xl shadow-2xl max-w-md w-full">
              <div className="p-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-12 h-12 bg-gradient-to-br from-red-100 to-red-200 rounded-full flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-bold bg-gradient-to-r from-red-900 to-red-600 bg-clip-text text-transparent">
                      Konfirmasi Hapus
                    </h3>
                    <p className="text-gray-600 mt-1">Apakah Anda yakin ingin menghapus transaksi ini?</p>
                  </div>
                </div>

                <div className="bg-red-50/50 rounded-lg p-4 mb-6 border border-red-200/50">
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Bulan Fiskal:</span>
                      <span className="text-gray-900">{deleteData.bulan}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Kategori:</span>
                      <span className="text-gray-900">{deleteData.kategori}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Sub Kategori:</span>
                      <span className="text-gray-900">{deleteData.sub_kategori}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Akun:</span>
                      <span className="text-gray-900">{deleteData.akun}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-700">Nilai:</span>
                      <span className="text-gray-900 font-semibold">{formatCurrency(deleteData.nilai)}</span>
                    </div>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setDeleteDialogOpen(false);
                      setDeleteData(null);
                    }}
                    className="border-gray-300 hover:bg-gray-50 transition-all duration-200"
                  >
                    Batal
                  </Button>
                  <Button
                    onClick={handleConfirmDelete}
                    className="bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                  >
                    Hapus Transaksi
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
