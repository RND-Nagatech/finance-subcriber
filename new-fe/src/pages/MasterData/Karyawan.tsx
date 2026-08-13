import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { deleteKaryawan, fetchKaryawanList, Karyawan as KaryawanType, saveKaryawan } from '@/api/karyawan';
import { ModalForm } from '@/components/ModalForm';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { SearchableSelect } from '@/components/ui/searchable-select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const initialForm: KaryawanType = {
  kode_karyawan: '',
  nama_karyawan: '',
  jabatan: '',
  divisi: '',
  no_hp: '',
  email: '',
};

export default function Karyawan() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<KaryawanType>(initialForm);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);

  const { data: response, isLoading } = useQuery({
    queryKey: ['karyawan-list', page, limit, search],
    queryFn: () => fetchKaryawanList({ page, limit, search }),
  });

  const rows = response?.data || [];
  const pagination = response?.pagination || { page: 1, limit, total: 0, totalPages: 1 };

  const saveMutation = useMutation({
    mutationFn: (payload: KaryawanType) => saveKaryawan(payload, editId),
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['karyawan-list'] });
      queryClient.invalidateQueries({ queryKey: ['karyawan-options'] });
      toast.success(resp?.data?.message || 'Karyawan berhasil disimpan.');
      handleCloseModal();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Gagal menyimpan karyawan.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteKaryawan,
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['karyawan-list'] });
      queryClient.invalidateQueries({ queryKey: ['karyawan-options'] });
      toast.success(resp?.data?.message || 'Karyawan berhasil dihapus.');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Gagal menghapus karyawan.');
    },
  });

  const handleOpenModal = (item?: KaryawanType) => {
    if (item) {
      setEditId(item._id || null);
      setFormData({
        kode_karyawan: item.kode_karyawan,
        nama_karyawan: item.nama_karyawan,
        jabatan: item.jabatan || '',
        divisi: item.divisi || '',
        no_hp: item.no_hp || '',
        email: item.email || '',
      });
    } else {
      setEditId(null);
      setFormData(initialForm);
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
    setFormData(initialForm);
  };

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    saveMutation.mutate({
      ...formData,
      kode_karyawan: formData.kode_karyawan.trim(),
      nama_karyawan: formData.nama_karyawan.trim(),
      jabatan: formData.jabatan?.trim() || null,
      divisi: formData.divisi?.trim() || null,
      no_hp: formData.no_hp?.trim() || null,
      email: formData.email?.trim() || null,
    });
  };

  const handleDelete = (id: string) => {
    setDeleteId(id);
    setShowDeleteDialog(true);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId);
    setDeleteId(null);
    setShowDeleteDialog(false);
  };

  const limitOptions = useMemo(() => [
    { value: '10', label: '10' },
    { value: '25', label: '25' },
    { value: '50', label: '50' },
  ], []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      <div className="container mx-auto px-6 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Master Karyawan
            </h1>
            <p className="text-gray-600 mt-2">Kelola data karyawan perusahaan</p>
          </div>
          <Button
            onClick={() => handleOpenModal()}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            <Plus className="h-5 w-5 mr-2" />
            Tambah Karyawan
          </Button>
        </div>

        <div className="bg-white/70 rounded-lg border-2 border-dashed border-blue-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col">
            <Label htmlFor="search-karyawan" className="text-sm font-semibold text-gray-700 mb-1">Cari</Label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                id="search-karyawan"
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder="Kode, nama, jabatan, divisi, no hp, email"
                className="w-96 pl-9 pr-9 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => {
                    setSearch('');
                    setPage(1);
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                  aria-label="Hapus pencarian"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
          <div className="flex flex-col">
            <Label className="text-sm font-semibold text-gray-700 mb-1">Per Halaman</Label>
            <SearchableSelect
              value={String(limit)}
              onValueChange={(value) => {
                setLimit(Number(value));
                setPage(1);
              }}
              options={limitOptions}
              placeholder="Per halaman"
              searchPlaceholder="Cari jumlah..."
              className="w-32"
            />
          </div>
        </div>

        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="w-36 px-6 py-4 font-semibold text-gray-900">Kode</TableHead>
                <TableHead className="px-6 py-4 font-semibold text-gray-900">Nama Karyawan</TableHead>
                <TableHead className="w-44 px-6 py-4 font-semibold text-gray-900">Jabatan</TableHead>
                <TableHead className="w-44 px-6 py-4 font-semibold text-gray-900">Divisi</TableHead>
                <TableHead className="w-32 px-6 py-4 text-right font-semibold text-gray-900">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12">Memuat data karyawan...</TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-12 text-gray-600">Belum ada data karyawan</TableCell>
                </TableRow>
              ) : (
                rows.map((item) => (
                  <TableRow key={item._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                    <TableCell className="px-6 py-4 font-semibold text-gray-900">{item.kode_karyawan}</TableCell>
                    <TableCell className="px-6 py-4 font-medium text-gray-900">{item.nama_karyawan}</TableCell>
                    <TableCell className="px-6 py-4 text-gray-700">{item.jabatan || '-'}</TableCell>
                    <TableCell className="px-6 py-4 text-gray-700">{item.divisi || '-'}</TableCell>
                    <TableCell className="px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(item)}
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
            <div className="text-sm text-gray-600">Total Data: {pagination.total}</div>
            <div className="text-sm text-gray-600">Halaman {page} dari {pagination.totalPages || 1}</div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page <= 1}>
                Sebelumnya
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.min(pagination.totalPages || 1, p + 1))} disabled={page >= (pagination.totalPages || 1)}>
                Berikutnya
              </Button>
            </div>
          </div>
        </div>

        <ModalForm open={modalOpen} onOpenChange={setModalOpen} title={editId ? 'Edit Karyawan' : 'Tambah Karyawan'}>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="grid gap-2">
                <Label htmlFor="kode_karyawan" className="text-sm font-semibold text-gray-700">Kode Karyawan</Label>
                <Input
                  id="kode_karyawan"
                  value={formData.kode_karyawan}
                  onChange={(event) => setFormData((prev) => ({ ...prev, kode_karyawan: event.target.value.toUpperCase() }))}
                  placeholder="Otomatis jika dikosongkan"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                  readOnly={!!editId}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nama_karyawan" className="text-sm font-semibold text-gray-700">Nama Karyawan</Label>
                <Input
                  id="nama_karyawan"
                  value={formData.nama_karyawan}
                  onChange={(event) => setFormData((prev) => ({ ...prev, nama_karyawan: event.target.value.toUpperCase() }))}
                  placeholder="Masukkan nama karyawan"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                  required
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="jabatan" className="text-sm font-semibold text-gray-700">Jabatan</Label>
                <Input
                  id="jabatan"
                  value={formData.jabatan || ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, jabatan: event.target.value.toUpperCase() }))}
                  placeholder="Masukkan jabatan"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="divisi" className="text-sm font-semibold text-gray-700">Divisi</Label>
                <Input
                  id="divisi"
                  value={formData.divisi || ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, divisi: event.target.value.toUpperCase() }))}
                  placeholder="Masukkan divisi"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="no_hp" className="text-sm font-semibold text-gray-700">No HP</Label>
                <Input
                  id="no_hp"
                  value={formData.no_hp || ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, no_hp: event.target.value }))}
                  placeholder="Masukkan no HP"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email" className="text-sm font-semibold text-gray-700">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email || ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, email: event.target.value }))}
                  placeholder="Masukkan email"
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseModal}>
                Batal
              </Button>
              <Button
                type="submit"
                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Menyimpan...' : 'Simpan'}
              </Button>
            </div>
          </form>
        </ModalForm>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-white/95 backdrop-blur-sm border-red-300 shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
              <AlertDialogDescription>
                Apakah Anda yakin ingin menghapus data karyawan ini?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-red-600 hover:bg-red-700">
                Hapus
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
