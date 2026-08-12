import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '@/api/axiosInstance';
import { useAppStore } from '@/store/useAppStore';
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

interface GroupProgram {
  _id?: string;
  group_program: string;
  status_aktv?: boolean;
  input_by?: string;
}

export default function GroupProgram() {
  const queryClient = useQueryClient();
  const { user } = useAppStore();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<GroupProgram>({ group_program: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const { data: groupProgramList = [], isLoading } = useQuery<GroupProgram[]>({
    queryKey: ['group-program-all'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/group-program?all=true');
      return res.data || [];
    },
  });

  const activeGroupProgramList = groupProgramList.filter((item) => item.status_aktv !== false);

  const saveMutation = useMutation({
    mutationFn: async (payload: GroupProgram) => {
      if (editId) {
        return axiosInstance.put(`/master/group-program/${editId}`, {
          group_program: payload.group_program,
          update_by: user?.name || 'Unknown',
        });
      }
      return axiosInstance.post('/master/group-program', {
        group_program: payload.group_program,
        input_by: user?.name || 'Unknown',
      });
    },
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['group-program-all'] });
      queryClient.invalidateQueries({ queryKey: ['group-program-options'] });
      toast.success(resp?.data?.message || 'Data berhasil disimpan.');
      handleCloseModal();
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Gagal menyimpan group program.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => axiosInstance.delete(`/master/group-program/${id}`, {
      data: { delete_by: user?.name || 'Unknown' },
    }),
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['group-program-all'] });
      queryClient.invalidateQueries({ queryKey: ['group-program-options'] });
      toast.success(resp?.data?.message || 'Data berhasil dihapus.');
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Gagal menghapus group program.');
    },
  });

  const handleOpenModal = (item?: GroupProgram) => {
    if (item) {
      setEditId(item._id || null);
      setFormData({ group_program: item.group_program });
    } else {
      setEditId(null);
      setFormData({ group_program: '' });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
    setFormData({ group_program: '' });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate({ group_program: formData.group_program.trim() });
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

  const filteredList = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return activeGroupProgramList;
    return activeGroupProgramList.filter((item) => item.group_program.toLowerCase().includes(q));
  }, [activeGroupProgramList, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredList.length / pageSize));
  const displayRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredList.slice(start, start + pageSize);
  }, [filteredList, page, pageSize]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.6))] -z-10" />
      <div className="container mx-auto px-6 py-8 space-y-8">
        <div className="flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Master Group Program
            </h1>
            <p className="text-gray-600 mt-2">Kelola pilihan group program untuk master program</p>
          </div>
          <Button
            onClick={() => handleOpenModal()}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            Tambah Group Program
          </Button>
        </div>

        <div className="bg-white/70 rounded-lg border-2 border-dashed border-blue-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col">
            <Label htmlFor="search-group-program" className="text-sm font-semibold text-gray-700 mb-1">Cari</Label>
            <Input
              id="search-group-program"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari group program"
              className="w-80 border-2 border-gray-200"
            />
          </div>
          <div className="flex flex-col">
            <Label htmlFor="page-size-group-program" className="text-sm font-semibold text-gray-700 mb-1">Per Halaman</Label>
            <SearchableSelect
              value={String(pageSize)}
              onValueChange={(value) => {
                setPageSize(Number(value));
                setPage(1);
              }}
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

        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="px-6 py-4 font-semibold text-gray-900">Group Program</TableHead>
                <TableHead className="w-48 px-6 py-4 font-semibold text-gray-900">Input By</TableHead>
                <TableHead className="w-32 px-6 py-4 text-right font-semibold text-gray-900">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">Memuat data group program...</TableCell>
                </TableRow>
              ) : filteredList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12 text-gray-600">Belum ada data group program</TableCell>
                </TableRow>
              ) : (
                displayRows.map((item) => (
                  <TableRow key={item._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                    <TableCell className="px-6 py-4 font-medium text-gray-900">{item.group_program}</TableCell>
                    <TableCell className="w-48 px-6 py-4 text-gray-700">{item.input_by || '-'}</TableCell>
                    <TableCell className="w-32 px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => handleOpenModal(item)} className="border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200">
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button variant="outline" size="sm" onClick={() => item._id && handleDelete(item._id)} className="border-red-300 hover:bg-red-50 hover:border-red-400 text-red-600 hover:text-red-700 transition-all duration-200">
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
            <div className="text-sm text-gray-600">Total Data: {filteredList.length}</div>
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

        <ModalForm open={modalOpen} onOpenChange={handleCloseModal} title={editId ? 'Edit Group Program' : 'Tambah Group Program'}>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="group_program" className="text-sm font-semibold text-gray-700">Group Program</Label>
              <Input
                id="group_program"
                value={formData.group_program}
                onChange={(e) => setFormData({ group_program: e.target.value })}
                placeholder="Masukkan group program"
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                required
              />
            </div>
            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="outline" onClick={handleCloseModal} className="border-gray-300 hover:bg-gray-50 transition-all duration-200">
                Batal
              </Button>
              <Button type="submit" className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]">
                {editId ? 'Simpan Perubahan' : 'Tambah Group Program'}
              </Button>
            </div>
          </form>
        </ModalForm>

        <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
          <AlertDialogContent className="bg-white/95 backdrop-blur-sm shadow-2xl">
            <AlertDialogHeader>
              <AlertDialogTitle>Konfirmasi Hapus</AlertDialogTitle>
              <AlertDialogDescription>
                Yakin ingin menghapus group program ini?
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter className="gap-3">
              <AlertDialogCancel>Batal</AlertDialogCancel>
              <AlertDialogAction onClick={confirmDelete} className="bg-gradient-to-r from-red-600 to-rose-700 hover:from-red-700 hover:to-rose-800 text-white">
                Hapus Group Program
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
