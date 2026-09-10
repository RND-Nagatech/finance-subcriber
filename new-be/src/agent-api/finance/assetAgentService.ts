import Asset from '../../models/Asset';
import AssetType from '../../models/AssetType';
import AssetLedger from '../../models/AssetLedger';
import AssetTransfer from '../../models/AssetTransfer';
import { AgentHttpError } from '../common/agentTypes';
import { AgentQuery, objectIdOrThrow } from '../common/query';

function publicDoc(row: any) {
  const { _id, __v, ...rest } = row;
  return { id: String(_id), ...rest };
}

function assetView(asset: any) {
  const type = asset.asset_type_id || {};
  const qty = Number(asset.qty || 0);
  const purchaseValue = qty * Number(asset.harga_beli_per_unit || 0);
  const currentValue = qty * Number(type.current_price || 0);
  return { ...publicDoc(asset), assetType: type._id ? { id: String(type._id), code: type.code, name: type.name, unit: type.unit, currentPrice: Number(type.current_price || 0) } : null, quantity: qty, purchaseUnitPrice: Number(asset.harga_beli_per_unit || 0), currentUnitPrice: Number(type.current_price || 0), purchaseValue, currentValue, growthAmount: currentValue - purchaseValue, growthPercent: purchaseValue > 0 ? ((currentValue - purchaseValue) / purchaseValue) * 100 : 0, currency: 'IDR' };
}

export async function listAssets(query: AgentQuery, includeInactive: boolean) {
  const filter: any = includeInactive ? {} : { status_aktv: { $ne: false } };
  if (query.search) { const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); filter.$or = [{ asset_code: rx }, { asset_name: rx }, { kode_perusahaan: rx }, { nama_perusahaan: rx }]; }
  const [totalItems, rows] = await Promise.all([
    Asset.countDocuments(filter),
    Asset.find(filter).populate('asset_type_id').sort({ [query.sortBy || 'asset_code']: query.sortOrder, _id: query.sortOrder }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
  ]);
  return { items: rows.map(assetView), totalItems };
}

export async function getAssetSummary() {
  const rows = await Asset.find({ status_aktv: { $ne: false } }).populate('asset_type_id').lean();
  const byType: Record<string, any> = {};
  let purchaseValue = 0; let currentValue = 0;
  for (const asset of rows as any[]) {
    const view = assetView(asset); purchaseValue += view.purchaseValue; currentValue += view.currentValue;
    const type = view.assetType || { code: 'UNKNOWN', name: 'UNKNOWN', unit: '' }; const key = type.code;
    byType[key] ||= { code: key, name: type.name, unit: type.unit, quantity: 0, purchaseValue: 0, currentValue: 0 };
    byType[key].quantity += view.quantity; byType[key].purchaseValue += view.purchaseValue; byType[key].currentValue += view.currentValue;
  }
  const growthAmount = currentValue - purchaseValue;
  return { currency: 'IDR', totalPurchaseValue: purchaseValue, totalCurrentValue: currentValue, growthAmount, growthPercent: purchaseValue > 0 ? (growthAmount / purchaseValue) * 100 : 0, byType: Object.values(byType).map((row: any) => ({ ...row, growthAmount: row.currentValue - row.purchaseValue, growthPercent: row.purchaseValue > 0 ? ((row.currentValue - row.purchaseValue) / row.purchaseValue) * 100 : 0 })), dataAsOf: new Date().toISOString() };
}

export async function getAsset(id: string) {
  objectIdOrThrow(id, 'assetId');
  const asset = await Asset.findById(id).populate('asset_type_id').lean();
  if (!asset) throw new AgentHttpError(404, 'NOT_FOUND', 'Asset not found');
  return assetView(asset);
}

export async function listAssetTypes(query: AgentQuery) {
  const filter: any = { status_aktv: { $ne: false } };
  if (query.search) { const rx = new RegExp(query.search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'); filter.$or = [{ code: rx }, { name: rx }]; }
  const [totalItems, rows] = await Promise.all([AssetType.countDocuments(filter), AssetType.find(filter).sort({ code: query.sortOrder, _id: query.sortOrder }).skip((query.page - 1) * query.limit).limit(query.limit).lean()]);
  return { items: rows.map((row: any) => ({ id: String(row._id), code: row.code, name: row.name, unit: row.unit, currentPrice: Number(row.current_price || 0), currency: 'IDR' })), totalItems };
}

export async function listAssetLedger(id: string | undefined, query: AgentQuery) {
  const filter: any = id ? { asset_id: objectIdOrThrow(id, 'assetId') } : {};
  const [totalItems, rows] = await Promise.all([AssetLedger.countDocuments(filter), AssetLedger.find(filter).sort({ [query.sortBy || 'created_at']: query.sortOrder, _id: query.sortOrder }).skip((query.page - 1) * query.limit).limit(query.limit).lean()]);
  return { items: rows.map((row: any) => ({ ...publicDoc(row), assetId: String(row.asset_id), referenceId: row.ref_id ? String(row.ref_id) : null, currency: 'IDR' })), totalItems };
}

export async function listAssetTransfers(query: AgentQuery) {
  const [totalItems, rows] = await Promise.all([AssetTransfer.countDocuments({}), AssetTransfer.find({}).sort({ [query.sortBy || 'tanggal']: query.sortOrder, _id: query.sortOrder }).skip((query.page - 1) * query.limit).limit(query.limit).lean()]);
  return { items: rows.map((row: any) => ({ ...publicDoc(row), rekeningId: String(row.rekening_id), assetId: String(row.asset_id), currency: 'IDR' })), totalItems };
}
