import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Pencil, Plus, Search, Trash2, X } from 'lucide-react';

import { deleteGroup, fetchAllGroup, fetchGroupList, Group as GroupType, saveGroup } from '@/api/group';
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

const initialForm: GroupType = {
  kode_group: '',
  nama_group: '',
  owner: '',
  no_hp: '',
  nama_owner: '',
  no_hp_owner: '',
  gender_owner: null,
  nama_pic: '',
  no_hp_pic: '',
  gender_pic: null,
  alamat: '',
};

export default function Group() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<GroupType>(initialForm);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 500);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, limit]);

  const { data: allGroup = [] } = useQuery({
    queryKey: ['group-all'],
    queryFn: fetchAllGroup,
  });

  const { data: response, isLoading } = useQuery({
    queryKey: ['group', page, limit, debouncedSearch],
    queryFn: () => fetchGroupList({ page, limit, search: debouncedSearch }),
  });

  const rows = response?.data || [];
  const pagination = response?.pagination || { page, limit, total: 0, totalPages: 1 };

  const duplicateNonActive = useMemo(() => {
    const kode = formData.kode_group.trim().toUpperCase();
    const nama = formData.nama_group.trim().toLowerCase();
    return allGroup.find((item) =>
      item.status_aktv === false &&
      ((kode && item.kode_group === kode) || (nama && item.nama_group.toLowerCase() === nama))
    );
  }, [allGroup, formData.kode_group, formData.nama_group]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!editId && duplicateNonActive?._id) {
        return saveGroup({ ...duplicateNonActive, ...formData, status_aktv: true }, duplicateNonActive._id);
      }
      return saveGroup(formData, editId);
    },
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['group'] });
      queryClient.invalidateQueries({ queryKey: ['group-all'] });
      toast.success(resp?.data?.message || 'Group berhasil disimpan.');
      handleCloseModal();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Gagal menyimpan group.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteGroup(id),
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['group'] });
      queryClient.invalidateQueries({ queryKey: ['group-all'] });
      toast.success(resp?.data?.message || 'Group berhasil dihapus.');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Gagal menghapus group.');
    },
  });

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    saveMutation.mutate();
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
    setFormData(initialForm);
  };

  const handleEdit = (item: GroupType) => {
    setEditId(item._id || null);
    setFormData({
      kode_group: item.kode_group,
      nama_group: item.nama_group,
      owner: item.nama_owner || item.owner,
      no_hp: item.no_hp_owner || item.no_hp,
      nama_owner: item.nama_owner || item.owner,
      no_hp_owner: item.no_hp_owner || item.no_hp,
      gender_owner: item.gender_owner || null,
      nama_pic: item.nama_pic || '',
      no_hp_pic: item.no_hp_pic || '',
      gender_pic: item.gender_pic || null,
      alamat: item.alamat,
    });
    setModalOpen(true);
  };

  const confirmDelete = () => {
    if (!deleteId) return;
    deleteMutation.mutate(deleteId);
    setDeleteId(null);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 relative overflow-hidden">
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
              Master Group Toko
            </h1>
            <p className="text-gray-600 mt-2">Kelola group toko, owner, dan PIC untuk data subscriber</p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Group Toko
          </Button>
        </div>

        <div className="bg-white/70 rounded-lg border-2 border-dashed border-blue-200 p-4">
          <div className="flex flex-wrap items-end gap-3">
            <div className="grid gap-2">
              <Label htmlFor="search-group" className="text-sm font-semibold text-gray-700">Cari</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <Input
                  id="search-group"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Kode, nama, owner, PIC, no hp, alamat"
                  className="w-80 pl-9 pr-9 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="limit-group" className="text-sm font-semibold text-gray-700">Per Halaman</Label>
              <SearchableSelect
                value={String(limit)}
                onValueChange={(value) => setLimit(Number(value))}
                options={[
                  { value: '10', label: '10' },
                  { value: '25', label: '25' },
                  { value: '50', label: '50' },
                ]}
                placeholder="Per halaman"
                searchPlaceholder="Cari jumlah..."
                className="w-32"
              />
            </div>
          </div>
        </div>

        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="w-32 px-6 py-4 font-semibold text-gray-900">Kode Group</TableHead>
                <TableHead className="w-56 px-6 py-4 font-semibold text-gray-900">Nama Group</TableHead>
                <TableHead className="w-48 px-6 py-4 font-semibold text-gray-900">Owner</TableHead>
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">No HP Owner</TableHead>
                <TableHead className="w-36 px-6 py-4 font-semibold text-gray-900">Gender Owner</TableHead>
                <TableHead className="w-48 px-6 py-4 font-semibold text-gray-900">PIC</TableHead>
                <TableHead className="px-6 py-4 font-semibold text-gray-900">Alamat</TableHead>
                <TableHead className="w-32 px-6 py-4 text-right font-semibold text-gray-900">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-600 font-medium">Memuat data group...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <Search className="w-6 h-6 text-blue-600" />
                      </div>
                      <p className="text-gray-600 font-medium">Belum ada data group</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((item) => (
                  <TableRow key={item._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                    <TableCell className="w-32 px-6 py-4 font-semibold text-gray-900">{item.kode_group}</TableCell>
                    <TableCell className="w-56 px-6 py-4 font-medium text-gray-900">{item.nama_group}</TableCell>
                    <TableCell className="w-48 px-6 py-4 text-gray-700">{item.nama_owner || item.owner}</TableCell>
                    <TableCell className="w-40 px-6 py-4 text-gray-700">{item.no_hp_owner || item.no_hp}</TableCell>
                    <TableCell className="w-36 px-6 py-4 text-gray-700">{item.gender_owner || '-'}</TableCell>
                    <TableCell className="w-48 px-6 py-4 text-gray-700">
                      <div className="space-y-1">
                        <div>{item.nama_pic || '-'}</div>
                        <div className="text-xs text-gray-500">{item.no_hp_pic || '-'}</div>
                      </div>
                    </TableCell>
                    <TableCell className="px-6 py-4 text-gray-700 truncate" title={item.alamat}>{item.alamat}</TableCell>
                    <TableCell className="w-32 px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          aria-label="Edit group"
                          className="border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setDeleteId(item._id || null)}
                          className="border-red-300 hover:bg-red-50 hover:border-red-400 text-red-600 hover:text-red-700 transition-all duration-200"
                          aria-label="Hapus group"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-gray-200 p-4 text-sm text-gray-600">
            <span>Total Data: {pagination.total}</span>
            <span>Halaman {pagination.page} dari {pagination.totalPages}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.max(1, value - 1))} disabled={page <= 1}>
                Sebelumnya
              </Button>
              <Button variant="outline" size="sm" onClick={() => setPage((value) => Math.min(pagination.totalPages, value + 1))} disabled={page >= pagination.totalPages}>
                Berikutnya
              </Button>
            </div>
          </div>
        </div>

        <ModalForm open={modalOpen} onOpenChange={handleCloseModal} title={editId ? 'Edit Group Toko' : 'Tambah Group Toko'}>
          <form onSubmit={handleSubmit} className="space-y-5 py-4">
            <div className="grid gap-2">
              <Label htmlFor="kode_group" className="text-sm font-semibold text-gray-700">Kode Group</Label>
              <Input
                id="kode_group"
                value={formData.kode_group}
                onChange={(event) => setFormData((prev) => ({ ...prev, kode_group: event.target.value.toUpperCase() }))}
                placeholder="Masukkan kode group"
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nama_group" className="text-sm font-semibold text-gray-700">Nama Group Toko</Label>
              <Input
                id="nama_group"
                value={formData.nama_group}
                onChange={(event) => setFormData((prev) => ({ ...prev, nama_group: event.target.value.toUpperCase() }))}
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                required
              />
            </div>
            <div className="border-t border-blue-200 pt-4">
              <h3 className="text-sm font-bold uppercase tracking-wide text-blue-700">Informasi Owner & PIC</h3>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="nama_owner" className="text-sm font-semibold text-gray-700">Nama Owner</Label>
                <Input
                  id="nama_owner"
                  value={formData.nama_owner || formData.owner || ''}
                  onChange={(event) => setFormData((prev) => ({
                    ...prev,
                    nama_owner: event.target.value.toUpperCase(),
                    owner: event.target.value.toUpperCase(),
                  }))}
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="no_hp_owner" className="text-sm font-semibold text-gray-700">No HP Owner</Label>
                <Input
                  id="no_hp_owner"
                  value={formData.no_hp_owner || formData.no_hp || ''}
                  onChange={(event) => setFormData((prev) => ({
                    ...prev,
                    no_hp_owner: event.target.value,
                    no_hp: event.target.value,
                  }))}
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-semibold text-gray-700">Gender Owner</Label>
                <SearchableSelect
                  value={formData.gender_owner || 'none'}
                  onValueChange={(value) => setFormData((prev) => ({
                    ...prev,
                    gender_owner: value === 'none' ? null : value as 'LAKI-LAKI' | 'PEREMPUAN',
                  }))}
                  options={[
                    { value: 'none', label: 'Kosongkan' },
                    { value: 'LAKI-LAKI', label: 'LAKI-LAKI' },
                    { value: 'PEREMPUAN', label: 'PEREMPUAN' },
                  ]}
                  placeholder="Pilih gender owner"
                  searchPlaceholder="Cari gender..."
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="nama_pic" className="text-sm font-semibold text-gray-700">Nama PIC</Label>
                <Input
                  id="nama_pic"
                  value={formData.nama_pic || ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, nama_pic: event.target.value.toUpperCase() }))}
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="no_hp_pic" className="text-sm font-semibold text-gray-700">No HP PIC</Label>
                <Input
                  id="no_hp_pic"
                  value={formData.no_hp_pic || ''}
                  onChange={(event) => setFormData((prev) => ({ ...prev, no_hp_pic: event.target.value }))}
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                />
              </div>
              <div className="grid gap-2">
                <Label className="text-sm font-semibold text-gray-700">Gender PIC</Label>
                <SearchableSelect
                  value={formData.gender_pic || 'none'}
                  onValueChange={(value) => setFormData((prev) => ({
                    ...prev,
                    gender_pic: value === 'none' ? null : value as 'LAKI-LAKI' | 'PEREMPUAN',
                  }))}
                  options={[
                    { value: 'none', label: 'Kosongkan' },
                    { value: 'LAKI-LAKI', label: 'LAKI-LAKI' },
                    { value: 'PEREMPUAN', label: 'PEREMPUAN' },
                  ]}
                  placeholder="Pilih gender PIC"
                  searchPlaceholder="Cari gender..."
                />
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="alamat" className="text-sm font-semibold text-gray-700">Alamat</Label>
              <Input
                id="alamat"
                value={formData.alamat}
                onChange={(event) => setFormData((prev) => ({ ...prev, alamat: event.target.value.toUpperCase() }))}
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
              />
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <Button type="button" variant="outline" onClick={handleCloseModal} className="border-gray-300 hover:bg-gray-50 transition-all duration-200">Batal</Button>
              <Button
                type="submit"
                disabled={saveMutation.isPending}
                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                {saveMutation.isPending ? 'Menyimpan...' : editId ? 'Simpan Perubahan' : 'Tambah Group Toko'}
              </Button>
            </div>
          </form>
        </ModalForm>

        <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
          <AlertDialogContent className="bg-white/95 backdrop-blur-sm shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Konfirmasi Hapus
              </AlertDialogTitle>
              <AlertDialogDescription className="text-gray-600 text-base">
                Yakin ingin menghapus group toko ini?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel className="border-gray-300 hover:bg-gray-50 transition-all duration-200">Batal</AlertDialogCancel>
              <AlertDialogAction
                onClick={confirmDelete}
                className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              >
                Hapus Group Toko
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
