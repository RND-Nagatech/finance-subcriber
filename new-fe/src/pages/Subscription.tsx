import { Fragment, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { CheckCircle2, CreditCard, ExternalLink, FileCheck, FileDown, Pencil, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toast } from 'react-toastify';

import axiosInstance from '@/api/axiosInstance';
import {
  createSubscription,
  deleteSubscriptionDetail,
  fetchSubscriptionDetails,
  fetchSubscriptionList,
  generateSubscriptionDokuPaymentLink,
  generateSubscriptionInvoice,
  lunasiSubscriptionDetail,
  SubscriptionDetail,
  updateSubscriptionDetailStatus,
  updateSubscriptionDetail,
} from '@/api/subscription';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

const currentYear = new Date().getFullYear();

interface SubscriberOption {
  _id: string;
  kode: string;
  toko: string;
  program: string;
  biaya: number;
  server_location?: string | null;
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function toDateInputValue(value?: string | null) {
  if (!value) return '';
  const ymd = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return ymd ? `${ymd[1]}-${ymd[2]}-${ymd[3]}` : '';
}

function formatDate(value?: string | null) {
  const ymd = toDateInputValue(value);
  if (!ymd) return '-';
  const [year, month, day] = ymd.split('-');
  return `${Number(day)}/${Number(month)}/${year}`;
}

function formatShortDate(value?: string | null) {
  const ymd = toDateInputValue(value);
  if (!ymd) return '-';
  const [year, month, day] = ymd.split('-');
  const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  return `${day} ${monthNames[Number(month) - 1] || month} ${year}`;
}

function parseNumberInput(value: string) {
  const digits = value.replace(/[^0-9]/g, '');
  return digits ? Number(digits) : 0;
}

function toMonthValue(value?: string | null) {
  const ymd = toDateInputValue(value);
  return ymd ? ymd.slice(0, 7) : '';
}

function currentMonthValue() {
  return new Date().toISOString().slice(0, 7);
}

function calculateTempoDate(startDate: string, months: number) {
  if (!startDate || !months) return '';
  const start = new Date(`${startDate}T00:00:00`);
  if (Number.isNaN(start.getTime())) return '';
  const next = new Date(start);
  const day = next.getDate();
  next.setMonth(next.getMonth() + months);
  if (next.getDate() < day) next.setDate(0);
  next.setDate(next.getDate() - 1);
  return next.toISOString().slice(0, 10);
}

function downloadInvoicePdf(detail: SubscriptionDetail) {
  const invoice = detail.invoice_meta;
  if (!invoice) {
    toast.info('Generate invoice terlebih dahulu sebelum download PDF.');
    return;
  }

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'pt', format: 'a4' });
  const margin = 40;
  const pageWidth = pdf.internal.pageSize.getWidth();

  pdf.setFontSize(18);
  pdf.setFont('helvetica', 'bold');
  pdf.text('INVOICE SUBSCRIPTION', margin, 48);
  pdf.setFontSize(10);
  pdf.setFont('helvetica', 'normal');
  pdf.text(`No: ${invoice.invoice_number}`, margin, 68);
  pdf.text(`Tanggal: ${invoice.display_date}`, margin, 84);

  pdf.setFont('helvetica', 'bold');
  pdf.text(invoice.sender.name, margin, 122);
  pdf.setFont('helvetica', 'normal');
  pdf.text(invoice.sender.address, margin, 138, { maxWidth: 230 });
  pdf.text(invoice.sender.phone, margin, 166);

  pdf.setFont('helvetica', 'bold');
  pdf.text('Ditagihkan Kepada', pageWidth - 230, 122);
  pdf.setFont('helvetica', 'normal');
  pdf.text(invoice.customer.name, pageWidth - 230, 138, { maxWidth: 190 });
  pdf.text(invoice.customer.address || '-', pageWidth - 230, 154, { maxWidth: 190 });
  pdf.text(invoice.customer.phone || '-', pageWidth - 230, 182);

  autoTable(pdf, {
    startY: 220,
    head: [['Program', 'Periode', 'Qty', 'Harga', 'Total']],
    body: invoice.items.map((item) => [
      item.program_name,
      `${formatDate(item.start_date)} - ${formatDate(item.tempo_date)}`,
      String(item.qty),
      formatCurrency(item.unit_price),
      formatCurrency(item.line_total),
    ]),
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 8 },
    headStyles: { fillColor: [37, 99, 235], textColor: 255 },
    columnStyles: {
      2: { halign: 'right' },
      3: { halign: 'right' },
      4: { halign: 'right' },
    },
  });

  const finalY = (pdf as any).lastAutoTable?.finalY || 300;
  const totalX = pageWidth - 220;
  pdf.setFontSize(10);
  pdf.text('Subtotal', totalX, finalY + 28);
  pdf.text(formatCurrency(invoice.subtotal), pageWidth - margin, finalY + 28, { align: 'right' });
  pdf.text('Diskon', totalX, finalY + 46);
  pdf.text(formatCurrency(invoice.discount_rp), pageWidth - margin, finalY + 46, { align: 'right' });
  pdf.setFont('helvetica', 'bold');
  pdf.text('Grand Total', totalX, finalY + 68);
  pdf.text(formatCurrency(invoice.grand_total), pageWidth - margin, finalY + 68, { align: 'right' });

  const safeInvoiceNumber = invoice.invoice_number.replace(/[^a-zA-Z0-9-_]/g, '_');
  pdf.save(`invoice-subscription-${safeInvoiceNumber}.pdf`);
}

export default function Subscription() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [tahun, setTahun] = useState(currentYear);
  const [status, setStatus] = useState('OPEN');
  const [periodFrom, setPeriodFrom] = useState(currentMonthValue());
  const [periodTo, setPeriodTo] = useState(currentMonthValue());
  const [tokoFilter, setTokoFilter] = useState('ALL');
  const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});
  const [selectedInvoiceItems, setSelectedInvoiceItems] = useState<Record<string, SubscriptionDetail>>({});
  const [selectedDetail, setSelectedDetail] = useState<SubscriptionDetail | null>(null);
  const [editingDetail, setEditingDetail] = useState<SubscriptionDetail | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    subscriber_id: '',
    tgl_mulai_tagihan: toDateInputValue(new Date().toISOString()),
    jumlah_bulan: 1,
    biaya_per_bulan: 0,
    diskon_percent: 0,
    diskon: 0,
    keterangan: '',
  });
  const [tglLunas, setTglLunas] = useState(toDateInputValue(new Date().toISOString()));
  const [diskonText, setDiskonText] = useState('');
  const [metodeBayar, setMetodeBayar] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [editForm, setEditForm] = useState({
    tgl_mulai_tagihan: '',
    jumlah_bulan: 1,
    biaya_per_bulan: 0,
    diskon_percent: 0,
    diskon: 0,
    keterangan: '',
  });

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(search), 500);
    return () => window.clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, limit]);

  const { data: listResponse, isLoading: loadingList } = useQuery({
    queryKey: ['subscription', page, limit, debouncedSearch, tahun],
    queryFn: () => fetchSubscriptionList({ page, limit, search: debouncedSearch, tahun }),
  });

  const { data: details = [], isLoading: loadingDetails } = useQuery({
    queryKey: ['subscription-detail', tahun],
    queryFn: () => fetchSubscriptionDetails({ tahun }),
  });

  const { data: subscriberOptions = [], isLoading: loadingSubscribers } = useQuery<SubscriberOption[]>({
    queryKey: ['subscriber-options-for-subscription'],
    queryFn: async () => {
      const response = await axiosInstance.get('/subscriber?page=1&limit=1000');
      return response.data?.data || [];
    },
  });

  const subscriptions = listResponse?.data || [];
  const pagination = listResponse?.pagination || { page, limit, total: 0, totalPages: 1 };
  const diskon = parseNumberInput(diskonText);
  const totalSetelahDiskon = Math.max(0, (selectedDetail?.jumlah_biaya || 0) - diskon);
  const tokoOptions = useMemo(() => {
    return ['ALL', ...Array.from(new Set(details.map((item) => item.toko).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'id-ID'))];
  }, [details]);

  const filteredDetails = useMemo(() => {
    const q = debouncedSearch.trim().toLowerCase();
    return details
      .filter((item) => status === 'ALL' ? true : item.status === status)
      .filter((item) => tokoFilter === 'ALL' ? true : item.toko === tokoFilter)
      .filter((item) => {
        const month = toMonthValue(item.tgl_mulai_tagihan);
        if (periodFrom && month < periodFrom) return false;
        if (periodTo && month > periodTo) return false;
        return true;
      })
      .filter((item) => {
        if (!q) return true;
        return `${item.toko} ${item.program} ${item.kode_subscriber} ${item.periode}`.toLowerCase().includes(q);
      })
      .sort((a, b) => {
        const da = new Date(a.tgl_mulai_tagihan || 0).getTime();
        const db = new Date(b.tgl_mulai_tagihan || 0).getTime();
        if (da !== db) return da - db;
        return String(a.toko || '').localeCompare(String(b.toko || ''), 'id-ID');
      });
  }, [debouncedSearch, details, periodFrom, periodTo, status, tokoFilter]);

  const getDisplayStatus = (item: SubscriptionDetail) => String(item.status) === 'LUNAS' ? 'DONE' : item.status;
  const itemKey = (item: SubscriptionDetail) => `${item.periode}-${item._id}`;
  const isSelectableForBulk = (item: SubscriptionDetail) => getDisplayStatus(item) === 'OPEN';
  const isSelected = (item: SubscriptionDetail) => !!selectedInvoiceItems[itemKey(item)];
  const visibleSelectableItems = useMemo(() => filteredDetails.filter(isSelectableForBulk), [filteredDetails]);
  const allVisibleSelected = visibleSelectableItems.length > 0 && visibleSelectableItems.every((item) => !!selectedInvoiceItems[itemKey(item)]);
  const selectedCount = Object.keys(selectedInvoiceItems).length;
  const selectedVisibleItems = useMemo(
    () => filteredDetails.filter((item) => !!selectedInvoiceItems[itemKey(item)]),
    [filteredDetails, selectedInvoiceItems]
  );

  const toggleSelected = (item: SubscriptionDetail) => {
    if (!isSelectableForBulk(item)) return;
    const key = itemKey(item);
    setSelectedInvoiceItems((prev) => {
      const next = { ...prev };
      if (next[key]) delete next[key];
      else next[key] = item;
      return next;
    });
  };

  const toggleSelectedAllVisible = () => {
    setSelectedInvoiceItems((prev) => {
      const next = { ...prev };
      if (allVisibleSelected) {
        visibleSelectableItems.forEach((item) => delete next[itemKey(item)]);
      } else {
        visibleSelectableItems.forEach((item) => {
          next[itemKey(item)] = item;
        });
      }
      return next;
    });
  };

  useEffect(() => {
    const visibleKeys = new Set(filteredDetails.map(itemKey));
    setSelectedInvoiceItems((prev) => {
      const next: Record<string, SubscriptionDetail> = {};
      for (const [key, value] of Object.entries(prev)) {
        if (visibleKeys.has(key)) next[key] = value;
      }
      return next;
    });
  }, [filteredDetails]);

  const detailSummary = useMemo(() => {
    const total = filteredDetails.reduce((sum, item) => sum + Number(item.total_biaya || 0), 0);
    const uniqueToko = new Set(filteredDetails.map((item) => item.toko)).size;
    return { total, uniqueToko, count: filteredDetails.length };
  }, [filteredDetails]);
  const subscriptionSummary = useMemo(() => {
    const monthlyRows = listResponse?.data || [];
    const estimasi = monthlyRows.reduce((sum, item) => sum + Number(item.estimasi || 0), 0);
    const realisasi = monthlyRows.reduce((sum, item) => sum + Number(item.realisasi || 0), 0);
    const totalDetail = monthlyRows.reduce((sum, item) => sum + Number(item.total_subscriber_estimasi || 0), 0);
    const totalDetailLunas = monthlyRows.reduce((sum, item) => sum + Number(item.total_subscriber_realisasi || 0), 0);
    const totalSubscriber = new Set(details.map((item) => item.subscriber_id).filter(Boolean)).size;
    return { estimasi, realisasi, totalDetail, totalDetailLunas, totalSubscriber };
  }, [details, listResponse?.data]);

  const tahunOptions = useMemo(() => {
    return Array.from({ length: 5 }, (_, idx) => currentYear - 2 + idx);
  }, []);

  const selectedSubscriber = useMemo(() => {
    return subscriberOptions.find((item) => item._id === createForm.subscriber_id);
  }, [createForm.subscriber_id, subscriberOptions]);

  const resetCreateForm = () => {
    setCreateForm({
      subscriber_id: '',
      tgl_mulai_tagihan: toDateInputValue(new Date().toISOString()),
      jumlah_bulan: 1,
      biaya_per_bulan: 0,
      diskon_percent: 0,
      diskon: 0,
      keterangan: '',
    });
  };

  const createGross = createForm.biaya_per_bulan * createForm.jumlah_bulan;
  const createDiscount = Math.max(0, Math.min(
    createGross,
    createForm.diskon_percent > 0 ? Math.floor(createGross * createForm.diskon_percent / 100) : createForm.diskon
  ));
  const createNet = Math.max(0, createGross - createDiscount);
  const createTempoDate = calculateTempoDate(createForm.tgl_mulai_tagihan, createForm.jumlah_bulan);
  const editGross = editForm.biaya_per_bulan * editForm.jumlah_bulan;
  const editDiscount = Math.max(0, Math.min(
    editGross,
    editForm.diskon_percent > 0 ? Math.floor(editGross * editForm.diskon_percent / 100) : editForm.diskon
  ));
  const editNet = Math.max(0, editGross - editDiscount);
  const editTempoDate = calculateTempoDate(editForm.tgl_mulai_tagihan, editForm.jumlah_bulan);

  const lunasiMutation = useMutation({
    mutationFn: () => {
      if (!selectedDetail) throw new Error('Detail subscription belum dipilih.');
      return lunasiSubscriptionDetail({
        id: selectedDetail._id,
        tgl_lunas: tglLunas,
        diskon,
        metode_bayar: metodeBayar || undefined,
        keterangan: keterangan || undefined,
      });
    },
    onSuccess: (response: any) => {
      toast.success(response?.message || 'Subscription berhasil dilunasi.');
      setSelectedDetail(null);
      setDiskonText('');
      setMetodeBayar('');
      setKeterangan('');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-detail'] });
      queryClient.invalidateQueries({ queryKey: ['subscriber'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Gagal melunasi subscription.');
    },
  });

  const invoiceMutation = useMutation({
    mutationFn: (id: string) => generateSubscriptionInvoice(id),
    onSuccess: (response: any) => {
      toast.success(response?.message || 'Invoice subscription berhasil dibuat.');
      queryClient.invalidateQueries({ queryKey: ['subscription-detail'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Gagal membuat invoice subscription.');
    },
  });

  const dokuMutation = useMutation({
    mutationFn: (id: string) => generateSubscriptionDokuPaymentLink(id),
    onSuccess: (response: any) => {
      const paymentUrl = response?.payment?.payment_url;
      toast.success(response?.message || 'Payment link DOKU berhasil dibuat.');
      if (paymentUrl) window.open(paymentUrl, '_blank', 'noopener,noreferrer');
      queryClient.invalidateQueries({ queryKey: ['subscription-detail'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Gagal membuat payment link DOKU.');
    },
  });

  const createMutation = useMutation({
    mutationFn: () => {
      if (!createForm.subscriber_id) throw new Error('Subscriber wajib dipilih.');
      if (!createForm.tgl_mulai_tagihan) throw new Error('Tgl mulai tagihan wajib diisi.');
      return createSubscription({
        subscriber_id: createForm.subscriber_id,
        tgl_mulai_tagihan: createForm.tgl_mulai_tagihan,
        jumlah_bulan: createForm.jumlah_bulan,
        biaya_per_bulan: createForm.biaya_per_bulan,
        diskon: createDiscount,
        keterangan: createForm.keterangan || undefined,
      });
    },
    onSuccess: (response: any) => {
      toast.success(response?.message || 'Subscription berhasil dibuat.');
      setCreateDialogOpen(false);
      resetCreateForm();
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-detail'] });
      queryClient.invalidateQueries({ queryKey: ['subscriber'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Gagal membuat subscription.');
    },
  });

  const editMutation = useMutation({
    mutationFn: () => {
      if (!editingDetail) throw new Error('Detail subscription belum dipilih.');
      if (!editForm.tgl_mulai_tagihan) throw new Error('Start date wajib diisi.');
      if (!editForm.jumlah_bulan || editForm.jumlah_bulan <= 0) throw new Error('Jumlah bulan wajib lebih dari 0.');
      return updateSubscriptionDetail({
        id: editingDetail._id,
        tgl_mulai_tagihan: editForm.tgl_mulai_tagihan,
        jumlah_bulan: editForm.jumlah_bulan,
        biaya_per_bulan: editForm.biaya_per_bulan,
        diskon: editDiscount,
        keterangan: editForm.keterangan || undefined,
      });
    },
    onSuccess: (response: any) => {
      toast.success(response?.message || 'Detail subscription berhasil diupdate.');
      setEditingDetail(null);
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-detail'] });
      queryClient.invalidateQueries({ queryKey: ['subscriber'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || 'Gagal update detail subscription.');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteSubscriptionDetail(id),
    onSuccess: (response: any) => {
      toast.success(response?.message || 'Detail subscription berhasil dihapus.');
      queryClient.invalidateQueries({ queryKey: ['subscription'] });
      queryClient.invalidateQueries({ queryKey: ['subscription-detail'] });
      queryClient.invalidateQueries({ queryKey: ['subscriber'] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || 'Gagal hapus detail subscription.');
    },
  });

  const openLunasDialog = (detail: SubscriptionDetail) => {
    setSelectedDetail(detail);
    setTglLunas('');
    setDiskonText(detail.diskon ? String(detail.diskon) : '');
    setMetodeBayar(detail.metode_bayar || '');
    setKeterangan(detail.keterangan || '');
  };

  const openEditDialog = (detail: SubscriptionDetail) => {
    const gross = Number(detail.biaya_per_bulan || 0) * Number(detail.jumlah_bulan || 1);
    const percent = gross > 0 ? Math.round((Number(detail.diskon || 0) / gross) * 100) : 0;
    setEditingDetail(detail);
    setEditForm({
      tgl_mulai_tagihan: toDateInputValue(detail.tgl_mulai_tagihan),
      jumlah_bulan: Number(detail.jumlah_bulan || 1),
      biaya_per_bulan: Number(detail.biaya_per_bulan || 0),
      diskon_percent: percent,
      diskon: 0,
      keterangan: detail.keterangan || '',
    });
  };

  const confirmDeleteDetail = (detail: SubscriptionDetail) => {
    if (detail.status !== 'OPEN') {
      toast.info('Hapus tersedia hanya untuk status OPEN.');
      return;
    }
    const ok = window.confirm(`Hapus subscription ${detail.toko} periode ${detail.periode}? Rekap estimasi sampai akhir fiscal year akan ikut dikurangi.`);
    if (ok) deleteMutation.mutate(detail._id);
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
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-4xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
              Subscription
            </h1>
            <p className="text-gray-600 mt-2">Kelola tagihan subscription per satu periode aktif</p>
          </div>
          <Button
            onClick={() => setCreateDialogOpen(true)}
            className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-3 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
          >
            <Plus className="mr-2 h-5 w-5" />
            Tambah Data
          </Button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="rounded-lg border-2 border-dashed border-blue-200 bg-white/70 p-4">
            <p className="text-sm font-semibold text-gray-600">Subscriber</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{subscriptionSummary.totalSubscriber}</p>
          </div>
          <div className="rounded-lg border-2 border-dashed border-blue-200 bg-white/70 p-4">
            <p className="text-sm font-semibold text-gray-600">Estimasi Tahun Ini</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(subscriptionSummary.estimasi)}</p>
          </div>
          <div className="rounded-lg border-2 border-dashed border-blue-200 bg-white/70 p-4">
            <p className="text-sm font-semibold text-gray-600">Sudah Lunas</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{formatCurrency(subscriptionSummary.realisasi)}</p>
          </div>
          <div className="rounded-lg border-2 border-dashed border-blue-200 bg-white/70 p-4">
            <p className="text-sm font-semibold text-gray-600">Detail Lunas</p>
            <p className="mt-2 text-2xl font-bold text-gray-900">{subscriptionSummary.totalDetailLunas}/{subscriptionSummary.totalDetail}</p>
          </div>
        </div>

        <div className="bg-white/70 rounded-lg border-2 border-dashed border-blue-200 p-4">
          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 items-end">
            <div>
              <Label className="text-sm font-semibold text-gray-700">Toko</Label>
              <Select value={tokoFilter} onValueChange={setTokoFilter}>
                <SelectTrigger className="w-full border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                  <SelectValue placeholder="Toko" />
                </SelectTrigger>
                <SelectContent>
                  {tokoOptions.map((name) => (
                    <SelectItem key={name} value={name}>{name === 'ALL' ? 'ALL' : name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-gray-700">Tahun</Label>
              <Select value={String(tahun)} onValueChange={(value) => setTahun(Number(value))}>
                <SelectTrigger className="w-full border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                  <SelectValue placeholder="Tahun" />
                </SelectTrigger>
                <SelectContent>
                  {tahunOptions.map((item) => (
                    <SelectItem key={item} value={String(item)}>{item}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="period-from" className="text-sm font-semibold text-gray-700">Periode Dari</Label>
              <Input
                id="period-from"
                type="month"
                value={periodFrom}
                onChange={(event) => setPeriodFrom(event.target.value)}
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div>
              <Label htmlFor="period-to" className="text-sm font-semibold text-gray-700">Periode Sampai</Label>
              <Input
                id="period-to"
                type="month"
                value={periodTo}
                onChange={(event) => setPeriodTo(event.target.value)}
                className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
              />
            </div>
            <div className="grid gap-2">
              <Label className="text-sm font-semibold text-gray-700">Status</Label>
              <Select value={status} onValueChange={setStatus}>
                <SelectTrigger className="w-full border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OPEN">OPEN</SelectItem>
                  <SelectItem value="PROCESS">PROCESS</SelectItem>
                  <SelectItem value="LUNAS">LUNAS</SelectItem>
                  <SelectItem value="BATAL">BATAL</SelectItem>
                  <SelectItem value="ALL">Semua</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="search-subscription" className="text-sm font-semibold text-gray-700">Search Data</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <Input
                  id="search-subscription"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Toko, program, kode..."
                  className="w-full pl-9 pr-9 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700"
                    aria-label="Hapus pencarian"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
            <div className="grid gap-2 hidden">
              <Label className="text-sm font-semibold text-gray-700">Per Halaman</Label>
              <Select value={String(limit)} onValueChange={(value) => setLimit(Number(value))}>
                <SelectTrigger className="w-32 border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                  <SelectValue placeholder="Limit" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="10">10</SelectItem>
                  <SelectItem value="25">25</SelectItem>
                  <SelectItem value="50">50</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <div className="px-4 py-3 border-b border-blue-200/50 bg-gradient-to-r from-blue-50/60 to-indigo-50/60">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-900">Daftar Subscription Detail</h2>
              <div className="flex flex-wrap items-center gap-4 text-sm text-gray-700">
                <span className="font-semibold">Total: {formatCurrency(detailSummary.total)}</span>
                <span>Subscriber: <span className="font-semibold">{detailSummary.uniqueToko}</span></span>
                <span>Data: <span className="font-semibold">{detailSummary.count}</span></span>
              </div>
            </div>
          </div>
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="w-12 px-4 py-4 font-semibold text-gray-900" />
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Toko</TableHead>
                <TableHead className="w-32 px-6 py-4 font-semibold text-gray-900">Start Date</TableHead>
                <TableHead className="w-24 px-6 py-4 font-semibold text-gray-900">Bulan</TableHead>
                <TableHead className="w-32 px-6 py-4 font-semibold text-gray-900">Tempo</TableHead>
                <TableHead className="w-36 px-6 py-4 font-semibold text-gray-900">Harga/Bln</TableHead>
                <TableHead className="w-36 px-6 py-4 font-semibold text-gray-900">Total</TableHead>
                <TableHead className="w-28 px-6 py-4 font-semibold text-gray-900">Status</TableHead>
                <TableHead className="w-64 px-6 py-4 text-right font-semibold text-gray-900">Aksi</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingDetails ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12">
                    <div className="flex flex-col items-center space-y-3">
                      <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                      <p className="text-gray-600 font-medium">Memuat detail subscription...</p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : filteredDetails.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-12 text-gray-600">
                    Belum ada detail subscription untuk filter ini.
                  </TableCell>
                </TableRow>
              ) : (
                filteredDetails.map((item) => (
                  <Fragment key={item._id}>
                    <TableRow className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                      <TableCell className="w-12 px-4 py-4">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setExpandedRows((prev) => ({ ...prev, [item._id]: !prev[item._id] }))}
                          aria-label="Expand detail"
                        >
                          {expandedRows[item._id] ? '▾' : '▸'}
                        </Button>
                      </TableCell>
                      <TableCell className="w-40 px-6 py-4 font-medium text-gray-900">{item.toko}</TableCell>
                      <TableCell className="w-32 px-6 py-4 text-gray-700">{formatDate(item.tgl_mulai_tagihan)}</TableCell>
                      <TableCell className="w-24 px-6 py-4 text-gray-700">{item.jumlah_bulan}</TableCell>
                      <TableCell className="w-32 px-6 py-4 text-gray-700">{formatDate(item.tgl_berakhir_langganan)}</TableCell>
                      <TableCell className="w-36 px-6 py-4 font-semibold text-gray-900">{formatCurrency(item.biaya_per_bulan)}</TableCell>
                      <TableCell className="w-36 px-6 py-4 font-semibold text-gray-900">{formatCurrency(item.total_biaya)}</TableCell>
                      <TableCell className="w-28 px-6 py-4">
                        <span className={
                          item.status === 'LUNAS'
                            ? 'rounded-full bg-green-100 px-2 py-1 text-xs font-semibold text-green-800'
                            : item.status === 'PROCESS'
                              ? 'rounded-full bg-yellow-100 px-2 py-1 text-xs font-semibold text-yellow-800'
                              : 'rounded-full bg-gray-200 px-2 py-1 text-xs font-semibold text-gray-800'
                        }>
                          {item.status}
                        </span>
                      </TableCell>
                      <TableCell className="w-64 px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => invoiceMutation.mutate(item._id)}
                          disabled={item.status === 'LUNAS' || item.status === 'BATAL' || invoiceMutation.isPending}
                          className="border-blue-300 hover:bg-blue-50 hover:border-blue-400 text-blue-700 hover:text-blue-800 transition-all duration-200"
                          title="Generate Invoice"
                        >
                          <FileCheck className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => downloadInvoicePdf(item)}
                          disabled={!item.invoice_meta}
                          className="border-slate-300 hover:bg-slate-50 hover:border-slate-400 text-slate-700 hover:text-slate-900 transition-all duration-200"
                          title="Download PDF Invoice"
                        >
                          <FileDown className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => dokuMutation.mutate(item._id)}
                          disabled={item.status === 'LUNAS' || item.status === 'BATAL' || dokuMutation.isPending}
                          className="border-indigo-300 hover:bg-indigo-50 hover:border-indigo-400 text-indigo-700 hover:text-indigo-800 transition-all duration-200"
                          title="Buka Payment Link DOKU"
                        >
                          <ExternalLink className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openLunasDialog(item)}
                          disabled={item.status === 'LUNAS' || item.status === 'BATAL'}
                          className="border-emerald-300 hover:bg-emerald-50 hover:border-emerald-400 text-emerald-700 hover:text-emerald-800 transition-all duration-200"
                          title="Lunasi"
                        >
                          <CheckCircle2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => openEditDialog(item)}
                          disabled={item.status !== 'OPEN' || editMutation.isPending}
                          title={item.status !== 'OPEN' ? 'Edit tersedia hanya untuk status OPEN' : 'Edit'}
                        >
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => confirmDeleteDetail(item)}
                          disabled={item.status !== 'OPEN' || deleteMutation.isPending}
                          title={item.status !== 'OPEN' ? 'Hapus tersedia hanya untuk status OPEN' : 'Hapus'}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                    {expandedRows[item._id] && (
                      <TableRow key={`${item._id}-expanded`} className="bg-slate-50">
                        <TableCell colSpan={9} className="px-6 py-4">
                          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
                            <div>
                              <div className="text-xs text-slate-500">Kode Subscriber</div>
                              <div className="font-medium">{item.kode_subscriber}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Program</div>
                              <div className="font-medium">{item.program}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Periode</div>
                              <div className="font-medium">{item.periode}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Jumlah Biaya</div>
                              <div className="font-medium">{formatCurrency(item.jumlah_biaya)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Diskon</div>
                              <div className="font-medium">{formatCurrency(item.diskon)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Bayar Selanjutnya</div>
                              <div className="font-medium">{formatDate(item.tgl_bayar_selanjutnya)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Tgl Lunas</div>
                              <div className="font-medium">{formatDate(item.tgl_lunas)}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Metode Bayar</div>
                              <div className="font-medium">{item.metode_bayar || '-'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">Invoice</div>
                              <div className="font-medium">{item.invoice_meta?.invoice_number || '-'}</div>
                            </div>
                            <div>
                              <div className="text-xs text-slate-500">DOKU</div>
                              <div className="font-medium">{item.doku_payment?.status || '-'}</div>
                            </div>
                            <div className="md:col-span-2">
                              <div className="text-xs text-slate-500">Keterangan</div>
                              <div className="font-medium">{item.keterangan || '-'}</div>
                            </div>
                          </div>
                        </TableCell>
                      </TableRow>
                    )}
                  </Fragment>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <div className="bg-white/50 rounded-lg overflow-hidden border-2 border-dashed border-blue-200">
          <div className="px-4 py-3 border-b border-blue-200/50 bg-gradient-to-r from-blue-50/60 to-indigo-50/60">
            <h2 className="font-semibold text-gray-900">Rekap Subscription Bulanan</h2>
          </div>
          <Table className="table-fixed w-full">
            <TableHeader>
              <TableRow className="bg-gradient-to-r from-blue-50 to-indigo-50 hover:from-blue-50 hover:to-indigo-50 border-b border-blue-200/50">
                <TableHead className="w-32 px-6 py-4 font-semibold text-gray-900">Periode</TableHead>
                <TableHead className="w-28 px-6 py-4 font-semibold text-gray-900">Tahun</TableHead>
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Estimasi</TableHead>
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Realisasi</TableHead>
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Subscriber Est.</TableHead>
                <TableHead className="w-40 px-6 py-4 font-semibold text-gray-900">Subscriber Real.</TableHead>
                <TableHead className="w-36 px-6 py-4 font-semibold text-gray-900">Update</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loadingList ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-gray-600">Memuat subscription...</TableCell>
                </TableRow>
              ) : subscriptions.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-gray-600">Belum ada subscription.</TableCell>
                </TableRow>
              ) : (
                subscriptions.map((item) => (
                  <TableRow key={item._id} className="hover:bg-blue-50/50 transition-colors duration-200 border-b border-gray-100/50">
                    <TableCell className="w-32 px-6 py-4 font-semibold text-gray-900">{item.periode}</TableCell>
                    <TableCell className="w-28 px-6 py-4 text-gray-700">{item.tahun}</TableCell>
                    <TableCell className="w-40 px-6 py-4 font-semibold text-gray-900">{formatCurrency(item.estimasi)}</TableCell>
                    <TableCell className="w-40 px-6 py-4 font-semibold text-emerald-700">{formatCurrency(item.realisasi)}</TableCell>
                    <TableCell className="w-40 px-6 py-4 text-gray-700">{item.total_subscriber_estimasi}</TableCell>
                    <TableCell className="w-40 px-6 py-4 text-gray-700">{item.total_subscriber_realisasi}</TableCell>
                    <TableCell className="w-36 px-6 py-4 text-gray-700">{formatDate(item.updated_at)}</TableCell>
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

        <Dialog open={!!selectedDetail} onOpenChange={(open) => !open && setSelectedDetail(null)}>
          <DialogContent className="sm:max-w-[780px] bg-white/95 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="text-3xl font-bold text-slate-950">
                Selesaikan Subscription?
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-7">
              <p className="text-xl text-slate-500">Status akan diubah menjadi LUNAS. Pilih tanggal lunas:</p>

              <div className="rounded-md border border-slate-200 bg-white p-5">
                <div className="grid grid-cols-2 gap-x-5 gap-y-4 text-[15px] sm:grid-cols-5">
                  <div>
                    <div className="text-slate-500">Toko</div>
                    <div className="mt-1 break-words text-lg font-semibold text-slate-950">{selectedDetail?.toko || '-'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Program</div>
                    <div className="mt-1 break-words text-lg font-semibold text-slate-950">{selectedDetail?.program || '-'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Periode</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{selectedDetail?.periode || '-'}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Start Date</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{formatShortDate(selectedDetail?.tgl_mulai_tagihan)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Bulan</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{selectedDetail?.jumlah_bulan || 0}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Tempo</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{formatShortDate(selectedDetail?.tgl_berakhir_langganan)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Harga/Bln</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(selectedDetail?.biaya_per_bulan || 0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Jumlah Harga</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(selectedDetail?.jumlah_biaya || 0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Diskon (%)</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">
                      {selectedDetail?.jumlah_biaya ? Math.round((Number(selectedDetail?.diskon || 0) / Number(selectedDetail.jumlah_biaya || 1)) * 100) : 0}%
                    </div>
                  </div>
                  <div>
                    <div className="text-slate-500">Diskon (Rp)</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(selectedDetail?.diskon || 0)}</div>
                  </div>
                  <div>
                    <div className="text-slate-500">Total Harga</div>
                    <div className="mt-1 text-lg font-semibold text-slate-950">{formatCurrency(selectedDetail?.total_biaya || 0)}</div>
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="tgl-lunas" className="text-xl font-semibold text-slate-950">Tanggal Lunas</Label>
                <Input
                  id="tgl-lunas"
                  type="date"
                  value={tglLunas}
                  onChange={(event) => setTglLunas(event.target.value)}
                  className="h-16 border-2 border-gray-200 text-xl focus:border-emerald-400 focus:ring-2 focus:ring-emerald-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-1">
                <Button type="button" variant="outline" onClick={() => setSelectedDetail(null)} className="h-16 px-8 text-xl">
                  Batal
                </Button>
                <Button
                  type="button"
                  onClick={() => lunasiMutation.mutate()}
                  disabled={lunasiMutation.isPending || !tglLunas}
                  className="h-16 bg-emerald-400 px-8 text-xl font-semibold text-white hover:bg-emerald-500 disabled:bg-emerald-300"
                >
                  {lunasiMutation.isPending ? 'Menyimpan...' : 'Ya, Selesaikan'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        <Dialog open={!!editingDetail} onOpenChange={(open) => !open && setEditingDetail(null)}>
          <DialogContent className="sm:max-w-[640px] bg-white/95 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Edit Data Subscription
              </DialogTitle>
            </DialogHeader>
            {editingDetail && (
              <div className="space-y-4">
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-sm text-gray-700">
                  <div className="font-semibold text-gray-900">{editingDetail.toko}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>{editingDetail.kode_subscriber}</span>
                    <span>{editingDetail.program}</span>
                    <span>Status: {editingDetail.status}</span>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label htmlFor="edit-biaya" className="text-sm font-semibold text-gray-700">Harga/Bln</Label>
                    <Input
                      id="edit-biaya"
                      inputMode="numeric"
                      value={formatCurrency(editForm.biaya_per_bulan)}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, biaya_per_bulan: parseNumberInput(event.target.value), diskon: 0, diskon_percent: 0 }))}
                      placeholder="0"
                      className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-tgl-mulai" className="text-sm font-semibold text-gray-700">Start Date</Label>
                    <Input
                      id="edit-tgl-mulai"
                      type="date"
                      value={editForm.tgl_mulai_tagihan}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, tgl_mulai_tagihan: event.target.value }))}
                      className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-jumlah-bulan" className="text-sm font-semibold text-gray-700">Jumlah Bulan</Label>
                    <Input
                      id="edit-jumlah-bulan"
                      type="number"
                      min={1}
                      value={editForm.jumlah_bulan}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, jumlah_bulan: Math.max(1, Number(event.target.value || 1)) }))}
                      className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-tempo" className="text-sm font-semibold text-gray-700">Tanggal Tempo</Label>
                    <Input
                      id="edit-tempo"
                      value={formatDate(editTempoDate)}
                      readOnly
                      className="border-2 border-gray-200 bg-gray-50"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-gross" className="text-sm font-semibold text-gray-700">Jumlah Harga</Label>
                    <Input
                      id="edit-gross"
                      value={formatCurrency(editGross)}
                      readOnly
                      className="border-2 border-gray-200 bg-gray-50"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-diskon-percent" className="text-sm font-semibold text-gray-700">Diskon (%)</Label>
                    <Input
                      id="edit-diskon-percent"
                      inputMode="numeric"
                      value={editForm.diskon_percent ? String(editForm.diskon_percent) : ''}
                      onChange={(event) => {
                        const percent = Math.max(0, Math.min(100, parseNumberInput(event.target.value)));
                        setEditForm((prev) => ({ ...prev, diskon_percent: percent, diskon: 0 }));
                      }}
                      placeholder="0"
                      className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-diskon" className="text-sm font-semibold text-gray-700">Diskon (Rp)</Label>
                    <Input
                      id="edit-diskon"
                      inputMode="numeric"
                      value={editForm.diskon ? String(editForm.diskon) : ''}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, diskon: parseNumberInput(event.target.value), diskon_percent: 0 }))}
                      placeholder="0"
                      className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="edit-net" className="text-sm font-semibold text-gray-700">Total Harga</Label>
                    <Input
                      id="edit-net"
                      value={formatCurrency(editNet)}
                      readOnly
                      className="border-2 border-gray-200 bg-gray-50 font-semibold"
                    />
                  </div>
                  <div className="grid gap-2 md:col-span-2">
                    <Label htmlFor="edit-keterangan" className="text-sm font-semibold text-gray-700">Keterangan</Label>
                    <Input
                      id="edit-keterangan"
                      value={editForm.keterangan}
                      onChange={(event) => setEditForm((prev) => ({ ...prev, keterangan: event.target.value }))}
                      placeholder="Keterangan"
                      className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <Button type="button" variant="outline" onClick={() => setEditingDetail(null)}>Batal</Button>
                  <Button
                    type="button"
                    onClick={() => editMutation.mutate()}
                    disabled={editMutation.isPending || !editForm.tgl_mulai_tagihan}
                    className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                  >
                    {editMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={createDialogOpen} onOpenChange={(open) => {
          setCreateDialogOpen(open);
          if (!open) resetCreateForm();
        }}>
          <DialogContent className="sm:max-w-[640px] bg-white/95 backdrop-blur-sm">
            <DialogHeader>
              <DialogTitle className="text-2xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 bg-clip-text text-transparent">
                Tambah Subscription
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid gap-2">
                <Label className="text-sm font-semibold text-gray-700">Subscriber</Label>
                <Select
                  value={createForm.subscriber_id || 'none'}
                  onValueChange={(value) => {
                    if (value === 'none') {
                      setCreateForm((prev) => ({ ...prev, subscriber_id: '', biaya_per_bulan: 0, diskon: 0, diskon_percent: 0 }));
                      return;
                    }
                    const subscriber = subscriberOptions.find((item) => item._id === value);
                    setCreateForm((prev) => ({
                      ...prev,
                      subscriber_id: value,
                      biaya_per_bulan: Number(subscriber?.biaya || 0),
                      diskon: 0,
                      diskon_percent: 0,
                    }));
                  }}
                >
                  <SelectTrigger className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100">
                    <SelectValue placeholder={loadingSubscribers ? 'Memuat subscriber...' : 'Pilih subscriber'} />
                  </SelectTrigger>
                  <SelectContent className="max-h-[320px] bg-white/95">
                    <SelectItem value="none">Pilih subscriber</SelectItem>
                    {subscriberOptions.map((item) => (
                      <SelectItem key={item._id} value={item._id}>
                        {item.kode} - {item.toko}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedSubscriber && (
                <div className="rounded-lg border border-blue-200 bg-blue-50/60 p-3 text-sm text-gray-700">
                  <div className="font-semibold text-gray-900">{selectedSubscriber.program}</div>
                  <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
                    <span>Biaya: {formatCurrency(selectedSubscriber.biaya)}</span>
                    <span>Server: {selectedSubscriber.server_location || '-'}</span>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div className="grid gap-2">
                  <Label htmlFor="create-biaya" className="text-sm font-semibold text-gray-700">Harga/Bln</Label>
                  <Input
                    id="create-biaya"
                    inputMode="numeric"
                    value={formatCurrency(createForm.biaya_per_bulan)}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, biaya_per_bulan: parseNumberInput(event.target.value), diskon: 0, diskon_percent: 0 }))}
                    placeholder="0"
                    className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-tgl-mulai" className="text-sm font-semibold text-gray-700">Start Date</Label>
                  <Input
                    id="create-tgl-mulai"
                    type="date"
                    value={createForm.tgl_mulai_tagihan}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, tgl_mulai_tagihan: event.target.value }))}
                    className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-jumlah-bulan" className="text-sm font-semibold text-gray-700">Jumlah Bulan</Label>
                  <Input
                    id="create-jumlah-bulan"
                    type="number"
                    min={1}
                    value={createForm.jumlah_bulan}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, jumlah_bulan: Math.max(1, Number(event.target.value || 1)) }))}
                    className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-tempo" className="text-sm font-semibold text-gray-700">Tanggal Tempo</Label>
                  <Input
                    id="create-tempo"
                    value={formatDate(createTempoDate)}
                    readOnly
                    className="border-2 border-gray-200 bg-gray-50"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-gross" className="text-sm font-semibold text-gray-700">Jumlah Harga</Label>
                  <Input
                    id="create-gross"
                    value={formatCurrency(createGross)}
                    readOnly
                    className="border-2 border-gray-200 bg-gray-50"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-diskon-percent" className="text-sm font-semibold text-gray-700">Diskon (%)</Label>
                  <Input
                    id="create-diskon-percent"
                    inputMode="numeric"
                    value={createForm.diskon_percent ? String(createForm.diskon_percent) : ''}
                    onChange={(event) => {
                      const percent = Math.max(0, Math.min(100, parseNumberInput(event.target.value)));
                      setCreateForm((prev) => ({
                        ...prev,
                        diskon_percent: percent,
                        diskon: 0,
                      }));
                    }}
                    placeholder="0"
                    className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-diskon" className="text-sm font-semibold text-gray-700">Diskon (Rp)</Label>
                  <Input
                    id="create-diskon"
                    inputMode="numeric"
                    value={createForm.diskon ? String(createForm.diskon) : ''}
                    onChange={(event) => setCreateForm((prev) => ({ ...prev, diskon: parseNumberInput(event.target.value), diskon_percent: 0 }))}
                    placeholder="0"
                    className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="create-net" className="text-sm font-semibold text-gray-700">Total Harga</Label>
                  <Input
                    id="create-net"
                    value={formatCurrency(createNet)}
                    readOnly
                    className="border-2 border-gray-200 bg-gray-50 font-semibold"
                  />
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="create-keterangan" className="text-sm font-semibold text-gray-700">Keterangan</Label>
                <Input
                  id="create-keterangan"
                  value={createForm.keterangan}
                  onChange={(event) => setCreateForm((prev) => ({ ...prev, keterangan: event.target.value.toUpperCase() }))}
                  placeholder="Keterangan tambahan..."
                  className="border-2 border-gray-200 focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <Button type="button" variant="outline" onClick={() => setCreateDialogOpen(false)}>Batal</Button>
                <Button
                  type="button"
                  onClick={() => createMutation.mutate()}
                  disabled={createMutation.isPending || !createForm.subscriber_id || !createForm.tgl_mulai_tagihan}
                  className="bg-gradient-to-r from-blue-600 to-indigo-700 hover:from-blue-700 hover:to-indigo-800 text-white font-semibold px-6 py-2 rounded-lg shadow-lg hover:shadow-xl transition-all duration-200 transform hover:scale-[1.02]"
                >
                  {createMutation.isPending ? 'Menyimpan...' : 'Simpan'}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
