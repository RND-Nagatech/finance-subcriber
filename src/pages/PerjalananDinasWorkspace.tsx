import { useEffect, useMemo, useState } from 'react';
import { useRef } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { Link, useSearchParams } from 'react-router-dom';
import { useAppStore } from '@/store/useAppStore';
import axiosInstance from '@/api/axiosInstance';
import { fetchUsers } from '@/api/users';
import {
  createPerjalananDinas,
  createPerjalananItem,
  deletePerjalananItem,
  deletePerjalananItemAttachment,
  finalizePerjalananAudit,
  getPerjalananDinasDetail,
  getPerjalananSummary,
  injectPerjalananDana,
  listPerjalananDana,
  listPerjalananDinas,
  listPerjalananItems,
  postPerjalananToTtFinance,
  returnPerjalananDana,
  submitPerjalananAudit,
  updatePerjalananItem,
  updatePerjalananItemAuditStatus,
  uploadPerjalananItemAttachments,
  type PerjalananHeader,
  type PerjalananItem,
  type PerjalananItemAuditStatus,
} from '@/api/perjalananDinas';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
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
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ArrowDownLeft, ArrowUpRight, MoreHorizontal, Plus } from 'lucide-react';

type WorkspaceView = 'header' | 'transaksi' | 'dana' | 'audit';

interface Props {
  view: WorkspaceView;
}

function getErrorMessage(err: any) {
  return err?.response?.data?.message || err?.message || 'Terjadi kesalahan';
}

function parseCurrencyInput(value: string) {
  return value.replace(/[^\d]/g, '');
}

function formatCurrencyInput(value?: string | number) {
  const raw = String(value ?? '').replace(/[^\d]/g, '');
  if (!raw) return '';
  return new Intl.NumberFormat('id-ID').format(Number(raw));
}

function AttachmentUploader({ tripId, itemId, onDone, disabled = false }: { tripId: string; itemId: string; onDone: () => Promise<void> | void; disabled?: boolean }) {
  const [isDragOver, setIsDragOver] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handleFiles = async (files: FileList | File[] | null) => {
    const list = Array.from(files || []);
    if (!list.length || !tripId || disabled) return;
    try {
      await uploadPerjalananItemAttachments(tripId, itemId, list);
      toast.success('Bukti diupload');
      await onDone();
    } catch (err) {
      toast.error(getErrorMessage(err));
    }
  };

  return (
    <div>
      <div
        className={`border-2 border-dashed rounded-lg p-3 text-center transition-all duration-150 ${disabled ? 'opacity-50 cursor-not-allowed bg-gray-50 border-gray-200' : 'cursor-pointer border-gray-200 bg-white'} ${!disabled && isDragOver ? 'border-blue-500 bg-blue-50' : ''}`}
        onDragOver={(e) => { if (disabled) return; e.preventDefault(); setIsDragOver(true); }}
        onDragLeave={(e) => { if (disabled) return; e.preventDefault(); setIsDragOver(false); }}
        onDrop={async (e) => { if (disabled) return; e.preventDefault(); setIsDragOver(false); await handleFiles(e.dataTransfer.files); }}
        onClick={() => { if (!disabled) inputRef.current?.click(); }}
      >
        <div className="flex items-center justify-center gap-2">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isDragOver ? 'bg-blue-100' : 'bg-gray-100'}`}>
            <svg className={`w-4 h-4 ${isDragOver ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div className="text-xs text-gray-600">Klik untuk pilih file atau tarik di sini</div>
        </div>
        <input ref={inputRef} disabled={disabled} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={async (e) => { await handleFiles(e.target.files); e.currentTarget.value = ''; }} />
      </div>
    </div>
  );
}

function StatusBadge({ value }: { value?: string }) {
  const cls =
    value === 'SELESAI' ? 'bg-green-100 text-green-700' :
    value === 'SEDANG_DIAUDIT' ? 'bg-yellow-100 text-yellow-700' :
    value === 'APPROVED' ? 'bg-green-100 text-green-700' :
    value === 'REVISI' ? 'bg-red-100 text-red-700' :
    'bg-blue-100 text-blue-700';
  return <span className={`px-2 py-1 rounded text-xs font-medium ${cls}`}>{value || '-'}</span>;
}

function SummaryCards({ summary }: { summary: any }) {
  const items = [
    ['Total Inject', summary?.total_inject || 0],
    ['Total Transaksi', summary?.total_transaksi || 0],
    ['Total Approved', summary?.total_approved || 0],
    ['Total Return', summary?.total_return || 0],
    ['Sisa Dana', summary?.sisa_dana || 0],
  ];
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-3">
      {items.map(([label, value]) => (
        <Card key={String(label)}>
          <CardContent className="p-4">
            <div className="text-xs text-gray-500">{label}</div>
            <div className="text-lg font-semibold">{Number(value).toLocaleString('id-ID')}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function PerjalananDinasWorkspace({ view }: Props) {
  const queryClient = useQueryClient();
  const { user } = useAppStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const selectedTripId = searchParams.get('tripId') || '';
  const [headerForm, setHeaderForm] = useState({
    user_id: '',
    user_name: '',
    user_username: '',
    tujuan: '',
    tanggal_berangkat: '',
    tanggal_pulang: '',
    catatan: '',
  });
  const [itemForm, setItemForm] = useState({ tanggal_transaksi: '', nominal: '', keterangan: '' });
  const [editItemId, setEditItemId] = useState<string>('');
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [itemDialogFiles, setItemDialogFiles] = useState<File[]>([]);
  const [injectForm, setInjectForm] = useState({ nominal: '', rekening_id: '', keterangan: '' });
  const [returnForm, setReturnForm] = useState({ nominal: '', rekening_id: '', keterangan: '' });
  const [postingForm, setPostingForm] = useState({ kategori: '', sub_kategori: '', akun: '', tanggal_posting: '', bulan: '', tahun_fiskal: '' });
  const [auditNotesByItem, setAuditNotesByItem] = useState<Record<string, string>>({});
  const [auditNominalByItem, setAuditNominalByItem] = useState<Record<string, string>>({});
  const [auditKetByItem, setAuditKetByItem] = useState<Record<string, string>>({});
  const [headerDialogOpen, setHeaderDialogOpen] = useState(false);
  const [previewDialogOpen, setPreviewDialogOpen] = useState(false);
  const [previewAttachments, setPreviewAttachments] = useState<Array<{ path: string; original_name?: string }>>([]);
  const [previewIndex, setPreviewIndex] = useState(0);

  const role = user?.role || 'user';
  const isOffice = ['admin', 'finance', 'corsec', 'superuser'].includes(role);
  const isAudit = ['corsec', 'superuser'].includes(role);
  const canPost = ['finance', 'corsec', 'superuser'].includes(role);

  const headersQuery = useQuery({
    queryKey: ['perjalanan-dinas', 'headers', role],
    queryFn: () => listPerjalananDinas({ limit: 100 }),
  });

  const headers: PerjalananHeader[] = headersQuery.data?.data || [];

  useEffect(() => {
    if (!selectedTripId && headers.length > 0) {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.set('tripId', headers[0]._id);
        return next;
      });
    }
  }, [headers, selectedTripId, setSearchParams]);

  const selectedHeader = headers.find((h) => h._id === selectedTripId);

  const detailQuery = useQuery({
    queryKey: ['perjalanan-dinas', 'detail', selectedTripId],
    queryFn: () => getPerjalananDinasDetail(selectedTripId),
    enabled: !!selectedTripId,
  });

  const summaryQuery = useQuery({
    queryKey: ['perjalanan-dinas', 'summary', selectedTripId],
    queryFn: () => getPerjalananSummary(selectedTripId),
    enabled: !!selectedTripId,
  });

  const itemsQuery = useQuery({
    queryKey: ['perjalanan-dinas', 'items', selectedTripId],
    queryFn: () => listPerjalananItems(selectedTripId),
    enabled: !!selectedTripId && (view === 'transaksi' || view === 'audit'),
  });

  const danaQuery = useQuery({
    queryKey: ['perjalanan-dinas', 'dana', selectedTripId],
    queryFn: () => listPerjalananDana(selectedTripId),
    enabled: !!selectedTripId && view === 'dana',
  });

  const usersQuery = useQuery({
    queryKey: ['users-lite'],
    queryFn: fetchUsers,
    enabled: view === 'header' && isOffice,
  });

  const rekeningQuery = useQuery({
    queryKey: ['rekening-all-perjalanan'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/rekening?all=true');
      return res.data || [];
    },
    enabled: view === 'dana' && isOffice,
  });

  const kategoriQuery = useQuery({
    queryKey: ['master-kategori-perjalanan'],
    queryFn: async () => (await axiosInstance.get('/master/kategori')).data || [],
    enabled: view === 'audit' && canPost,
  });
  const subKategoriQuery = useQuery({
    queryKey: ['master-subkategori-perjalanan'],
    queryFn: async () => (await axiosInstance.get('/master/subkategori')).data || [],
    enabled: view === 'audit' && canPost,
  });
  const akunQuery = useQuery({
    queryKey: ['master-akun-perjalanan'],
    queryFn: async () => (await axiosInstance.get('/master/akun')).data || [],
    enabled: view === 'audit' && canPost,
  });

  const invalidateSelectedTrip = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['perjalanan-dinas', 'headers'] }),
      queryClient.invalidateQueries({ queryKey: ['perjalanan-dinas', 'detail', selectedTripId] }),
      queryClient.invalidateQueries({ queryKey: ['perjalanan-dinas', 'summary', selectedTripId] }),
      queryClient.invalidateQueries({ queryKey: ['perjalanan-dinas', 'items', selectedTripId] }),
      queryClient.invalidateQueries({ queryKey: ['perjalanan-dinas', 'dana', selectedTripId] }),
    ]);
  };

  const createHeaderMut = useMutation({
    mutationFn: createPerjalananDinas,
    onSuccess: async () => {
      toast.success('Perjalanan berhasil dibuat');
      setHeaderForm({ user_id: '', user_name: '', user_username: '', tujuan: '', tanggal_berangkat: '', tanggal_pulang: '', catatan: '' });
      setHeaderDialogOpen(false);
      await queryClient.invalidateQueries({ queryKey: ['perjalanan-dinas', 'headers'] });
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const saveItemMut = useMutation({
    mutationFn: async () => {
      if (!selectedTripId) throw new Error('Pilih perjalanan');
      const payload = { ...itemForm, nominal: Number(itemForm.nominal) };
      if (editItemId) {
        return updatePerjalananItem(selectedTripId, editItemId, payload);
      }
      const created = await createPerjalananItem(selectedTripId, payload);
      if (itemDialogFiles.length > 0 && created?._id) {
        await uploadPerjalananItemAttachments(selectedTripId, created._id, itemDialogFiles);
      }
      return created;
    },
    onSuccess: async () => {
      toast.success(editItemId ? 'Item diperbarui' : 'Item ditambahkan');
      setItemForm({ tanggal_transaksi: '', nominal: '', keterangan: '' });
      setEditItemId('');
      setItemDialogFiles([]);
      setItemDialogOpen(false);
      await invalidateSelectedTrip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const deleteItemMut = useMutation({
    mutationFn: (itemId: string) => deletePerjalananItem(selectedTripId, itemId),
    onSuccess: async () => {
      toast.success('Item dihapus');
      await invalidateSelectedTrip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const submitAuditMut = useMutation({
    mutationFn: () => submitPerjalananAudit(selectedTripId),
    onSuccess: async () => {
      toast.success('Perjalanan dikirim ke audit');
      await invalidateSelectedTrip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const auditItemMut = useMutation({
    mutationFn: ({ itemId, status }: { itemId: string; status: PerjalananItemAuditStatus }) =>
      updatePerjalananItemAuditStatus(selectedTripId, itemId, { audit_status: status, audit_catatan_item: auditNotesByItem[itemId] || '' }),
    onSuccess: async () => {
      toast.success('Status audit item diperbarui');
      await invalidateSelectedTrip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const auditAdjustMut = useMutation({
    mutationFn: ({ itemId, nominal, keterangan }: { itemId: string; nominal: number; keterangan: string }) =>
      updatePerjalananItem(selectedTripId, itemId, { nominal, keterangan }),
    onSuccess: async () => {
      toast.success('Adjustment transaksi disimpan');
      await invalidateSelectedTrip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const finalizeAuditMut = useMutation({
    mutationFn: () => finalizePerjalananAudit(selectedTripId, {}),
    onSuccess: async () => {
      toast.success('Audit difinalisasi');
      await invalidateSelectedTrip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const injectMut = useMutation({
    mutationFn: () => injectPerjalananDana(selectedTripId, { ...injectForm, nominal: Number(injectForm.nominal) }),
    onSuccess: async () => {
      toast.success('Inject dana berhasil');
      setInjectForm({ nominal: '', rekening_id: '', keterangan: '' });
      await invalidateSelectedTrip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const returnMut = useMutation({
    mutationFn: () => returnPerjalananDana(selectedTripId, { ...returnForm, nominal: Number(returnForm.nominal) }),
    onSuccess: async () => {
      toast.success('Return dana berhasil');
      await invalidateSelectedTrip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const postingMut = useMutation({
    mutationFn: () => postPerjalananToTtFinance(selectedTripId, {
      ...postingForm,
      tahun_fiskal: postingForm.tahun_fiskal || undefined,
    }),
    onSuccess: async () => {
      toast.success('Posting ke tt_finance berhasil');
      await invalidateSelectedTrip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const activeSummary = summaryQuery.data || detailQuery.data?.summary || selectedHeader?.summary;
  const items: PerjalananItem[] = itemsQuery.data || [];
  const danaRows = danaQuery.data || [];
  const selectedHeaderFull = detailQuery.data?.header || selectedHeader;
  const transaksiInputLocked = String((selectedHeaderFull as any)?.status || '') !== 'BERJALAN';

  const navLinks = useMemo(
    () => [
      { key: 'header', to: '/perjalanan-dinas', label: 'Header Perjalanan' },
      { key: 'transaksi', to: '/perjalanan-dinas/transaksi', label: 'Transaksi Perjalanan' },
      { key: 'dana', to: '/perjalanan-dinas/dana', label: 'Dana Perjalanan' },
      { key: 'audit', to: '/perjalanan-dinas/audit', label: 'Audit Perjalanan' },
    ],
    []
  );

  const previewBaseUrl = (import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5001');
  const activePreview = previewAttachments[previewIndex];
  const activePreviewUrl = activePreview ? `${previewBaseUrl}${activePreview.path}` : '';
  const activePreviewName = activePreview?.original_name || activePreview?.path?.split('/').pop() || '';
  const isPdfPreview = /\.pdf($|\?)/i.test(activePreviewUrl) || activePreviewName.toLowerCase().endsWith('.pdf');

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-indigo-100 relative overflow-hidden">
      <div className="absolute inset-0 bg-grid-slate-100 [mask-image:linear-gradient(0deg,white,rgba(255,255,255,0.65))] -z-10" />
      <div className="absolute top-0 right-0 -z-10"><div className="w-72 h-72 bg-gradient-to-bl from-blue-400/15 to-indigo-600/15 rounded-full blur-3xl" /></div>
      <div className="absolute bottom-0 left-0 -z-10"><div className="w-96 h-96 bg-gradient-to-tr from-indigo-400/15 to-cyan-500/10 rounded-full blur-3xl" /></div>
      <div className="container mx-auto px-4 md:px-6 py-6 space-y-6">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">Perjalanan Dinas</h1>
          <p className="text-sm text-gray-500">Modul perjalanan dinas: header, transaksi, dana, audit, posting</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {navLinks.map((n) => (
            <Link key={n.key} to={n.to + (selectedTripId ? `?tripId=${selectedTripId}` : '')}>
              <Button variant={view === n.key ? 'default' : 'outline'} size="sm">{n.label}</Button>
            </Link>
          ))}
        </div>
      </div>

      <Card className="bg-white/80 backdrop-blur-sm border-blue-100 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Pilih Perjalanan</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <select
            className="w-full border rounded-md px-3 py-2"
            value={selectedTripId}
            onChange={(e) => setSearchParams((prev) => {
              const next = new URLSearchParams(prev);
              if (e.target.value) next.set('tripId', e.target.value); else next.delete('tripId');
              return next;
            })}
          >
            <option value="">-- Pilih Perjalanan --</option>
            {headers.map((h) => (
              <option key={h._id} value={h._id}>
                {h.kode_perjalanan} | {h.user_name} | {h.tujuan} | {h.status}
              </option>
            ))}
          </select>
          {selectedHeaderFull && (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <StatusBadge value={selectedHeaderFull.status} />
              <span className="font-medium">{selectedHeaderFull.kode_perjalanan}</span>
              <span className="text-gray-500">{selectedHeaderFull.user_name}</span>
              <span className="text-gray-500">{selectedHeaderFull.tujuan}</span>
              <span className="text-gray-400">
                {selectedHeaderFull.tanggal_berangkat} s/d {selectedHeaderFull.tanggal_pulang}
              </span>
              {(selectedHeaderFull as any).posted_to_tt_finance && <StatusBadge value="POSTED" />}
            </div>
          )}
          {selectedTripId && <SummaryCards summary={activeSummary || {}} />}
        </CardContent>
      </Card>

      {view === 'header' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="xl:col-span-2 bg-white/80 backdrop-blur-sm border-blue-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Daftar Perjalanan</CardTitle>
              {isOffice && (
                <Dialog open={headerDialogOpen} onOpenChange={setHeaderDialogOpen}>
                  <DialogTrigger asChild>
                    <Button className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800">
                      <Plus className="w-4 h-4 mr-2" />
                      Buat Header Perjalanan
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="sm:max-w-[620px] bg-white/95 backdrop-blur-sm">
                    <DialogHeader>
                      <DialogTitle>Buat Header Perjalanan</DialogTitle>
                      <DialogDescription>
                        Isi data penugasan perjalanan untuk user pelaksana.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <select
                        className="w-full border rounded-md px-3 py-2"
                        value={headerForm.user_id}
                        onChange={(e) => {
                          const u = (usersQuery.data || []).find((x: any) => x._id === e.target.value);
                          setHeaderForm((prev) => ({
                            ...prev,
                            user_id: e.target.value,
                            user_name: u?.name || u?.username || '',
                            user_username: u?.username || '',
                          }));
                        }}
                      >
                        <option value="">-- Pilih User Pelaksana --</option>
                        {(usersQuery.data || []).map((u: any) => (
                          <option key={u._id} value={u._id}>{u.name || u.username} ({u.role})</option>
                        ))}
                      </select>
                      <Input placeholder="Tujuan / Kota" value={headerForm.tujuan} onChange={(e) => setHeaderForm({ ...headerForm, tujuan: e.target.value })} />
                      <div className="grid grid-cols-2 gap-2">
                        <Input type="date" value={headerForm.tanggal_berangkat} onChange={(e) => setHeaderForm({ ...headerForm, tanggal_berangkat: e.target.value })} />
                        <Input type="date" value={headerForm.tanggal_pulang} onChange={(e) => setHeaderForm({ ...headerForm, tanggal_pulang: e.target.value })} />
                      </div>
                      <Input placeholder="Catatan" value={headerForm.catatan} onChange={(e) => setHeaderForm({ ...headerForm, catatan: e.target.value })} />
                      <div className="flex justify-end gap-2">
                        <Button variant="outline" onClick={() => setHeaderDialogOpen(false)}>Batal</Button>
                        <Button onClick={() => createHeaderMut.mutate(headerForm)} disabled={createHeaderMut.isPending}>
                          {createHeaderMut.isPending ? 'Menyimpan...' : 'Simpan Header'}
                        </Button>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kode</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Tujuan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((h) => (
                    <TableRow key={h._id}>
                      <TableCell>{h.kode_perjalanan}</TableCell>
                      <TableCell>{h.user_name}</TableCell>
                      <TableCell>{h.tujuan}</TableCell>
                      <TableCell><StatusBadge value={h.status} /></TableCell>
                      <TableCell className="space-x-2">
                        <Button size="sm" variant="outline" onClick={() => setSearchParams({ tripId: h._id })}>Pilih</Button>
                        {selectedTripId === h._id && h.status === 'BERJALAN' && (
                          <Button size="sm" onClick={() => {
                            if (window.confirm('Kirim perjalanan ke audit?')) submitAuditMut.mutate();
                          }} disabled={submitAuditMut.isPending}>Selesai Perjalanan</Button>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                  {headers.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Belum ada data</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'transaksi' && (
        <div className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-blue-100 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">Daftar Item</CardTitle>
              <Dialog open={itemDialogOpen} onOpenChange={(open) => {
                setItemDialogOpen(open);
                if (!open) {
                  setEditItemId('');
                  setItemDialogFiles([]);
                  setItemForm({ tanggal_transaksi: '', nominal: '', keterangan: '' });
                }
              }}>
                <DialogTrigger asChild>
                  <Button disabled={!selectedTripId || transaksiInputLocked}>
                    <Plus className="w-4 h-4 mr-2" />
                    Tambah Transaksi Perjalanan
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[680px] bg-white/95 backdrop-blur-sm">
                  <DialogHeader>
                    <DialogTitle>{editItemId ? 'Edit Transaksi Perjalanan' : 'Tambah Transaksi Perjalanan'}</DialogTitle>
                    <DialogDescription>
                      Isi transaksi perjalanan dan upload bukti (opsional). Bukti bisa image/PDF.
                    </DialogDescription>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                      <Input type="date" value={itemForm.tanggal_transaksi} onChange={(e) => setItemForm({ ...itemForm, tanggal_transaksi: e.target.value })} />
                      <Input
                        type="text"
                        inputMode="numeric"
                        placeholder="Nominal"
                        value={formatCurrencyInput(itemForm.nominal)}
                        onChange={(e) => setItemForm({ ...itemForm, nominal: parseCurrencyInput(e.target.value) })}
                      />
                      <Input placeholder="Keterangan" value={itemForm.keterangan} onChange={(e) => setItemForm({ ...itemForm, keterangan: e.target.value })} />
                    </div>
                    {!editItemId && (
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Upload Attachment</label>
                        <div
                          id={`item-upload-${editItemId || 'new'}`}
                          className={`border-2 border-dashed rounded-lg p-3 cursor-pointer ${itemDialogFiles.length ? 'border-blue-400 bg-blue-50' : 'border-gray-200 bg-white'}`}
                          onClick={() => (document.getElementById(`item-input-${editItemId || 'new'}`) as HTMLInputElement)?.click()}
                        >
                          <div className="flex items-center justify-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${itemDialogFiles.length ? 'bg-blue-100' : 'bg-gray-100'}`}>
                              <svg className={`w-4 h-4 ${itemDialogFiles.length ? 'text-blue-600' : 'text-gray-600'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                              </svg>
                            </div>
                            <div className="text-xs text-gray-600">Klik untuk pilih file atau tarik di sini</div>
                          </div>
                        </div>
                        <input id={`item-input-${editItemId || 'new'}`} type="file" multiple accept="image/*,.pdf" className="hidden" onChange={(e) => setItemDialogFiles(Array.from(e.target.files || []))} />
                        {itemDialogFiles.length > 0 && (
                          <div className="space-y-2">
                            <p className="text-sm font-medium">Files to upload ({itemDialogFiles.length}):</p>
                            <div className="max-h-40 overflow-y-auto space-y-2">
                              {itemDialogFiles.map((file, idx) => (
                                <div key={idx} className="flex items-center justify-between bg-gray-50 rounded p-2">
                                  <div className="flex-1 min-w-0">
                                    <p className="text-sm text-gray-700 truncate">{file.name}</p>
                                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                                  </div>
                                  <Button variant="ghost" size="sm" className="text-red-600" onClick={() => setItemDialogFiles(prev => prev.filter((_, i) => i !== idx))}>
                                    Hapus
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                    <div className="flex justify-end gap-2">
                      <Button variant="outline" onClick={() => setItemDialogOpen(false)}>Batal</Button>
                      <Button onClick={() => saveItemMut.mutate()} disabled={!selectedTripId || saveItemMut.isPending || transaksiInputLocked}>
                        {saveItemMut.isPending ? 'Menyimpan...' : (editItemId ? 'Update Item' : 'Simpan Item')}
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>
            </CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Audit</TableHead>
                    <TableHead>Bukti</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it._id}>
                      <TableCell>{it.tanggal_transaksi}</TableCell>
                      <TableCell className="min-w-[180px]">
                        {isAudit ? (
                          <Input
                            type="text"
                            inputMode="numeric"
                            value={formatCurrencyInput(auditNominalByItem[it._id] ?? String(it.nominal))}
                            onChange={(e) => setAuditNominalByItem((prev) => ({ ...prev, [it._id]: parseCurrencyInput(e.target.value) }))}
                            placeholder="Nominal audit"
                          />
                        ) : (
                          Number(it.nominal).toLocaleString('id-ID')
                        )}
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        {isAudit ? (
                          <Input
                            value={auditKetByItem[it._id] ?? it.keterangan}
                            onChange={(e) => setAuditKetByItem((prev) => ({ ...prev, [it._id]: e.target.value }))}
                            placeholder="Keterangan transaksi"
                          />
                        ) : (
                          it.keterangan
                        )}
                      </TableCell>
                      <TableCell><StatusBadge value={it.audit_status} /></TableCell>
                      <TableCell className="space-y-1">
                        <div className="text-xs text-gray-500">{it.attachments?.length || 0} file</div>
                        <AttachmentUploader tripId={selectedTripId} itemId={it._id} onDone={invalidateSelectedTrip} disabled={transaksiInputLocked} />
                        {(it.attachments || []).slice(0, 2).map((att, idx) => (
                          <div key={`${att.path}-${idx}`} className="flex items-center justify-between bg-gray-50 rounded p-2 text-xs">
                            <a href={`${import.meta.env.VITE_API_BASE_URL?.replace('/api', '') || 'http://localhost:5001'}${att.path}`} target="_blank" rel="noreferrer" className="text-blue-600 underline truncate">
                              {att.original_name || att.path.split('/').pop()}
                            </a>
                            <Button variant="ghost" size="sm" disabled={transaksiInputLocked} className="text-red-600" onClick={async () => {
                              if (!selectedTripId) return;
                              if (!window.confirm('Hapus lampiran?')) return;
                              try {
                                const filename = att.path.split('/').pop() || '';
                                await deletePerjalananItemAttachment(selectedTripId, it._id, filename);
                                toast.success('Lampiran dihapus');
                                await invalidateSelectedTrip();
                              } catch (err) {
                                toast.error(getErrorMessage(err));
                              }
                            }}>
                              Hapus
                            </Button>
                          </div>
                        ))}
                      </TableCell>
                      <TableCell className="space-x-2">
                        <Button size="sm" variant="outline" disabled={transaksiInputLocked} onClick={() => {
                          setEditItemId(it._id);
                          setItemForm({ tanggal_transaksi: it.tanggal_transaksi, nominal: String(it.nominal), keterangan: it.keterangan });
                          setItemDialogFiles([]);
                          setItemDialogOpen(true);
                        }}>Edit</Button>
                        <Button size="sm" variant="outline" disabled={transaksiInputLocked} onClick={() => {
                          if (window.confirm('Hapus item?')) deleteItemMut.mutate(it._id);
                        }}>Hapus</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center text-gray-500">Belum ada item</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'dana' && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
          <Card className="bg-white/85 backdrop-blur-md border-blue-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-blue-500 to-indigo-600" />
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
                  <ArrowUpRight className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Inject Dana</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">Transfer dana perjalanan dari rekening perusahaan</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nominal Inject</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Contoh: 1.500.000"
                  value={formatCurrencyInput(injectForm.nominal)}
                  onChange={(e) => setInjectForm({ ...injectForm, nominal: parseCurrencyInput(e.target.value) })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Rekening Sumber</Label>
                <Select value={injectForm.rekening_id} onValueChange={(value) => setInjectForm({ ...injectForm, rekening_id: value })}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Pilih rekening" />
                  </SelectTrigger>
                  <SelectContent>
                    {(rekeningQuery.data || []).map((r: any) => (
                      <SelectItem key={r._id} value={r._id}>
                        {r.kode_bank} - {r.no_rekening} ({r.nama_rekening})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Input
                  placeholder="Contoh: Inject awal perjalanan"
                  value={injectForm.keterangan}
                  onChange={(e) => setInjectForm({ ...injectForm, keterangan: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="pt-1">
                <Button
                  className="w-full h-11 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
                  disabled={!selectedTripId || !isOffice || injectMut.isPending}
                  onClick={() => injectMut.mutate()}
                >
                  {injectMut.isPending ? 'Memproses Inject...' : 'Inject Dana'}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/85 backdrop-blur-md border-emerald-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-emerald-500 to-teal-600" />
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center">
                  <ArrowDownLeft className="w-5 h-5" />
                </div>
                <div>
                  <CardTitle className="text-base">Return Sisa Dana (Final)</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">Kembalikan sisa dana setelah audit perjalanan selesai</p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/70 p-3">
                <div className="text-xs text-emerald-700 font-medium">Sisa Dana Saat Ini</div>
                <div className="text-lg font-bold text-emerald-800">
                  Rp {Number(activeSummary?.sisa_dana || 0).toLocaleString('id-ID')}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Nominal Return</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  placeholder="Harus sama dengan sisa dana"
                  value={formatCurrencyInput(returnForm.nominal)}
                  onChange={(e) => setReturnForm({ ...returnForm, nominal: parseCurrencyInput(e.target.value) })}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Rekening Tujuan</Label>
                <Select value={returnForm.rekening_id} onValueChange={(value) => setReturnForm({ ...returnForm, rekening_id: value })}>
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Pilih rekening" />
                  </SelectTrigger>
                  <SelectContent>
                    {(rekeningQuery.data || []).map((r: any) => (
                      <SelectItem key={r._id} value={r._id}>
                        {r.kode_bank} - {r.no_rekening} ({r.nama_rekening})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Input
                  placeholder="Contoh: Return sisa dana perjalanan"
                  value={returnForm.keterangan}
                  onChange={(e) => setReturnForm({ ...returnForm, keterangan: e.target.value })}
                  className="h-11"
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Button
                  variant="outline"
                  className="h-11 border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  onClick={() => setReturnForm((prev) => ({ ...prev, nominal: String(Math.max(Number(activeSummary?.sisa_dana || 0), 0)) }))}
                >
                  Isi Nominal Sisa
                </Button>
                <Button
                  className="h-11 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800"
                  disabled={!selectedTripId || !isOffice || returnMut.isPending}
                  onClick={() => returnMut.mutate()}
                >
                  {returnMut.isPending ? 'Memproses Return...' : 'Return Dana'}
                </Button>
              </div>
            </CardContent>
          </Card>
          <Card className="xl:col-span-2 bg-white/80 backdrop-blur-sm border-blue-100 shadow-sm">
            <CardHeader><CardTitle className="text-base">Ledger Dana</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Waktu</TableHead>
                    <TableHead>Jenis</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Rekening</TableHead>
                    <TableHead>Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {danaRows.map((d) => (
                    <TableRow key={d._id}>
                      <TableCell>{new Date(d.created_at).toLocaleString('id-ID')}</TableCell>
                      <TableCell><StatusBadge value={d.jenis} /></TableCell>
                      <TableCell>{Number(d.nominal).toLocaleString('id-ID')}</TableCell>
                      <TableCell>{d.kode_bank}/{d.no_rekening}</TableCell>
                      <TableCell>{d.keterangan || '-'}</TableCell>
                    </TableRow>
                  ))}
                  {danaRows.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-500">Belum ada ledger dana</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'audit' && (
        <div className="space-y-6">
          <Card className="bg-white/80 backdrop-blur-sm border-blue-100 shadow-sm">
            <CardHeader><CardTitle className="text-base">Audit Item Perjalanan</CardTitle></CardHeader>
            <CardContent className="overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Tanggal</TableHead>
                    <TableHead>Nominal</TableHead>
                    <TableHead>Keterangan</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Bukti</TableHead>
                    <TableHead>Catatan Audit</TableHead>
                    <TableHead>Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it._id}>
                      <TableCell>{it.tanggal_transaksi}</TableCell>
                      <TableCell className="min-w-[180px]">
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={formatCurrencyInput(auditNominalByItem[it._id] ?? String(it.nominal))}
                          onChange={(e) => setAuditNominalByItem((prev) => ({ ...prev, [it._id]: parseCurrencyInput(e.target.value) }))}
                          placeholder="Nominal audit"
                          disabled={!isAudit}
                        />
                      </TableCell>
                      <TableCell className="min-w-[220px]">
                        <Input
                          value={auditKetByItem[it._id] ?? it.keterangan}
                          onChange={(e) => setAuditKetByItem((prev) => ({ ...prev, [it._id]: e.target.value }))}
                          placeholder="Keterangan transaksi"
                          disabled={!isAudit}
                        />
                      </TableCell>
                      <TableCell><StatusBadge value={it.audit_status} /></TableCell>
                      <TableCell>
                        {(it.attachments?.length || 0) > 0 ? (
                          <div className="flex items-center gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                const files = (it.attachments || []).map((a) => ({ path: a.path, original_name: a.original_name }));
                                if (!files.length) return;
                                setPreviewAttachments(files);
                                setPreviewIndex(0);
                                setPreviewDialogOpen(true);
                              }}
                            >
                              Preview
                            </Button>
                            <span className="text-xs text-gray-500">{it.attachments?.length} file</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">Tidak ada</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Input
                          value={auditNotesByItem[it._id] ?? it.audit_catatan_item ?? ''}
                          onChange={(e) => setAuditNotesByItem((prev) => ({ ...prev, [it._id]: e.target.value }))}
                          placeholder="Catatan audit item"
                        />
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={!isAudit || auditAdjustMut.isPending || auditItemMut.isPending}
                            >
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="w-52">
                            <DropdownMenuItem
                              onClick={() => {
                                const nominalRaw = auditNominalByItem[it._id] ?? String(it.nominal);
                                const ket = auditKetByItem[it._id] ?? it.keterangan;
                                auditAdjustMut.mutate({ itemId: it._id, nominal: Number(nominalRaw || 0), keterangan: ket });
                              }}
                            >
                              Simpan Adjust
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={async () => {
                                try {
                                  const nominalRaw = auditNominalByItem[it._id] ?? String(it.nominal);
                                  const ket = auditKetByItem[it._id] ?? it.keterangan;
                                  if (String(nominalRaw) !== String(it.nominal) || ket !== it.keterangan) {
                                    await auditAdjustMut.mutateAsync({ itemId: it._id, nominal: Number(nominalRaw || 0), keterangan: ket });
                                  }
                                  await auditItemMut.mutateAsync({ itemId: it._id, status: 'APPROVED' });
                                } catch {
                                  // handled by mutation onError
                                }
                              }}
                            >
                              Adjust + Approve
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() => auditItemMut.mutate({ itemId: it._id, status: 'PENDING' })}
                            >
                              Set Pending
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                  {items.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-gray-500">Belum ada item</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          <Card className="bg-white/80 backdrop-blur-sm border-blue-100 shadow-sm">
            <CardHeader><CardTitle className="text-base">Finalisasi Audit & Posting</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button disabled={!selectedTripId || !isAudit || finalizeAuditMut.isPending} onClick={() => finalizeAuditMut.mutate()}>
                  Finalize Audit (SELESAI)
                </Button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                <select className="w-full border rounded-md px-3 py-2" value={postingForm.kategori} onChange={(e) => setPostingForm({ ...postingForm, kategori: e.target.value })}>
                  <option value="">-- Pilih Kategori --</option>
                  {(kategoriQuery.data || []).map((k: any, idx: number) => (
                    <option key={k._id || idx} value={k.kategori || k.nama || ''}>{k.kategori || k.nama}</option>
                  ))}
                </select>
                <select className="w-full border rounded-md px-3 py-2" value={postingForm.sub_kategori} onChange={(e) => setPostingForm({ ...postingForm, sub_kategori: e.target.value })}>
                  <option value="">-- Pilih Sub Kategori --</option>
                  {(subKategoriQuery.data || []).map((s: any, idx: number) => (
                    <option key={s._id || idx} value={s.sub_kategori || s.nama || ''}>{s.sub_kategori || s.nama}</option>
                  ))}
                </select>
                <select className="w-full border rounded-md px-3 py-2" value={postingForm.akun} onChange={(e) => setPostingForm({ ...postingForm, akun: e.target.value })}>
                  <option value="">-- Pilih Akun --</option>
                  {(akunQuery.data || []).map((a: any, idx: number) => (
                    <option key={a._id || idx} value={a.akun || a.nama || ''}>{a.akun || a.nama}</option>
                  ))}
                </select>
                <Input type="date" value={postingForm.tanggal_posting} onChange={(e) => setPostingForm({ ...postingForm, tanggal_posting: e.target.value })} />
                <Input placeholder="Bulan fiskal (contoh: JAN-26)" value={postingForm.bulan} onChange={(e) => setPostingForm({ ...postingForm, bulan: e.target.value.toUpperCase() })} />
                <Input placeholder="Tahun fiskal (opsional)" value={postingForm.tahun_fiskal} onChange={(e) => setPostingForm({ ...postingForm, tahun_fiskal: e.target.value })} />
              </div>
              <Button
                disabled={!selectedTripId || !canPost || postingMut.isPending || !!(selectedHeaderFull as any)?.posted_to_tt_finance}
                onClick={() => postingMut.mutate()}
              >
                Posting ke tt_finance
              </Button>
              {(selectedHeaderFull as any)?.posting_meta && (
                <div className="text-sm text-gray-600">
                  Sudah diposting oleh {(selectedHeaderFull as any).posting_meta?.posted_by} pada{' '}
                  {new Date((selectedHeaderFull as any).posting_meta?.posted_at).toLocaleString('id-ID')}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={previewDialogOpen} onOpenChange={setPreviewDialogOpen}>
        <DialogContent className="sm:max-w-5xl w-[96vw] bg-white/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>Preview Bukti</DialogTitle>
            <DialogDescription>
              {activePreviewName || 'Lampiran transaksi perjalanan'}
            </DialogDescription>
          </DialogHeader>

          {previewAttachments.length > 1 && (
            <div className="flex flex-wrap gap-2">
              {previewAttachments.map((att, idx) => {
                const name = att.original_name || att.path.split('/').pop() || `File ${idx + 1}`;
                return (
                  <Button
                    key={`${att.path}-${idx}`}
                    size="sm"
                    variant={idx === previewIndex ? 'default' : 'outline'}
                    onClick={() => setPreviewIndex(idx)}
                    className="max-w-[220px] truncate"
                    title={name}
                  >
                    {idx + 1}. {name}
                  </Button>
                );
              })}
            </div>
          )}

          <div className="rounded-lg border bg-gray-50 min-h-[60vh] flex items-center justify-center overflow-hidden">
            {!activePreview ? (
              <div className="text-sm text-gray-500">Tidak ada file untuk dipreview.</div>
            ) : isPdfPreview ? (
              <iframe
                src={activePreviewUrl}
                title={activePreviewName || 'Preview PDF'}
                className="w-full h-[70vh] bg-white"
              />
            ) : (
              <img
                src={activePreviewUrl}
                alt={activePreviewName || 'Preview attachment'}
                className="max-h-[70vh] w-auto object-contain"
              />
            )}
          </div>

          {activePreviewUrl && (
            <div className="flex justify-end">
              <a href={activePreviewUrl} target="_blank" rel="noreferrer">
                <Button variant="outline">Buka di Tab Baru</Button>
              </a>
            </div>
          )}
        </DialogContent>
      </Dialog>
      </div>
    </div>
  );
}
