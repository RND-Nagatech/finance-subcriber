import { Request, Response } from 'express';
import { spawn } from 'child_process';
import crypto from 'crypto';
import path from 'path';

type PatchJob = {
  id: string;
  status: 'running' | 'done' | 'error';
  mode: 'DRY_RUN' | 'APPLY';
  sourceSuffix: string;
  targetSuffix: string;
  replaceTarget: boolean;
  collections?: Record<string, string>;
  startedAt: string;
  finishedAt?: string;
  exitCode?: number | null;
  output: string;
  error?: string;
};

const jobs = new Map<string, PatchJob>();
let runningJobId: string | null = null;

const isSuperuser = (req: Request) => {
  const user = req.user as any;
  return user?.role === 'superuser';
};

const appendOutput = (job: PatchJob, chunk: Buffer) => {
  job.output += chunk.toString('utf8');
  if (job.output.length > 250_000) {
    job.output = job.output.slice(job.output.length - 250_000);
  }
};

const getProjectRoot = () => path.resolve(__dirname, '..', '..', '..');

export const startPatchJob = (req: Request, res: Response) => {
  if (!isSuperuser(req)) return res.status(403).json({ message: 'Hanya superuser yang boleh menjalankan patch data.' });
  if (runningJobId) {
    const running = jobs.get(runningJobId);
    return res.status(409).json({ message: 'Patch masih berjalan. Tunggu sampai selesai dulu.', job: running });
  }

  const apply = Boolean(req.body?.apply);
  const sourceSuffix = String(req.body?.sourceSuffix ?? '2').trim();
  const targetSuffix = String(req.body?.targetSuffix ?? '').trim();
  const replaceTarget = Boolean(req.body?.replaceTarget);
  const collections = {
    sourceProgram: String(req.body?.collections?.sourceProgram || '').trim(),
    targetProgram: String(req.body?.collections?.targetProgram || '').trim(),
    sourceSubscriber: String(req.body?.collections?.sourceSubscriber || '').trim(),
    targetSubscriber: String(req.body?.collections?.targetSubscriber || '').trim(),
    sourceSubscriptionDetail: String(req.body?.collections?.sourceSubscriptionDetail || '').trim(),
    targetSubscriptionDetail: String(req.body?.collections?.targetSubscriptionDetail || '').trim(),
    targetSubscription: String(req.body?.collections?.targetSubscription || '').trim(),
    targetSubscriberTahun: String(req.body?.collections?.targetSubscriberTahun || '').trim(),
  };
  const id = crypto.randomUUID();
  const job: PatchJob = {
    id,
    status: 'running',
    mode: apply ? 'APPLY' : 'DRY_RUN',
    sourceSuffix,
    targetSuffix,
    replaceTarget,
    collections,
    startedAt: new Date().toISOString(),
    output: '',
  };

  jobs.set(id, job);
  runningJobId = id;

  const root = getProjectRoot();
  const args = [
    path.join(root, 'script-patch', 'run-patch-all.sh'),
    `--source-suffix=${sourceSuffix}`,
    `--target-suffix=${targetSuffix}`,
  ];
  if (apply) args.push('--apply');
  if (replaceTarget) args.push('--replace-target');
  if (collections.sourceProgram) args.push(`--source-tm_program=${collections.sourceProgram}`);
  if (collections.targetProgram) args.push(`--target-tm_program=${collections.targetProgram}`);
  if (collections.sourceSubscriber) args.push(`--source-tm_subscriber=${collections.sourceSubscriber}`);
  if (collections.targetSubscriber) args.push(`--target-tm_subscriber=${collections.targetSubscriber}`);
  if (collections.sourceSubscriptionDetail) args.push(`--source-tt_subscription_detail=${collections.sourceSubscriptionDetail}`);
  if (collections.targetSubscriptionDetail) args.push(`--target-tt_subscription_detail=${collections.targetSubscriptionDetail}`);
  if (collections.targetSubscription) args.push(`--target-tt_subscription=${collections.targetSubscription}`);
  if (collections.targetSubscriberTahun) args.push(`--target-tt_subscriber_tahun=${collections.targetSubscriberTahun}`);

  const child = spawn('bash', args, {
    cwd: root,
    env: {
      ...process.env,
      PATCH_SOURCE_SUFFIX: sourceSuffix,
      PATCH_TARGET_SUFFIX: targetSuffix,
    },
  });

  child.stdout.on('data', (chunk) => appendOutput(job, chunk));
  child.stderr.on('data', (chunk) => appendOutput(job, chunk));
  child.on('error', (error) => {
    job.status = 'error';
    job.error = error.message;
    job.finishedAt = new Date().toISOString();
    runningJobId = null;
  });
  child.on('close', (code) => {
    job.exitCode = code;
    job.status = code === 0 ? 'done' : 'error';
    job.finishedAt = new Date().toISOString();
    runningJobId = null;
  });

  res.status(202).json({ message: `Patch ${job.mode} dimulai.`, job });
};

export const getPatchJob = (req: Request, res: Response) => {
  if (!isSuperuser(req)) return res.status(403).json({ message: 'Hanya superuser yang boleh melihat patch data.' });
  const id = String(req.params.id || '');
  const job = jobs.get(id);
  if (!job) return res.status(404).json({ message: 'Job patch tidak ditemukan.' });
  res.json(job);
};

export const getLatestPatchJob = (req: Request, res: Response) => {
  if (!isSuperuser(req)) return res.status(403).json({ message: 'Hanya superuser yang boleh melihat patch data.' });
  const latest = [...jobs.values()].sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0] || null;
  res.json(latest);
};
