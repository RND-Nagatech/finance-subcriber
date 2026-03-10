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
  submitPerjalananAudit,
  updatePerjalananItem,
  updatePerjalananItemAuditStatus,
  uploadPerjalananDanaAttachments,
  uploadPerjalananItemAttachments,
  type PerjalananDanaLedger,
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
import { ArrowUpRight, MoreHorizontal, Plus } from 'lucide-react';

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

function todayYmd() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function buildInjectKeteranganTemplate(header?: any) {
  if (!header) return 'Biaya OPR';
  const kodePerjalanan = String(header?.kode_perjalanan || '').trim();
  const tujuan = String(header?.tujuan || '').trim();
  const pelaksana = String(header?.user_name || '').trim();
  const baseParts = ['Biaya OPR', tujuan].filter(Boolean);
  const baseText = baseParts.join(' ').trim() || 'Biaya OPR';
  const withPelaksana = pelaksana ? `${baseText} (${pelaksana})` : baseText;
  return kodePerjalanan ? `${withPelaksana} - ${kodePerjalanan}` : withPelaksana;
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
  const [injectForm, setInjectForm] = useState({ tanggal: todayYmd(), nominal: '', rekening_id: '', perusahaan_id: '', keterangan: '', kategori: '', sub_kategori: '', akun: '' });
  const [injectKeteranganTouched, setInjectKeteranganTouched] = useState(false);
  const [injectDanaFiles, setInjectDanaFiles] = useState<File[]>([]);
  const [postingDialogOpen, setPostingDialogOpen] = useState(false);
  const [postingFiles, setPostingFiles] = useState<File[]>([]);
  const [postingForm, setPostingForm] = useState({
    perusahaan_id: '',
    rekening_id: '',
    kategori: 'BIAYA',
    sub_kategori: 'LAIN LAIN',
    akun: 'REALISASI',
  });
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
    enabled: !!selectedTripId && (view === 'dana' || view === 'audit'),
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
    enabled: (view === 'dana' && isOffice) || (view === 'audit' && canPost),
  });
  const perusahaanQuery = useQuery({
    queryKey: ['perusahaan-all-perjalanan'],
    queryFn: async () => (await axiosInstance.get('/master/perusahaan?all=true')).data || [],
    enabled: (view === 'dana' && isOffice) || (view === 'audit' && canPost),
  });

  const kategoriQuery = useQuery({
    queryKey: ['master-kategori-perjalanan'],
    queryFn: async () => (await axiosInstance.get('/master/kategori')).data || [],
    enabled: (view === 'audit' && canPost) || (view === 'dana' && isOffice),
  });
  const subKategoriQuery = useQuery({
    queryKey: ['master-subkategori-perjalanan'],
    queryFn: async () => (await axiosInstance.get('/master/subkategori')).data || [],
    enabled: (view === 'audit' && canPost) || (view === 'dana' && isOffice),
  });
  const akunQuery = useQuery({
    queryKey: ['master-akun-perjalanan'],
    queryFn: async () => (await axiosInstance.get('/master/akun')).data || [],
    enabled: (view === 'audit' && canPost) || (view === 'dana' && isOffice),
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
    mutationFn: async () => {
      const res = await injectPerjalananDana(selectedTripId, { ...injectForm, nominal: Number(injectForm.nominal) });
      const ledgerId = res?.ledger?._id;
      if (ledgerId && injectDanaFiles.length > 0) {
        try {
          await uploadPerjalananDanaAttachments(selectedTripId, String(ledgerId), injectDanaFiles);
        } catch (err) {
          return { ...res, __attachmentUploadError: getErrorMessage(err) };
        }
      }
      return res;
    },
    onSuccess: async (res: any) => {
      if (res?.__attachmentUploadError) {
        toast.warn(`Inject dana berhasil, tetapi upload bukti gagal: ${res.__attachmentUploadError}`);
      } else {
        toast.success('Inject dana berhasil');
      }
      setInjectForm({
        tanggal: todayYmd(),
        nominal: '',
        rekening_id: '',
        perusahaan_id: '',
        keterangan: buildInjectKeteranganTemplate(selectedHeaderFull),
        kategori: '',
        sub_kategori: '',
        akun: '',
      });
      setInjectKeteranganTouched(false);
      setInjectDanaFiles([]);
      await invalidateSelectedTrip();
    },
    onError: (e) => toast.error(getErrorMessage(e)),
  });

  const postingMut = useMutation({
    mutationFn: (payload: any) => postPerjalananToTtFinance(selectedTripId, payload || {}),
  });

  const activeSummary = summaryQuery.data || detailQuery.data?.summary || selectedHeader?.summary;
  const items: PerjalananItem[] = itemsQuery.data || [];
  const danaRows: PerjalananDanaLedger[] = danaQuery.data || [];
  const latestInjectLedger = useMemo(
    () => danaRows.find((d) => d.jenis === 'INJECT'),
    [danaRows]
  );
  const postingSisaDana = useMemo(
    () => Number(activeSummary?.sisa_dana || 0),
    [activeSummary?.sisa_dana]
  );
  const willCreateRealisasi = postingSisaDana > 0;
  const realisasiPostingValue = willCreateRealisasi ? -postingSisaDana : 0;
  const estimatedMergedAttachmentCount = useMemo(() => {
    const itemCount = items.reduce((sum, it) => sum + (it.attachments?.length || 0), 0);
    const danaCount = danaRows.reduce((sum, d) => sum + (d.attachments?.length || 0), 0);
    return itemCount + danaCount;
  }, [items, danaRows]);
  const estimatedItemAttachmentCount = useMemo(
    () => items.reduce((sum, it) => sum + (it.attachments?.length || 0), 0),
    [items]
  );
  const selectedHeaderFull = detailQuery.data?.header || selectedHeader;
  const transaksiInputLocked = String((selectedHeaderFull as any)?.status || '') !== 'BERJALAN';
  const postingSubKategoriOptions = useMemo(
    () => (subKategoriQuery.data || []).filter((s: any) => !postingForm.kategori || s.kategori === postingForm.kategori),
    [subKategoriQuery.data, postingForm.kategori]
  );
  const postingAkunOptions = useMemo(
    () => (akunQuery.data || []).filter((a: any) => (
      (!postingForm.kategori || a.kategori === postingForm.kategori) &&
      (!postingForm.sub_kategori || a.sub_kategori === postingForm.sub_kategori)
    )),
    [akunQuery.data, postingForm.kategori, postingForm.sub_kategori]
  );

  const uploadAttachmentsToTransaksi = async (transaksiId: string, files: File[]) => {
    if (!transaksiId || files.length === 0) return;
    const formData = new FormData();
    files.forEach((file) => formData.append('attachments', file));
    await axiosInstance.post(`/transaksi/${transaksiId}/attachments`, formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  };

  const openPostingDialogWithDefaults = () => {
    let rekeningId = '';
    if (latestInjectLedger?.kode_bank && latestInjectLedger?.no_rekening) {
      const matchedRekening = (rekeningQuery.data || []).find((r: any) =>
        String(r.kode_bank || '') === String(latestInjectLedger.kode_bank || '') &&
        String(r.no_rekening || '') === String(latestInjectLedger.no_rekening || '')
      );
      rekeningId = matchedRekening?._id || '';
    }
    setPostingForm({
      perusahaan_id: '',
      rekening_id: rekeningId,
      kategori: 'BIAYA',
      sub_kategori: 'LAIN LAIN',
      akun: 'REALISASI',
    });
    setPostingFiles([]);
    setPostingDialogOpen(true);
  };

  const handleSubmitPostingWithDialog = async () => {
    if (!selectedTripId) return;
    if (!postingForm.perusahaan_id || !postingForm.rekening_id || !postingForm.kategori || !postingForm.sub_kategori || !postingForm.akun) {
      toast.error('Perusahaan, rekening, kategori, sub kategori, dan akun wajib dipilih.');
      return;
    }
    try {
      const res = await postingMut.mutateAsync({
        perusahaan_id: postingForm.perusahaan_id,
        rekening_id: postingForm.rekening_id,
        kategori: postingForm.kategori,
        sub_kategori: postingForm.sub_kategori,
        akun: postingForm.akun,
      });
      const targetId = String(res?.target_tt_finance_detail_id || '');
      if (targetId && postingFiles.length > 0) {
        await uploadAttachmentsToTransaksi(targetId, postingFiles);
      }
      toast.success('Posting transaksi berhasil (menunggu validasi)');
      setPostingDialogOpen(false);
      setPostingFiles([]);
      await invalidateSelectedTrip();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const handleClickPosting = async () => {
    if (!selectedTripId) return;
    if (willCreateRealisasi) {
      openPostingDialogWithDefaults();
      return;
    }
    try {
      await postingMut.mutateAsync({});
      toast.success('Posting transaksi berhasil (menunggu validasi)');
      await invalidateSelectedTrip();
    } catch (e) {
      toast.error(getErrorMessage(e));
    }
  };

  const navLinks = useMemo(
    () => [
      { key: 'header', to: '/perjalanan-dinas', label: 'Header Perjalanan' },
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

  useEffect(() => {
    setInjectKeteranganTouched(false);
  }, [selectedTripId]);

  useEffect(() => {
    if (view !== 'dana') return;
    const template = buildInjectKeteranganTemplate(selectedHeaderFull);
    setInjectForm((prev) => {
      if (injectKeteranganTouched) return prev;
      return { ...prev, keterangan: template };
    });
  }, [selectedHeaderFull, view, injectKeteranganTouched]);

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

      <Card className="bg-white/85 backdrop-blur-md border-blue-100 shadow-sm overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500" />
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle className="text-base">Pilih Perjalanan</CardTitle>
              <p className="text-xs text-gray-500 mt-1">
                Pilih header perjalanan untuk melihat transaksi, dana, audit, dan status posting
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="px-3 py-1.5 rounded-full bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                {headers.length} Perjalanan
              </div>
              {selectedHeaderFull && (
                <div className="px-3 py-1.5 rounded-full bg-emerald-50 text-emerald-700 text-xs font-medium border border-emerald-100">
                  Aktif: {selectedHeaderFull.kode_perjalanan}
                </div>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
            <div className="space-y-2">
              <Label>Pilih Header Perjalanan</Label>
              <Select
                value={selectedTripId || undefined}
                onValueChange={(value) => setSearchParams((prev) => {
                  const next = new URLSearchParams(prev);
                  if (value) next.set('tripId', value); else next.delete('tripId');
                  return next;
                })}
              >
                <SelectTrigger className="h-12 bg-white border-blue-100">
                  <SelectValue placeholder="-- Pilih Perjalanan --" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  {headers.map((h) => (
                    <SelectItem key={h._id} value={h._id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{h.kode_perjalanan}</span>
                        <span className="text-xs text-gray-500">{h.user_name} • {h.tujuan} • {h.status}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4">
              {!selectedHeaderFull ? (
                <div className="h-full min-h-[84px] flex items-center justify-center text-sm text-gray-500">
                  Belum ada perjalanan yang dipilih
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusBadge value={selectedHeaderFull.status} />
                    {(selectedHeaderFull as any).posted_to_tt_finance && <StatusBadge value="POSTED" />}
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                    <div>
                      <div className="text-xs text-gray-500">Kode</div>
                      <div className="font-semibold text-gray-900">{selectedHeaderFull.kode_perjalanan}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Pelaksana</div>
                      <div className="font-semibold text-gray-900">{selectedHeaderFull.user_name}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Tujuan</div>
                      <div className="font-medium text-gray-800">{selectedHeaderFull.tujuan}</div>
                    </div>
                    <div>
                      <div className="text-xs text-gray-500">Periode</div>
                      <div className="font-medium text-gray-800">
                        {selectedHeaderFull.tanggal_berangkat} s/d {selectedHeaderFull.tanggal_pulang}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

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
                  <DialogContent className="sm:max-w-[820px] bg-white/95 backdrop-blur-sm border-blue-100 p-0 overflow-hidden">
                    <div className="h-1.5 bg-gradient-to-r from-blue-500 via-indigo-500 to-cyan-500" />
                    <DialogHeader className="px-6 pt-6 pb-0">
                      <div className="rounded-2xl border border-blue-100 bg-gradient-to-br from-blue-50 via-indigo-50/70 to-cyan-50/60 p-5">
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div className="space-y-2">
                            <div className="inline-flex items-center rounded-full border border-blue-200 bg-white/80 px-3 py-1 text-xs font-semibold text-blue-700">
                              Header Penugasan Perjalanan
                            </div>
                            <DialogTitle className="text-xl md:text-2xl font-semibold text-slate-900">
                              Buat Header Perjalanan
                            </DialogTitle>
                            <DialogDescription className="max-w-2xl text-sm text-slate-600">
                              Tentukan pelaksana, tujuan, dan periode perjalanan. Header ini akan menjadi sumber untuk transaksi perjalanan, inject dana, audit, dan posting.
                            </DialogDescription>
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 md:min-w-[360px]">
                            <div className="rounded-xl border border-blue-100 bg-white/80 px-3 py-2">
                              <div className="text-[11px] font-medium uppercase tracking-wide text-blue-700">Status Awal</div>
                              <div className="mt-1 text-sm font-semibold text-blue-900">BERJALAN</div>
                            </div>
                            <div className="rounded-xl border border-indigo-100 bg-white/80 px-3 py-2">
                              <div className="text-[11px] font-medium uppercase tracking-wide text-indigo-700">Workflow</div>
                              <div className="mt-1 text-xs font-semibold text-indigo-900">Berjalan • Audit • Selesai</div>
                            </div>
                            <div className="rounded-xl border border-cyan-100 bg-white/80 px-3 py-2">
                              <div className="text-[11px] font-medium uppercase tracking-wide text-cyan-700">Setelah Create</div>
                              <div className="mt-1 text-xs font-semibold text-cyan-900">Inject dana & transaksi</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </DialogHeader>

                    <div className="px-6 py-5 space-y-5">
                      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-4 space-y-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <div className="text-sm font-semibold text-slate-900">Informasi Penugasan</div>
                            <div className="text-xs text-slate-500">Field bertanda wajib harus diisi sebelum menyimpan.</div>
                          </div>
                          <div className="hidden sm:flex items-center gap-2 text-xs">
                            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-medium text-emerald-700">Draft form aktif</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-slate-700">User Pelaksana</Label>
                            <Select
                              value={headerForm.user_id || undefined}
                              onValueChange={(value) => {
                                const u = (usersQuery.data || []).find((x: any) => x._id === value);
                                setHeaderForm((prev) => ({
                                  ...prev,
                                  user_id: value,
                                  user_name: u?.name || u?.username || '',
                                  user_username: u?.username || '',
                                }));
                              }}
                            >
                              <SelectTrigger className="h-11 bg-white border-slate-200 focus:ring-blue-500">
                                <SelectValue placeholder="Pilih user pelaksana" />
                              </SelectTrigger>
                              <SelectContent className="max-h-80">
                                {(usersQuery.data || []).map((u: any) => (
                                  <SelectItem key={u._id} value={u._id}>
                                    {(u.name || u.username)} ({u.role})
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                            {headerForm.user_name && (
                              <div className="rounded-xl border border-blue-100 bg-blue-50/60 px-3 py-2 text-xs text-blue-800">
                                Pelaksana terpilih: <span className="font-semibold">{headerForm.user_name}</span>
                                {headerForm.user_username ? ` (@${headerForm.user_username})` : ''}
                              </div>
                            )}
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-slate-700">Tujuan / Kota</Label>
                            <Input
                              className="h-11 bg-white border-slate-200 focus-visible:ring-blue-500"
                              placeholder="Contoh: Bandung / Surabaya / Jakarta"
                              value={headerForm.tujuan}
                              onChange={(e) => setHeaderForm({ ...headerForm, tujuan: e.target.value })}
                            />
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                            <Label className="text-slate-700">Tanggal Berangkat</Label>
                            <Input
                              className="h-11 bg-white border-slate-200"
                              type="date"
                              value={headerForm.tanggal_berangkat}
                              onChange={(e) => setHeaderForm({ ...headerForm, tanggal_berangkat: e.target.value })}
                            />
                          </div>

                          <div className="rounded-xl border border-slate-200 bg-slate-50/60 p-3 space-y-2">
                            <Label className="text-slate-700">Tanggal Pulang</Label>
                            <Input
                              className="h-11 bg-white border-slate-200"
                              type="date"
                              value={headerForm.tanggal_pulang}
                              onChange={(e) => setHeaderForm({ ...headerForm, tanggal_pulang: e.target.value })}
                            />
                          </div>

                          <div className="space-y-2 md:col-span-2">
                            <Label className="text-slate-700">Catatan</Label>
                            <Input
                              className="h-11 bg-white border-slate-200 focus-visible:ring-blue-500"
                              placeholder="Catatan tambahan penugasan (opsional)"
                              value={headerForm.catatan}
                              onChange={(e) => setHeaderForm({ ...headerForm, catatan: e.target.value })}
                            />
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                          <div className="rounded-xl border border-white bg-white/80 p-3">
                            <div className="text-xs text-slate-500">Validasi Praktis</div>
                            <div className="mt-1 font-medium text-slate-800">Cek periode dan pelaksana agar tidak tertukar.</div>
                          </div>
                          <div className="rounded-xl border border-white bg-white/80 p-3">
                            <div className="text-xs text-slate-500">Dampak Setelah Simpan</div>
                            <div className="mt-1 font-medium text-slate-800">Trip bisa dipilih untuk inject dana dan transaksi.</div>
                          </div>
                          <div className="rounded-xl border border-white bg-white/80 p-3">
                            <div className="text-xs text-slate-500">Catatan Audit</div>
                            <div className="mt-1 font-medium text-slate-800">Header akan diaudit saat user submit selesai perjalanan.</div>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-col-reverse sm:flex-row sm:justify-between sm:items-center gap-3 pt-1">
                        <div className="text-xs text-gray-500">
                          Pastikan user, tujuan, dan periode perjalanan sudah benar sebelum menyimpan.
                        </div>
                        <div className="flex w-full sm:w-auto gap-2">
                          <Button variant="outline" className="flex-1 sm:flex-none" onClick={() => setHeaderDialogOpen(false)}>
                            Batal
                          </Button>
                          <Button
                            className="flex-1 sm:flex-none bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
                            onClick={() => createHeaderMut.mutate(headerForm)}
                            disabled={createHeaderMut.isPending}
                          >
                            {createHeaderMut.isPending ? 'Menyimpan...' : 'Simpan Header'}
                          </Button>
                        </div>
                      </div>
                    </div>
                  </DialogContent>
                </Dialog>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="text-xs text-blue-700 font-medium">Total Perjalanan</div>
                  <div className="text-lg font-bold text-blue-900">{headers.length}</div>
                </div>
                <div className="rounded-xl border border-yellow-100 bg-yellow-50/60 p-3">
                  <div className="text-xs text-yellow-700 font-medium">Sedang Diaudit</div>
                  <div className="text-lg font-bold text-yellow-900">{headers.filter((h) => h.status === 'SEDANG_DIAUDIT').length}</div>
                </div>
                <div className="rounded-xl border border-green-100 bg-green-50/60 p-3">
                  <div className="text-xs text-green-700 font-medium">Selesai</div>
                  <div className="text-lg font-bold text-green-900">{headers.filter((h) => h.status === 'SELESAI').length}</div>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                  <div className="text-xs text-indigo-700 font-medium">Belum Diposting</div>
                  <div className="text-lg font-bold text-indigo-900">
                    {headers.filter((h: any) => !h.posted_to_tt_finance).length}
                  </div>
                </div>
              </div>

              <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50/60 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/60">
                    <TableHead className="font-semibold text-slate-700">Perjalanan</TableHead>
                    <TableHead className="font-semibold text-slate-700">Pelaksana</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="font-semibold text-slate-700">Ringkasan Dana</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {headers.map((h) => (
                    <TableRow
                      key={h._id}
                      className={
                        "transition-colors " +
                        (selectedTripId === h._id
                          ? "bg-blue-50/70 hover:bg-blue-100/60 border-l-4 border-l-blue-500"
                          : "hover:bg-slate-50/80")
                      }
                    >
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="font-semibold text-slate-900">{h.kode_perjalanan}</div>
                          <div className="text-sm text-slate-700">{h.tujuan}</div>
                          <div className="text-xs text-slate-500">
                            {h.tanggal_berangkat} s/d {h.tanggal_pulang}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{h.user_name}</div>
                          <div className="text-xs text-slate-500">{h.user_username || h.user_id}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="flex flex-col gap-2">
                          <StatusBadge value={h.status} />
                          {(h as any).posted_to_tt_finance ? (
                            <span className="inline-flex w-fit items-center rounded-full bg-emerald-100 text-emerald-700 px-2 py-0.5 text-xs font-medium">
                              Posted
                            </span>
                          ) : (
                            <span className="inline-flex w-fit items-center rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-xs font-medium">
                              Belum Posted
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="grid grid-cols-2 gap-2 text-xs min-w-[240px]">
                          <div className="rounded-lg bg-blue-50 px-2 py-1.5">
                            <div className="text-blue-700">Inject</div>
                            <div className="font-semibold text-blue-900">
                              {Number((h as any).summary?.total_inject || 0).toLocaleString('id-ID')}
                            </div>
                          </div>
                          <div className="rounded-lg bg-emerald-50 px-2 py-1.5">
                            <div className="text-emerald-700">Sisa</div>
                            <div className="font-semibold text-emerald-900">
                              {Number((h as any).summary?.sisa_dana || 0).toLocaleString('id-ID')}
                            </div>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <div className="flex flex-wrap justify-end gap-2">
                          <Button size="sm" variant={selectedTripId === h._id ? 'default' : 'outline'} onClick={() => setSearchParams({ tripId: h._id })}>
                            {selectedTripId === h._id ? 'Terpilih' : 'Pilih'}
                          </Button>
                          {selectedTripId === h._id && h.status === 'BERJALAN' && (
                            <Button size="sm" onClick={() => {
                              if (window.confirm('Kirim perjalanan ke audit?')) submitAuditMut.mutate();
                            }} disabled={submitAuditMut.isPending}>
                              Selesai Perjalanan
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {headers.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center text-gray-500 py-10">Belum ada data perjalanan</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
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
        <div className="grid grid-cols-1 gap-6">
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
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Tanggal Inject</Label>
                  <Input
                    type="date"
                    value={injectForm.tanggal}
                    onChange={(e) => setInjectForm({ ...injectForm, tanggal: e.target.value })}
                    className="h-11"
                  />
                </div>
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
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="space-y-2">
                  <Label>Kategori</Label>
                  <Select value={injectForm.kategori} onValueChange={(value) => setInjectForm({ ...injectForm, kategori: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Pilih Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {(kategoriQuery.data || []).map((k: any, idx: number) => (
                        <SelectItem key={k._id || idx} value={k.kategori || k.nama || `kat-${idx}`}>
                          {k.kategori || k.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Sub Kategori</Label>
                  <Select value={injectForm.sub_kategori} onValueChange={(value) => setInjectForm({ ...injectForm, sub_kategori: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Pilih Sub Kategori" />
                    </SelectTrigger>
                    <SelectContent>
                      {(subKategoriQuery.data || []).map((s: any, idx: number) => (
                        <SelectItem key={s._id || idx} value={s.sub_kategori || s.nama || `sub-${idx}`}>
                          {s.sub_kategori || s.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Akun</Label>
                  <Select value={injectForm.akun} onValueChange={(value) => setInjectForm({ ...injectForm, akun: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Pilih Akun" />
                    </SelectTrigger>
                    <SelectContent>
                      {(akunQuery.data || []).map((a: any, idx: number) => (
                        <SelectItem key={a._id || idx} value={a.akun || a.nama || `akun-${idx}`}>
                          {a.akun || a.nama}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Perusahaan</Label>
                  <Select value={injectForm.perusahaan_id} onValueChange={(value) => setInjectForm({ ...injectForm, perusahaan_id: value })}>
                    <SelectTrigger className="h-11">
                      <SelectValue placeholder="Pilih perusahaan" />
                    </SelectTrigger>
                    <SelectContent>
                      {(perusahaanQuery.data || []).map((p: any) => (
                        <SelectItem key={p._id} value={p._id}>
                          {p.nama_perusahaan} ({p.kode_perusahaan})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
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
              </div>
              <div className="space-y-2">
                <Label>Keterangan</Label>
                <Input
                  placeholder="Contoh: Inject awal perjalanan"
                  value={injectForm.keterangan}
                  onChange={(e) => {
                    setInjectKeteranganTouched(true);
                    setInjectForm({ ...injectForm, keterangan: e.target.value });
                  }}
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label>Attachment Bukti Inject (Opsional)</Label>
                <Input
                  type="file"
                  multiple
                  accept="image/*,.pdf"
                  className="h-11"
                  onChange={(e) => setInjectDanaFiles(Array.from(e.target.files || []))}
                />
                {injectDanaFiles.length > 0 && (
                  <div className="text-xs text-gray-500">{injectDanaFiles.length} file dipilih</div>
                )}
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

          <Card className="bg-white/85 backdrop-blur-md border-blue-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-slate-500 via-blue-500 to-emerald-500" />
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base">Ledger Dana</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">Riwayat mutasi dana perjalanan (inject dan return)</p>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                  {danaRows.length} Mutasi
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="text-xs text-blue-700 font-medium">Total Inject</div>
                  <div className="text-lg font-bold text-blue-900">
                    Rp {danaRows.filter((d) => d.jenis === 'INJECT').reduce((sum, d) => sum + Number(d.nominal || 0), 0).toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <div className="text-xs text-emerald-700 font-medium">Total Return</div>
                  <div className="text-lg font-bold text-emerald-900">
                    Rp {danaRows.filter((d) => d.jenis === 'RETURN').reduce((sum, d) => sum + Number(d.nominal || 0), 0).toLocaleString('id-ID')}
                  </div>
                </div>
                <div className="rounded-xl border border-indigo-100 bg-indigo-50/60 p-3">
                  <div className="text-xs text-indigo-700 font-medium">Mutasi Terakhir</div>
                  <div className="text-sm font-semibold text-indigo-900">
                    {danaRows[0] ? new Date(danaRows[0].created_at).toLocaleString('id-ID') : '-'}
                  </div>
                </div>
              </div>

              <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50/40 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/40">
                    <TableHead className="font-semibold text-slate-700">Waktu Mutasi</TableHead>
                    <TableHead className="font-semibold text-slate-700">Jenis</TableHead>
                    <TableHead className="font-semibold text-slate-700">Transaksi</TableHead>
                    <TableHead className="font-semibold text-slate-700">Nominal</TableHead>
                    <TableHead className="font-semibold text-slate-700">Rekening</TableHead>
                    <TableHead className="font-semibold text-slate-700">Bukti</TableHead>
                    <TableHead className="font-semibold text-slate-700">Keterangan</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {danaRows.map((d) => (
                    <TableRow key={d._id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{new Date(d.created_at).toLocaleString('id-ID')}</div>
                          <div className="text-xs text-slate-500">{new Date(d.created_at).toLocaleDateString('id-ID', { weekday: 'long' })}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium border ${
                          d.jenis === 'INJECT'
                            ? 'bg-blue-100 text-blue-700 border-blue-200'
                            : 'bg-emerald-100 text-emerald-700 border-emerald-200'
                        }`}>
                          {d.jenis}
                        </span>
                      </TableCell>
                      <TableCell className="align-top min-w-[180px]">
                        {d.jenis === 'INJECT' ? (
                          <div className="space-y-1">
                            <div className={`text-xs font-semibold ${d.tt_finance_detail_id ? 'text-blue-700' : 'text-amber-700'}`}>
                              {d.tt_finance_detail_id ? `Linked: ${String(d.tt_finance_detail_id).slice(-8)}` : 'Belum linked'}
                            </div>
                            {d.transaksi_snapshot?.kategori && (
                              <div className="text-xs text-slate-500">
                                {d.transaksi_snapshot.kategori} / {d.transaksi_snapshot.sub_kategori} / {d.transaksi_snapshot.akun}
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">-</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className={`font-semibold ${d.jenis === 'INJECT' ? 'text-blue-700' : 'text-emerald-700'}`}>
                          {d.jenis === 'INJECT' ? '-' : '+'} Rp {Number(d.nominal).toLocaleString('id-ID')}
                        </div>
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{d.kode_bank}</div>
                          <div className="text-xs text-slate-500">{d.no_rekening}</div>
                        </div>
                      </TableCell>
                      <TableCell className="align-top min-w-[120px]">
                        {(d.attachments?.length || 0) > 0 ? (
                          <div className="flex flex-col items-start gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
                              onClick={() => {
                                const files = (d.attachments || []).map((a) => ({ path: a.path, original_name: a.original_name }));
                                setPreviewAttachments(files);
                                setPreviewIndex(0);
                                setPreviewDialogOpen(true);
                              }}
                            >
                              Preview
                            </Button>
                            <span className="text-xs text-gray-500">{d.attachments?.length} file</span>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400">Tidak ada</span>
                        )}
                      </TableCell>
                      <TableCell className="align-top">
                        <div className="text-sm text-slate-700 max-w-[360px] whitespace-normal break-words">
                          {d.keterangan || '-'}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                  {danaRows.length === 0 && (
                    <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-10">Belum ada ledger dana</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {view === 'audit' && (
        <div className="space-y-6">
          <Card className="bg-white/85 backdrop-blur-md border-blue-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-amber-500 via-blue-500 to-emerald-500" />
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base">Audit Item Perjalanan</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">Auditor dapat melakukan adjustment nominal/keterangan lalu approve item langsung</p>
                </div>
                <div className="px-3 py-1.5 rounded-full bg-slate-50 border border-slate-200 text-xs font-medium text-slate-700">
                  {items.length} Item
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                  <div className="text-xs text-slate-600 font-medium">Total Item</div>
                  <div className="text-lg font-bold text-slate-900">{items.length}</div>
                </div>
                <div className="rounded-xl border border-blue-100 bg-blue-50/60 p-3">
                  <div className="text-xs text-blue-700 font-medium">Pending</div>
                  <div className="text-lg font-bold text-blue-900">{items.filter((i) => i.audit_status === 'PENDING').length}</div>
                </div>
                <div className="rounded-xl border border-emerald-100 bg-emerald-50/60 p-3">
                  <div className="text-xs text-emerald-700 font-medium">Approved</div>
                  <div className="text-lg font-bold text-emerald-900">{items.filter((i) => i.audit_status === 'APPROVED').length}</div>
                </div>
                <div className="rounded-xl border border-amber-100 bg-amber-50/60 p-3">
                  <div className="text-xs text-amber-700 font-medium">Total Nominal</div>
                  <div className="text-sm md:text-lg font-bold text-amber-900">
                    Rp {items.reduce((sum, i) => sum + Number(i.nominal || 0), 0).toLocaleString('id-ID')}
                  </div>
                </div>
              </div>

              <div className="overflow-auto rounded-xl border border-slate-200 bg-white">
              <Table>
                <TableHeader>
                  <TableRow className="bg-gradient-to-r from-slate-50 to-blue-50/40 hover:bg-gradient-to-r hover:from-slate-50 hover:to-blue-50/40">
                    <TableHead className="font-semibold text-slate-700">Transaksi</TableHead>
                    <TableHead className="font-semibold text-slate-700">Nominal Audit</TableHead>
                    <TableHead className="font-semibold text-slate-700">Keterangan Audit</TableHead>
                    <TableHead className="font-semibold text-slate-700">Status</TableHead>
                    <TableHead className="font-semibold text-slate-700">Bukti</TableHead>
                    <TableHead className="font-semibold text-slate-700">Catatan Auditor</TableHead>
                    <TableHead className="font-semibold text-slate-700 text-right">Aksi</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => (
                    <TableRow key={it._id} className="hover:bg-slate-50/80 transition-colors">
                      <TableCell className="align-top min-w-[180px]">
                        <div className="space-y-1">
                          <div className="font-medium text-slate-900">{it.tanggal_transaksi}</div>
                          <div className="text-xs text-slate-500">ID: {it._id.slice(-6)}</div>
                        </div>
                      </TableCell>
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
                      <TableCell className="align-top"><StatusBadge value={it.audit_status} /></TableCell>
                      <TableCell className="align-top">
                        {(it.attachments?.length || 0) > 0 ? (
                          <div className="flex flex-col items-start gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
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
                      <TableCell className="min-w-[220px] align-top">
                        <Input
                          value={auditNotesByItem[it._id] ?? it.audit_catatan_item ?? ''}
                          onChange={(e) => setAuditNotesByItem((prev) => ({ ...prev, [it._id]: e.target.value }))}
                          placeholder="Catatan audit item"
                        />
                      </TableCell>
                      <TableCell className="align-top text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8"
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
                    <TableRow><TableCell colSpan={7} className="text-center text-gray-500 py-10">Belum ada item untuk diaudit</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-white/85 backdrop-blur-md border-blue-100 shadow-sm overflow-hidden">
            <div className="h-1 bg-gradient-to-r from-indigo-500 via-blue-500 to-emerald-500" />
            <CardHeader className="pb-3">
              <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <CardTitle className="text-base">Finalisasi Audit & Posting</CardTitle>
                  <p className="text-xs text-gray-500 mt-1">Finalisasi audit perjalanan dan posting berbasis sisa dana ke modul transaksi (tt_finance_detail)</p>
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge value={(selectedHeaderFull as any)?.status || '-'} />
                  {(selectedHeaderFull as any)?.posted_to_tt_finance ? (
                    <span className="inline-flex items-center rounded-full bg-emerald-100 text-emerald-700 px-2.5 py-1 text-xs font-medium border border-emerald-200">Posted</span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-slate-100 text-slate-600 px-2.5 py-1 text-xs font-medium border border-slate-200">Belum Posted</span>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid grid-cols-1 xl:grid-cols-[0.95fr_1.05fr] gap-4">
                <div className="rounded-xl border border-slate-200 bg-gradient-to-br from-slate-50 to-white p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-slate-600">Checklist Finalisasi</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between rounded-lg bg-white border px-3 py-2">
                        <span className="text-slate-600">Total Item</span>
                        <span className="font-semibold text-slate-900">{items.length}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white border px-3 py-2">
                        <span className="text-slate-600">Pending</span>
                        <span className="font-semibold text-blue-700">{items.filter((i) => i.audit_status === 'PENDING').length}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white border px-3 py-2">
                        <span className="text-slate-600">Approved</span>
                        <span className="font-semibold text-emerald-700">{items.filter((i) => i.audit_status === 'APPROVED').length}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-lg bg-white border px-3 py-2">
                        <span className="text-slate-600">Nilai Approved</span>
                        <span className="font-semibold text-slate-900">
                          Rp {Number(activeSummary?.total_approved || 0).toLocaleString('id-ID')}
                        </span>
                      </div>
                    </div>
                  </div>

                  <Button
                    className="w-full h-11 bg-gradient-to-r from-indigo-600 to-blue-700 hover:from-indigo-700 hover:to-blue-800"
                    disabled={!selectedTripId || !isAudit || finalizeAuditMut.isPending}
                    onClick={() => finalizeAuditMut.mutate()}
                  >
                    {finalizeAuditMut.isPending ? 'Memfinalisasi Audit...' : 'Finalize Audit (SELESAI)'}
                  </Button>
                </div>

                <div className="rounded-xl border border-blue-100 bg-blue-50/30 p-4 space-y-4">
                  <div className="text-sm font-semibold text-slate-800">Posting Transaksi</div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="rounded-xl border border-white bg-white p-3">
                      <div className="text-xs text-slate-500">Inject Dana Terakhir</div>
                      {latestInjectLedger ? (
                        <div className="mt-2 space-y-1">
                          <div className="text-sm font-semibold text-slate-900">
                            {latestInjectLedger.tt_finance_detail_id ? `Linked #${String(latestInjectLedger.tt_finance_detail_id).slice(-8)}` : 'Belum linked transaksi'}
                          </div>
                          <div className="text-xs text-slate-600">
                            {latestInjectLedger.transaksi_snapshot?.kategori || '-'} / {latestInjectLedger.transaksi_snapshot?.sub_kategori || '-'} / {latestInjectLedger.transaksi_snapshot?.akun || '-'}
                          </div>
                          <div className="text-xs text-slate-500">
                            Inject awal: Rp {Number(latestInjectLedger.nominal || 0).toLocaleString('id-ID')}
                          </div>
                          <div className="text-xs text-slate-500">
                            Total return perjalanan: Rp {Number(activeSummary?.total_return || 0).toLocaleString('id-ID')}
                          </div>
                          <div className="text-xs text-slate-500">
                            Sisa dana saat ini: Rp {Number(postingSisaDana || 0).toLocaleString('id-ID')}
                          </div>
                        </div>
                      ) : (
                        <div className="mt-2 text-xs text-amber-700">Belum ada inject dana.</div>
                      )}
                    </div>
                    <div className="rounded-xl border border-white bg-white p-3">
                      <div className="text-xs text-slate-500">Target Lampiran Posting</div>
                      <div className="mt-2 space-y-1 text-xs text-slate-600">
                        {willCreateRealisasi ? (
                          <>
                            <div>Target transaksi: REALISASI (mapping dipilih saat klik Posting)</div>
                            <div>Item perjalanan: {estimatedItemAttachmentCount} file</div>
                            <div>Inject + Return: {danaRows.reduce((sum, d) => sum + (d.attachments?.length || 0), 0)} file</div>
                            <div className="font-semibold text-blue-700">Estimasi total merge: {estimatedMergedAttachmentCount} file</div>
                          </>
                        ) : (
                          <>
                            <div>Target transaksi: Inject dana terakhir</div>
                            <div>Sumber lampiran: Item perjalanan saja</div>
                            <div className="font-semibold text-blue-700">Estimasi total item: {estimatedItemAttachmentCount} file</div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-xl border border-blue-100 bg-white p-3">
                    <div>
                      <div className="text-xs text-slate-500">Nilai transaksi REALISASI</div>
                      <div className="text-lg font-bold text-blue-900">
                        Rp {Number(realisasiPostingValue || 0).toLocaleString('id-ID')}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Rumus: REALISASI = -sisa_dana (hanya dibuat jika sisa dana &gt; 0)
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1">
                        Jika sisa dana ≤ 0: tidak membuat transaksi REALISASI, hanya sinkron lampiran item ke transaksi inject.
                      </div>
                    </div>
                    <Button
                      className="h-11 bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
                      disabled={!selectedTripId || !canPost || postingMut.isPending || !!(selectedHeaderFull as any)?.posted_to_tt_finance || !latestInjectLedger}
                      onClick={handleClickPosting}
                    >
                      {postingMut.isPending ? 'Posting...' : 'Posting Transaksi'}
                    </Button>
                  </div>

                  {(selectedHeaderFull as any)?.posting_meta && (
                    <div className="text-sm text-gray-600 rounded-lg border border-emerald-100 bg-emerald-50/60 px-3 py-2">
                      Sudah diposting oleh {(selectedHeaderFull as any).posting_meta?.posted_by} pada{' '}
                      {new Date((selectedHeaderFull as any).posting_meta?.posted_at).toLocaleString('id-ID')}
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Dialog open={postingDialogOpen} onOpenChange={setPostingDialogOpen}>
        <DialogContent className="sm:max-w-2xl bg-white/95 backdrop-blur-sm">
          <DialogHeader>
            <DialogTitle>Posting Transaksi REALISASI</DialogTitle>
            <DialogDescription>
              Pilih perusahaan, rekening, kategori, sub kategori, akun, dan attachment untuk transaksi hasil posting.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Perusahaan</Label>
                <Select
                  value={postingForm.perusahaan_id}
                  onValueChange={(value) => setPostingForm((prev) => ({ ...prev, perusahaan_id: value }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Pilih perusahaan" />
                  </SelectTrigger>
                  <SelectContent>
                    {(perusahaanQuery.data || []).map((p: any) => (
                      <SelectItem key={p._id} value={p._id}>
                        {p.nama_perusahaan} ({p.kode_perusahaan})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Rekening</Label>
                <Select
                  value={postingForm.rekening_id}
                  onValueChange={(value) => setPostingForm((prev) => ({ ...prev, rekening_id: value }))}
                >
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
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label>Kategori</Label>
                <Select
                  value={postingForm.kategori}
                  onValueChange={(value) => setPostingForm((prev) => ({ ...prev, kategori: value, sub_kategori: '', akun: '' }))}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Pilih kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {(kategoriQuery.data || []).map((k: any, idx: number) => (
                      <SelectItem key={k._id || idx} value={k.kategori || k.nama || `kat-${idx}`}>
                        {k.kategori || k.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Sub Kategori</Label>
                <Select
                  value={postingForm.sub_kategori}
                  onValueChange={(value) => setPostingForm((prev) => ({ ...prev, sub_kategori: value, akun: '' }))}
                  disabled={!postingForm.kategori}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Pilih sub kategori" />
                  </SelectTrigger>
                  <SelectContent>
                    {postingSubKategoriOptions.map((s: any, idx: number) => (
                      <SelectItem key={s._id || idx} value={s.sub_kategori || s.nama || `sub-${idx}`}>
                        {s.sub_kategori || s.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Akun</Label>
                <Select
                  value={postingForm.akun}
                  onValueChange={(value) => setPostingForm((prev) => ({ ...prev, akun: value }))}
                  disabled={!postingForm.sub_kategori}
                >
                  <SelectTrigger className="h-11">
                    <SelectValue placeholder="Pilih akun" />
                  </SelectTrigger>
                  <SelectContent>
                    {postingAkunOptions.map((a: any, idx: number) => (
                      <SelectItem key={a._id || idx} value={a.akun || a.nama || `akun-${idx}`}>
                        {a.akun || a.nama}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Attachment Posting (Opsional)</Label>
              <Input
                type="file"
                multiple
                accept="image/*,.pdf"
                className="h-11"
                onChange={(e) => setPostingFiles(Array.from(e.target.files || []))}
              />
              {postingFiles.length > 0 && (
                <div className="text-xs text-gray-500">{postingFiles.length} file dipilih</div>
              )}
            </div>

            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setPostingDialogOpen(false);
                  setPostingFiles([]);
                }}
                disabled={postingMut.isPending}
              >
                Batal
              </Button>
              <Button
                className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800"
                onClick={handleSubmitPostingWithDialog}
                disabled={postingMut.isPending}
              >
                {postingMut.isPending ? 'Posting...' : 'Posting Sekarang'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

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
