import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '../../api/axiosInstance';
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
import { ModalForm } from '../../components/ModalForm';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '../../components/ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Bank {
  _id?: string;
  kode_bank: string;
  nama_bank: string;
}

interface Rekening {
  _id?: string;
  bank_id: string;
  perusahaan_id?: string | { _id?: string; id?: string };
  perusahaan_ids?: Array<string | { _id?: string; id?: string; kode_perusahaan?: string; nama_perusahaan?: string }>;
  kode_perusahaan?: string;
  nama_perusahaan?: string;
  kode_bank?: string;
  no_rekening: string;
  nama_rekening: string;
  saldo: number;
}
interface Perusahaan {
  _id?: string;
  kode_perusahaan: string;
  nama_perusahaan: string;
}

const getReferenceId = (value: any): string => {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object') {
    return String(value._id || value.id || '');
  }
  return String(value);
};

const getReferenceIds = (values: any): string[] => {
  if (!values) return [];
  const list = Array.isArray(values) ? values : [values];
  return Array.from(new Set(list.map(getReferenceId).filter(Boolean)));
};

export default function Rekening() {
  const queryClient = useQueryClient();
  const { user } = useAppStore();
  const canViewSaldo = user?.role === 'superuser' || user?.role === 'corsec';
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Rekening>({ bank_id: '', perusahaan_ids: [], no_rekening: '', nama_rekening: '', saldo: 0 });
  const [saldoDisplay, setSaldoDisplay] = useState<string>('0');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [transferNominalDisplay, setTransferNominalDisplay] = useState('0');
  const [transferForm, setTransferForm] = useState({
    from_rekening_id: '',
    to_rekening_id: '',
    nominal: 0,
    tanggal: new Date().toISOString().slice(0, 10),
    keterangan: '',
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [filterBank, setFilterBank] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Helper functions for currency formatting
  const formatCurrency = (value: number): string => {
    return new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(value);
  };

  const parseCurrency = (value: string): number => {
    // Remove all non-numeric characters except comma and dot
    const cleaned = value.replace(/[^\d.,]/g, '');
    // Replace comma with dot for decimal
    const normalized = cleaned.replace(',', '.');
    const parsed = parseFloat(normalized);
    return isNaN(parsed) ? 0 : parsed;
  };

  // Get bank list for dropdown
  const { data: bankList = [] } = useQuery<Bank[]>({
    queryKey: ['bank-all'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/bank?all=true');
      return res.data || [];
    },
  });

  // Get rekening list
  const { data: rekeningList = [], isLoading } = useQuery<Rekening[]>({
    queryKey: ['rekening-all'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/rekening?all=true');
      return res.data || [];
    },
  });
  const { data: perusahaanList = [] } = useQuery<Perusahaan[]>({
    queryKey: ['perusahaan-all'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/perusahaan?all=true');
      return res.data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Rekening) => {
      if (editId) {
        return axiosInstance.put(`/master/rekening/${editId}`, payload);
      }
      return axiosInstance.post('/master/rekening', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rekening-all'] });
      toast.success('Data berhasil disimpan.');
      handleCloseModal();
    },
    onError: () => {
      toast.error('Gagal menyimpan data rekening!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return axiosInstance.delete(`/master/rekening/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rekening-all'] });
      toast.success('Data berhasil dihapus.');
    },
    onError: () => {
      toast.error('Gagal menghapus data rekening!');
    },
  });

  const transferMutation = useMutation({
    mutationFn: async (payload: typeof transferForm) => {
      return axiosInstance.post('/master/rekening/transfer-saldo', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rekening-all'] });
      toast.success('Transfer saldo berhasil diproses.');
      setTransferDialogOpen(false);
      setTransferForm({
        from_rekening_id: '',
        to_rekening_id: '',
        nominal: 0,
        tanggal: new Date().toISOString().slice(0, 10),
        keterangan: '',
      });
      setTransferNominalDisplay('0');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Gagal transfer saldo.');
    },
  });

  const handleOpenModal = (rekening?: Rekening) => {
    if (rekening) {
      let bank_id = rekening.bank_id;
      // Jika kode_bank ada, cari _id bank yang sesuai
      if (rekening.kode_bank && bankList.length > 0) {
        const found = bankList.find((b) => b.kode_bank === rekening.kode_bank);
        if (found) bank_id = found._id || bank_id;
      }
      setEditId(rekening._id || null);
      const perusahaan_ids = getReferenceIds(rekening.perusahaan_ids);
      const legacyPerusahaanId = getReferenceId(rekening.perusahaan_id);
      setFormData({
        bank_id,
        perusahaan_id: legacyPerusahaanId,
        perusahaan_ids: perusahaan_ids.length > 0 ? perusahaan_ids : (legacyPerusahaanId ? [legacyPerusahaanId] : []),
        kode_perusahaan: rekening.kode_perusahaan,
        nama_perusahaan: rekening.nama_perusahaan,
        kode_bank: rekening.kode_bank,
        no_rekening: rekening.no_rekening,
        nama_rekening: rekening.nama_rekening,
        saldo: rekening.saldo || 0,
      });
      setSaldoDisplay(formatCurrency(rekening.saldo || 0));
    } else {
      setEditId(null);
      setFormData({ bank_id: '', perusahaan_ids: [], kode_perusahaan: '', nama_perusahaan: '', no_rekening: '', nama_rekening: '', saldo: 0 });
      setSaldoDisplay('0');
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
    setFormData({ bank_id: '', perusahaan_ids: [], no_rekening: '', nama_rekening: '', saldo: 0 });
    setSaldoDisplay('0');
  };

  const handleSaldoBlur = () => {
    // Format the display value when user finishes editing
    setSaldoDisplay(formatCurrency(formData.saldo));
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    if (name === 'saldo') {
      // Handle currency input
      const numericValue = parseCurrency(value);
      setFormData({ ...formData, [name]: numericValue });
      setSaldoDisplay(value); // Keep the formatted display
    } else {
      setFormData({ ...formData, [name]: name === 'bank_id' ? value : value.toUpperCase() });
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const perusahaan_ids = formData.perusahaan_ids || [];
    saveMutation.mutate({
      ...formData,
      perusahaan_id: perusahaan_ids[0] || '',
      perusahaan_ids,
    });
  };

  const handleTransferSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!transferForm.from_rekening_id || !transferForm.to_rekening_id) {
      toast.error('Pilih rekening sumber dan rekening tujuan.');
      return;
    }
    if (transferForm.from_rekening_id === transferForm.to_rekening_id) {
      toast.error('Rekening sumber dan tujuan tidak boleh sama.');
      return;
    }
    if (!transferForm.nominal || transferForm.nominal <= 0) {
      toast.error('Nominal transfer harus lebih besar dari 0.');
      return;
    }
    transferMutation.mutate(transferForm);
  };

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

  const getRekeningPerusahaanLabel = (r: Rekening) => {
    const populatedLabels = (r.perusahaan_ids || [])
      .filter((p: any) => typeof p === 'object')
      .map((p: any) => `${p.kode_perusahaan || '-'} - ${p.nama_perusahaan || '-'}`);
    if (populatedLabels.length > 0) return populatedLabels.join(', ');
    if (r.kode_perusahaan || r.nama_perusahaan) return `${r.kode_perusahaan || '-'} - ${r.nama_perusahaan || '-'}`;
    return '-';
  };

  const filteredRekeningList = useMemo(() => {
    let rows = [...rekeningList];
    if (filterBank !== 'ALL') {
      rows = rows.filter((r) => (r.kode_bank || '') === filterBank);
    }
    const q = searchQuery.trim().toLowerCase();
    if (q) {
      rows = rows.filter((r) =>
        `${r.kode_bank || ''} ${r.no_rekening || ''} ${r.nama_rekening || ''} ${getRekeningPerusahaanLabel(r)}`
          .toLowerCase()
          .includes(q)
      );
    }
    return rows;
  }, [rekeningList, filterBank, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredRekeningList.length / pageSize));
  const pagedRekeningList = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredRekeningList.slice(start, start + pageSize);
  }, [filteredRekeningList, page, pageSize]);

  const bankFilterOptions = useMemo(() => {
    return Array.from(new Set(rekeningList.map((r) => r.kode_bank).filter(Boolean)));
  }, [rekeningList]);

  const formatRekeningOptionLabel = (r: Rekening) =>
    `${r.kode_bank || '-'} - ${r.no_rekening} - ${r.nama_rekening} (Saldo: Rp ${new Intl.NumberFormat('id-ID').format(r.saldo || 0)})`;

  const togglePerusahaan = (id?: string) => {
    if (!id) return;
    setFormData((prev) => {
      const current = prev.perusahaan_ids || [];
      const exists = current.includes(id);
      return {
        ...prev,
        perusahaan_ids: exists ? current.filter((item) => item !== id) : [...current, id],
      };
    });
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
              Master Rekening
            </h1>
            <p className="text-gray-600 mt-2">Kelola data rekening</p>
          </div>
          <div className="flex gap-2">
            <Button
              onClick={() => setTransferDialogOpen(true)}
              variant="outline"
              className="border-emerald-300 text-emerald-700 hover:bg-emerald-50"
            >
              Transfer Saldo
            </Button>
            <Button
              onClick={() => handleOpenModal()}
              className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
            >
              Tambah Rekening
            </Button>
          </div>
        </div>

        <div className="bg-white/70 rounded-lg border-2 border-dashed border-blue-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col">
            <Label htmlFor="search-rekening" className="text-sm font-semibold text-gray-700 mb-1">Cari</Label>
            <Input
              id="search-rekening"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Bank / No rekening / Nama rekening / Perusahaan"
              className="w-80 border-2 border-gray-200"
            />
          </div>
          <div className="flex flex-col">
            <Label htmlFor="filter-bank" className="text-sm font-semibold text-gray-700 mb-1">Filter Bank</Label>
            <select
              id="filter-bank"
              value={filterBank}
              onChange={(e) => {
                setFilterBank(e.target.value);
                setPage(1);
              }}
              className="bg-white border-2 border-gray-200 rounded-md px-3 py-2 h-10 min-w-48"
            >
              <option value="ALL">Semua</option>
              {bankFilterOptions.map((bank) => (
                <option key={bank} value={bank}>{bank}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <Label htmlFor="page-size-rekening" className="text-sm font-semibold text-gray-700 mb-1">Per Halaman</Label>
            <select
              id="page-size-rekening"
              value={String(pageSize)}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              className="bg-white border-2 border-gray-200 rounded-md px-3 py-2 h-10"
            >
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
            </select>
          </div>
        </div>

        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Kode Bank</TableHead>
                <TableHead className="w-56 px-6 py-4 font-semibold text-gray-900">No Rekening</TableHead>
                <TableHead className="w-56 px-6 py-4 font-semibold text-gray-900">Nama Rekening</TableHead>
                <TableHead className="w-52 px-6 py-4 font-semibold text-gray-900">Perusahaan</TableHead>
                {canViewSaldo && (
                  <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Saldo</TableHead>
                )}
                <TableHead className={`w-32 px-6 py-4 text-right font-semibold text-gray-900 ${canViewSaldo ? '' : 'w-40'}`}>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={canViewSaldo ? 6 : 5} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-600 font-medium">Memuat data rekening...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredRekeningList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={canViewSaldo ? 6 : 5} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">Belum ada data rekening</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                pagedRekeningList.map((r) => (
                  <TableRow key={r._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                    <TableCell className="w-40 px-6 py-4 font-semibold text-gray-900">
                      {r.kode_bank || '-'}
                    </TableCell>
                    <TableCell className="w-56 px-6 py-4 font-mono text-gray-900">{r.no_rekening}</TableCell>
                    <TableCell className="w-56 px-6 py-4 font-medium text-gray-900">{r.nama_rekening}</TableCell>
                    <TableCell className="w-52 px-6 py-4 font-medium text-gray-900">
                      <span className="line-clamp-2" title={getRekeningPerusahaanLabel(r)}>
                        {getRekeningPerusahaanLabel(r)}
                      </span>
                    </TableCell>
                    {canViewSaldo && (
                      <TableCell className="w-40 px-6 py-4 font-mono text-gray-900">
                        Rp {new Intl.NumberFormat('id-ID').format(r.saldo || 0)}
                      </TableCell>
                    )}
                    <TableCell className={`w-32 px-6 py-4 text-right ${canViewSaldo ? '' : 'w-40'}`}>
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(r)}
                          className="border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => r._id && handleDelete(r._id)}
                          className="border-red-300 hover:bg-red-50 hover:border-red-400 text-red-600 hover:text-red-700 transition-all duration-200"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex items-center justify-between p-4 border-t border-gray-200">
            <div className="text-sm text-gray-600">
              Total Data: {filteredRekeningList.length}
            </div>
            <div className="text-sm text-gray-600">
              Halaman {page} dari {totalPages}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page <= 1}
              >
                Sebelumnya
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page >= totalPages}
              >
                Berikutnya
              </Button>
            </div>
          </div>
        </div>

        <ModalForm open={modalOpen} onOpenChange={setModalOpen} title={editId ? 'Edit Rekening' : 'Tambah Rekening'}>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="bank_id" className="text-sm font-semibold text-gray-700">Kode Bank</Label>
              <select
                id="bank_id"
                name="bank_id"
                value={formData.bank_id}
                onChange={handleChange}
                required
                className="bg-blue-50 focus:bg-white border-2 border-gray-200 transition-all duration-200 text-base px-4 py-2 rounded-md"
              >
                <option value="">Pilih Kode Bank</option>
                {bankList.map((b) => (
                  <option key={b._id} value={b._id}>{b.kode_bank} - {b.nama_bank}</option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-gray-700">Perusahaan</Label>
              <div className="bg-blue-50 focus-within:bg-white border-2 border-gray-200 transition-all duration-200 rounded-md p-3 max-h-48 overflow-y-auto space-y-2">
                {perusahaanList.length === 0 ? (
                  <p className="text-sm text-gray-500">Belum ada data perusahaan.</p>
                ) : (
                  perusahaanList.map((p) => {
                    const checked = !!p._id && (formData.perusahaan_ids || []).includes(p._id);
                    return (
                      <label key={p._id} className="flex items-center gap-3 text-sm text-gray-800 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => togglePerusahaan(p._id)}
                          className="h-4 w-4 rounded border-gray-300"
                        />
                        <span>{p.kode_perusahaan} - {p.nama_perusahaan}</span>
                      </label>
                    );
                  })
                )}
              </div>
              <p className="text-xs text-gray-500">
                Pilih satu atau beberapa perusahaan yang boleh memakai rekening ini.
              </p>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="no_rekening" className="text-sm font-semibold text-gray-700">No Rekening</Label>
              <Input
                id="no_rekening"
                name="no_rekening"
                value={formData.no_rekening}
                onChange={handleChange}
                required
                maxLength={30}
                className="uppercase tracking-widest font-mono bg-blue-50 focus:bg-white border-2 border-gray-200 transition-all duration-200 text-base px-4 py-2"
                autoComplete="off"
                placeholder="Masukkan no rekening"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nama_rekening" className="text-sm font-semibold text-gray-700">Nama Rekening</Label>
              <Input
                id="nama_rekening"
                name="nama_rekening"
                value={formData.nama_rekening}
                onChange={handleChange}
                required
                maxLength={100}
                className="uppercase tracking-wide bg-blue-50 focus:bg-white border-2 border-gray-200 transition-all duration-200 text-base px-4 py-2"
                autoComplete="off"
                placeholder="Masukkan nama rekening"
              />
            </div>
            {!editId && (
              <div className="grid gap-2">
                <Label htmlFor="saldo" className="text-sm font-semibold text-gray-700">Saldo (Rp)</Label>
                <Input
                  id="saldo"
                  name="saldo"
                  type="text"
                  value={saldoDisplay}
                  onChange={handleChange}
                  onBlur={handleSaldoBlur}
                  className="font-mono bg-blue-50 focus:bg-white border-2 border-gray-200 transition-all duration-200 text-base px-4 py-2"
                  autoComplete="off"
                  placeholder="0"
                />
              </div>
            )}
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
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Menyimpan...' : (editId ? 'Simpan Perubahan' : 'Tambah Rekening')}
              </Button>
            </div>
          </form>
        </ModalForm>

        {/* Delete Confirmation Dialog */}
        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-white/95 backdrop-blur-sm border-blue-300 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Konfirmasi Hapus
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 text-base">
                Apakah Anda yakin ingin menghapus data rekening ini?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700 text-white">
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
          <DialogContent className="sm:max-w-[560px]">
            <DialogHeader>
              <DialogTitle>Transfer Saldo Antar Rekening</DialogTitle>
              <DialogDescription>
                Pindahkan saldo dari rekening sumber ke rekening tujuan.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleTransferSubmit} className="space-y-4">
              <div className="grid gap-2">
                <Label htmlFor="from_rekening_id">Rekening Sumber</Label>
                <Select
                  value={transferForm.from_rekening_id}
                  onValueChange={(value) => setTransferForm((p) => ({ ...p, from_rekening_id: value }))}
                >
                  <SelectTrigger id="from_rekening_id" className="border-2 border-gray-200">
                    <SelectValue placeholder="Pilih rekening sumber" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {rekeningList.filter((r) => !!r._id).map((r) => (
                      <SelectItem key={r._id} value={r._id as string}>
                        <span className="block max-w-[460px] truncate" title={formatRekeningOptionLabel(r)}>
                          {formatRekeningOptionLabel(r)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="to_rekening_id">Rekening Tujuan</Label>
                <Select
                  value={transferForm.to_rekening_id}
                  onValueChange={(value) => setTransferForm((p) => ({ ...p, to_rekening_id: value }))}
                >
                  <SelectTrigger id="to_rekening_id" className="border-2 border-gray-200">
                    <SelectValue placeholder="Pilih rekening tujuan" />
                  </SelectTrigger>
                  <SelectContent className="max-h-64">
                    {rekeningList.filter((r) => !!r._id).map((r) => (
                      <SelectItem key={r._id} value={r._id as string}>
                        <span className="block max-w-[460px] truncate" title={formatRekeningOptionLabel(r)}>
                          {formatRekeningOptionLabel(r)}
                        </span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nominal_transfer">Nominal Transfer (Rp)</Label>
                <Input
                  id="nominal_transfer"
                  value={transferNominalDisplay}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/[^\d]/g, '');
                    const amount = Number(raw || 0);
                    setTransferForm((p) => ({ ...p, nominal: amount }));
                    setTransferNominalDisplay(raw.replace(/\B(?=(\d{3})+(?!\d))/g, '.'));
                  }}
                  placeholder="0"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tanggal_transfer">Tanggal</Label>
                <Input
                  id="tanggal_transfer"
                  type="date"
                  value={transferForm.tanggal}
                  onChange={(e) => setTransferForm((p) => ({ ...p, tanggal: e.target.value }))}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ket_transfer">Keterangan</Label>
                <Input
                  id="ket_transfer"
                  value={transferForm.keterangan}
                  onChange={(e) => setTransferForm((p) => ({ ...p, keterangan: e.target.value }))}
                  placeholder="Opsional"
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTransferDialogOpen(false)}>
                  Batal
                </Button>
                <Button type="submit" disabled={transferMutation.isPending}>
                  {transferMutation.isPending ? 'Memproses...' : 'Transfer Saldo'}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
