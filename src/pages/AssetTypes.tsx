import { FormEvent, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Pencil, Plus, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'react-toastify';
import {
  createAssetType,
  deleteAssetType,
  fetchAssetTypes,
  updateAssetType,
  type AssetType,
} from '@/api/assets';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

const currency = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));

const emptyForm = { code: '', name: '', unit: '', current_price: '' };

export default function AssetTypes() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<AssetType | null>(null);
  const [deleteItem, setDeleteItem] = useState<AssetType | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [search, setSearch] = useState('');

  const { data: assetTypes = [], isLoading } = useQuery({ queryKey: ['asset-types'], queryFn: fetchAssetTypes });

  const filteredTypes = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return assetTypes;
    return assetTypes.filter((item) =>
      `${item.code} ${item.name} ${item.unit}`.toLowerCase().includes(q)
    );
  }, [assetTypes, search]);

  const resetForm = () => {
    setDialogOpen(false);
    setEditItem(null);
    setForm(emptyForm);
  };

  const openCreate = () => {
    setEditItem(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const openEdit = (item: AssetType) => {
    setEditItem(item);
    setForm({
      code: item.code || '',
      name: item.name || '',
      unit: item.unit || '',
      current_price: String(item.current_price || 0),
    });
    setDialogOpen(true);
  };

  const saveMutation = useMutation({
    mutationFn: () => {
      const payload = {
        code: form.code,
        name: form.name,
        unit: form.unit,
        current_price: Number(form.current_price || 0),
      };
      return editItem ? updateAssetType(editItem._id, payload) : createAssetType(payload);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-types'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets-summary'] });
      toast.success(editItem ? 'Jenis asset berhasil diperbarui' : 'Jenis asset berhasil ditambahkan');
      resetForm();
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menyimpan jenis asset'),
  });

  const deleteMutation = useMutation({
    mutationFn: deleteAssetType,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-types'] });
      toast.success('Jenis asset berhasil dihapus');
      setDeleteItem(null);
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menghapus jenis asset'),
  });

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    saveMutation.mutate();
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="mb-3">
            <Button asChild variant="ghost" className="gap-2 px-0 text-slate-600 hover:bg-transparent hover:text-slate-950">
              <Link to="/assets">
                <ArrowLeft className="h-4 w-4" />
                Kembali ke Asset
              </Link>
            </Button>
          </div>
          <h1 className="text-3xl font-bold text-slate-950">Jenis Asset</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola master jenis asset, satuan, dan harga sekarang.</p>
        </div>
        <Button onClick={openCreate} className="gap-2 bg-emerald-600 hover:bg-emerald-700">
          <Plus className="h-4 w-4" />
          Tambah Jenis Asset
        </Button>
      </div>

      <Card>
        <CardHeader className="gap-4 md:flex-row md:items-center md:justify-between">
          <CardTitle>Daftar Jenis Asset</CardTitle>
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Cari kode, nama, atau satuan"
            className="md:w-80"
          />
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Kode</TableHead>
                <TableHead>Nama</TableHead>
                <TableHead>Satuan</TableHead>
                <TableHead>Harga Sekarang</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">Memuat data...</TableCell>
                </TableRow>
              ) : filteredTypes.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-slate-500">Belum ada jenis asset.</TableCell>
                </TableRow>
              ) : (
                filteredTypes.map((item) => (
                  <TableRow key={item._id}>
                    <TableCell className="font-semibold text-slate-900">{item.code}</TableCell>
                    <TableCell>{item.name}</TableCell>
                    <TableCell>{item.unit}</TableCell>
                    <TableCell>{currency(item.current_price)} / {item.unit}</TableCell>
                    <TableCell>
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                        Aktif
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" size="sm" onClick={() => openEdit(item)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                          onClick={() => setDeleteItem(item)}
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
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => (open ? setDialogOpen(true) : resetForm())}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editItem ? 'Edit Jenis Asset' : 'Tambah Jenis Asset'}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="code">Kode</Label>
              <Input
                id="code"
                value={form.code}
                onChange={(event) => setForm({ ...form, code: event.target.value })}
                placeholder="EMAS"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="name">Nama</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Emas"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="unit">Satuan</Label>
              <Input
                id="unit"
                value={form.unit}
                onChange={(event) => setForm({ ...form, unit: event.target.value })}
                placeholder="gram"
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="current_price">Harga Sekarang / Satuan</Label>
              <Input
                id="current_price"
                type="number"
                min="0"
                step="any"
                value={form.current_price}
                onChange={(event) => setForm({ ...form, current_price: event.target.value })}
                placeholder="2500000"
                required
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={resetForm}>Batal</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {editItem ? 'Simpan Perubahan' : 'Simpan'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteItem} onOpenChange={(open) => !open && setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Jenis Asset?</AlertDialogTitle>
            <AlertDialogDescription>
              Jenis asset {deleteItem?.name || '-'} akan dihapus dari master. Jika jenis asset ini sedang dipakai,
              sistem akan menolak penghapusan dan menampilkan notifikasi.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleteMutation.isPending}>Batal</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleteMutation.isPending}
              onClick={(event) => {
                event.preventDefault();
                if (deleteItem?._id) deleteMutation.mutate(deleteItem._id);
              }}
              className="bg-red-600 text-white hover:bg-red-700"
            >
              Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
