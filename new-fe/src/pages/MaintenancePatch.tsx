import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle2, Database, Play, RefreshCw, Search, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";

import { fetchLatestPatchJob, fetchPatchJob, fetchUnverifiedSubscriptionPatchRows, startPatchJob, type PatchJob, type UnverifiedSubscriptionPatchRow } from "@/api/maintenance";
import { fetchSubscribers, verifySubscriptionDetail } from "@/api/ttvps";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { SearchableSelect } from "@/components/ui/searchable-select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const statusClass: Record<PatchJob["status"], string> = {
  running: "bg-blue-100 text-blue-700",
  done: "bg-emerald-100 text-emerald-700",
  error: "bg-red-100 text-red-700",
};

export default function MaintenancePatch() {
  const qc = useQueryClient();
  const [jobId, setJobId] = useState<string | null>(null);
  const [collections, setCollections] = useState({
    sourceProgram: "tm_program2",
    targetProgram: "tm_program",
    sourceSubscriber: "tm_subscriber2",
    targetSubscriber: "tm_subscriber",
    sourceSubscriptionDetail: "tt_subscription_detail2",
    targetSubscriptionDetail: "tt_subscription_detail",
    targetSubscription: "tt_subscription",
    targetSubscriberTahun: "tt_subscriber_tahun",
  });
  const [replaceTarget, setReplaceTarget] = useState(false);
  const [patchScope, setPatchScope] = useState<"all" | "subscription">("all");
  const [fillMissingInactive, setFillMissingInactive] = useState(false);
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);
  const [unverifiedSearch, setUnverifiedSearch] = useState("");
  const [verifySelections, setVerifySelections] = useState<Record<string, string>>({});

  const latestQuery = useQuery({
    queryKey: ["patch-latest"],
    queryFn: fetchLatestPatchJob,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!jobId && latestQuery.data?.id) setJobId(latestQuery.data.id);
  }, [jobId, latestQuery.data?.id]);

  const jobQuery = useQuery({
    queryKey: ["patch-job", jobId],
    queryFn: () => fetchPatchJob(jobId || ""),
    enabled: Boolean(jobId),
    refetchInterval: (query) => query.state.data?.status === "running" ? 1500 : false,
    refetchOnWindowFocus: false,
  });

  const job = jobQuery.data || latestQuery.data || null;
  const isRunning = job?.status === "running";
  const unverifiedQuery = useQuery({
    queryKey: ["patch-subscription-unverified", unverifiedSearch],
    queryFn: () => fetchUnverifiedSubscriptionPatchRows({ search: unverifiedSearch || undefined, limit: 500 }),
    refetchOnWindowFocus: false,
  });
  const { data: subscribers = [] } = useQuery({
    queryKey: ["patch-subscribers-all"],
    queryFn: () => fetchSubscribers(true),
    refetchOnWindowFocus: false,
  });
  const hasBlankCollection = patchScope === "subscription"
    ? [
        collections.sourceSubscriptionDetail,
        collections.targetSubscriptionDetail,
        collections.targetSubscription,
        collections.targetSubscriberTahun,
      ].some((value) => !value.trim())
    : Object.values(collections).some((value) => !value.trim());
  const updateCollection = (key: keyof typeof collections, value: string) => {
    setCollections((current) => ({ ...current, [key]: value }));
  };

  const mutation = useMutation({
    mutationFn: startPatchJob,
    onSuccess: (response) => {
      setJobId(response.job.id);
      toast.success(response.message);
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || "Gagal menjalankan patch.");
    },
  });

  const verifyMutation = useMutation({
    mutationFn: ({ row, subscriberId }: { row: UnverifiedSubscriptionPatchRow; subscriberId: string }) =>
      verifySubscriptionDetail({ periode: row.periode, itemId: row._id, subscriber_id: subscriberId }),
    onSuccess: (response) => {
      toast.success(response?.message || "Subscription berhasil diverifikasi.");
      qc.invalidateQueries({ queryKey: ["patch-subscription-unverified"] });
      qc.invalidateQueries({ queryKey: ["tt-vps-details-search"] });
    },
    onError: (error: any) => {
      toast.error(error?.response?.data?.message || error?.message || "Gagal verifikasi subscription.");
    },
  });

  const runPatch = (apply: boolean) => {
    mutation.mutate({
      apply,
      scope: patchScope,
      sourceSuffix: "",
      targetSuffix: "",
      replaceTarget,
      fillMissingInactive,
      collections,
    });
  };

  const formatDate = (value: string) => {
    if (!value) return "-";
    const [year, month, day] = value.slice(0, 10).split("-");
    return year && month && day ? `${day}/${month}/${year}` : value;
  };

  const currency = (value: number) => new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    maximumFractionDigits: 0,
  }).format(value || 0);

  const subscriberOptions = subscribers.map((subscriber) => ({
    value: subscriber._id,
    label: `${subscriber.kode || "-"} - ${subscriber.toko}${subscriber.program ? ` (${subscriber.program})` : ""}`,
  }));

  const setVerifySelection = (rowId: string, subscriberId: string) => {
    setVerifySelections((current) => ({ ...current, [rowId]: subscriberId }));
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-blue-50 p-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-4xl font-bold text-gray-900">Maintenance Patch Data</h1>
            <p className="mt-2 text-gray-600">Patch data legacy ke struktur subscriber dan subscription baru.</p>
          </div>
          {job && (
            <Badge className={`w-fit px-3 py-1 text-sm ${statusClass[job.status]}`}>
              {job.status.toUpperCase()} · {job.mode}
            </Badge>
          )}
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <Database className="h-6 w-6 text-blue-600" />
              Konfigurasi Collection
            </CardTitle>
            <CardDescription>
              Pilih patch semua data atau hanya rebuild subscription dari detail lama.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="flex flex-wrap gap-3 rounded-lg border bg-slate-50 p-3">
              <Button
                type="button"
                variant={patchScope === "all" ? "default" : "outline"}
                onClick={() => setPatchScope("all")}
                disabled={isRunning}
                className={patchScope === "all" ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                Semua Data
              </Button>
              <Button
                type="button"
                variant={patchScope === "subscription" ? "default" : "outline"}
                onClick={() => setPatchScope("subscription")}
                disabled={isRunning}
                className={patchScope === "subscription" ? "bg-blue-600 hover:bg-blue-700" : ""}
              >
                Subscription Saja
              </Button>
              <p className="flex min-w-[240px] items-center text-sm text-slate-500">
                {patchScope === "subscription"
                  ? "Hanya rebuild detail, rekap bulanan, dan rekap subscriber tahunan."
                  : "Jalankan urutan patch lengkap dari master sampai subscription."}
              </p>
            </div>

            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[1fr_1fr] gap-4 border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 md:grid-cols-[180px_1fr_1fr]">
                <div className="hidden md:block">Data</div>
                <div>Collection Awal</div>
                <div>Target Collection</div>
              </div>

              <div className="grid gap-4 border-b px-4 py-4 md:grid-cols-[180px_1fr_1fr] md:items-center">
                <Label className="font-semibold text-slate-700">Program</Label>
                <Input value={collections.sourceProgram} onChange={(event) => updateCollection("sourceProgram", event.target.value)} disabled={isRunning || patchScope === "subscription"} />
                <Input value={collections.targetProgram} onChange={(event) => updateCollection("targetProgram", event.target.value)} disabled={isRunning || patchScope === "subscription"} />
              </div>

              <div className="grid gap-4 border-b px-4 py-4 md:grid-cols-[180px_1fr_1fr] md:items-center">
                <Label className="font-semibold text-slate-700">Subscriber</Label>
                <Input value={collections.sourceSubscriber} onChange={(event) => updateCollection("sourceSubscriber", event.target.value)} disabled={isRunning || patchScope === "subscription"} />
                <Input value={collections.targetSubscriber} onChange={(event) => updateCollection("targetSubscriber", event.target.value)} disabled={isRunning || patchScope === "subscription"} />
              </div>

              <div className="grid gap-4 px-4 py-4 md:grid-cols-[180px_1fr_1fr] md:items-center">
                <Label className="font-semibold text-slate-700">Subscription Detail</Label>
                <Input value={collections.sourceSubscriptionDetail} onChange={(event) => updateCollection("sourceSubscriptionDetail", event.target.value)} disabled={isRunning} />
                <Input value={collections.targetSubscriptionDetail} onChange={(event) => updateCollection("targetSubscriptionDetail", event.target.value)} disabled={isRunning} />
              </div>
            </div>

            <div className="rounded-lg border bg-slate-50 p-4">
              <div className="mb-3 text-sm font-semibold text-slate-700">Dibuat otomatis dari Subscription Detail</div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Rekap Bulanan</Label>
                  <Input value={collections.targetSubscription} onChange={(event) => updateCollection("targetSubscription", event.target.value)} disabled={isRunning} />
                </div>
                <div className="space-y-2">
                  <Label>Rekap Subscriber Tahunan</Label>
                  <Input value={collections.targetSubscriberTahun} onChange={(event) => updateCollection("targetSubscriberTahun", event.target.value)} disabled={isRunning} />
                </div>
              </div>
              <p className="mt-3 text-sm text-slate-500">
                User tidak perlu memilih source untuk dua rekap ini. Sistem akan menghitung ulang dari target subscription detail.
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium text-slate-700">
                <Checkbox className="mt-0.5" checked={replaceTarget} onCheckedChange={(value) => setReplaceTarget(Boolean(value))} disabled={isRunning} />
                <span>
                  <span className="block">Kosongkan target subscription sebelum apply</span>
                  <span className="block pt-1 text-xs font-normal text-slate-500">
                    Dipakai untuk patch ulang detail, rekap bulanan, dan rekap tahunan agar tidak double.
                  </span>
                </span>
              </label>

              <label className="flex items-start gap-3 rounded-lg border px-4 py-3 text-sm font-medium text-slate-700">
                <Checkbox className="mt-0.5" checked={fillMissingInactive} onCheckedChange={(value) => setFillMissingInactive(Boolean(value))} disabled={isRunning} />
                <span>
                  <span className="block">Isi gap lama sebagai nonaktif</span>
                  <span className="block pt-1 text-xs font-normal text-slate-500">
                    Opsional. Gunakan hanya kalau dry-run menunjukkan gap yang memang perlu ditutup.
                  </span>
                </span>
              </label>
            </div>

            <div className="flex flex-wrap gap-3">
              <Button variant="outline" onClick={() => runPatch(false)} disabled={isRunning || mutation.isPending || hasBlankCollection}>
                <Play className="mr-2 h-4 w-4" />
                Dry Run
              </Button>
              <Button onClick={() => setConfirmApplyOpen(true)} disabled={isRunning || mutation.isPending || hasBlankCollection} className="bg-blue-600 hover:bg-blue-700">
                <ShieldCheck className="mr-2 h-4 w-4" />
                Apply Patch
              </Button>
              <Button variant="ghost" onClick={() => jobQuery.refetch()} disabled={!jobId}>
                <RefreshCw className="mr-2 h-4 w-4" />
                Refresh
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-2xl">
              <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              Verifikasi Hasil Patch Subscription
            </CardTitle>
            <CardDescription>
              Data yang belum ketemu relasi subscriber tidak ikut rekap bulanan/tahunan sampai diverifikasi di sini.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="w-full md:max-w-md">
                <Label>Cari Data</Label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <Input
                    value={unverifiedSearch}
                    onChange={(event) => setUnverifiedSearch(event.target.value)}
                    placeholder="Cari toko/program/chain id..."
                    className="pl-9"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge className="bg-amber-100 px-3 py-1 text-amber-700">
                  {unverifiedQuery.data?.total || 0} belum verifikasi
                </Badge>
                <Button type="button" variant="outline" onClick={() => unverifiedQuery.refetch()} disabled={unverifiedQuery.isFetching}>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Refresh
                </Button>
              </div>
            </div>

            <div className="overflow-x-auto rounded-lg border">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-700">
                  <tr>
                    <th className="px-4 py-3">Source Legacy</th>
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Kandidat</th>
                    <th className="px-4 py-3 min-w-[340px]">Verifikasi Ke Subscriber</th>
                    <th className="px-4 py-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {(unverifiedQuery.data?.data || []).map((row) => {
                    const selectedSubscriberId = verifySelections[row._id] || "";
                    const candidateText = row.candidates.length
                      ? row.candidates.map((candidate) => `${candidate.kode} - ${candidate.toko}`).join(", ")
                      : "-";
                    return (
                      <tr key={row._id} className="border-t bg-amber-50/40 align-top">
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900">{row.patch_source_toko || row.toko}</div>
                          <div className="mt-1 text-slate-600">{row.patch_source_program || row.program}</div>
                          <div className="mt-1 text-xs text-slate-500">Chain: {row.chain_id}</div>
                          {row.patch_match_reason && (
                            <div className="mt-1 text-xs text-amber-700">{row.patch_match_reason}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap">
                          <div>{formatDate(row.start)} - {formatDate(row.tempo)}</div>
                          <div className="text-xs text-slate-500">{row.bulan} bulan · {currency(row.total_harga)}</div>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex flex-wrap gap-2">
                            <Badge className="bg-slate-200 text-slate-700">{row.status}</Badge>
                            {!row.is_active && <Badge className="bg-red-100 text-red-700">Nonaktif</Badge>}
                          </div>
                        </td>
                        <td className="max-w-[260px] px-4 py-3 text-xs text-slate-600">
                          {candidateText}
                        </td>
                        <td className="px-4 py-3">
                          <SearchableSelect
                            value={selectedSubscriberId}
                            onValueChange={(value) => setVerifySelection(row._id, value)}
                            options={subscriberOptions}
                            placeholder="Pilih subscriber..."
                            searchPlaceholder="Cari subscriber..."
                          />
                        </td>
                        <td className="px-4 py-3">
                          <Button
                            type="button"
                            size="sm"
                            disabled={!selectedSubscriberId || verifyMutation.isPending}
                            onClick={() => verifyMutation.mutate({ row, subscriberId: selectedSubscriberId })}
                            className="bg-emerald-600 hover:bg-emerald-700"
                          >
                            Verifikasi
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
                  {!unverifiedQuery.isLoading && !(unverifiedQuery.data?.data || []).length && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Tidak ada data subscription yang belum diverifikasi.
                      </td>
                    </tr>
                  )}
                  {unverifiedQuery.isLoading && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        Memuat data...
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-2xl">Log Patch</CardTitle>
            <CardDescription>
              {job ? `Job ${job.id} · ${job.scope === "subscription" ? "Subscription Saja" : "Semua Data"} · mulai ${new Date(job.startedAt).toLocaleString("id-ID")}` : "Belum ada job patch."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="max-h-[520px] overflow-auto rounded-lg bg-slate-950 p-4 text-sm leading-6 text-slate-100">
              {job?.output || "Belum ada output."}
            </pre>
          </CardContent>
        </Card>
      </div>

      <AlertDialog open={confirmApplyOpen} onOpenChange={setConfirmApplyOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Jalankan Apply Patch?
            </AlertDialogTitle>
            <AlertDialogDescription>
              {patchScope === "subscription"
                ? "Patch hanya akan rebuild subscription detail, rekap bulanan, dan rekap subscriber tahunan dari collection awal subscription detail."
                : "Patch akan dijalankan berurutan dari collection awal ke target collection yang sudah diisi di form."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction onClick={() => runPatch(true)} className="bg-blue-600 hover:bg-blue-700">
              Apply Patch
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
