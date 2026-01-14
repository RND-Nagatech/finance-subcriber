import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Pencil, Trash2 } from 'lucide-react';
import { toast } from 'react-toastify';
import axiosInstance from '../../api/axiosInstance';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
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

interface Bank {
  _id?: string;
  kode_bank: string;
  nama_bank: string;
}

export default function Bank() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Bank>({ kode_bank: '', nama_bank: '' });
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  const { data: bankList = [], isLoading } = useQuery<Bank[]>({
    queryKey: ['bank-all'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/bank?all=true');
      return res.data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (payload: Bank) => {
      if (editId) {
        return axiosInstance.put(`/master/bank/${editId}`, payload);
      }
      return axiosInstance.post('/master/bank', payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-all'] });
      toast.success('Data berhasil disimpan.');
      handleCloseModal();
    },
    onError: () => {
      toast.error('Gagal menyimpan data bank!');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      return axiosInstance.delete(`/master/bank/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['bank-all'] });
      toast.success('Data berhasil dihapus.');
    },
    onError: () => {
      toast.error('Gagal menghapus data bank!');
    },
  });

  const handleOpenModal = (bank?: Bank) => {
    if (bank) {
      setEditId(bank._id || null);
      setFormData({ kode_bank: bank.kode_bank, nama_bank: bank.nama_bank });
    } else {
      setEditId(null);
      setFormData({ kode_bank: '', nama_bank: '' });
    }
    setModalOpen(true);
  };

  const handleCloseModal = () => {
    setModalOpen(false);
    setEditId(null);
    setFormData({ kode_bank: '', nama_bank: '' });
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value.toUpperCase() });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    saveMutation.mutate(formData);
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
              Master Bank
            </h1>
            <p className="text-gray-600 mt-2">Kelola data bank</p>
          </div>
          <Button
            onClick={() => handleOpenModal()}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            Tambah Bank
          </Button>
        </div>

        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Kode Bank</TableHead>
                <TableHead className="w-96 px-6 py-4 font-semibold text-gray-900">Nama Bank</TableHead>
                <TableHead className="w-32 px-6 py-4 text-right font-semibold text-gray-900">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-600 font-medium">Memuat data bank...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : bankList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={3} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">Belum ada data bank</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                bankList.map((b) => (
                  <TableRow key={b._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                    <TableCell className="w-40 px-6 py-4 font-semibold text-gray-900">{b.kode_bank}</TableCell>
                    <TableCell className="w-96 px-6 py-4 font-medium text-gray-900">{b.nama_bank}</TableCell>
                    <TableCell className="w-32 px-6 py-4 text-right">
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleOpenModal(b)}
                          className="border-blue-300 hover:bg-blue-50 hover:border-blue-400 transition-all duration-200"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => b._id && handleDelete(b._id)}
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
        </div>

        <ModalForm open={modalOpen} onOpenChange={setModalOpen} title={editId ? 'Edit Bank' : 'Tambah Bank'}>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="kode_bank" className="text-sm font-semibold text-gray-700">Kode Bank</Label>
              <Input
                id="kode_bank"
                name="kode_bank"
                value={formData.kode_bank}
                onChange={handleChange}
                required
                maxLength={10}
                className="uppercase tracking-widest font-mono bg-blue-50 focus:bg-white border-2 border-gray-200 transition-all duration-200 text-base px-4 py-2"
                autoComplete="off"
                placeholder="Masukkan kode bank"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="nama_bank" className="text-sm font-semibold text-gray-700">Nama Bank</Label>
              <Input
                id="nama_bank"
                name="nama_bank"
                value={formData.nama_bank}
                onChange={handleChange}
                required
                maxLength={100}
                className="uppercase tracking-wide bg-blue-50 focus:bg-white border-2 border-gray-200 transition-all duration-200 text-base px-4 py-2"
                autoComplete="off"
                placeholder="Masukkan nama bank"
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
                disabled={saveMutation.isPending}
              >
                {saveMutation.isPending ? 'Menyimpan...' : (editId ? 'Simpan Perubahan' : 'Tambah Bank')}
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
                Apakah Anda yakin ingin menghapus data bank ini?
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
      </div>
    </div>
  );
}
