import Transaksi from '../models/Transaksi';
import { Model } from 'mongoose';

type CheckResult = {
  canDelete: boolean;
  reason?: string;
};

/**
 * Generic helper to check whether a master record can be soft-deleted.
 * - Checks for active transactions referencing the master (by transactionField)
 * - Checks for active child records (childModel) where childField equals parentValue and status_aktv === true
 *
 * Both checks ignore soft-deleted/ inactive child records (status_aktv: false).
 */
export async function canSoftDeleteMaster(options: {
  parentLabel: string; // e.g. 'Kategori'
  parentValue: any | any[]; // value(s) to check in child/transaction refs (usually name or _id)
  transactionField?: string; // field in Transaksi to check (e.g. 'akun','kategori','sub_kategori')
  childModel?: Model<any>; // Mongoose model for child (e.g. SubKategori)
  childField?: string; // child model field that references parent (e.g. 'kategori', 'sub_kategori')
}): Promise<CheckResult> {
  const { parentLabel, parentValue, transactionField, childModel, childField } = options;

  // 1) Check active transactions referencing this master
  if (transactionField) {
    const values = Array.isArray(parentValue) ? parentValue : [parentValue];
    // Build OR queries for exact and stringified forms
    const ors: any[] = [];
    for (const v of values) {
      ors.push({ [transactionField]: v });
      ors.push({ [transactionField]: String(v) });
    }
    const trx = await Transaksi.findOne({ $or: ors }).lean();
    if (trx) return { canDelete: false, reason: `Terdapat transaksi aktif yang mereferensi ${parentLabel}` };
  }

  // 2) Check active child records (status_aktv: true)
  if (childModel && childField) {
    const values = Array.isArray(parentValue) ? parentValue : [parentValue];
    // child is considered active if status_aktv === true OR active === true
    // and also should not be already soft-deleted (delete_date or deleted_at is null)
    const activeClause = { $or: [{ status_aktv: true }, { active: true }] };
    const notDeletedClause = {
      $and: [
        { $or: [{ delete_date: null }, { delete_date: { $exists: false } }] },
        { $or: [{ deleted_at: null }, { deleted_at: { $exists: false } }] },
      ],
    };
    const ors: any[] = values.map((v) => ({ [childField]: v }));
    const childFilter = { $and: [{ $or: ors }, activeClause, notDeletedClause] };
    const count = await childModel.countDocuments(childFilter);
    if (count > 0) return { canDelete: false, reason: `Terdapat child ${childModel.modelName} yang aktif` };
  }

  return { canDelete: true };
}

export default canSoftDeleteMaster;
