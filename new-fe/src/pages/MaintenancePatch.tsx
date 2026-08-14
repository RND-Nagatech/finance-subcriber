import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Database, Play, RefreshCw, ShieldCheck } from "lucide-react";
import { toast } from "react-toastify";

import { fetchLatestPatchJob, fetchPatchJob, startPatchJob, type PatchJob } from "@/api/maintenance";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  const [confirmApplyOpen, setConfirmApplyOpen] = useState(false);

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
  const hasBlankCollection = Object.values(collections).some((value) => !value.trim());
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

  const runPatch = (apply: boolean) => {
    mutation.mutate({
      apply,
      sourceSuffix: "",
      targetSuffix: "",
      replaceTarget,
      collections,
    });
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
            <CardDescription>Urutan patch dikunci dari backend agar tidak dijalankan dobel.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="overflow-hidden rounded-lg border">
              <div className="grid grid-cols-[1fr_1fr] gap-4 border-b bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 md:grid-cols-[180px_1fr_1fr]">
                <div className="hidden md:block">Data</div>
                <div>Collection Awal</div>
                <div>Target Collection</div>
              </div>

              <div className="grid gap-4 border-b px-4 py-4 md:grid-cols-[180px_1fr_1fr] md:items-center">
                <Label className="font-semibold text-slate-700">Program</Label>
                <Input value={collections.sourceProgram} onChange={(event) => updateCollection("sourceProgram", event.target.value)} disabled={isRunning} />
                <Input value={collections.targetProgram} onChange={(event) => updateCollection("targetProgram", event.target.value)} disabled={isRunning} />
              </div>

              <div className="grid gap-4 border-b px-4 py-4 md:grid-cols-[180px_1fr_1fr] md:items-center">
                <Label className="font-semibold text-slate-700">Subscriber</Label>
                <Input value={collections.sourceSubscriber} onChange={(event) => updateCollection("sourceSubscriber", event.target.value)} disabled={isRunning} />
                <Input value={collections.targetSubscriber} onChange={(event) => updateCollection("targetSubscriber", event.target.value)} disabled={isRunning} />
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

            <label className="flex w-fit items-center gap-3 rounded-lg border px-4 py-3 text-sm font-medium text-slate-700">
              <Checkbox checked={replaceTarget} onCheckedChange={(value) => setReplaceTarget(Boolean(value))} disabled={isRunning} />
              Replace ulang data subscription target saat apply
            </label>

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
            <CardTitle className="text-2xl">Log Patch</CardTitle>
            <CardDescription>
              {job ? `Job ${job.id} · mulai ${new Date(job.startedAt).toLocaleString("id-ID")}` : "Belum ada job patch."}
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
              Patch akan dijalankan berurutan dari collection awal ke target collection yang sudah diisi di form.
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
