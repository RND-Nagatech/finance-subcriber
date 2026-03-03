import { useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient, useQueries } from '@tanstack/react-query';
import { createSchedule, deleteItem as deleteTTItem, fetchAvailableSubscribers, fetchDetailsByPeriode, fetchDetailsByToko, fetchSubscribers, updateItemStatus, updateItem as updateTTItem, TTVpsDetailItemDTO, VpsSubscriberOption, fetchLastPeriod, generateNextFiscal, startGenerateNextFiscal, getGenerateStatus, updateItemActive } from '@/api/ttvps';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'react-toastify';
import { format } from 'date-fns';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Combobox, ComboboxOption } from '@/components/ui/Combobox';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CheckCircle2, Trash2, Pencil, RotateCcw, FileCheck } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

function currency(n: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(n || 0);
}

function parseCurrencyInput(value: string): number {
  // Remove non-digit characters
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? parseInt(digits, 10) : 0;
}

function formatCurrencyInput(n: number): string {
  return currency(n);
}

function enumerateMonths(from: string, to: string): string[] {
  const res: string[] = [];
  const [fy, fm] = from.split('-').map(Number);
  const [ty, tm] = to.split('-').map(Number);
  if (!fy || !fm || !ty || !tm) return res;
  let y = fy, m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    res.push(`${y}-${String(m).padStart(2,'0')}`);
    m += 1;
    if (m > 12) { m = 1; y += 1; }
  }
  return res;
}

export default function VPS() {
  const qc = useQueryClient();
  // Filters
  const [open, setOpen] = useState(false);
  const [editItem, setEditItem] = useState<(TTVpsDetailItemDTO & { __periode: string }) | null>(null);
  const [openEdit, setOpenEdit] = useState(false);

  // Filters: period (from/to month), status, and search term
  const currentMonth = useMemo(() => format(new Date(), 'yyyy-MM'), []);
  const [periodFrom, setPeriodFrom] = useState<string>(currentMonth);
  const [periodTo, setPeriodTo] = useState<string>(currentMonth);
  const [tokoFilter, setTokoFilter] = useState<string>('ALL');
  const [statusFilter, setStatusFilter] = useState<'OPEN'|'PROCESS'|'DONE'|'ALL'>('OPEN');
  const [searchTerm, setSearchTerm] = useState<string>('');

  const months = useMemo(() => {
    if (!periodFrom || !periodTo) return [];
    return enumerateMonths(periodFrom, periodTo);
  }, [periodFrom, periodTo]);
  const detailQueries = useQueries({
    queries: months.map((p) => ({
      queryKey: ['tt-vps-details', p],
      queryFn: () => fetchDetailsByPeriode(p),
    })),
    combine: (results) => ({
      data: results.flatMap(r => (Array.isArray(r.data) ? r.data : []) ) as any,
      pending: results.some(r => r.isLoading),
    })
  });

  const { data: subsAll } = useQuery({ queryKey: ['subs-all'], queryFn: () => fetchSubscribers(true) });
  const tokoOptions = useMemo(() => {
    const names = Array.from(new Set((subsAll || []).map(s => s.toko))).sort();
    return ['ALL', ...names];
  }, [subsAll]);

  const detailsByToko = useQuery({
    queryKey: ['tt-vps-details-by-toko', tokoFilter],
    queryFn: () => fetchDetailsByToko(tokoFilter),
    enabled: !periodFrom && !periodTo && tokoFilter !== 'ALL'
  });

  const [localItems, setLocalItems] = useState<any[]>([]);
  useEffect(() => {
    // Sync localItems with fetched data
    const docs = months.length > 0 ? ((detailQueries as any).data as any[]) : ((detailsByToko.data as any[]) || []);
    if (!Array.isArray(docs)) return setLocalItems([]);
    const items = docs.map(doc => ({ ...doc, __periode: doc.periode }));
    setLocalItems(items);
  }, [detailQueries, detailsByToko.data, months.length]);

  const combinedItems = useMemo(() => {
    const containsText = (s: string, q: string) => s?.toLowerCase().includes(q.toLowerCase());
    const filtered = localItems.filter((it) => {
      const matchStatus = statusFilter === 'ALL' ? true : it.status === statusFilter;
      const matchToko = tokoFilter === 'ALL' ? true : it.toko === tokoFilter;
      const matchSearch = !searchTerm || containsText(it.toko, searchTerm) || containsText(it.program, searchTerm) || containsText((it as any).daerah, searchTerm);
      return matchStatus && matchToko && matchSearch;
    });
    // Sort by start date ascending, then by toko name ascending
    return filtered.sort((a: any, b: any) => {
      const da = new Date(a?.start || 0).getTime();
      const db = new Date(b?.start || 0).getTime();
      if (da !== db) return da - db;
      const ta = String(a?.toko || '');
      const tb = String(b?.toko || '');
      return ta.localeCompare(tb, 'id-ID', { sensitivity: 'base' });
    });
  }, [localItems, statusFilter, tokoFilter, searchTerm]);

  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const toggleExpand = (id: string, periode: string) => {
    setExpanded((prev) => ({ ...prev, [`${periode}-${id}`]: !prev[`${periode}-${id}`] }));
  };

  // Next fiscal caption based on last period in backend
  const { data: lastPeriodData } = useQuery({ queryKey: ['tt-vps-last-period'], queryFn: fetchLastPeriod });
  const nextFiscalLabel = useMemo(() => {
    if (!lastPeriodData) return '';
    const y = parseInt(String(lastPeriodData).slice(0,4), 10);
    if (!y) return '';
    return String(y + 1);
  }, [lastPeriodData]);

  const [genJob, setGenJob] = useState<{ jobId: string; total: number; done: number; label: number; status: 'running'|'done'|'error' } | null>(null);
  const handleStartGenerate = async () => {
    try {
      const res = await startGenerateNextFiscal();
      setGenJob({ jobId: res.jobId, total: res.total || 0, done: 0, label: res.nextFiscalLabel, status: 'running' });
    } catch (e: any) {
      toast.error(e?.response?.data?.message || 'Gagal mulai generate data');
    }
  };
  useEffect(() => {
    if (!genJob || genJob.status !== 'running') return;
    const id = setInterval(async () => {
      try {
        const st = await getGenerateStatus(genJob.jobId);
        setGenJob((prev) => prev ? { ...prev, done: st.done, status: st.status } : prev);
        if (st.status === 'done') {
          clearInterval(id);
          toast.success(`Generate ${st.nextFiscalLabel} berhasil (${st.total} toko)`);
          qc.invalidateQueries({ queryKey: ['tt-vps-details'] });
          qc.invalidateQueries({ queryKey: ['vps-tt-aggregates'] });
        } else if (st.status === 'error') {
          clearInterval(id);
          toast.error(st.error || 'Generate gagal');
        }
      } catch (e: any) {
        clearInterval(id);
        toast.error('Gagal memantau progres generate');
      }
    }, 1000);
    return () => clearInterval(id);
  }, [genJob?.jobId, genJob?.status]);

  const startCreate = () => { setEditItem(null); setOpen(true); };
  const startEdit = (item: any) => { setEditItem(item); setOpenEdit(true); };

  const delMut = useMutation({
    mutationFn: ({ periode, itemId }: { periode: string; itemId: string }) => deleteTTItem({ periode, itemId }),
    onSuccess: (_data, variables) => {
      toast.success('Data dihapus');
      setLocalItems((prev) => prev.filter((item) => !(item.__periode === variables.periode && item._id === variables.itemId)));
      qc.invalidateQueries({ queryKey: ['tt-vps-details'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Gagal hapus data'),
  });

  const updateActiveMut = useMutation({
    mutationFn: ({ periode, itemId, is_active }: { periode: string; itemId: string; is_active: boolean }) => updateItemActive({ periode, itemId, is_active }),
    onSuccess: (_data, variables) => {
      toast.success(variables.is_active ? 'Data diaktifkan' : 'Data dinonaktifkan');
      setLocalItems((prev) => prev.map((item) =>
        item.__periode === variables.periode && item._id === variables.itemId
          ? { ...item, is_active: variables.is_active }
          : item
      ));
      qc.invalidateQueries({ queryKey: ['tt-vps-details'] });
      qc.invalidateQueries({ queryKey: ['vps-tt-aggregates'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Gagal ubah status aktif'),
  });

  const updateStatusMut = useMutation({
    mutationFn: ({ periode, itemId, status, tanggalLunas }: { periode: string; itemId: string; status: 'OPEN' | 'PROCESS' | 'DONE'; tanggalLunas?: string }) => updateItemStatus({ periode, itemId, status, tanggalLunas }),
    onSuccess: (_data, variables) => {
      toast.success('Status diperbarui');
      setLocalItems((prev) => prev.map((item) =>
        item.__periode === variables.periode && item._id === variables.itemId
          ? { ...item, status: variables.status, tanggalLunas: variables.tanggalLunas ?? item.tanggalLunas }
          : item
      ));
      qc.invalidateQueries({ queryKey: ['tt-vps-details'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Gagal ubah status'),
  });

  // Summary for current table view
  const summary = useMemo(() => {
    const rows = Array.isArray(combinedItems) ? combinedItems : [];
    const activeRows = rows.filter((it: any) => (it?.is_active ?? true) !== false);
    const total = activeRows.reduce((sum: number, it: any) => sum + (Number(it?.total_harga) || 0), 0);
    const uniqueToko = new Set(activeRows.map((r: any) => r.toko)).size;
    return { total, uniqueToko, count: rows.length };
  }, [combinedItems]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">VPS Subscription</h2>
        <div className="flex gap-2">
          <Button
            onClick={startCreate}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            Tambah VPS
          </Button>
          <ConfirmAction
            title="Generate Data?"
            description={nextFiscalLabel ? `Anda yakin ingin generate data VPS untuk periode ${nextFiscalLabel}?` : 'Menentukan tahun...'}
            actionText="Ya, Generate"
            onConfirm={handleStartGenerate}
          >
            <Button
              disabled={(genJob?.status === 'running') || !nextFiscalLabel}
              className="bg-gradient-to-r from-purple-600 to-fuchsia-700 hover:from-purple-700 hover:to-fuchsia-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
              title={nextFiscalLabel ? `Generate Data ${nextFiscalLabel}` : 'Menentukan tahun...'}
            >
              {(genJob?.status === 'running') ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/70 border-t-transparent rounded-full animate-spin"></span>
                  <span>Generate...</span>
                </span>
              ) : (
                nextFiscalLabel ? `Generate Data ${nextFiscalLabel}` : 'Generate Data'
              )}
            </Button>
          </ConfirmAction>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white/50 rounded-lg p-4 border-2 border-dashed border-blue-200">
        <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
          <div>
            <Label>Toko</Label>
            <Select value={tokoFilter} onValueChange={(v) => {
              // Jika beralih ke ALL sementara periode kosong, paksa isi periode saat ini
              if (v === 'ALL' && (!periodFrom || !periodTo)) {
                toast.warn('Toko = ALL, periode wajib diisi');
                setPeriodFrom(currentMonth);
                setPeriodTo(currentMonth);
              }
              setTokoFilter(v);
            }}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                {tokoOptions.map((name) => (
                  <SelectItem key={name} value={name}>{name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Periode Dari</Label>
            <Input
              type="month"
              value={periodFrom}
              onChange={(e) => {
                const v = e.target.value;
                if (tokoFilter === 'ALL' && !v) {
                  toast.warn('Toko = ALL, periode wajib diisi');
                  return;
                }
                setPeriodFrom(v);
              }}
            />
          </div>
          <div>
            <Label>Periode Sampai</Label>
            <Input
              type="month"
              value={periodTo}
              onChange={(e) => {
                const v = e.target.value;
                if (tokoFilter === 'ALL' && !v) {
                  toast.warn('Toko = ALL, periode wajib diisi');
                  return;
                }
                setPeriodTo(v);
              }}
            />
          </div>
          <div>
            <Label>Status</Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
              <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="OPEN">OPEN</SelectItem>
                <SelectItem value="PROCESS">PROCESS</SelectItem>
                <SelectItem value="DONE">DONE</SelectItem>
                <SelectItem value="ALL">ALL</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="md:col-span-2">
            <Label>Search Data</Label>
            <Input
              placeholder="Cari berdasarkan toko/program/daerah..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100 transition-all duration-200"
            />
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Daftar VPS</CardTitle>
            <div className="text-sm text-gray-700 flex items-center gap-4">
              <span className="font-semibold">Total: {currency(summary.total)}</span>
              <span>Subscriber: <span className="font-semibold">{summary.uniqueToko}</span></span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {(detailQueries as any).pending ? (
            <div>Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left border-b">
                    <th className="py-2 pr-4"></th>
                    <th className="py-2 pr-4">Toko</th>
                    <th className="py-2 pr-4">Start Date</th>
                    <th className="py-2 pr-4">Bulan</th>
                    <th className="py-2 pr-4">Tempo</th>
                    <th className="py-2 pr-4">Harga/Bln</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {combinedItems?.map((item: any) => (
                    <>
                    <tr key={`${item.__periode}-${item._id}`} className="border-b">
                      <td className="py-2 pr-4">
                        <Button variant="ghost" size="sm" onClick={() => toggleExpand(item._id, item.__periode)} aria-label="Expand">
                          {expanded[`${item.__periode}-${item._id}`] ? '▾' : '▸'}
                        </Button>
                      </td>
                      <td className="py-2 pr-4">{item.toko}</td>
                      <td className="py-2 pr-4">{format(new Date(item.start), 'dd MMM yyyy')}</td>
                      <td className="py-2 pr-4">{item.bulan}</td>
                      <td className="py-2 pr-4">{format(new Date(item.tempo), 'dd MMM yyyy')}</td>
                      <td className="py-2 pr-4">{currency(item.harga)}</td>
                      <td className="py-2 pr-4">{currency(item.total_harga)}</td>
                      <td className="py-2 pr-4">
                        {item.status === 'DONE' ? (
                          <span className="inline-flex items-center rounded-full bg-green-100 text-green-700 px-2 py-0.5 text-xs font-medium">DONE</span>
                        ) : item.status === 'PROCESS' ? (
                          <span className="inline-flex items-center rounded-full bg-yellow-100 text-yellow-700 px-2 py-0.5 text-xs font-medium">PROCESS</span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-gray-200 text-gray-700 px-2 py-0.5 text-xs font-medium">OPEN</span>
                        )}
                        {(item.is_active ?? true) === false && (
                          <span className="inline-flex items-center rounded-full bg-red-100 text-red-700 px-2 py-0.5 text-xs font-medium ml-2">Nonaktif</span>
                        )}
                      </td>
                      <td className="py-2 pr-4 flex gap-2">
                        {item.status === 'OPEN' && (
                          <ConfirmAction
                            title="Invoice telah dibuat?"
                            description="Status akan diubah menjadi PROCESS. Setelah itu bisa dilunasi."
                            actionText="Ya, Invoice dibuat"
                            preview={<VpsItemPreview item={item} />}
                            onConfirm={() => updateStatusMut.mutate({ periode: item.__periode, itemId: item._id, status: 'PROCESS' })}
                          >
                            <Button
                              size="icon"
                              aria-label="Invoice dibuat"
                              title="Invoice dibuat"
                              className="rounded-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white shadow-md hover:shadow-lg border border-white/10 transition-transform hover:scale-105"
                              disabled={updateStatusMut.isPending || ((item.is_active ?? true) === false)}
                            >
                              <FileCheck className="h-5 w-5" />
                            </Button>
                          </ConfirmAction>
                        )}
                        {item.status === 'OPEN' && (
                          (item.is_active ?? true) !== false ? (
                            <ConfirmAction
                              title="Nonaktifkan VPS?"
                              description="Data akan dinonaktifkan untuk periode ini. Tidak bisa diproses invoice/pelunasan hingga diaktifkan kembali."
                              actionText="Ya, Nonaktifkan"
                              preview={<VpsItemPreview item={item} />}
                              onConfirm={() => updateActiveMut.mutate({ periode: item.__periode, itemId: item._id, is_active: false })}
                            >
                              <Button
                                size="icon"
                                aria-label="Nonaktifkan"
                                title="Nonaktifkan data"
                                className="rounded-full bg-gradient-to-r from-rose-500 to-red-600 hover:from-rose-600 hover:to-red-700 text-white shadow-md hover:shadow-lg border border-white/10 transition-transform hover:scale-105"
                                disabled={updateActiveMut.isPending}
                              >
                                <span className="font-bold">Ø</span>
                              </Button>
                            </ConfirmAction>
                          ) : (
                            <ConfirmAction
                              title="Aktifkan kembali?"
                              description="Data akan diaktifkan kembali dan kembali dihitung dalam estimasi."
                              actionText="Ya, Aktifkan"
                              preview={<VpsItemPreview item={item} />}
                              onConfirm={() => updateActiveMut.mutate({ periode: item.__periode, itemId: item._id, is_active: true })}
                            >
                              <Button
                                size="icon"
                                aria-label="Aktifkan kembali"
                                title="Aktifkan kembali"
                                className="rounded-full bg-gradient-to-r from-teal-500 to-emerald-600 hover:from-teal-600 hover:to-emerald-700 text-white shadow-md hover:shadow-lg border border-white/10 transition-transform hover:scale-105"
                                disabled={updateActiveMut.isPending}
                              >
                                <span className="font-bold">↺</span>
                              </Button>
                            </ConfirmAction>
                          )
                        )}
                        {item.status === 'PROCESS' && (
                          <>
                            <ConfirmAction
                              title="Selesaikan VPS?"
                              description="Status akan diubah menjadi DONE. Pilih tanggal lunas:"
                              actionText="Ya, Selesaikan"
                              showDate
                              preview={<VpsItemPreview item={item} />}
                              onConfirm={(tanggalLunas?: string) => updateStatusMut.mutate({ periode: item.__periode, itemId: item._id, status: 'DONE', tanggalLunas })}
                            >
                              <Button
                                size="icon"
                                aria-label="Tandai selesai"
                                title="Tandai selesai"
                                className="rounded-full bg-gradient-to-r from-emerald-500 to-green-600 hover:from-emerald-600 hover:to-green-700 text-white shadow-md hover:shadow-lg border border-white/10 transition-transform hover:scale-105"
                                disabled={updateStatusMut.isPending}
                              >
                                <CheckCircle2 className="h-5 w-5" />
                              </Button>
                            </ConfirmAction>
                            <ConfirmAction
                              title="Batalkan Proses?"
                              description="Status akan dikembalikan ke OPEN. Data akan bisa diedit dan dihapus kembali."
                              actionText="Ya, Batalkan"
                              onConfirm={() => updateStatusMut.mutate({ periode: item.__periode, itemId: item._id, status: 'OPEN' })}
                            >
                              <Button
                                size="icon"
                                aria-label="Batalkan proses"
                                title="Batalkan proses"
                                className="rounded-full bg-gradient-to-r from-orange-400 to-yellow-500 hover:from-orange-500 hover:to-yellow-600 text-white shadow-md hover:shadow-lg border border-white/10 transition-transform hover:scale-105"
                                disabled={updateStatusMut.isPending}
                              >
                                <RotateCcw className="h-5 w-5" />
                              </Button>
                            </ConfirmAction>
                          </>
                        )}
                        {item.status === 'DONE' && (
                          <ConfirmAction
                            title="Batal Pelunasan?"
                            description="Status akan dikembalikan ke PROCESS dan realisasi di periode tgl lunas akan dikurangi."
                            actionText="Ya, Batalkan"
                            onConfirm={() => updateStatusMut.mutate({ periode: item.__periode, itemId: item._id, status: 'PROCESS' })}
                          >
                            <Button
                              size="icon"
                              aria-label="Batal pelunasan"
                              title="Batal pelunasan"
                              className="rounded-full bg-gradient-to-r from-orange-500 to-amber-600 hover:from-orange-600 hover:to-amber-700 text-white shadow-md hover:shadow-lg border border-white/10 transition-transform hover:scale-105"
                              disabled={updateStatusMut.isPending}
                            >
                              <RotateCcw className="h-5 w-5" />
                            </Button>
                          </ConfirmAction>
                        )}
                        <Button
                          size="icon"
                          variant="secondary"
                          onClick={() => item.status === 'OPEN' ? startEdit(item) : undefined}
                          disabled={item.status !== 'OPEN'}
                          title={item.status !== 'OPEN' ? 'Edit tersedia hanya untuk status OPEN' : 'Edit'}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        {item.status === 'OPEN' ? (
                          <ConfirmAction
                            title="Hapus VPS?"
                            description="Data akan dihapus permanen. Lanjutkan?"
                            actionText="Ya, Hapus"
                            onConfirm={() => delMut.mutate({ periode: item.__periode, itemId: item._id })}
                          >
                            <Button size="icon" variant="destructive"><Trash2 className="h-4 w-4" /></Button>
                          </ConfirmAction>
                        ) : (
                          <Button
                            size="icon"
                            variant="destructive"
                            disabled
                            title="Hapus tersedia hanya untuk status OPEN"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        )}
                      </td>
                    </tr>
                    {expanded[`${item.__periode}-${item._id}`] && (
                      <tr className="bg-slate-50">
                        <td colSpan={9} className="py-2 px-4">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
                            <div>
                              <div className="text-xs text-slate-500">Program</div>
                              <div className="text-sm font-medium">{item.program}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Daerah</div>
                              <div className="text-sm font-medium">{item.daerah}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Diskon (%)</div>
                              <div className="text-sm font-medium">{item.diskon_percent || 0}%</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Diskon (Rp)</div>
                              <div className="text-sm font-medium">{currency(item.diskon)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Tanggal Lunas</div>
                              <div className="text-sm font-medium">
                                {item.tgl_lunas ? format(new Date(item.tgl_lunas), 'dd MMM yyyy') : <span className="text-slate-400">-</span>}
                              </div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Keterangan</div>
                              <div className="text-sm font-medium">{item.keterangan || '-'}</div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                    </>
                  ))}
                  {!combinedItems?.length && (
                    <tr><td className="py-4 text-slate-500" colSpan={10}>Belum ada data</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {genJob?.status === 'running' && (
        <div className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-lg p-5 shadow-xl w-[460px]">
            <div className="mb-3 font-semibold">Generate data {genJob?.label || nextFiscalLabel || ''}...</div>
            <Progress value={genJob?.total ? Math.round(((genJob?.done || 0) / genJob.total) * 100) : 0} />
            <div className="mt-2 text-sm text-gray-600 flex justify-between">
              <span>{genJob?.done || 0} / {genJob?.total || 0} toko</span>
              <span>{genJob?.total ? Math.round(((genJob?.done || 0) / genJob.total) * 100) : 0}%</span>
            </div>
            <div className="mt-1 text-xs text-gray-400">Mohon tunggu, proses bisa memakan waktu.</div>
          </div>
        </div>
      )}

      <VpsFormDialog
        open={open}
        onOpenChange={setOpen}
        editItem={null}
          onSuccess={() => { qc.invalidateQueries({ queryKey: ['tt-vps-details'] }); }}
      />
      <TTVpsEditDialog
        open={openEdit}
        onOpenChange={setOpenEdit}
        item={editItem}
        onSuccess={() => { setOpenEdit(false); qc.invalidateQueries({ queryKey: ['tt-vps-details'] }); }}
      />
    </div>
  );
}

function VpsFormDialog({ open, onOpenChange, editItem, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; editItem: null; onSuccess: () => void }) {
  const { data: subs } = useQuery({ queryKey: ['vps-available-subs'], queryFn: fetchAvailableSubscribers, enabled: !editItem });
  const qc = useQueryClient();
  const createMut = useMutation({
    mutationFn: (payload: { subscriberId?: string; startDate: string; months: number; discount?: number; discountPercent?: number; keterangan?: string }) =>
      createSchedule({ subscriber_id: payload.subscriberId, start: payload.startDate, bulan: payload.months, diskon: payload.discount, diskon_percent: payload.discountPercent, keterangan: payload.keterangan }),
    onSuccess: () => {
      toast.success('Data disimpan');
      // Tetap buka form; reset field agar siap input berikutnya
      setSubscriberId('');
      setStartDate('');
      setMonthsText('');
      setDiscountPercentText('');
      onSuccess();
      qc.invalidateQueries({ queryKey: ['vps-available-subs'] });
      qc.invalidateQueries({ queryKey: ['tt-vps-details'] });
    },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Gagal simpan data'),
  });
  // Update/edit for TT items will be added after edit semantics are confirmed

  const [subscriberId, setSubscriberId] = useState<string>('');
  const selectedSub = useMemo(() => subs?.find(s => s._id === subscriberId), [subs, subscriberId]);
  const pricePerMonth = selectedSub?.biaya || 0;

  const [startDate, setStartDate] = useState<string>('');
  const [monthsText, setMonthsText] = useState<string>('');
  const [discountPercentText, setDiscountPercentText] = useState<string>('');
  const [keterangan, setKeterangan] = useState<string>('');

  useEffect(() => {
    if (!open) {
      setSubscriberId('');
      setStartDate('');
      setMonthsText('');
      setDiscountPercentText('');
      setKeterangan('');
    }
  }, [open]);

  // Prefill values when editing and dialog opens
  // No edit prefill for TT yet

  const months = useMemo(() => {
    const digits = (monthsText || '').replace(/[^0-9]/g, '');
    if (!digits) return 0;
    return parseInt(digits, 10);
  }, [monthsText]);

  const dueDate = useMemo(() => {
    if (!startDate || !months || months <= 0) return '';
    const d = new Date(startDate);
    // next period start = startDate + months months
    const next = new Date(d);
    const day = next.getDate();
    next.setMonth(next.getMonth() + months);
    if (next.getDate() < day) {
      next.setDate(0);
    }
    // due date = next start - 1 day
    const due = new Date(next);
    due.setDate(due.getDate() - 1);
    return due.toISOString().slice(0,10);
  }, [startDate, months]);

  const gross = (pricePerMonth || 0) * (months || 0);
  const discountPercent = (() => {
    const digits = (discountPercentText || '').replace(/[^0-9]/g, '');
    if (!digits) return 0;
    const p = parseInt(digits, 10);
    return Math.max(0, Math.min(100, p));
  })();
  const discountRp = Math.floor(gross * discountPercent / 100);
  const net = Math.max(0, gross - discountRp);

  const handleSubmit = () => {
    if (!startDate || !months || months <= 0) return toast.error('Lengkapi form: jumlah bulan harus diisi (> 0)');
    if (!subscriberId) return toast.error('Pilih toko terlebih dahulu');
    createMut.mutate({ subscriberId, startDate, months, discount: discountRp, discountPercent, keterangan });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editItem ? 'Edit VPS' : 'Tambah VPS'}</DialogTitle>
        </DialogHeader>

        {!editItem ? (
          <div className="space-y-2">
            <Label>Toko</Label>
            <Combobox
              options={subs?.map(s => ({ value: s._id, label: `${s.toko} — ${currency(s.biaya)}`, extra: s })) || []}
              value={subscriberId}
              onChange={setSubscriberId}
              placeholder="Pilih Toko"
              renderOption={(opt, active) => (
                <span className={active ? 'font-semibold' : ''}>{opt.label}</span>
              )}
            />
          </div>
        ) : null}

        {selectedSub ? (
          <div className="space-y-2">
            <Label>Program</Label>
            <Input value={selectedSub.program} readOnly />
          </div>
        ) : null}

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <Label>Harga/Bln</Label>
            <Input value={currency(pricePerMonth)} readOnly />
          </div>
          <div className="space-y-1">
            <Label>Start Date</Label>
            <Input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label>Jumlah Bulan</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={monthsText}
              onChange={e => {
                const raw = e.target.value;
                const digits = raw.replace(/[^0-9]/g, '');
                // remove leading zeros except keep single zero if that's all
                const normalized = digits.replace(/^0+(?=\d)/, '');
                setMonthsText(normalized);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Tanggal Tempo</Label>
            <Input value={dueDate ? format(new Date(dueDate), 'dd MMM yyyy') : ''} readOnly />
          </div>
          <div className="space-y-1">
            <Label>Jumlah Harga</Label>
            <Input value={currency(gross)} readOnly />
          </div>
          <div className="space-y-1">
            <Label>Diskon (%)</Label>
            <Input
              type="text"
              inputMode="numeric"
              placeholder="0"
              value={discountPercentText}
              onChange={e => {
                const raw = e.target.value;
                const digits = raw.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');
                setDiscountPercentText(digits);
              }}
            />
          </div>
          <div className="space-y-1">
            <Label>Diskon (Rp)</Label>
            <Input value={currency(discountRp)} readOnly />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Total Harga</Label>
            <Input value={currency(net)} readOnly />
          </div>
          <div className="space-y-1 col-span-2">
            <Label>Keterangan</Label>
            <Input value={keterangan} onChange={e => setKeterangan((e.target.value || '').toUpperCase())} placeholder="Keterangan tambahan..." />
          </div>
        </div>

        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button
            onClick={handleSubmit}
            disabled={createMut.isPending || months <= 0}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            Tambah
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function TTVpsEditDialog({ open, onOpenChange, item, onSuccess }: { open: boolean; onOpenChange: (v: boolean) => void; item: (TTVpsDetailItemDTO & { __periode: string }) | null; onSuccess: () => void }) {
  const qc = useQueryClient();
  const [startDate, setStartDate] = useState<string>('');
  const [monthsText, setMonthsText] = useState<string>('');
  const [harga, setHarga] = useState<number>(0);
  const [diskonPercentText, setDiskonPercentText] = useState<string>('');
  const [keterangan, setKeterangan] = useState<string>('');

  useEffect(() => {
    if (open && item) {
      setStartDate(item.start);
      setMonthsText(String(item.bulan));
      setHarga(item.harga);
      const base = item.harga * item.bulan;
      const pct = base > 0 ? Math.round((item.diskon / base) * 100) : 0;
      setDiskonPercentText(String(pct));
      setKeterangan(((item as any).keterangan || '').toUpperCase());
    }
    if (!open) {
      setStartDate(''); setMonthsText(''); setHarga(0); setDiskonPercentText('');
      setKeterangan('');
    }
  }, [open, item]);

  const months = useMemo(() => {
    const digits = (monthsText || '').replace(/[^0-9]/g, '');
    if (!digits) return 0;
    return parseInt(digits, 10);
  }, [monthsText]);

  const tempo = useMemo(() => {
    if (!startDate || !months) return '';
    const s = new Date(startDate + 'T00:00:00.000Z');
    const next = new Date(s);
    const day = next.getUTCDate();
    next.setUTCMonth(next.getUTCMonth() + months);
    if (next.getUTCDate() < day) next.setUTCDate(0);
    const due = new Date(next);
    due.setUTCDate(due.getUTCDate() - 1);
    return due.toISOString().slice(0,10);
  }, [startDate, months]);

  const jumlah = (harga || 0) * (months || 0);
  const diskonPercent = (() => {
    const digits = (diskonPercentText || '').replace(/[^0-9]/g, '');
    if (!digits) return 0;
    const p = parseInt(digits, 10);
    return Math.max(0, Math.min(100, p));
  })();
  const diskonRp = Math.floor(jumlah * diskonPercent / 100);
  const total = Math.max(0, jumlah - diskonRp);

  const updateMut = useMutation({
    mutationFn: () => updateTTItem({ periode: item!.__periode, itemId: item!._id, start: startDate, bulan: months, harga, diskon: diskonRp, diskon_percent: diskonPercent, keterangan }),
    onSuccess: () => { toast.success('Data diupdate'); onSuccess(); },
    onError: (e: any) => toast.error(e?.response?.data?.message || 'Gagal update data'),
  });

  const handleSubmit = () => {
    if (!item) return;
    if (!startDate || !months || months <= 0) return toast.error('Lengkapi form (bulan > 0)');
    if (startDate.slice(0,7) !== item.__periode) return toast.error('Tanggal start harus tetap di periode yang sama');
    updateMut.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Data VPS</DialogTitle>
        </DialogHeader>
        {item ? (
          <div className="space-y-3">
            <div>
              <Label>Toko</Label>
              <div className="p-2 border rounded bg-slate-50">{item.toko}</div>
            </div>
            <div>
              <Label>Program</Label>
              <div className="p-2 border rounded bg-slate-50">{item.program}</div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Start Date</Label>
                <Input
                  type="date"
                  value={startDate}
                  onChange={e => setStartDate(e.target.value)}
                />
                {startDate && (
                  <div className="text-xs text-gray-500 mt-1">
                    Tanggal dipilih: {format(new Date(startDate), 'dd/MM/yyyy')}
                  </div>
                )}
              </div>
              <div>
                <Label>Jumlah Bulan</Label>
                <Input type="text" inputMode="numeric" value={monthsText} onChange={e => setMonthsText(e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, ''))} />
              </div>
              <div>
                <Label>Harga/Bln</Label>
                <CurrencyInput value={harga} onChange={setHarga} />
              </div>
              <div>
                <Label>Tempo</Label>
                <Input value={tempo ? format(new Date(tempo), 'dd MMM yyyy') : ''} readOnly />
              </div>
              <div>
                <Label>Jumlah Harga</Label>
                <Input value={currency(jumlah)} readOnly />
              </div>
              <div>
                <Label>Diskon (%)</Label>
                <Input type="text" inputMode="numeric" value={diskonPercentText} onChange={e => setDiskonPercentText(e.target.value.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, ''))} />
              </div>
              <div>
                <Label>Diskon (Rp)</Label>
                <Input value={currency(diskonRp)} readOnly />
              </div>
              <div className="col-span-2">
                <Label>Total Harga</Label>
                <Input value={currency(total)} readOnly />
              </div>
            </div>
            <div className="space-y-1 col-span-2">
              <Label>Keterangan</Label>
              <Input value={keterangan} onChange={e => setKeterangan((e.target.value || '').toUpperCase())} placeholder="Keterangan..." />
            </div>
          </div>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button variant="secondary" onClick={() => onOpenChange(false)}>Batal</Button>
          <Button onClick={handleSubmit} disabled={updateMut.isPending || !item || months <= 0} className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white">Simpan</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function CurrencyInput({ value, onChange }: { value: number; onChange: (n: number) => void }) {
  const [text, setText] = useState<string>(() => formatCurrencyInput(value));

  useEffect(() => {
    setText(formatCurrencyInput(value));
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    const num = parseCurrencyInput(raw);
    onChange(num);
    setText(formatCurrencyInput(num));
  };

  const handleFocus = () => {
    // Optionally remove 'Rp' on focus; keep formatted display for consistency
  };

  return (
    <Input value={text} onChange={handleChange} onFocus={handleFocus} inputMode="numeric" />
  );
}

import { useState } from 'react';

function VpsItemPreview({ item }: { item: any }) {
  const jumlah = (Number(item?.harga) || 0) * (Number(item?.bulan) || 0);
  const diskonPercent = Number(item?.diskon_percent) || 0;
  const diskonRp = Number(item?.diskon) || 0;
  const total = Number(item?.total_harga) || Math.max(0, jumlah - diskonRp);
  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
      <div>
        <div className="text-xs text-slate-500">Toko</div>
        <div className="text-sm font-medium">{item?.toko}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Program</div>
        <div className="text-sm font-medium">{item?.program}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Daerah</div>
        <div className="text-sm font-medium">{item?.daerah}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Start Date</div>
        <div className="text-sm font-medium">{item?.start ? format(new Date(item.start), 'dd MMM yyyy') : '-'}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Bulan</div>
        <div className="text-sm font-medium">{item?.bulan}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Tempo</div>
        <div className="text-sm font-medium">{item?.tempo ? format(new Date(item.tempo), 'dd MMM yyyy') : '-'}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Harga/Bln</div>
        <div className="text-sm font-medium">{currency(Number(item?.harga) || 0)}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Jumlah Harga</div>
        <div className="text-sm font-medium">{currency(jumlah)}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Diskon (%)</div>
        <div className="text-sm font-medium">{diskonPercent}%</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Diskon (Rp)</div>
        <div className="text-sm font-medium">{currency(diskonRp)}</div>
      </div>
      <div>
        <div className="text-xs text-slate-500">Total Harga</div>
        <div className="text-sm font-medium">{currency(total)}</div>
      </div>
    </div>
  );
}

function ConfirmAction({ title, description, actionText, onConfirm, children, showDate, preview }: { title: string; description: string; actionText: string; onConfirm: (date?: string) => void; children: React.ReactElement; showDate?: boolean; preview?: React.ReactNode }) {
  const [date, setDate] = useState<string>('');
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{children}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {preview ? (
          <div className="my-3 p-3 border rounded bg-slate-50">
            {preview}
          </div>
        ) : null}
        {showDate && (
          <div className="my-2">
            <Label htmlFor="tanggal-lunas">Tanggal Lunas</Label>
            <Input id="tanggal-lunas" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel>Batal</AlertDialogCancel>
          <AlertDialogAction onClick={() => onConfirm(showDate ? date : undefined)} disabled={!!showDate && !date}>{actionText}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
