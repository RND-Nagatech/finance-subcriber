import { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import axiosInstance from '@/api/axiosInstance';
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
import { ModalForm } from '@/components/ModalForm';
import { Plus, Pencil, Trash2, X } from 'lucide-react';
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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';

interface CustomDashboard {
  _id?: string;
  title: string;
  sub_kategories: string[];
  input_date?: string;
  update_date?: string;
  delete_date?: string | null;
  input_by: string;
  update_by?: string | null;
  delete_by?: string | null;
}

interface SubKategori {
  _id: string;
  sub_kategori: string;
  kode: string;
  kategori: string;
}

export default function CustomDashboard() {
  const queryClient = useQueryClient();
  const [modalOpen, setModalOpen] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [formData, setFormData] = useState<CustomDashboard>({
    title: '',
    sub_kategories: [],
    input_by: '',
  });
  const { user } = useAppStore();

  // Fetch subkategori for multi-select
  const { data: subKategories = [] } = useQuery({
    queryKey: ['subkategori'],
    queryFn: async () => {
      const response = await axiosInstance.get('/master/subkategori');
      return response.data || [];
    },
  });

  // Fetch custom dashboards
  const { data = [], isLoading, error } = useQuery({
    queryKey: ['custom-dashboard'],
    queryFn: async () => {
      const response = await axiosInstance.get('/master/custom-dashboard');
      return response.data || [];
    },
  });

  // Create/Update mutation
  const saveMutation = useMutation({
    mutationFn: async (payload: CustomDashboard) => {
      if (editId) {
        return axiosInstance.put(`/master/custom-dashboard/${editId}`, {
          ...payload,
          update_by: user?.name || 'Unknown',
        });
      }
      return axiosInstance.post('/master/custom-dashboard', payload);
    },
    onSuccess: async (data: any, variables: any, context: any) => {
      // Add small delay to ensure server has processed the request
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Force refetch the data
      await queryClient.invalidateQueries({ queryKey: ['custom-dashboard'], exact: true });
      await queryClient.refetchQueries({ queryKey: ['custom-dashboard'], exact: true });
      
      const serverMsg = data?.data?.message || 'Data berhasil disimpan.';
      toast.success(serverMsg);
      handleCloseModal();
    },
    onError: (error: any) => {
      const serverMsg = error?.response?.data?.message;
      if (serverMsg) {
        toast.error(serverMsg);
      } else {
        toast.error('Gagal menyimpan data. Silakan coba lagi.');
      }
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => axiosInstance.delete(`/master/custom-dashboard/${id}`, {
      data: { delete_by: user?.name || 'Unknown' },
    }),
    onSuccess: (resp: any) => {
      queryClient.invalidateQueries({ queryKey: ['custom-dashboard'] });
      const msg = resp?.data?.message || 'Custom Dashboard berhasil dihapus!';
      toast.success(msg);
    },
    onError: (error: any) => {
      const serverMsg = error?.response?.data?.message;
      if (serverMsg) {
        toast.error(serverMsg);
      } else {
        toast.error('Gagal menghapus custom dashboard!');
      }
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const payload = { ...formData, input_by: user?.name || 'Unknown' };
    saveMutation.mutate(payload);
  };

  const handleEdit = (item: CustomDashboard) => {
    setEditId(item._id || null);
    setFormData(item);
    setModalOpen(true);
  };

  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSubKategori, setFilterSubKategori] = useState('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
    setFormData({ title: '', sub_kategories: [], input_by: '' });
  };

  const handleSubKategoriToggle = (subKategori: string, checked: boolean) => {
    setFormData(prev => ({
      ...prev,
      sub_kategories: checked
        ? [...prev.sub_kategories, subKategori]
        : prev.sub_kategories.filter(s => s !== subKategori)
    }));
  };

  const removeSubKategori = (subKategori: string) => {
    setFormData(prev => ({
      ...prev,
      sub_kategories: prev.sub_kategories.filter(s => s !== subKategori)
    }));
  };

  const filteredCustomDashboards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return data
      .filter((item) => filterSubKategori === 'ALL' || (item.sub_kategories || []).includes(filterSubKategori))
      .filter((item) =>
        !q ? true : `${item.title} ${(item.sub_kategories || []).join(' ')} ${item.input_by || ''}`
          .toLowerCase()
          .includes(q)
      );
  }, [data, filterSubKategori, searchQuery]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomDashboards.length / pageSize));
  const displayRows = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredCustomDashboards.slice(start, start + pageSize);
  }, [filteredCustomDashboards, page, pageSize]);

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
              Master Custom Dashboard
            </h1>
            <p className="text-gray-600 mt-2">Kelola custom dashboard dengan mudah dan efisien</p>
          </div>
          <Button
            onClick={() => setModalOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            <Plus className="w-5 h-5 mr-2" />
            Tambah Custom Dashboard
          </Button>
        </div>

        <div className="bg-white/70 rounded-lg border-2 border-dashed border-blue-200 p-4 flex flex-wrap gap-3 items-end">
          <div className="flex flex-col">
            <Label htmlFor="search-custom-dashboard" className="text-sm font-semibold text-gray-700 mb-1">Cari</Label>
            <Input
              id="search-custom-dashboard"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              placeholder="Cari title / sub kategori / input by"
              className="w-80 border-2 border-gray-200"
            />
          </div>
          <div className="flex flex-col">
            <Label htmlFor="filter-sub-custom-dashboard" className="text-sm font-semibold text-gray-700 mb-1">Filter Sub Kategori</Label>
            <select
              id="filter-sub-custom-dashboard"
              value={filterSubKategori}
              onChange={(e) => {
                setFilterSubKategori(e.target.value);
                setPage(1);
              }}
              className="bg-white border-2 border-gray-200 rounded-md px-3 py-2 h-10 min-w-56"
            >
              <option value="ALL">Semua</option>
              {Array.from(new Set(subKategories.map((s: any) => s.sub_kategori))).map((sub) => (
                <option key={sub} value={sub}>{sub}</option>
              ))}
            </select>
          </div>
          <div className="flex flex-col">
            <Label htmlFor="page-size-custom-dashboard" className="text-sm font-semibold text-gray-700 mb-1">Per Halaman</Label>
            <select
              id="page-size-custom-dashboard"
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

        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-300">
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="w-64 px-6 py-4 font-semibold text-gray-900">Title</TableHead>
                <TableHead className="w-96 px-6 py-4 font-semibold text-gray-900">Sub Kategories</TableHead>
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
                      <p className="text-gray-600 font-medium">Memuat data custom dashboard...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredCustomDashboards.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-12 h-12 bg-gradient-to-br from-blue-100 to-indigo-100 rounded-full flex items-center justify-center">
                        <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
                        </svg>
                      </div>
                      <p className="text-gray-600 font-medium">Belum ada data custom dashboard</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                displayRows.map((item) => (
                  <TableRow key={item._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                    <TableCell className="w-64 px-6 py-4 font-semibold text-gray-900">{item.title}</TableCell>
                    <TableCell className="w-96 px-6 py-4 text-gray-700">
                      <div className="flex flex-wrap gap-1">
                        {item.sub_kategories.map((sub, index) => (
                          <Badge key={index} variant="secondary" className="text-xs">
                            {sub}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
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
            <div className="text-sm text-gray-600">Total Data: {filteredCustomDashboards.length}</div>
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

        <ModalForm open={modalOpen} onOpenChange={handleCloseModal} title={editId ? 'Edit Custom Dashboard' : 'Tambah Custom Dashboard'}>
          <form onSubmit={handleSubmit} className="space-y-6 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title" className="text-sm font-semibold text-gray-700">Title</Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Masukkan title custom dashboard"
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                required
              />
            </div>

            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-gray-700">Sub Kategories</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    className="w-full justify-start border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
                  >
                    {formData.sub_kategories.length === 0
                      ? "Pilih sub kategories..."
                      : `${formData.sub_kategories.length} sub kategori dipilih`
                    }
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0 max-h-64 overflow-hidden" align="start">
                  <div className="p-2">
                    <div 
                      className="space-y-2 max-h-56 overflow-y-auto scrollbar-thin scrollbar-thumb-blue-300 scrollbar-track-blue-100"
                      onWheel={(e) => {
                        e.stopPropagation();
                        const target = e.currentTarget;
                        const scrollTop = target.scrollTop;
                        const scrollHeight = target.scrollHeight;
                        const height = target.clientHeight;
                        
                        // Prevent default only if scrolling would go beyond bounds
                        if ((scrollTop === 0 && e.deltaY < 0) || 
                            (scrollTop >= scrollHeight - height && e.deltaY > 0)) {
                          e.preventDefault();
                        }
                      }}
                    >
                      {subKategories.map((sub) => (
                        <div key={sub._id} className="flex items-center space-x-2">
                          <Checkbox
                            id={sub._id}
                            checked={formData.sub_kategories.includes(sub.sub_kategori)}
                            onCheckedChange={(checked) =>
                              handleSubKategoriToggle(sub.sub_kategori, checked as boolean)
                            }
                          />
                          <Label
                            htmlFor={sub._id}
                            className="text-sm font-normal cursor-pointer flex-1"
                          >
                            {sub.kategori} - {sub.sub_kategori}
                          </Label>
                        </div>
                      ))}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {formData.sub_kategories.length > 0 && (
                <div className="flex flex-wrap gap-2 mt-2">
                  {formData.sub_kategories.map((sub, index) => (
                    <Badge key={index} variant="secondary" className="flex items-center gap-1">
                      {sub}
                      <X
                        className="w-3 h-3 cursor-pointer hover:text-red-500"
                        onClick={() => removeSubKategori(sub)}
                      />
                    </Badge>
                  ))}
                </div>
              )}
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
                {editId ? 'Simpan Perubahan' : 'Tambah Custom Dashboard'}
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
                Yakin ingin menghapus custom dashboard ini? Tindakan ini tidak dapat dibatalkan.
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
                Hapus Custom Dashboard
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </div>
  );
}
