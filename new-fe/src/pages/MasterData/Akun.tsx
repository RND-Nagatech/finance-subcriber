import { useMemo, useState } from 'react';
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
import { ModalForm } from '@/components/ModalForm';
import { Plus, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';

interface Akun {
  _id?: string;
  nama: string;
  kode: string;
  subkategori_id: string;
  budget_id?: string;
  budget_name?: string;
  subkategori_nama?: string;
  input_by: string;
  akun?: string;
  sub_kategori?: string;
}

interface SubKategori {
  _id: string;
  sub_kategori: string;
  kategori: string;
  status_aktv?: boolean;
}

interface BudgetOption {
  _id: string;
  name: string;
  year: number;
}

export default function Akun() {
    const queryClient = useQueryClient();
    const [modalOpen, setModalOpen] = useState(false);
    const [editId, setEditId] = useState<string | null>(null);
    const [formData, setFormData] = useState<Akun>({
      nama: '',
      kode: '',
      subkategori_id: '', // tetap simpan id untuk dropdown
      budget_id: 'none',
      input_by: '',
    });
    const { user } = useAppStore();
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [deleteId, setDeleteId] = useState<string | null>(null);
    const [showReactivateDialog, setShowReactivateDialog] = useState(false);
    const [reactivateId, setReactivateId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterSubKategori, setFilterSubKategori] = useState('ALL');
    const [page, setPage] = useState(1);
    const [pageSize, setPageSize] = useState(10);

    // Fetch sub categories
    const { data: subCategories = [] } = useQuery({
      queryKey: ['subkategori'],
      queryFn: async () => {
        const response = await axiosInstance.get('/master/subkategori');
        return response.data || [];
      },
    });

    const { data: budgets = [] } = useQuery({
      queryKey: ['budgets-active-for-akun'],
      queryFn: async () => {
        const response = await axiosInstance.get('/budget/budgets');
        return response.data?.data || [];
      },
    });

    // Fetch akun
    const { data = [], isLoading, error } = useQuery({
      queryKey: ['akun'],
      queryFn: async () => {
        const response = await axiosInstance.get('/master/akun');
        return response.data || [];
      },
    });

    // Create/Update mutation
    const saveMutation = useMutation({
      mutationFn: async (payload: any) => {
        if (editId) {
          return axiosInstance.put(`/master/akun/${editId}`, payload);
        }
        return axiosInstance.post('/master/akun', payload);
      },
      onSuccess: () => { /* handled in onSettled */ },
      onError: () => { /* handled in onSettled */ },
      onSettled: (data: any, error: any) => {
        queryClient.invalidateQueries({ queryKey: ['akun'] });
        const serverMsg = data?.data?.message || error?.response?.data?.message;
        if (serverMsg) {
          if (error) toast.error(serverMsg); else toast.success(serverMsg);
        } else {
          if (error) toast.error('Gagal menyimpan data. Silakan coba lagi.'); else toast.success('Data berhasil disimpan.');
        }
        // custom re-activate logic preserved
        if (error?.response?.data?.code === 'REACTIVATE' && error?.response?.data?.id) {
          setReactivateId(error.response.data.id);
          setShowReactivateDialog(true);
        }
        if (!error) handleCloseModal();
      },
    });

    // Delete mutation
    const deleteMutation = useMutation({
      mutationFn: (id: string) => axiosInstance.delete(`/master/akun/${id}`, {
        data: { delete_by: user?.name || 'Unknown' },
      }),
      onSuccess: (resp: any) => {
        queryClient.invalidateQueries({ queryKey: ['akun'] });
        const msg = resp?.data?.message || 'Akun berhasil dihapus!';
        toast.success(msg);
        setShowDeleteDialog(false);
        setDeleteId(null);
      },
      onError: (error: any) => {
        const serverMsg = error?.response?.data?.message;
        if (serverMsg) {
          toast.error(serverMsg);
        } else {
          toast.error('Gagal menghapus data. Silakan coba lagi.');
        }
      },
    });

    const handleSubmit = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!formData.subkategori_id) {
        toast.error('Sub Kategori wajib dipilih!');
        return;
      }
      if (!formData.nama) {
        toast.error('Nama Akun wajib diisi!');
        return;
      }
      // Kirim _id sub kategori ke backend
      const payload = {
        sub_kategori: formData.subkategori_id,
        akun: formData.nama,
        budget_id: formData.budget_id && formData.budget_id !== 'none' ? formData.budget_id : null,
        input_by: user?.name || 'Unknown',
      };
      saveMutation.mutate(payload);
    };

    const handleEdit = (item: Akun) => {
      const subKategoriObj = subCategories.find(
        (sub) => sub.sub_kategori === item.sub_kategori
      );
      setEditId(item._id || null);
      setFormData({
        ...item,
        nama: item.nama || item.akun || '',
        subkategori_id: subKategoriObj ? subKategoriObj._id : '',
        budget_id: item.budget_id || 'none',
      });
      setModalOpen(true);
    };

    const handleDelete = async () => {
      if (deleteId) {
        deleteMutation.mutate(deleteId);
      }
    };

    const handleCloseModal = () => {
      setModalOpen(false);
      setEditId(null);
      setFormData({ nama: '', kode: '', subkategori_id: '', budget_id: 'none', input_by: '' });
    };

  const filteredAkunList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data
      .filter((item) => filterSubKategori === 'ALL' || (item.sub_kategori || '') === filterSubKategori)
      .filter((item) =>
        !q ? true : `${item.kode || ''} ${item.akun || item.nama || ''} ${item.sub_kategori || ''} ${item.budget_name || ''}`
          .toLowerCase()
          .includes(q)
      );
  }, [data, filterSubKategori, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredAkunList.length / pageSize));
  const displayRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredAkunList.slice(start, start + pageSize);
  }, [filteredAkunList, page, pageSize]);

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
              Master Akun
            </h1>
            <p className="text-gray-600 mt-2">Kelola akun transaksi dengan mudah dan efisien</p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Akun
          </Button>
        </div>

        <div className="bg-white/70 rounded-lg border-2 border-dashed border-blue-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col">
            <Label htmlFor="search-akun" className="text-sm font-semibold text-gray-700 mb-1">Cari</Label>
            <Input
              id="search-akun"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari kode / nama akun / sub kategori / budget"
              className="w-80 border-2 border-gray-200"
            />
          </div>
          <div className="flex flex-col">
            <Label htmlFor="filter-subkategori-akun" className="text-sm font-semibold text-gray-700 mb-1">Filter Sub Kategori</Label>
            <select
              id="filter-subkategori-akun"
              value={filterSubKategori}
              onChange={(e) => {
                setFilterSubKategori(e.target.value);
                setPage(1);
              }}
              className="bg-white border-2 border-gray-200 rounded-md px-3 py-2 h-10 min-w-56"
            >
              <option value="ALL">Semua</option>
              {Array.from(new Set((data || []).map((item: any) => item.sub_kategori).filter(Boolean))).map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <Label htmlFor="page-size-akun" className="text-sm font-semibold text-gray-700 mb-1">Per Halaman</Label>
            <select
              id="page-size-akun"
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
                <TableHead className="w-20 px-6 py-4 font-semibold text-gray-900">Kode</TableHead>
                <TableHead className="w-64 px-6 py-4 font-semibold text-gray-900">Nama Akun</TableHead>
                <TableHead className="w-48 px-6 py-4 font-semibold text-gray-900">Sub Kategori</TableHead>
                <TableHead className="w-48 px-6 py-4 font-semibold text-gray-900">Budget</TableHead>
                <TableHead className="w-32 px-6 py-4 font-semibold text-gray-900">Input By</TableHead>
                <TableHead className="w-32 px-6 py-4 text-right font-semibold text-gray-900">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-600 font-medium">Memuat data akun...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredAkunList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">Belum ada data akun</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayRows.map((item) => (
                  <TableRow key={item._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                    <TableCell className="w-20 px-6 py-4 font-semibold text-gray-900">{item.kode}</TableCell>
                    <TableCell className="w-64 px-6 py-4 font-medium text-gray-900">{item.akun || item.nama}</TableCell>
                    <TableCell className="w-48 px-6 py-4 text-gray-700">
                      {subCategories.find((sub) => sub._id === item.sub_kategori)?.sub_kategori || item.sub_kategori}
                    </TableCell>
                    <TableCell className="w-48 px-6 py-4 text-gray-700">
                      {item.budget_name || '-'}
                    </TableCell>
                    <TableCell className="w-32 px-6 py-4 text-gray-700">{item.input_by}</TableCell>
                    <TableCell className="w-32 px-6 py-4 text-right">
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
                          onClick={() => {
                            setDeleteId(item._id || null);
                            setShowDeleteDialog(true);
                          }}
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
            <div className="text-sm text-gray-600">Total Data: {filteredAkunList.length}</div>
            <div className="text-sm text-gray-600">Halaman {page} dari {totalPages}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Sebelumnya
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page >= totalPages}>
                Berikutnya
              </Button>
            </div>
          </div>
        </div>
        <ModalForm
          open={modalOpen}
          onOpenChange={handleCloseModal}
          title={editId ? 'Edit Akun' : 'Tambah Akun'}
        >
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="subkategori" className="text-sm font-semibold text-gray-700">Sub Kategori</Label>
              <Select
                value={formData.subkategori_id}
                onValueChange={(value) =>
                  setFormData({ ...formData, subkategori_id: value })
                }
              >
                <SelectTrigger className="border-2 border-gray-200 transition-all duration-200">
                  <SelectValue placeholder="Pilih sub kategori" />
                </SelectTrigger>
                <SelectContent>
                  {subCategories
                    .filter((data) => data.status_aktv !== false)
                    .sort((a, b) => a.kategori.localeCompare(b.kategori))
                    .map((data) => (
                      <SelectItem key={data._id} value={data._id}>
                        ({data.kategori}) {data.sub_kategori}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nama" className="text-sm font-semibold text-gray-700">Nama Akun</Label>
              <Input
                id="nama"
                value={formData.nama}
                onChange={(e) => setFormData({ ...formData, nama: e.target.value })}
                placeholder="Masukkan nama akun"
                className="border-2 border-gray-200 transition-all duration-200"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="budget_id" className="text-sm font-semibold text-gray-700">Budget (Opsional)</Label>
              <Select
                value={formData.budget_id || 'none'}
                onValueChange={(value) => setFormData({ ...formData, budget_id: value })}
              >
                <SelectTrigger className="border-2 border-gray-200 transition-all duration-200">
                  <SelectValue placeholder="Pilih budget (opsional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa Budget</SelectItem>
                  {(budgets as BudgetOption[]).map((budget) => (
                    <SelectItem key={budget._id} value={budget._id}>
                      {budget.name} ({budget.year})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                {editId ? 'Simpan Perubahan' : 'Tambah Akun'}
              </Button>
            </div>
          </form>
        </ModalForm>
        {/* Custom Delete Dialog */}
        <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <DialogContent className="bg-white/95 backdrop-blur-sm shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Konfirmasi Hapus
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                Yakin ingin menghapus akun ini? Tindakan ini tidak dapat dibatalkan.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-3">
              <Button
                variant="outline"
                onClick={() => setShowDeleteDialog(false)}
                className="border-gray-300 hover:bg-gray-50 transition-all duration-200"
              >
                Batal
              </Button>
              <Button
                variant="destructive"
                onClick={handleDelete}
                className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                Hapus Akun
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        {/* Custom Reactivate Dialog */}
        <Dialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
          <DialogContent className="bg-white/95 backdrop-blur-sm border-blue-300 shadow-2xl">
            <DialogHeader>
              <DialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Data Sudah Ada
              </DialogTitle>
              <DialogDescription className="text-gray-600 text-base">
                Data ini sudah ada, aktifkan kembali?
              </DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-3">
              <Button
                variant="outline"
                onClick={() => setShowReactivateDialog(false)}
                className="border-gray-300 hover:bg-gray-50 transition-all duration-200"
              >
                Batal
              </Button>
              <Button
                variant="default"
                onClick={async () => {
                  if (reactivateId) {
                    await axiosInstance.put(`/master/akun/${reactivateId}`, {
                      status_aktv: true,
                      update_by: user?.name || 'Unknown',
                    });
                    await queryClient.invalidateQueries({ queryKey: ['akun'] });
                    setShowReactivateDialog(false);
                    handleCloseModal();
                    toast.success('Akun diaktifkan kembali!');
                  }
                }}
                className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                Aktifkan Kembali
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
