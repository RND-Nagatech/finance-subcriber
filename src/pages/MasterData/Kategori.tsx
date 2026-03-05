import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import axiosInstance from '@/api/axiosInstance';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog';

interface Kategori {
  _id?: string;
  kategori: string;
  kode: string;
  status_aktv?: boolean;
  input_date?: string;
  update_date?: string;
  delete_date?: string | null;
  input_by: string;
  update_by?: string | null;
  delete_by?: string | null;
}

export default function Kategori() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Kategori>({ kategori: '', kode: '', input_by: '' });
  const { user } = useAppStore();

  // Fetch kategori
  // Ambil semua data kategori (aktif dan non-aktif) untuk validasi input
  const { data: allKategoriList = [], isLoading } = useQuery<Kategori[]>({
    queryKey: ['kategori-all'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/kategori?all=true');
      return res.data || [];
    },
  });

  // Filter hanya yang aktif untuk ditampilkan di tabel
  const kategoriList = allKategoriList.filter((k) => k.status_aktv !== false);

  // Create / Update
  const saveMutation = useMutation({
    mutationFn: async (payload: Kategori) => {
      if (editId) {
        return axiosInstance.put(`/master/kategori/${editId}`, {
          ...payload,
          update_by: user?.name || 'Unknown',
        });
      }
      // Cek apakah data sudah ada dan non-aktif
      const existing = allKategoriList.find(
        (k) => k.kode === payload.kode || k.kategori.toLowerCase() === payload.kategori.toLowerCase()
      );
      if (existing && existing.status_aktv === false) {
        setReactivateId(existing._id);
        setShowReactivateDialog(true);
        return;
      }
      return axiosInstance.post('/master/kategori', { kategori: payload.kategori, input_by: payload.input_by });
    },
    onSuccess: () => {
      return; // handled in onSettled
    },
    onError: () => { /* handled in onSettled */ },
    onSettled: (data: any, error: any) => {
      queryClient.invalidateQueries({ queryKey: ['kategori'] });
      queryClient.invalidateQueries({ queryKey: ['kategori-all'] });
      const serverMsg = data?.data?.message || error?.response?.data?.message;
      if (serverMsg) {
        if (error) toast.error(serverMsg); else toast.success(serverMsg);
      } else {
        if (error) toast.error('Gagal menyimpan kategori!'); else toast.success('Data berhasil disimpan.');
      }
      if (!error) handleCloseModal();
    },
  });

  // Delete (soft delete)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/master/kategori/${id}`, {
      data: { delete_by: user?.name || 'Unknown' },
    }),
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['kategori'] });
      queryClient.invalidateQueries({ queryKey: ['kategori-all'] });
      const msg = resp?.data?.message || 'Kategori berhasil dihapus!';
      toast.success(msg);
    },
    onError: (error: any) => {
      const serverMsg = error?.response?.data?.message;
      if (serverMsg) {
        toast.error(serverMsg);
      } else {
        toast.error('Gagal menghapus kategori!');
      }
    },
  });
  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [reactivateId, setReactivateId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ ...formData, input_by: user?.name || 'Unknown' });
  };

  const handleEdit = (item: Kategori) => {
    setEditId(item._id || null);
    setFormData(item);
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
    setFormData({ kategori: '', kode: '', input_by: '' });
  };

  const filteredKategoriList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return kategoriList;
    return kategoriList.filter((k) =>
      `${k.kode} ${k.kategori}`.toLowerCase().includes(q)
    );
  }, [kategoriList, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredKategoriList.length / pageSize));
  const displayRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredKategoriList.slice(start, start + pageSize);
  }, [filteredKategoriList, page, pageSize]);

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
              Master Kategori
            </h1>
            <p className="text-gray-600 mt-2">Kelola kategori transaksi dengan mudah dan efisien</p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Kategori
          </Button>
        </div>

        <div className="bg-white/70 rounded-lg border-2 border-dashed border-blue-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col">
            <Label htmlFor="search-kategori" className="text-sm font-semibold text-gray-700 mb-1">Cari</Label>
            <Input
              id="search-kategori"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari kode / kategori"
              className="w-80 border-2 border-gray-200"
            />
          </div>
          <div className="flex flex-col">
            <Label htmlFor="page-size-kategori" className="text-sm font-semibold text-gray-700 mb-1">Per Halaman</Label>
            <select
              id="page-size-kategori"
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
                    <TableHead className="w-64 px-6 py-4 font-semibold text-gray-900">Kategori</TableHead>
                    <TableHead className="w-48 px-6 py-4 font-semibold text-gray-900">Input By</TableHead>
                    <TableHead className="w-32 px-6 py-4 text-right font-semibold text-gray-900">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
                        <div className="flex flex-col items-center space-y-3">
                          <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                          <p className="text-gray-600 font-medium">Memuat data kategori...</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : filteredKategoriList.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center py-12">
                        <div className="flex flex-col items-center space-y-3">
                          <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                            <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                            </svg>
                          </div>
                          <p className="text-gray-600 font-medium">Belum ada data kategori</p>
                        </div>
                      </TableCell>
                    </TableRow>
                  ) : (
                    displayRows.map((item) => (
                      <TableRow key={item._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                        <TableCell className="w-20 px-6 py-4 font-semibold text-gray-900">{item.kode}</TableCell>
                        <TableCell className="w-64 px-6 py-4 font-medium text-gray-900">{item.kategori}</TableCell>
                        <TableCell className="w-48 px-6 py-4 text-gray-700">{item.input_by}</TableCell>
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
                              onClick={() => item._id && handleDelete(item._id)}
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
                <div className="text-sm text-gray-600">Total Data: {filteredKategoriList.length}</div>
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
      <ModalForm open={modalOpen} onOpenChange={handleCloseModal} title={editId ? 'Edit Kategori' : 'Tambah Kategori'}>
        <form onSubmit={handleSubmit} className="space-y-6 py-4">
          <div className="grid gap-2">
            <Label htmlFor="kategori" className="text-sm font-semibold text-gray-700">Nama Kategori</Label>
            <Input
              id="kategori"
              value={formData.kategori}
              onChange={e => setFormData({...formData, kategori: e.target.value})}
              placeholder="Masukkan nama kategori"
              className="border-2 border-gray-200  transition-all duration-200"
              required
            />
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
              {editId ? 'Simpan Perubahan' : 'Tambah Kategori'}
            </Button>
          </div>
        </form>
      </ModalForm>

      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent className="bg-white/95 backdrop-blur-sm border-blue-300 shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Data Sudah Ada
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-base">
              Data ini sudah ada, aktifkan kembali?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3">
            <AlertDialogCancel
              onClick={() => setShowReactivateDialog(false)}
              className="border-gray-300 hover:bg-gray-50 transition-all duration-200"
            >
              Batal
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                if (reactivateId) {
                  await axiosInstance.put(`/master/kategori/${reactivateId}`, {
                    status_aktv: true,
                    update_by: user?.name || 'Unknown',
                  });
                  await queryClient.invalidateQueries({ queryKey: ['kategori'] });
                  await queryClient.invalidateQueries({ queryKey: ['kategori-all'] });
                  setShowReactivateDialog(false);
                  handleCloseModal();
                  toast.success('Kategori diaktifkan kembali!');
                }
              }}
              className="bg-gradient-to-r from-green-600 to-emerald-700 hover:from-green-700 hover:to-emerald-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
            >
              Aktifkan Kembali
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent className="bg-white/95 backdrop-blur-sm shadow-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Konfirmasi Hapus
            </AlertDialogTitle>
            <AlertDialogDescription className="text-gray-600 text-base">
              Yakin ingin menghapus kategori ini? Tindakan ini tidak dapat dibatalkan.
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
              Hapus Kategori
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      </div>
    </div>
  );
}
