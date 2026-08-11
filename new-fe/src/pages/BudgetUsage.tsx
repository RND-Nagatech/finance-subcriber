import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import {
  fetchBudgets,
  fetchBudgetUsages,
  createBudgetUsage,
  updateBudgetUsage,
  deleteBudgetUsage,
  Budget,
  BudgetUsage
} from '@/api/budget';
import { useAppStore } from '@/store/useAppStore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ModalForm } from '@/components/ModalForm';
import { Plus, Pencil, Trash2, FileText, Download, Receipt, File, Image, X, Eye } from 'lucide-react';
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

export default function BudgetUsagePage() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingUsage, setEditingUsage] = useState<BudgetUsage | null>(null);
  const [selectedBudget, setSelectedBudget] = useState<string>('all');
  const [formData, setFormData] = useState({
    budget_id: '',
    amount_used: 0,
    description: '',
    usage_date: new Date().toISOString().split('T')[0],
  });
  const [formattedAmount, setFormattedAmount] = useState('0');
  const [attachment, setAttachment] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { user } = useAppStore();
  const queryClient = useQueryClient();

  const { data: budgets = [] } = useQuery({
    queryKey: ['budgets'],
    queryFn: fetchBudgets,
  });

  const { data: usages = [], isLoading } = useQuery({
    queryKey: ['budget-usages', selectedBudget],
    queryFn: () => fetchBudgetUsages(selectedBudget === 'all' ? undefined : selectedBudget),
  });

  const createMutation = useMutation({
    mutationFn: ({ data, file }: { data: any; file?: File }) => createBudgetUsage(data, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-usages'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Penggunaan budget berhasil dicatat');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal mencatat penggunaan budget');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data, file }: { id: string; data: any; file?: File }) => updateBudgetUsage(id, data, file),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-usages'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Penggunaan budget berhasil diupdate');
      setIsModalOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal update penggunaan budget');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteBudgetUsage,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['budget-usages'] });
      queryClient.invalidateQueries({ queryKey: ['budgets'] });
      toast.success('Penggunaan budget berhasil dihapus');
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Gagal hapus penggunaan budget');
    },
  });

  const resetForm = () => {
    setFormData({
      budget_id: '',
      amount_used: 0,
      description: '',
      usage_date: new Date().toISOString().split('T')[0],
    });
    setFormattedAmount('0');
    setAttachment(null);
    setEditingUsage(null);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editingUsage) {
      updateMutation.mutate({
        id: editingUsage._id!,
        data: {
          amount_used: formData.amount_used,
          description: formData.description,
          usage_date: formData.usage_date,
        },
        file: attachment || undefined
      });
    } else {
      createMutation.mutate({
        data: formData,
        file: attachment || undefined
      });
    }
  };

  const handleEdit = (usage: BudgetUsage) => {
    setEditingUsage(usage);
    setFormData({
      budget_id: typeof usage.budget_id === 'string' ? usage.budget_id : usage.budget_id._id,
      amount_used: usage.amount_used,
      description: usage.description,
      usage_date: new Date(usage.usage_date).toISOString().split('T')[0],
    });
    setFormattedAmount(formatNumberInput(usage.amount_used.toString()));
    setAttachment(null);
    setIsModalOpen(true);
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Cleanup previous preview
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }

      setAttachment(file);

      // Create preview for images
      if (isImageFile(file.name)) {
        const previewUrl = URL.createObjectURL(file);
        setImagePreview(previewUrl);
      } else {
        setImagePreview(null);
      }
    }
  };

  // Cleanup image preview on unmount
  useEffect(() => {
    return () => {
      if (imagePreview) {
        URL.revokeObjectURL(imagePreview);
      }
    };
  }, [imagePreview]);

  const handleRemoveFile = () => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setAttachment(null);
    setImagePreview(null);
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
    }).format(amount);
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

  const formatDate = (date: string) => {
    return new Date(date).toLocaleDateString('id-ID');
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const getFileIcon = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    switch (extension) {
      case 'jpg':
      case 'jpeg':
      case 'png':
      case 'gif':
      case 'webp':
        return <Image className="w-8 h-8 text-blue-500" />;
      case 'pdf':
        return <FileText className="w-8 h-8 text-red-500" />;
      case 'doc':
      case 'docx':
        return <FileText className="w-8 h-8 text-blue-600" />;
      default:
        return <File className="w-8 h-8 text-gray-500" />;
    }
  };

  const isImageFile = (fileName: string) => {
    const extension = fileName.split('.').pop()?.toLowerCase();
    return ['jpg', 'jpeg', 'png', 'gif', 'webp'].includes(extension || '');
  };

  const getBudgetName = (budgetId: string | Budget) => {
    if (typeof budgetId === 'string') {
      const budget = budgets.find((b: Budget) => b._id === budgetId);
      return budget?.name || 'Unknown';
    }
    return budgetId.name;
  };

  if (isLoading) {
    return <div className="flex justify-center items-center h-64">Loading...</div>;
  }

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
              Budget Usage History
            </h1>
            <p className="text-gray-600 mt-2">Riwayat penggunaan budget</p>
          </div>
          <Button onClick={() => setIsModalOpen(true)} className="flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 transition-all duration-200 shadow-lg hover:shadow-xl">
            <Plus className="w-4 h-4 text-white" />
            Catat Penggunaan
          </Button>
        </div>

        <Card className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              <Receipt className="w-5 h-5 text-blue-600" />
              Filter Budget
            </CardTitle>
            <CardDescription className="text-gray-600">
              Pilih budget untuk melihat riwayat penggunaannya
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Select value={selectedBudget} onValueChange={setSelectedBudget}>
              <SelectTrigger className="w-full max-w-xs">
                <SelectValue placeholder="Pilih budget" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Semua Budget</SelectItem>
                {budgets.map((budget: Budget) => (
                  <SelectItem key={budget._id} value={budget._id!}>
                    {budget.name} ({budget.year})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </CardContent>
        </Card>

        <Card className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              <FileText className="w-5 h-5 text-blue-600" />
              Riwayat Penggunaan Budget
            </CardTitle>
          <CardDescription>
            Daftar semua penggunaan budget
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tanggal</TableHead>
                <TableHead>Budget</TableHead>
                <TableHead>Jumlah</TableHead>
                <TableHead>Deskripsi</TableHead>
                <TableHead>Lampiran</TableHead>
                <TableHead>Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usages.map((usage: BudgetUsage) => (
                <TableRow key={usage._id}>
                  <TableCell>{formatDate(usage.usage_date)}</TableCell>
                  <TableCell>{getBudgetName(usage.budget_id)}</TableCell>
                  <TableCell>{formatCurrency(usage.amount_used)}</TableCell>
                  <TableCell className="max-w-xs truncate">{usage.description}</TableCell>
                  <TableCell>
                    {usage.attachment ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => window.open(`http://localhost:5000/${usage.attachment}`, '_blank')}
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    ) : (
                      <span className="text-gray-400">-</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(usage)}
                      >
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Hapus Penggunaan Budget</AlertDialogTitle>
                            <AlertDialogDescription>
                              Apakah Anda yakin ingin menghapus catatan penggunaan budget ini?
                              Tindakan ini tidak dapat dibatalkan.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Batal</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDelete(usage._id!)}
                              className="bg-red-600 hover:bg-red-700"
                            >
                              Hapus
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <ModalForm
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) resetForm();
        }}
        title={editingUsage ? 'Edit Penggunaan Budget' : 'Catat Penggunaan Budget'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="budget_id">Budget</Label>
            <Select
              value={formData.budget_id}
              onValueChange={(value) => setFormData({ ...formData, budget_id: value })}
            >
              <SelectTrigger>
                <SelectValue placeholder="Pilih budget" />
              </SelectTrigger>
              <SelectContent>
                {budgets.map((budget: Budget) => (
                  <SelectItem key={budget._id} value={budget._id!}>
                    {budget.name} ({budget.year}) - Sisa: {formatCurrency(budget.total_amount - budget.used_amount)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount_used">Jumlah Digunakan</Label>
            <Input
              id="amount_used"
              type="text"
              value={formattedAmount}
              onChange={(e) => {
                const formatted = formatNumberInput(e.target.value);
                const numericValue = parseFormattedInput(formatted);
                setFormattedAmount(formatted);
                setFormData({ ...formData, amount_used: numericValue });
              }}
              placeholder="0"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="usage_date">Tanggal Penggunaan</Label>
            <Input
              id="usage_date"
              type="date"
              value={formData.usage_date}
              onChange={(e) => setFormData({ ...formData, usage_date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Deskripsi</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Jelaskan penggunaan budget"
              required
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="attachment">Lampiran (Opsional)</Label>
            <Input
              id="attachment"
              type="file"
              onChange={handleFileChange}
              accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
              className="mb-2"
            />

            {attachment && (
              <div className="mt-3 p-4 border border-gray-200 rounded-lg bg-gray-50">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0">
                    {getFileIcon(attachment.name)}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {attachment.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(attachment.size)}
                        </p>
                      </div>

                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveFile}
                        className="ml-2 text-gray-400 hover:text-red-500"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>

                    {imagePreview && (
                      <div className="mt-3">
                        <img
                          src={imagePreview}
                          alt="Preview"
                          className="max-w-full max-h-32 object-contain rounded border border-gray-200"
                        />
                      </div>
                    )}

                    <div className="mt-2 flex items-center gap-2">
                      <Eye className="w-4 h-4 text-gray-400" />
                      <span className="text-xs text-gray-600">
                        File siap diupload
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
          <div className="flex justify-end gap-2 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsModalOpen(false)}
            >
              Batal
            </Button>
            <Button
              type="submit"
              disabled={createMutation.isPending || updateMutation.isPending}
            >
              {createMutation.isPending || updateMutation.isPending ? 'Menyimpan...' : 'Simpan'}
            </Button>
          </div>
        </form>
      </ModalForm>
      </div>
    </div>
  );
}