import { useState, useMemo, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ModalForm } from '@/components/ModalForm';
import { Plus, Pencil, Trash2, Check, ChevronDown, ChevronRight, Search, X } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface Subscriber {
  _id?: string;
  kode: string;
  no_ok: string | null;
  sales: string | null;
  toko: string;
  alamat: string | null;
  daerah: string;
  program: string;
  internal_kode: string;
  vb_online: string | null;
  biaya: number;
  prev_subscriber: number;
  current_subscriber: number;
  prev_biaya: number;
  current_biaya: number;
  tanggal: string;
  implementator: string | null;
  via: 'VISIT' | 'ONLINE';
  status_aktv?: boolean;
  input_date?: string;
  update_date?: string;
  delete_date?: string | null;
  input_by: string;
  update_by?: string | null;
  delete_by?: string | null;
}

interface Program {
  _id: string;
  kode: string;
  nama: string;
  biaya: number;
  internal_kode: string;
}

export default function Subscriber() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Subscriber>({
    kode: '',
    no_ok: null,
    sales: null,
    toko: '',
    alamat: null,
    daerah: '',
    internal_kode: '',
    program: '',
    vb_online: null,
    biaya: 0,
    prev_subscriber: 0,
    current_subscriber: 0,
    prev_biaya: 0,
    current_biaya: 0,
    tanggal: '',
    implementator: null,
    via: 'VISIT',
    input_by: '',
  });
  const { user } = useAppStore();

  // Formatted input for biaya
  const [formattedBiaya, setFormattedBiaya] = useState('');

  // Pagination and Search states
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10); // Limit per page, can be changed by user
  const [searchField, setSearchField] = useState<string>('toko'); // Default search field
  const [searchValue, setSearchValue] = useState<string>('');
  const [debouncedSearchValue, setDebouncedSearchValue] = useState<string>('');
  const [programSearch, setProgramSearch] = useState('');
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [filterMonth, setFilterMonth] = useState<string>('ALL');
  const [filterYear, setFilterYear] = useState<string>('ALL');

  // Debounce searchValue
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearchValue(searchValue);
    }, 1000); // 1 second delay

    return () => clearTimeout(timer);
  }, [searchValue]);

  // Reset page to 1 when debounced search changes
  useEffect(() => {
    setPage(1);
  }, [debouncedSearchValue]);

  // Reset page to 1 when limit changes
  useEffect(() => {
    setPage(1);
  }, [limit]);

  // Reset page to 1 when month/year filter changes
  useEffect(() => {
    setPage(1);
  }, [filterMonth, filterYear]);

  // Fetch programs for dropdown
  const { data: programs = [] } = useQuery({
    queryKey: ['program'],
    queryFn: async () => {
      const response = await axiosInstance.get('/master/program');
      return response.data || [];
    },
  });

  // Fetch all available years for filter dropdown
  const { data: allYears = [] } = useQuery({
    queryKey: ['subscriber-years'],
    queryFn: async () => {
      const response = await axiosInstance.get('/subscriber/years');
      return response.data || [];
    },
  });

  // Filter programs based on search
  const filteredPrograms = programs.filter(program =>
    program.nama.toLowerCase().includes(programSearch.toLowerCase()) ||
    program.kode.toLowerCase().includes(programSearch.toLowerCase())
  );

  // Fetch subscribers with pagination and search
  const { data: response, isLoading, error } = useQuery({
    queryKey: ['subscriber', page, limit, searchField, debouncedSearchValue, filterMonth, filterYear],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });
      if (debouncedSearchValue.trim()) {
        params.append('searchField', searchField);
        params.append('searchValue', debouncedSearchValue);
      }
      if (filterMonth !== 'ALL') {
        params.append('month', filterMonth);
      }
      if (filterYear !== 'ALL') {
        params.append('year', filterYear);
      }
      const response = await axiosInstance.get(`/subscriber?${params.toString()}`);
      return response.data || { data: [], pagination: { total: 0 } };
    },
  });

  const data = response?.data || [];
  const pagination = response?.pagination || { total: 0 };

  // Use all years from database for filter dropdown
  const availableYears = allYears;

  const MONTH_OPTIONS: { value: string; label: string }[] = [
    { value: 'ALL', label: 'All' },
    { value: '1', label: 'Januari' },
    { value: '2', label: 'Februari' },
    { value: '3', label: 'Maret' },
    { value: '4', label: 'April' },
    { value: '5', label: 'Mei' },
    { value: '6', label: 'Juni' },
    { value: '7', label: 'Juli' },
    { value: '8', label: 'Agustus' },
    { value: '9', label: 'September' },
    { value: '10', label: 'Oktober' },
    { value: '11', label: 'November' },
    { value: '12', label: 'Desember' },
  ];

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: Subscriber) => {
      if (editId) {
        return axiosInstance.put(`/subscriber/${editId}`, {
          no_ok: payload.no_ok,
          sales: payload.sales,
          toko: payload.toko,
          alamat: payload.alamat,
          daerah: payload.daerah,
          internal_kode: payload.internal_kode,
          program: payload.program,
          vb_online: payload.vb_online,
          biaya: payload.biaya,
          tanggal: payload.tanggal,
          implementator: payload.implementator,
          via: payload.via,
          update_by: user?.name || 'Unknown',
        });
      }
      return axiosInstance.post('/subscriber', {
        no_ok: payload.no_ok,
        sales: payload.sales,
        toko: payload.toko,
        alamat: payload.alamat,
        daerah: payload.daerah,
        internal_kode: payload.internal_kode,
        program: payload.program,
        vb_online: payload.vb_online,
        biaya: payload.biaya,
        tanggal: payload.tanggal,
        implementator: payload.implementator,
        via: payload.via,
        input_by: payload.input_by
      });
    },
    onSuccess: () => {
      return; // handled in onSettled
    },
    onError: () => { /* handled in onSettled */ },
    onSettled: (data: any, error: any) => {
      queryClient.invalidateQueries({ queryKey: ['subscriber'] });
      const serverMsg = data?.data?.message || error?.response?.data?.message;
      if (serverMsg) {
        if (error) toast.error(serverMsg); else toast.success(serverMsg);
      } else {
        if (error) toast.error('Gagal menyimpan data. Silakan coba lagi.'); else toast.success('Data berhasil disimpan.');
      }
      if (!error) handleCloseModal();
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/subscriber/${id}`, {
      data: { delete_by: user?.name || 'Unknown' },
    }),
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['subscriber'] });
      const msg = resp?.data?.message || 'Subscriber berhasil dihapus!';
      toast.success(msg);
    },
    onError: (error: any) => {
      const serverMsg = error?.response?.data?.message;
      if (serverMsg) {
        toast.error(serverMsg);
      } else {
        toast.error('Gagal menghapus subscriber!');
      }
    },
  });

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

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, input_by: user?.name || 'Unknown' };
    saveMutation.mutate(payload);
  };

  const handleEdit = (item: Subscriber) => {
    setEditId(item.kode);
    setFormData({
      ...item,
      tanggal: item.tanggal ? new Date(item.tanggal).toISOString().split('T')[0] : '',
    });
    setFormattedBiaya(formatNumberInput(item.biaya.toString()));
    setModalOpen(true);
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (deleteId) {
      deleteMutation.mutate(deleteId);
      setShowDeleteDialog(false);
      setDeleteId(null);
    }
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
    setFormData({
      kode: '',
      no_ok: null,
      sales: null,
      toko: '',
      alamat: null,
      daerah: '',
      internal_kode: '',
      program: '',
      vb_online: null,
      biaya: 0,
      prev_subscriber: 0,
      current_subscriber: 0,
      prev_biaya: 0,
      current_biaya: 0,
      tanggal: '',
      implementator: null,
      via: 'VISIT',
      input_by: ''
    });
    setFormattedBiaya('');
    setProgramSearch('');
  };

  const handleProgramSelect = (program: Program) => {
    setFormData({
      ...formData,
      program: program.nama,
      biaya: program.biaya, 
      internal_kode: program.internal_kode
    });
    setFormattedBiaya(formatNumberInput(program.biaya.toString()));
  };

  const toggleRowExpansion = (id: string) => {
    const newExpandedRows = new Set(expandedRows);
    if (newExpandedRows.has(id)) {
      newExpandedRows.delete(id);
    } else {
      newExpandedRows.add(id);
    }
    setExpandedRows(newExpandedRows);
  };

  // Filter subscribers based on month/year (now done on backend)
  // const filteredSubscribers = data.filter((subscriber) => {
  //   // Month/Year filter based on `tanggal`
  //   let passMonthYear = true;
  //   if (filterMonth !== 'ALL' || filterYear !== 'ALL') {
  //     const d = subscriber?.tanggal ? new Date(subscriber.tanggal) : null;
  //     if (!d || isNaN(d.getTime())) return false;
  //     const y = String(d.getFullYear());
  //     const m = String(d.getMonth() + 1); // 1..12
  //     const monthOk = filterMonth === 'ALL' ? true : m === filterMonth;
  //     const yearOk = filterYear === 'ALL' ? true : y === filterYear;
  //     passMonthYear = monthOk && yearOk;
  //   }
  //   return passMonthYear;
  // });

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
              Master Subscriber
            </h1>
            <p className="text-gray-600 mt-2">Kelola data subscriber dengan mudah dan efisien</p>
          </div>
          <Button
            onClick={() => {
              setFormData({
                kode: '',
                no_ok: null,
                sales: null,
                toko: '',
                alamat: null,
                daerah: '',
                internal_kode: '',
                program: '',
                vb_online: null,
                biaya: 0,
                prev_subscriber: 0,
                current_subscriber: 0,
                prev_biaya: 0,
                current_biaya: 0,
                tanggal: '',
                implementator: null,
                via: 'VISIT',
                input_by: ''
              });
              setFormattedBiaya('');
              setModalOpen(true);
            }}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Subscriber
          </Button>
        </div>

        {/* Search Bar */}
        <div className="bg-white/50 rounded-lg p-6 border-2 border-dashed border-blue-200">
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="flex flex-col">
                <Label className="mb-1 text-sm text-gray-700">Bulan</Label>
                <Select value={filterMonth} onValueChange={setFilterMonth}>
                  <SelectTrigger className="w-44 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <SelectValue placeholder="Bulan" />
                  </SelectTrigger>
                  <SelectContent>
                    {MONTH_OPTIONS.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col">
                <Label className="mb-1 text-sm text-gray-700">Tahun</Label>
                <Select value={filterYear} onValueChange={setFilterYear}>
                  <SelectTrigger className="w-36 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <SelectValue placeholder="Tahun" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL">All</SelectItem>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y}>{y}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col">
                <Label className="mb-1 text-sm text-gray-700">Tampilkan</Label>
                <Select value={limit.toString()} onValueChange={(value) => setLimit(Number(value))}>
                  <SelectTrigger className="w-32 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <SelectValue placeholder="Limit" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="10">10</SelectItem>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex-1 relative">
              <div className="flex gap-2">
                <Select value={searchField} onValueChange={setSearchField}>
                  <SelectTrigger className="w-40 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <SelectValue placeholder="Field" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="toko">Toko</SelectItem>
                    <SelectItem value="daerah">Daerah</SelectItem>
                    <SelectItem value="program">Program</SelectItem>
                    <SelectItem value="internal_kode">Internal Kode</SelectItem>
                    <SelectItem value="kode">Kode</SelectItem>
                    <SelectItem value="sales">Sales</SelectItem>
                  </SelectContent>
                </Select>
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
                  <Input
                    placeholder={`Cari berdasarkan ${searchField}...`}
                    value={searchValue}
                    onChange={(e) => setSearchValue(e.target.value)}
                    className="pl-10 pr-10 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                  />
                  {searchValue && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setSearchValue('')}
                      className="absolute right-2 top-1/2 transform -translate-y-1/2 p-1 h-6 w-6 hover:bg-gray-100"
                    >
                      <X className="w-4 h-4 text-gray-400" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
            <div className="flex flex-col self-center leading-tight mt-4">
              <div className="text-sm font-semibold text-gray-700">
                Total Biaya: {formatCurrency(pagination.totalBiaya || 0)}
              </div>
              <div className="text-sm text-gray-600">
                {pagination.total || 0} subscriber (halaman {page} dari {pagination.totalPages || 1})
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <Table className="w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="w-12 px-4 py-4 font-semibold text-gray-900"></TableHead>
                <TableHead className="w-32 px-6 py-4 font-semibold text-gray-900">Toko</TableHead>
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Program</TableHead>
                <TableHead className="w-32 px-6 py-4 font-semibold text-gray-900">Internal Kode</TableHead>
                <TableHead className="w-32 px-6 py-4 font-semibold text-gray-900">Biaya</TableHead>
                <TableHead className="w-28 px-6 py-4 font-semibold text-gray-900">Tanggal</TableHead>
                <TableHead className="w-24 px-6 py-4 text-right font-semibold text-gray-900">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-600 font-medium">Memuat data subscriber...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : data.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={11} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">
                        {searchValue ? 'Tidak ada subscriber yang cocok dengan pencarian' : 'Belum ada data subscriber'}
                      </p>
                      {searchValue && (
                        <p className="text-sm text-gray-500">Coba ubah kata kunci pencarian</p>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                data.map((item) => (
                  <>
                    <TableRow key={item._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                      <TableCell className="w-12 px-4 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleRowExpansion(item._id || '')}
                          className="p-1 h-6 w-6 hover:bg-blue-100"
                        >
                          {expandedRows.has(item._id || '') ? (
                            <ChevronDown className="w-4 h-4 text-blue-600" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-blue-600" />
                          )}
                        </Button>
                      </TableCell>
                      <TableCell className="w-32 px-6 py-4 text-gray-700 font-medium">{item.toko}</TableCell>
                      <TableCell className="w-40 px-6 py-4 text-gray-700">{item.program}</TableCell>
                      <TableCell className="w-32 px-6 py-4 text-gray-700">{item.internal_kode || '-'}</TableCell>
                      <TableCell className="w-32 px-6 py-4 text-gray-700 font-semibold">{formatCurrency(item.biaya)}</TableCell>
                      <TableCell className="w-28 px-6 py-4 text-gray-700">{new Date(item.tanggal).toLocaleDateString('id-ID')}</TableCell>
                      <TableCell className="w-24 px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEdit(item)}
                            className="border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
                          >
                            <Pencil className="w-4 h-4" />
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDelete(item.kode)}
                            className="border-red-300 hover:bg-red-50 hover:border-red-400 text-red-600 hover:text-red-700 transition-all duration-200"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRows.has(item._id || '') && (
                      <TableRow className="bg-blue-50/30 border-b border-gray-100/50">
                        <TableCell colSpan={7} className="px-6 py-4">
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Kode:</span>
                                <span className="text-gray-900 font-semibold">{item.kode}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">NO OK:</span>
                                <span className="text-gray-900">{item.no_ok || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Sales:</span>
                                <span className="text-gray-900">{item.sales || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Daerah:</span>
                                <span className="text-gray-900">{item.daerah}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Prev Subscriber:</span>
                                <span className="text-gray-900">{item.prev_subscriber}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Current Subscriber:</span>
                                <span className="text-gray-900">{item.current_subscriber}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Alamat:</span>
                                <span className="text-gray-900">{item.alamat || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">VB Online:</span>
                                <span className="text-gray-900">{item.vb_online || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Implementator:</span>
                                <span className="text-gray-900">{item.implementator || '-'}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Via:</span>
                                <span className="text-gray-900">{item.via}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Prev Biaya:</span>
                                <span className="text-gray-900">{formatCurrency(item.prev_biaya)}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Current Biaya:</span>
                                <span className="text-gray-900">{formatCurrency(item.current_biaya)}</span>
                              </div>
                            </div>
                            <div className="space-y-2">
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Input By:</span>
                                <span className="text-gray-900">{item.input_by}</span>
                              </div>
                              <div className="flex justify-between">
                                <span className="font-medium text-gray-600">Status:</span>
                                <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  item.status_aktv ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                                }`}>
                                  {item.status_aktv ? 'Aktif' : 'Tidak Aktif'}
                                </span>
                              </div>
                              {item.input_date && (
                                <div className="flex justify-between">
                                  <span className="font-medium text-gray-600">Input Date:</span>
                                  <span className="text-gray-900">{new Date(item.input_date).toLocaleDateString('id-ID')}</span>
                                </div>
                              )}
                              {item.update_date && (
                                <div className="flex justify-between">
                                  <span className="font-medium text-gray-600">Update Date:</span>
                                  <span className="text-gray-900">{new Date(item.update_date).toLocaleDateString('id-ID')}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        {/* Pagination */}
        <div className="flex justify-center items-center gap-2 mt-4">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(Math.max(1, page - 1))}
            disabled={page === 1}
            className="border-gray-300 hover:bg-gray-50"
          >
            Previous
          </Button>
          <span className="text-sm text-gray-600 px-3">
            Page {page} of {pagination.totalPages || 1}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPage(page + 1)}
            disabled={page >= (pagination.totalPages || 1)}
            className="border-gray-300 hover:bg-gray-50"
          >
            Next
          </Button>
        </div>

        <ModalForm open={modalOpen} onOpenChange={handleCloseModal} title={editId ? 'Edit Subscriber' : 'Tambah Subscriber'}>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label htmlFor="no_ok" className="text-sm font-semibold text-gray-700">NO OK</Label>
                <Input
                  id="no_ok"
                  value={formData.no_ok || ''}
                  onChange={(e) => setFormData({ ...formData, no_ok: e.target.value || null })}
                  placeholder="Masukkan NO OK"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="sales" className="text-sm font-semibold text-gray-700">Sales</Label>
                <Input
                  id="sales"
                  value={formData.sales || ''}
                  onChange={(e) => setFormData({ ...formData, sales: e.target.value || null })}
                  placeholder="Masukkan nama sales"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="toko" className="text-sm font-semibold text-gray-700">Toko</Label>
                <Input
                  id="toko"
                  value={formData.toko}
                  onChange={(e) => setFormData({ ...formData, toko: e.target.value })}
                  placeholder="Masukkan nama toko"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="alamat" className="text-sm font-semibold text-gray-700">Alamat</Label>
                <Input
                  id="alamat"
                  value={formData.alamat || ''}
                  onChange={(e) => setFormData({ ...formData, alamat: e.target.value || null })}
                  placeholder="Masukkan alamat"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="daerah" className="text-sm font-semibold text-gray-700">Daerah</Label>
                <Input
                  id="daerah"
                  value={formData.daerah}
                  onChange={(e) => setFormData({ ...formData, daerah: e.target.value })}
                  placeholder="Masukkan daerah"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="internal_kode" className="text-sm font-semibold text-gray-700">Internal Kode</Label>
                <Input
                  id="internal_kode"
                  value={formData.internal_kode || ''}
                  onChange={(e) => setFormData({ ...formData, internal_kode: e.target.value })}
                  placeholder="Masukkan internal kode"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="program" className="text-sm font-semibold text-gray-700">Program</Label>
                <Select
                  value={formData.program}
                  onValueChange={(value) => {
                    const selectedProgram = programs.find(p => p.nama === value);
                    if (selectedProgram) {
                      handleProgramSelect(selectedProgram);
                    }
                  }}
                >
                  <SelectTrigger className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200">
                    <SelectValue placeholder="Pilih program..." />
                  </SelectTrigger>
                  <SelectContent className="max-h-[300px] overflow-y-auto">
                    <div className="p-2">
                      <Input
                        placeholder="Cari program..."
                        value={programSearch}
                        onChange={(e) => setProgramSearch(e.target.value)}
                        className="mb-2"
                        onClick={(e) => e.stopPropagation()}
                        onKeyDown={(e) => e.stopPropagation()}
                      />
                    </div>
                    {filteredPrograms.length === 0 ? (
                      <div className="py-6 text-center text-sm text-gray-500">
                        Program tidak ditemukan.
                      </div>
                    ) : (
                      filteredPrograms.map((program) => (
                        <SelectItem
                          key={program._id}
                          value={program.nama}
                          className="cursor-pointer hover:bg-blue-50"
                        >
                          <div className="flex items-center">
                            <Check
                              className={`mr-2 h-4 w-4 ${formData.program === program.nama ? "opacity-100" : "opacity-0"}`}
                            />
                            {program.kode} - {program.nama} ({formatCurrency(program.biaya)})
                          </div>
                        </SelectItem>
                      ))
                    )}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="vb_online" className="text-sm font-semibold text-gray-700">VB Online</Label>
                <Input
                  id="vb_online"
                  value={formData.vb_online || ''}
                  onChange={(e) => setFormData({ ...formData, vb_online: e.target.value || null })}
                  placeholder="Masukkan VB Online"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="biaya" className="text-sm font-semibold text-gray-700">Biaya Program (Rp)</Label>
                <Input
                  id="biaya"
                  type="text"
                  value={formattedBiaya}
                  onChange={(e) => {
                    const formatted = formatNumberInput(e.target.value);
                    const numericValue = parseFormattedInput(formatted);
                    setFormattedBiaya(formatted);
                    setFormData({ ...formData, biaya: numericValue });
                  }}
                  placeholder="0"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tanggal" className="text-sm font-semibold text-gray-700">Tanggal</Label>
                <Input
                  id="tanggal"
                  type="date"
                  value={formData.tanggal}
                  onChange={(e) => setFormData({ ...formData, tanggal: e.target.value })}
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                  required
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="implementator" className="text-sm font-semibold text-gray-700">Implementator</Label>
                <Input
                  id="implementator"
                  value={formData.implementator || ''}
                  onChange={(e) => setFormData({ ...formData, implementator: e.target.value || null })}
                  placeholder="Masukkan nama implementator"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>

              <div className="grid gap-2">
                <Label htmlFor="via" className="text-sm font-semibold text-gray-700">Via</Label>
                <Select
                  value={formData.via}
                  onValueChange={(value: 'VISIT' | 'ONLINE') =>
                    setFormData({ ...formData, via: value })
                  }
                >
                  <SelectTrigger className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200">
                    <SelectValue placeholder="Pilih via" />
                  </SelectTrigger>
                  <SelectContent className="bg-white/95 backdrop-blur-sm border-gray-200 shadow-xl">
                    <SelectItem value="VISIT" className="hover:bg-blue-50 focus:bg-blue-50">VISIT</SelectItem>
                    <SelectItem value="ONLINE" className="hover:bg-blue-50 focus:bg-blue-50">ONLINE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCloseModal}
                className="border-gray-300 hover:bg-gray-50 transition-all duration-200"
              >
                Batal
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                {editId ? 'Simpan Perubahan' : 'Tambah Subscriber'}
              </Button>
            </div>
          </form>
        </ModalForm>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-white/95 backdrop-blur-sm shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Konfirmasi Hapus
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 text-base">
                Yakin ingin menghapus subscriber ini? Tindakan ini tidak dapat dibatalkan.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel className="border-gray-300 hover:bg-gray-50 transition-all duration-200">
                Batal
              </AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                Hapus Subscriber
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}