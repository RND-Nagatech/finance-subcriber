import { useState } from 'react';
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

interface Program {
  _id?: string;
  nama: string;
  kode: string;
  internal_kode?: string;
  biaya: number;
  group_program?: string;
  status_aktv?: boolean;
  input_date?: string;
  update_date?: string;
  delete_date?: string | null;
  input_by: string;
  update_by?: string | null;
  delete_by?: string | null;
}

export default function Program() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<Program>({ nama: '', kode: '', internal_kode: '', biaya: 0, group_program: '', input_by: '' });
  const { user } = useAppStore();

  // Formatted input for biaya
  const [formattedBiaya, setFormattedBiaya] = useState('');

  // Fetch program
  // Ambil semua data program (aktif dan non-aktif) untuk validasi input
  const { data: allProgramList = [], isLoading } = useQuery<Program[]>({
    queryKey: ['program-all'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/program?all=true');
      return res.data || [];
    },
  });

  // Filter hanya yang aktif untuk ditampilkan di tabel
  const programList = allProgramList.filter((p) => p.status_aktv !== false);

  // Create / Update
  const saveMutation = useMutation({
    mutationFn: async (payload: Program) => {
      if (editId) {
        return axiosInstance.put(`/master/program/${editId}`, {
          nama: payload.nama,
          biaya: payload.biaya,
          group_program: payload.group_program,
          internal_kode: payload.internal_kode,
          update_by: user?.name || 'Unknown',
        });
      }
      // Cek apakah data sudah ada dan non-aktif
      const existing = allProgramList.find(
        (p) => p.nama.toLowerCase() === payload.nama.toLowerCase()
      );
      if (existing && existing.status_aktv === false) {
        setReactivateId(existing._id);
        setShowReactivateDialog(true);
        return;
      }
      return axiosInstance.post('/master/program', {
        nama: payload.nama,
        biaya: payload.biaya,
        group_program: payload.group_program,
        internal_kode: payload.internal_kode,
        input_by: payload.input_by
      });
    },
    onSuccess: () => {
      return; // handled in onSettled
    },
    onError: () => { /* handled in onSettled */ },
    onSettled: (data: any, error: any) => {
      queryClient.invalidateQueries({ queryKey: ['program'] });
      queryClient.invalidateQueries({ queryKey: ['program-all'] });
      const serverMsg = data?.data?.message || error?.response?.data?.message;
      if (serverMsg) {
        if (error) toast.error(serverMsg); else toast.success(serverMsg);
      } else {
        if (error) toast.error('Gagal menyimpan program!'); else toast.success('Data berhasil disimpan.');
      }
      if (!error) handleCloseModal();
    },
  });

  // Delete (soft delete)
  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/master/program/${id}`, {
      data: { delete_by: user?.name || 'Unknown' },
    }),
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['program'] });
      queryClient.invalidateQueries({ queryKey: ['program-all'] });
      const msg = resp?.data?.message || 'Program berhasil dihapus!';
      toast.success(msg);
    },
    onError: (error: any) => {
      const serverMsg = error?.response?.data?.message;
      if (serverMsg) {
        toast.error(serverMsg);
      } else {
        toast.error('Gagal menghapus program!');
      }
    },
  });

  const [showReactivateDialog, setShowReactivateDialog] = useState(false);
  const [reactivateId, setReactivateId] = useState<string | null>(null);

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

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(value);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      ...formData,
      biaya: parseFormattedInput(formattedBiaya),
      input_by: user?.name || 'Unknown'
    };
    saveMutation.mutate(payload);
  };

  const handleEdit = (item: Program) => {
    setEditId(item._id || null);
    setFormData(item);
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
    setFormData({ nama: '', kode: '', internal_kode: '', biaya: 0, group_program: '', input_by: '' });
    setFormattedBiaya('');
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
              Master Program
            </h1>
            <p className="text-gray-600 mt-2">Kelola program subscriber dengan mudah dan efisien</p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Program
          </Button>
        </div>

        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="w-20 px-6 py-4 font-semibold text-gray-900">Kode</TableHead>
                <TableHead className="w-32 px-6 py-4 font-semibold text-gray-900">Internal Kode</TableHead>
                <TableHead className="w-64 px-6 py-4 font-semibold text-gray-900">Nama Program</TableHead>
                <TableHead className="w-48 px-6 py-4 font-semibold text-gray-900">Group Program</TableHead>
                <TableHead className="w-48 px-6 py-4 font-semibold text-gray-900">Biaya</TableHead>
                <TableHead className="w-48 px-6 py-4 font-semibold text-gray-900">Input By</TableHead>
                <TableHead className="w-32 px-6 py-4 text-right font-semibold text-gray-900">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-600 font-medium">Memuat data program...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : programList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">Belum ada data program</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                programList.map((item) => (
                  <TableRow key={item._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                    <TableCell className="w-20 px-6 py-4 font-semibold text-gray-900">{item.kode}</TableCell>
                    <TableCell className="w-32 px-6 py-4 text-gray-700">{item.internal_kode || '-'}</TableCell>
                    <TableCell className="w-64 px-6 py-4 font-medium text-gray-900">{item.nama}</TableCell>
                    <TableCell className="w-48 px-6 py-4 text-gray-700">{item.group_program || '-'}</TableCell>
                    <TableCell className="w-48 px-6 py-4 text-gray-700 font-semibold">{formatCurrency(item.biaya)}</TableCell>
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
        </div>

        <ModalForm open={modalOpen} onOpenChange={handleCloseModal} title={editId ? 'Edit Program' : 'Tambah Program'}>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="nama" className="text-sm font-semibold text-gray-700">Nama Program</Label>
              <Input
                id="nama"
                value={formData.nama}
                onChange={e => setFormData({...formData, nama: e.target.value})}
                placeholder="Masukkan nama program"
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="kode" className="text-sm font-semibold text-gray-700">Kode Program</Label>
              <Input
                id="kode"
                value={formData.kode}
                onChange={e => setFormData({...formData, kode: e.target.value})}
                placeholder="Kode akan di-generate otomatis"
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                readOnly
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="internal_kode" className="text-sm font-semibold text-gray-700">Internal Kode</Label>
              <Input
                id="internal_kode"
                value={formData.internal_kode}
                onChange={e => setFormData({...formData, internal_kode: e.target.value})}
                placeholder="Masukkan internal kode"
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                required
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
                  setFormattedBiaya(formatted);
                }}
                placeholder="0"
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
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
                {editId ? 'Simpan Perubahan' : 'Tambah Program'}
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
                    await axiosInstance.put(`/master/program/${reactivateId}`, {
                      status_aktv: true,
                      update_by: user?.name || 'Unknown',
                    });
                    await queryClient.invalidateQueries({ queryKey: ['program'] });
                    await queryClient.invalidateQueries({ queryKey: ['program-all'] });
                    setShowReactivateDialog(false);
                    handleCloseModal();
                    toast.success('Program diaktifkan kembali!');
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
                Yakin ingin menghapus program ini? Tindakan ini tidak dapat dibatalkan.
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
                Hapus Program
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}