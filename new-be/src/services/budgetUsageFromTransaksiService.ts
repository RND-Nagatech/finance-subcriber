import mongoose from 'mongoose';
import Akun from '../models/Akun';
import Budget from '../models/Budget';
import BudgetUsage from '../models/BudgetUsage';

interface CreateParams {
  doc: any;
  actor: string;
}

interface RollbackParams {
  transaksiId: string | mongoose.Types.ObjectId;
  actor: string;
}

export function shouldCreateBudgetUsageFromTransaksi(doc: any): boolean {
  if (!doc) return false;
  if (String(doc.kategori || '') === 'PENDAPATAN') return false;
  if (Number(doc.nilai || 0) <= 0) return false;
  return true;
}

function normalizeActor(actor?: string): string {
  return String(actor || 'SYSTEM');
}

function buildDescription(doc: any): string {
  const base = `AUTO VALIDASI ${doc.kategori || ''}/${doc.sub_kategori || ''}/${doc.akun || ''}`.trim();
  const ket = String(doc.keterangan || '').trim();
  if (!ket) return base;
  return `${base} - ${ket}`;
}

async function resolveAkunByTransaksi(doc: any) {
  if (!doc?.akun) return null;
  return Akun.findOne({
    akun: String(doc.akun),
    $or: [{ status_aktv: true }, { active: true }],
  })
    .sort({ update_date: -1, input_date: -1, _id: -1 })
    .lean();
}

export async function createBudgetUsageFromValidatedTransaksi(params: CreateParams): Promise<void> {
  const doc = params.doc;
  if (!shouldCreateBudgetUsageFromTransaksi(doc)) return;

  const akun = await resolveAkunByTransaksi(doc);
  const budgetId = (akun as any)?.budget_id;
  if (!budgetId) return;

  const budget = await Budget.findOne({
    _id: budgetId,
    $or: [{ status_aktv: true }, { active: true }],
  });
  if (!budget) {
    throw new Error('Budget relasi akun tidak ditemukan atau tidak aktif.');
  }

  const sourceRefId = new mongoose.Types.ObjectId(String(doc._id));

  const existed = await BudgetUsage.findOne({
    source_type: 'TRANSAKSI_VALIDATION',
    source_ref_id: sourceRefId,
    active: true,
  }).lean();
  if (existed) return;

  const actor = normalizeActor(params.actor);
  const amountUsed = Number(doc.nilai || 0);

  try {
    await BudgetUsage.create({
      budget_id: budget._id,
      amount_used: amountUsed,
      description: buildDescription(doc),
      usage_date: new Date(String(doc.tanggal)),
      status_aktv: true,
      active: true,
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: actor,
      update_by: null,
      delete_by: null,
      source_type: 'TRANSAKSI_VALIDATION',
      source_ref_id: sourceRefId,
      source_ref_model: 'TtFinanceDetail',
      reversed_at: null,
      reversed_by: null,
    });
  } catch (err: any) {
    if (err?.code === 11000) return;
    throw err;
  }

  budget.used_amount = Number(budget.used_amount || 0) + amountUsed;
  budget.update_date = new Date();
  budget.update_by = actor;
  await budget.save();
}

export async function rollbackBudgetUsageFromValidatedTransaksi(params: RollbackParams): Promise<void> {
  const sourceRefId = new mongoose.Types.ObjectId(String(params.transaksiId));
  const actor = normalizeActor(params.actor);

  const usage = await BudgetUsage.findOne({
    source_type: 'TRANSAKSI_VALIDATION',
    source_ref_id: sourceRefId,
    active: true,
  });

  if (!usage) return;

  const budget = await Budget.findById(usage.budget_id);
  if (budget) {
    budget.used_amount = Number(budget.used_amount || 0) - Number(usage.amount_used || 0);
    budget.update_date = new Date();
    budget.update_by = actor;
    await budget.save();
  }

  usage.status_aktv = false;
  (usage as any).active = false;
  usage.delete_date = new Date();
  (usage as any).deleted_at = new Date();
  usage.delete_by = actor;
  (usage as any).deleted_by = actor;
  usage.update_date = new Date();
  usage.update_by = actor;
  (usage as any).reversed_at = new Date();
  (usage as any).reversed_by = actor;
  await usage.save();
}
