import axiosInstance from './axiosInstance';

export interface Budget {
  _id?: string;
  name: string;
  year: number;
  total_amount: number;
  used_amount: number;
  status_aktv?: boolean;
  input_date?: string;
  update_date?: string;
  delete_date?: string | null;
  input_by: string;
  update_by?: string | null;
  delete_by?: string | null;
}

export interface BudgetUsage {
  _id?: string;
  budget_id: string | Budget;
  amount_used: number;
  description: string;
  attachment?: string;
  usage_date: string;
  status_aktv?: boolean;
  input_date?: string;
  update_date?: string;
  delete_date?: string | null;
  input_by: string;
  update_by?: string | null;
  delete_by?: string | null;
}

export async function fetchBudgets() {
  const res = await axiosInstance.get('/budget/budgets');
  return res.data?.data ?? [];
}

export async function createBudget(data: Omit<Budget, '_id' | 'used_amount' | 'status_aktv' | 'input_date' | 'update_date' | 'delete_date' | 'input_by' | 'update_by' | 'delete_by'>) {
  const res = await axiosInstance.post('/budget/budgets', data);
  return res.data;
}

export async function updateBudget(id: string, data: Partial<Omit<Budget, '_id' | 'used_amount' | 'status_aktv' | 'input_date' | 'update_date' | 'delete_date' | 'input_by' | 'update_by' | 'delete_by'>>) {
  const res = await axiosInstance.put(`/budget/budgets/${id}`, data);
  return res.data;
}

export async function deleteBudget(id: string) {
  const res = await axiosInstance.delete(`/budget/budgets/${id}`);
  return res.data;
}

export async function fetchBudgetUsages(budgetId?: string) {
  const params = budgetId ? `?budget_id=${budgetId}` : '';
  const res = await axiosInstance.get(`/budget/budget-usages${params}`);
  return res.data?.data ?? [];
}

export async function createBudgetUsage(data: Omit<BudgetUsage, '_id' | 'status_aktv' | 'input_date' | 'update_date' | 'delete_date' | 'input_by' | 'update_by' | 'delete_by'>, attachment?: File) {
  const formData = new FormData();
  formData.append('budget_id', data.budget_id as string);
  formData.append('amount_used', data.amount_used.toString());
  formData.append('description', data.description);
  formData.append('usage_date', data.usage_date);
  if (attachment) {
    formData.append('attachment', attachment);
  }

  const res = await axiosInstance.post('/budget/budget-usages', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function updateBudgetUsage(id: string, data: Partial<Omit<BudgetUsage, '_id' | 'status_aktv' | 'input_date' | 'update_date' | 'delete_date' | 'input_by' | 'update_by' | 'delete_by'>>, attachment?: File) {
  const formData = new FormData();
  if (data.amount_used !== undefined) formData.append('amount_used', data.amount_used.toString());
  if (data.description) formData.append('description', data.description);
  if (data.usage_date) formData.append('usage_date', data.usage_date);
  if (attachment) {
    formData.append('attachment', attachment);
  }

  const res = await axiosInstance.put(`/budget/budget-usages/${id}`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
  });
  return res.data;
}

export async function deleteBudgetUsage(id: string) {
  const res = await axiosInstance.delete(`/budget/budget-usages/${id}`);
  return res.data;
}