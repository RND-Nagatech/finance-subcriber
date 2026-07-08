import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'react-toastify';
import { BarChart3, Coins, LineChart, Minus, Plus, RefreshCw, Trash2 } from 'lucide-react';
import {
  createAsset,
  createAssetType,
  deleteAsset,
  fetchAssetLedgerHistory,
  fetchAssets,
  fetchAssetSummary,
  fetchAssetTypes,
  fetchAssetTransfers,
  fetchAssetTypePriceHistory,
  reduceAssetStock,
  transferAssetToRekening,
  transferRekeningToAsset,
  updateAssetTypeCurrentPrice,
  type AssetItem,
  type AssetLedger,
  type AssetTransfer,
  type AssetTypePriceHistory,
  type AssetType,
} from '@/api/assets';
import axiosInstance from '@/api/axiosInstance';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface Perusahaan {
  _id: string;
  kode_perusahaan: string;
  nama_perusahaan: string;
}

interface RekeningOption {
  _id: string;
  kode_bank: string;
  no_rekening: string;
  nama_rekening?: string;
  saldo?: number;
  nama_perusahaan?: string;
}

const currency = (value: number) =>
  new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(Number(value || 0));

const numberFmt = (value: number) => new Intl.NumberFormat('id-ID', { maximumFractionDigits: 4 }).format(Number(value || 0));

export default function Assets() {
  const queryClient = useQueryClient();
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [typeDialogOpen, setTypeDialogOpen] = useState(false);
  const [priceDialogOpen, setPriceDialogOpen] = useState(false);
  const [transferDialogOpen, setTransferDialogOpen] = useState(false);
  const [assetToRekeningDialogOpen, setAssetToRekeningDialogOpen] = useState(false);
  const [reduceDialogOpen, setReduceDialogOpen] = useState(false);
  const [selectedType, setSelectedType] = useState<AssetType | null>(null);
  const [assetForm, setAssetForm] = useState({
    asset_type_id: '',
    asset_name: '',
    perusahaan_id: 'none',
    qty: '',
    harga_beli_per_unit: '',
  });
  const [typeForm, setTypeForm] = useState({ code: '', name: '', unit: '', current_price: '' });
  const [priceText, setPriceText] = useState('');
  const [priceNote, setPriceNote] = useState('');
  const [transferForm, setTransferForm] = useState({
    rekening_id: '',
    asset_id: '',
    unit_price: '',
    nominal: '',
    asset_qty: '',
    tanggal: new Date().toISOString().slice(0, 10),
    keterangan: '',
  });
  const [assetToRekeningForm, setAssetToRekeningForm] = useState({
    rekening_id: '',
    asset_id: '',
    unit_price: '',
    nominal: '',
    asset_qty: '',
    tanggal: new Date().toISOString().slice(0, 10),
    keterangan: '',
  });
  const [reduceForm, setReduceForm] = useState({
    asset_id: '',
    unit_price: '',
    qty: '',
    tanggal: new Date().toISOString().slice(0, 10),
    keterangan: '',
  });

  const { data: assetTypes = [] } = useQuery({ queryKey: ['asset-types'], queryFn: fetchAssetTypes });
  const { data: assets = [], isLoading } = useQuery({ queryKey: ['assets'], queryFn: fetchAssets });
  const { data: summary } = useQuery({ queryKey: ['assets-summary'], queryFn: fetchAssetSummary });
  const { data: assetTransfers = [] } = useQuery({ queryKey: ['asset-transfers'], queryFn: fetchAssetTransfers });
  const { data: assetLedgerHistory = [] } = useQuery({ queryKey: ['asset-ledger-history'], queryFn: fetchAssetLedgerHistory });
  const { data: priceHistory = [] } = useQuery({ queryKey: ['asset-type-price-history'], queryFn: () => fetchAssetTypePriceHistory() });
  const { data: perusahaanList = [] } = useQuery({
    queryKey: ['perusahaan-all'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/perusahaan?all=true');
      return res.data || [];
    },
  });
  const { data: rekeningList = [] } = useQuery({
    queryKey: ['rekening-all'],
    queryFn: async () => {
      const res = await axiosInstance.get('/master/rekening?all=true');
      return res.data || [];
    },
  });

  const totalGrowthClass = Number(summary?.growth_nominal || 0) >= 0 ? 'text-emerald-700' : 'text-red-700';

  const createTypeMut = useMutation({
    mutationFn: () => createAssetType({
      code: typeForm.code,
      name: typeForm.name,
      unit: typeForm.unit,
      current_price: Number(typeForm.current_price || 0),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-types'] });
      toast.success('Jenis asset berhasil ditambahkan');
      setTypeDialogOpen(false);
      setTypeForm({ code: '', name: '', unit: '', current_price: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menambah jenis asset'),
  });

  const createAssetMut = useMutation({
    mutationFn: () => createAsset({
      asset_type_id: assetForm.asset_type_id,
      asset_name: assetForm.asset_name,
      perusahaan_id: assetForm.perusahaan_id === 'none' ? undefined : assetForm.perusahaan_id,
      qty: Number(assetForm.qty || 0),
      harga_beli_per_unit: Number(assetForm.harga_beli_per_unit || 0),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets-summary'] });
      toast.success('Asset berhasil ditambahkan');
      setAssetDialogOpen(false);
      setAssetForm({ asset_type_id: '', asset_name: '', perusahaan_id: 'none', qty: '', harga_beli_per_unit: '' });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal menambah asset'),
  });

  const updatePriceMut = useMutation({
    mutationFn: () => updateAssetTypeCurrentPrice(selectedType!._id, Number(priceText || 0), priceNote),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['asset-types'] });
      queryClient.invalidateQueries({ queryKey: ['asset-type-price-history'] });
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets-summary'] });
      toast.success('Harga sekarang berhasil diperbarui');
      setPriceDialogOpen(false);
      setSelectedType(null);
      setPriceText('');
      setPriceNote('');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal update harga sekarang'),
  });

  const deleteMut = useMutation({
    mutationFn: deleteAsset,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets-summary'] });
      toast.success('Asset berhasil dinonaktifkan');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal hapus asset'),
  });

  const transferMut = useMutation({
    mutationFn: () => transferRekeningToAsset({
      rekening_id: transferForm.rekening_id,
      asset_id: transferForm.asset_id,
      nominal: Number(transferForm.nominal || 0),
      unit_price: Number(transferForm.unit_price || 0),
      asset_qty: Number(transferForm.asset_qty || 0),
      tanggal: transferForm.tanggal,
      keterangan: transferForm.keterangan,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets-summary'] });
      queryClient.invalidateQueries({ queryKey: ['asset-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['asset-ledger-history'] });
      queryClient.invalidateQueries({ queryKey: ['rekening-all'] });
      toast.success('Transfer rekening ke asset berhasil');
      setTransferDialogOpen(false);
      setTransferForm({
        rekening_id: '',
        asset_id: '',
        unit_price: '',
        nominal: '',
        asset_qty: '',
        tanggal: new Date().toISOString().slice(0, 10),
        keterangan: '',
      });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal transfer rekening ke asset'),
  });

  const assetToRekeningMut = useMutation({
    mutationFn: () => transferAssetToRekening({
      rekening_id: assetToRekeningForm.rekening_id,
      asset_id: assetToRekeningForm.asset_id,
      nominal: Number(assetToRekeningForm.nominal || 0),
      unit_price: Number(assetToRekeningForm.unit_price || 0),
      asset_qty: Number(assetToRekeningForm.asset_qty || 0),
      tanggal: assetToRekeningForm.tanggal,
      keterangan: assetToRekeningForm.keterangan,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets-summary'] });
      queryClient.invalidateQueries({ queryKey: ['asset-transfers'] });
      queryClient.invalidateQueries({ queryKey: ['asset-ledger-history'] });
      queryClient.invalidateQueries({ queryKey: ['rekening-all'] });
      toast.success('Transfer asset ke rekening berhasil');
      setAssetToRekeningDialogOpen(false);
      setAssetToRekeningForm({
        rekening_id: '',
        asset_id: '',
        unit_price: '',
        nominal: '',
        asset_qty: '',
        tanggal: new Date().toISOString().slice(0, 10),
        keterangan: '',
      });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal transfer asset ke rekening'),
  });

  const reduceAssetMut = useMutation({
    mutationFn: () => reduceAssetStock({
      asset_id: reduceForm.asset_id,
      qty: Number(reduceForm.qty || 0),
      unit_price: Number(reduceForm.unit_price || 0),
      tanggal: reduceForm.tanggal,
      keterangan: reduceForm.keterangan,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['assets'] });
      queryClient.invalidateQueries({ queryKey: ['assets-summary'] });
      queryClient.invalidateQueries({ queryKey: ['asset-ledger-history'] });
      toast.success('Pengurangan asset berhasil dicatat');
      setReduceDialogOpen(false);
      setReduceForm({
        asset_id: '',
        unit_price: '',
        qty: '',
        tanggal: new Date().toISOString().slice(0, 10),
        keterangan: '',
      });
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Gagal mengurangi asset'),
  });

  const typeLookup = useMemo(() => {
    const map = new Map<string, AssetType>();
    assetTypes.forEach((t) => map.set(t._id, t));
    return map;
  }, [assetTypes]);

  const resolveAssetType = (asset: AssetItem) => {
    if (asset.asset_type && typeof asset.asset_type === 'object') return asset.asset_type;
    if (asset.asset_type_id && typeof asset.asset_type_id === 'object') return asset.asset_type_id as AssetType;
    return typeLookup.get(String(asset.asset_type_id || ''));
  };
  const selectedTransferRekening = (rekeningList as RekeningOption[]).find((rekening) => rekening._id === transferForm.rekening_id);
  const selectedTransferAsset = assets.find((asset) => asset._id === transferForm.asset_id);
  const selectedTransferAssetType = selectedTransferAsset ? resolveAssetType(selectedTransferAsset) : undefined;
  const selectedAssetToRekening = assets.find((asset) => asset._id === assetToRekeningForm.asset_id);
  const selectedAssetToRekeningType = selectedAssetToRekening ? resolveAssetType(selectedAssetToRekening) : undefined;
  const selectedAssetToRekeningTarget = (rekeningList as RekeningOption[]).find((rekening) => rekening._id === assetToRekeningForm.rekening_id);
  const selectedReduceAsset = assets.find((asset) => asset._id === reduceForm.asset_id);
  const selectedReduceAssetType = selectedReduceAsset ? resolveAssetType(selectedReduceAsset) : undefined;
  const calculateQtyFromNominal = (nominalText: string, unitPriceText: string) => {
    const nominal = Number(nominalText || 0);
    const unitPrice = Number(unitPriceText || 0);
    if (!Number.isFinite(nominal) || !Number.isFinite(unitPrice) || nominal <= 0 || unitPrice <= 0) return '';
    return String(nominal / unitPrice);
  };
  const calculateNominalFromQty = (qtyText: string, unitPriceText: string) => {
    const qty = Number(qtyText || 0);
    const unitPrice = Number(unitPriceText || 0);
    if (!Number.isFinite(qty) || !Number.isFinite(unitPrice) || qty <= 0 || unitPrice <= 0) return '';
    return String(qty * unitPrice);
  };
  const handleTransferUnitPriceChange = (value: string) => {
    setTransferForm((prev) => ({
      ...prev,
      unit_price: value,
      asset_qty: calculateQtyFromNominal(prev.nominal, value),
    }));
  };
  const handleTransferNominalChange = (value: string) => {
    setTransferForm((prev) => ({
      ...prev,
      nominal: value,
      asset_qty: calculateQtyFromNominal(value, prev.unit_price),
    }));
  };
  const handleTransferQtyChange = (value: string) => {
    setTransferForm((prev) => ({
      ...prev,
      asset_qty: value,
      nominal: calculateNominalFromQty(value, prev.unit_price),
    }));
  };
  const handleAssetToRekeningUnitPriceChange = (value: string) => {
    setAssetToRekeningForm((prev) => ({
      ...prev,
      unit_price: value,
      nominal: calculateNominalFromQty(prev.asset_qty, value),
    }));
  };
  const handleAssetToRekeningQtyChange = (value: string) => {
    setAssetToRekeningForm((prev) => ({
      ...prev,
      asset_qty: value,
      nominal: calculateNominalFromQty(value, prev.unit_price),
    }));
  };
  const handleAssetToRekeningNominalChange = (value: string) => {
    setAssetToRekeningForm((prev) => ({
      ...prev,
      nominal: value,
      asset_qty: calculateQtyFromNominal(value, prev.unit_price),
    }));
  };
  const resolveLedgerTone = (row: AssetLedger) => {
    if (row.movement_type === 'OUT') return 'text-red-700';
    if (row.movement_type === 'ROLLBACK') return 'text-blue-700';
    return 'text-emerald-700';
  };

  return (
    <div className="min-h-screen bg-slate-50 px-6 py-8">
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-slate-950">Asset Investasi</h1>
          <p className="mt-1 text-sm text-slate-500">Kelola emas, mata uang asing, dan asset lain dengan valuasi harga sekarang.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => setTypeDialogOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Jenis Asset
          </Button>
          <Button variant="outline" onClick={() => setReduceDialogOpen(true)} className="gap-2 border-red-200 text-red-700 hover:bg-red-50">
            <Minus className="h-4 w-4" />
            Pengurangan Asset
          </Button>
          <Button onClick={() => setAssetDialogOpen(true)} className="gap-2 bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4" />
            Tambah Asset
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-slate-600"><Coins className="h-4 w-4" />Total Harga Beli</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-slate-950">{currency(summary?.total_harga_beli || 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-slate-600"><BarChart3 className="h-4 w-4" />Total Harga Sekarang</CardTitle></CardHeader>
          <CardContent className="text-2xl font-bold text-slate-950">{currency(summary?.total_harga_sekarang || 0)}</CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="flex items-center gap-2 text-sm text-slate-600"><LineChart className="h-4 w-4" />Growth</CardTitle></CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${totalGrowthClass}`}>{currency(summary?.growth_nominal || 0)}</div>
            <div className="text-sm text-slate-500">{numberFmt(summary?.growth_percent || 0)}%</div>
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-[1fr_360px]">
        <Card>
          <CardHeader>
            <CardTitle>Daftar Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Asset</TableHead>
                  <TableHead>Jenis</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Harga Beli</TableHead>
                  <TableHead>Harga Sekarang</TableHead>
                  <TableHead>Growth</TableHead>
                  <TableHead className="text-right">Aksi</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-500">Memuat data...</TableCell></TableRow>
                ) : assets.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-500">Belum ada asset.</TableCell></TableRow>
                ) : assets.map((asset) => {
                  const type = resolveAssetType(asset);
                  const growth = Number(asset.growth_nominal || 0);
                  return (
                    <TableRow key={asset._id}>
                      <TableCell>
                        <div className="font-semibold text-slate-900">{asset.asset_name}</div>
                        <div className="text-xs text-slate-500">{asset.asset_code} · {asset.nama_perusahaan || 'Tanpa perusahaan'}</div>
                      </TableCell>
                      <TableCell>{type?.name || '-'}</TableCell>
                      <TableCell>{numberFmt(asset.qty)} {type?.unit || asset.unit || ''}</TableCell>
                      <TableCell>
                        <div>{currency(asset.total_harga_beli || 0)}</div>
                        <div className="text-xs text-slate-500">{currency(asset.harga_beli_per_unit)} / {type?.unit || '-'}</div>
                      </TableCell>
                      <TableCell>
                        <div>{currency(asset.total_harga_sekarang || 0)}</div>
                        <div className="text-xs text-slate-500">{currency(asset.current_price || 0)} / {type?.unit || '-'}</div>
                      </TableCell>
                      <TableCell className={growth >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-red-700'}>
                        {currency(growth)}
                        <div className="text-xs">{numberFmt(asset.growth_percent || 0)}%</div>
                      </TableCell>
                      <TableCell className="text-right">
                        <Button variant="ghost" size="sm" className="text-red-600" onClick={() => {
                          if (window.confirm('Nonaktifkan asset ini?')) deleteMut.mutate(asset._id);
                        }}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Harga Sekarang</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {assetTypes.length === 0 ? <div className="text-sm text-slate-500">Belum ada jenis asset.</div> : assetTypes.map((type) => (
              <div key={type._id} className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <div className="font-semibold">{type.name}</div>
                  <div className="text-xs text-slate-500">{currency(type.current_price)} / {type.unit}</div>
                </div>
                <Button variant="outline" size="sm" className="gap-2" onClick={() => {
                  setSelectedType(type);
                  setPriceText(String(type.current_price || 0));
                  setPriceNote('');
                  setPriceDialogOpen(true);
                }}>
                  <RefreshCw className="h-4 w-4" />
                  Update
                </Button>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>History Harga Sekarang</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Jenis Asset</TableHead>
                  <TableHead>Harga Lama</TableHead>
                  <TableHead>Harga Baru</TableHead>
                  <TableHead>Update By</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {priceHistory.length === 0 ? (
                  <TableRow><TableCell colSpan={5} className="py-8 text-center text-slate-500">Belum ada history update harga.</TableCell></TableRow>
                ) : priceHistory.slice(0, 10).map((row: AssetTypePriceHistory) => (
                  <TableRow key={row._id}>
                    <TableCell>{row.changed_at ? new Date(row.changed_at).toLocaleString('id-ID') : '-'}</TableCell>
                    <TableCell>
                      <div className="font-medium">{row.name}</div>
                      <div className="text-xs text-slate-500">{row.code} / {row.unit}</div>
                    </TableCell>
                    <TableCell>{currency(row.old_price)}</TableCell>
                    <TableCell className="font-semibold text-emerald-700">{currency(row.new_price)}</TableCell>
                    <TableCell>
                      <div className="font-medium">{row.changed_by || '-'}</div>
                      {row.keterangan && <div className="max-w-[180px] truncate text-xs text-slate-500">{row.keterangan}</div>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* <Card>
          <CardHeader>
            <CardTitle>History Transfer Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Arah</TableHead>
                  <TableHead>Rekening</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Nominal</TableHead>
                  <TableHead>Qty</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetTransfers.length === 0 ? (
                  <TableRow><TableCell colSpan={6} className="py-8 text-center text-slate-500">Belum ada transfer asset.</TableCell></TableRow>
                ) : assetTransfers.slice(0, 10).map((row: AssetTransfer) => (
                  <TableRow key={row._id}>
                    <TableCell>{row.tanggal ? new Date(row.tanggal).toLocaleDateString('id-ID') : '-'}</TableCell>
                    <TableCell>
                      <span className={row.direction === 'ASSET_TO_REKENING' ? 'font-semibold text-amber-700' : 'font-semibold text-emerald-700'}>
                        {row.direction === 'ASSET_TO_REKENING' ? 'Asset ke Rekening' : 'Rekening ke Asset'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.kode_bank}</div>
                      <div className="text-xs text-slate-500">{row.no_rekening}</div>
                    </TableCell>
                    <TableCell>
                      <div className="font-medium">{row.asset_name}</div>
                      <div className="text-xs text-slate-500">{row.asset_code}</div>
                    </TableCell>
                    <TableCell>{currency(row.nominal)}</TableCell>
                    <TableCell>{numberFmt(row.asset_qty)} {row.asset_unit}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card> */}

        <Card>
          <CardHeader>
            <CardTitle>History Movement Asset</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tanggal</TableHead>
                  <TableHead>Asset</TableHead>
                  <TableHead>Movement</TableHead>
                  <TableHead>Qty</TableHead>
                  <TableHead>Harga</TableHead>
                  <TableHead>Total</TableHead>
                  <TableHead>Ref</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {assetLedgerHistory.length === 0 ? (
                  <TableRow><TableCell colSpan={7} className="py-8 text-center text-slate-500">Belum ada movement asset.</TableCell></TableRow>
                ) : assetLedgerHistory.slice(0, 10).map((row: AssetLedger) => (
                  <TableRow key={row._id}>
                    <TableCell>{row.tanggal || (row.created_at ? new Date(row.created_at).toLocaleDateString('id-ID') : '-')}</TableCell>
                    <TableCell>
                      <div className="font-medium">{row.asset_name || '-'}</div>
                      <div className="text-xs text-slate-500">{row.asset_code || '-'}</div>
                    </TableCell>
                    <TableCell className={`font-semibold ${resolveLedgerTone(row)}`}>{row.movement_type}</TableCell>
                    <TableCell>{numberFmt(row.qty_delta)} {row.unit}</TableCell>
                    <TableCell>{currency(row.unit_price_snapshot || 0)}</TableCell>
                    <TableCell>{currency(Math.abs(Number(row.qty_delta || 0)) * Number(row.unit_price_snapshot || 0))}</TableCell>
                    <TableCell>
                      <div className="text-xs font-medium text-slate-700">{row.ref_type || '-'}</div>
                      <div className="max-w-[180px] truncate text-xs text-slate-500">{row.keterangan || '-'}</div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Dialog open={typeDialogOpen} onOpenChange={setTypeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Jenis Asset</DialogTitle>
            <DialogDescription>Harga sekarang di sini berlaku untuk semua asset dengan jenis yang sama.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2"><Label>Kode</Label><Input value={typeForm.code} onChange={(e) => setTypeForm({ ...typeForm, code: e.target.value })} placeholder="EMAS" /></div>
            <div className="grid gap-2"><Label>Nama</Label><Input value={typeForm.name} onChange={(e) => setTypeForm({ ...typeForm, name: e.target.value })} placeholder="Emas" /></div>
            <div className="grid gap-2"><Label>Satuan</Label><Input value={typeForm.unit} onChange={(e) => setTypeForm({ ...typeForm, unit: e.target.value })} placeholder="gram" /></div>
            <div className="grid gap-2"><Label>Harga Sekarang / Satuan</Label><Input type="number" value={typeForm.current_price} onChange={(e) => setTypeForm({ ...typeForm, current_price: e.target.value })} placeholder="2500000" /></div>
          </div>
          <DialogFooter><Button onClick={() => createTypeMut.mutate()} disabled={createTypeMut.isPending}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assetDialogOpen} onOpenChange={setAssetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Asset</DialogTitle>
            <DialogDescription>Qty awal akan dicatat sebagai saldo awal asset.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Jenis Asset</Label>
              <Select value={assetForm.asset_type_id} onValueChange={(value) => setAssetForm({ ...assetForm, asset_type_id: value })}>
                <SelectTrigger><SelectValue placeholder="Pilih jenis asset" /></SelectTrigger>
                <SelectContent>{assetTypes.map((type) => <SelectItem key={type._id} value={type._id}>{type.name} ({type.unit})</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="grid gap-2"><Label>Nama Asset</Label><Input value={assetForm.asset_name} onChange={(e) => setAssetForm({ ...assetForm, asset_name: e.target.value })} placeholder="Emas Antam" /></div>
            <div className="grid gap-2">
              <Label>Perusahaan</Label>
              <Select value={assetForm.perusahaan_id} onValueChange={(value) => setAssetForm({ ...assetForm, perusahaan_id: value })}>
                <SelectTrigger><SelectValue placeholder="Pilih perusahaan" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Tanpa perusahaan</SelectItem>
                  {(perusahaanList as Perusahaan[]).map((p) => <SelectItem key={p._id} value={p._id}>{p.nama_perusahaan}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2"><Label>Qty Awal</Label><Input type="number" value={assetForm.qty} onChange={(e) => setAssetForm({ ...assetForm, qty: e.target.value })} placeholder="700" /></div>
              <div className="grid gap-2"><Label>Harga Beli / Satuan</Label><Input type="number" value={assetForm.harga_beli_per_unit} onChange={(e) => setAssetForm({ ...assetForm, harga_beli_per_unit: e.target.value })} placeholder="2000000" /></div>
            </div>
          </div>
          <DialogFooter><Button onClick={() => createAssetMut.mutate()} disabled={createAssetMut.isPending}>Simpan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={reduceDialogOpen} onOpenChange={setReduceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pengurangan Asset</DialogTitle>
            <DialogDescription>Gunakan untuk mengeluarkan stok asset, misalnya saat asset dijual. Jurnal uangnya tetap dicatat dari menu Transaksi.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Asset</Label>
              <Select value={reduceForm.asset_id} onValueChange={(value) => {
                const selectedAsset = assets.find((asset) => asset._id === value);
                const type = selectedAsset ? resolveAssetType(selectedAsset) : undefined;
                const unitPrice = String(type?.current_price || selectedAsset?.current_price || '');
                setReduceForm((prev) => ({ ...prev, asset_id: value, unit_price: unitPrice }));
              }}>
                <SelectTrigger><SelectValue placeholder="Pilih asset" /></SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => {
                    const type = resolveAssetType(asset);
                    return <SelectItem key={asset._id} value={asset._id}>{asset.asset_code} - {asset.asset_name} ({numberFmt(asset.qty)} {type?.unit || asset.unit || ''})</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              {selectedReduceAsset && (
                <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Qty saat ini: <span className="font-semibold">{numberFmt(selectedReduceAsset.qty)} {selectedReduceAsset.unit || selectedReduceAssetType?.unit || ''}</span>
                </div>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Qty Keluar</Label>
                <Input type="number" step="any" value={reduceForm.qty} onChange={(e) => setReduceForm({ ...reduceForm, qty: e.target.value })} placeholder={selectedReduceAssetType?.unit || 'Qty'} />
              </div>
              <div className="grid gap-2">
                <Label>Harga per Unit</Label>
                <Input type="number" step="any" value={reduceForm.unit_price} onChange={(e) => setReduceForm({ ...reduceForm, unit_price: e.target.value })} placeholder={selectedReduceAssetType?.unit ? `Harga per 1 ${selectedReduceAssetType.unit}` : 'Harga per 1 unit'} />
              </div>
            </div>
            {Number(reduceForm.qty || 0) > 0 && Number(reduceForm.unit_price || 0) > 0 && (
              <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-800">
                Nilai keluar: <span className="font-semibold">{currency(Number(reduceForm.qty || 0) * Number(reduceForm.unit_price || 0))}</span>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Tanggal</Label>
              <Input type="date" value={reduceForm.tanggal} onChange={(e) => setReduceForm({ ...reduceForm, tanggal: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Keterangan</Label>
              <Input value={reduceForm.keterangan} onChange={(e) => setReduceForm({ ...reduceForm, keterangan: e.target.value })} placeholder="Contoh: Penjualan asset, stok keluar" />
            </div>
          </div>
          <DialogFooter><Button onClick={() => reduceAssetMut.mutate()} disabled={reduceAssetMut.isPending}>Simpan Pengurangan</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={priceDialogOpen} onOpenChange={setPriceDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Update Harga Sekarang</DialogTitle>
            <DialogDescription>{selectedType?.name} per {selectedType?.unit}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-2 py-2">
            <Label>Harga Sekarang</Label>
            <Input type="number" value={priceText} onChange={(e) => setPriceText(e.target.value)} />
          </div>
          <div className="grid gap-2 py-2">
            <Label>Keterangan</Label>
            <Input value={priceNote} onChange={(e) => setPriceNote(e.target.value)} placeholder="Opsional" />
          </div>
          <DialogFooter><Button onClick={() => updatePriceMut.mutate()} disabled={!selectedType || updatePriceMut.isPending}>Update</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Rekening ke Asset</DialogTitle>
            <DialogDescription>Saldo rekening akan berkurang dan qty asset langsung bertambah.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Rekening Sumber</Label>
              <Select value={transferForm.rekening_id} onValueChange={(value) => setTransferForm({ ...transferForm, rekening_id: value })}>
                <SelectTrigger><SelectValue placeholder="Pilih rekening" /></SelectTrigger>
                <SelectContent>
                  {(rekeningList as RekeningOption[]).map((rekening) => (
                    <SelectItem key={rekening._id} value={rekening._id}>
                      {rekening.kode_bank} - {rekening.no_rekening} ({currency(rekening.saldo || 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedTransferRekening && (
                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  Saldo saat ini: <span className="font-semibold">{currency(selectedTransferRekening.saldo || 0)}</span>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Asset Tujuan</Label>
              <Select value={transferForm.asset_id} onValueChange={(value) => {
                const selectedAsset = assets.find((asset) => asset._id === value);
                const selectedTypeForPrice = selectedAsset ? resolveAssetType(selectedAsset) : undefined;
                const unitPrice = String(selectedTypeForPrice?.current_price || selectedAsset?.current_price || '');
                setTransferForm((prev) => ({
                  ...prev,
                  asset_id: value,
                  unit_price: unitPrice,
                  asset_qty: calculateQtyFromNominal(prev.nominal, unitPrice),
                }));
              }}>
                <SelectTrigger><SelectValue placeholder="Pilih asset" /></SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => {
                    const type = resolveAssetType(asset);
                    return <SelectItem key={asset._id} value={asset._id}>{asset.asset_code} - {asset.asset_name} ({numberFmt(asset.qty)} {type?.unit || asset.unit || ''})</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              {selectedTransferAsset && (
                <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Qty saat ini: <span className="font-semibold">{numberFmt(selectedTransferAsset.qty)} {selectedTransferAsset.unit || selectedTransferAssetType?.unit || ''}</span>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Harga per Unit</Label>
              <Input
                type="number"
                step="any"
                value={transferForm.unit_price}
                onChange={(e) => handleTransferUnitPriceChange(e.target.value)}
                placeholder={selectedTransferAssetType?.unit ? `Harga per 1 ${selectedTransferAssetType.unit}` : 'Harga per 1 unit'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Nominal Rekening</Label>
                <Input type="number" value={transferForm.nominal} onChange={(e) => handleTransferNominalChange(e.target.value)} placeholder="10000000" />
              </div>
              <div className="grid gap-2">
                <Label>Qty Asset</Label>
                <Input type="number" step="any" value={transferForm.asset_qty} onChange={(e) => handleTransferQtyChange(e.target.value)} placeholder={selectedTransferAssetType?.unit || 'Qty'} />
              </div>
            </div>
            {Number(transferForm.unit_price || 0) > 0 && Number(transferForm.nominal || 0) > 0 && (
              <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Kalkulasi: {currency(Number(transferForm.nominal || 0))} / {currency(Number(transferForm.unit_price || 0))}
                {' = '}
                <span className="font-semibold">{numberFmt(Number(transferForm.asset_qty || 0))} {selectedTransferAssetType?.unit || selectedTransferAsset?.unit || ''}</span>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Tanggal</Label>
              <Input type="date" value={transferForm.tanggal} onChange={(e) => setTransferForm({ ...transferForm, tanggal: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Keterangan</Label>
              <Input value={transferForm.keterangan} onChange={(e) => setTransferForm({ ...transferForm, keterangan: e.target.value })} placeholder="Pembelian emas dari rekening operasional" />
            </div>
          </div>
          <DialogFooter><Button onClick={() => transferMut.mutate()} disabled={transferMut.isPending}>Transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={assetToRekeningDialogOpen} onOpenChange={setAssetToRekeningDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Transfer Asset ke Rekening</DialogTitle>
            <DialogDescription>Qty asset akan berkurang dan saldo rekening langsung bertambah.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label>Asset Sumber</Label>
              <Select value={assetToRekeningForm.asset_id} onValueChange={(value) => {
                const selectedAsset = assets.find((asset) => asset._id === value);
                const selectedTypeForPrice = selectedAsset ? resolveAssetType(selectedAsset) : undefined;
                const unitPrice = String(selectedTypeForPrice?.current_price || selectedAsset?.current_price || '');
                setAssetToRekeningForm((prev) => ({
                  ...prev,
                  asset_id: value,
                  unit_price: unitPrice,
                  nominal: calculateNominalFromQty(prev.asset_qty, unitPrice),
                }));
              }}>
                <SelectTrigger><SelectValue placeholder="Pilih asset" /></SelectTrigger>
                <SelectContent>
                  {assets.map((asset) => {
                    const type = resolveAssetType(asset);
                    return <SelectItem key={asset._id} value={asset._id}>{asset.asset_code} - {asset.asset_name} ({numberFmt(asset.qty)} {type?.unit || asset.unit || ''})</SelectItem>;
                  })}
                </SelectContent>
              </Select>
              {selectedAssetToRekening && (
                <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  Qty saat ini: <span className="font-semibold">{numberFmt(selectedAssetToRekening.qty)} {selectedAssetToRekening.unit || selectedAssetToRekeningType?.unit || ''}</span>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Rekening Tujuan</Label>
              <Select value={assetToRekeningForm.rekening_id} onValueChange={(value) => setAssetToRekeningForm({ ...assetToRekeningForm, rekening_id: value })}>
                <SelectTrigger><SelectValue placeholder="Pilih rekening" /></SelectTrigger>
                <SelectContent>
                  {(rekeningList as RekeningOption[]).map((rekening) => (
                    <SelectItem key={rekening._id} value={rekening._id}>
                      {rekening.kode_bank} - {rekening.no_rekening} ({currency(rekening.saldo || 0)})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedAssetToRekeningTarget && (
                <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  Saldo saat ini: <span className="font-semibold">{currency(selectedAssetToRekeningTarget.saldo || 0)}</span>
                </div>
              )}
            </div>
            <div className="grid gap-2">
              <Label>Harga per Unit</Label>
              <Input
                type="number"
                step="any"
                value={assetToRekeningForm.unit_price}
                onChange={(e) => handleAssetToRekeningUnitPriceChange(e.target.value)}
                placeholder={selectedAssetToRekeningType?.unit ? `Harga per 1 ${selectedAssetToRekeningType.unit}` : 'Harga per 1 unit'}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label>Qty Asset</Label>
                <Input type="number" step="any" value={assetToRekeningForm.asset_qty} onChange={(e) => handleAssetToRekeningQtyChange(e.target.value)} placeholder={selectedAssetToRekeningType?.unit || 'Qty'} />
              </div>
              <div className="grid gap-2">
                <Label>Nominal Rekening</Label>
                <Input type="number" value={assetToRekeningForm.nominal} onChange={(e) => handleAssetToRekeningNominalChange(e.target.value)} placeholder="10000000" />
              </div>
            </div>
            {Number(assetToRekeningForm.unit_price || 0) > 0 && Number(assetToRekeningForm.asset_qty || 0) > 0 && (
              <div className="rounded-md border border-emerald-100 bg-emerald-50 px-3 py-2 text-xs text-emerald-800">
                Kalkulasi: {numberFmt(Number(assetToRekeningForm.asset_qty || 0))} {selectedAssetToRekeningType?.unit || selectedAssetToRekening?.unit || ''}
                {' x '}
                {currency(Number(assetToRekeningForm.unit_price || 0))}
                {' = '}
                <span className="font-semibold">{currency(Number(assetToRekeningForm.nominal || 0))}</span>
              </div>
            )}
            <div className="grid gap-2">
              <Label>Tanggal</Label>
              <Input type="date" value={assetToRekeningForm.tanggal} onChange={(e) => setAssetToRekeningForm({ ...assetToRekeningForm, tanggal: e.target.value })} />
            </div>
            <div className="grid gap-2">
              <Label>Keterangan</Label>
              <Input value={assetToRekeningForm.keterangan} onChange={(e) => setAssetToRekeningForm({ ...assetToRekeningForm, keterangan: e.target.value })} placeholder="Pencairan asset ke rekening" />
            </div>
          </div>
          <DialogFooter><Button onClick={() => assetToRekeningMut.mutate()} disabled={assetToRekeningMut.isPending}>Transfer</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
