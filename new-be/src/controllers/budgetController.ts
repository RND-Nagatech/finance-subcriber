// Resolve acting user from authenticated request only. Ignore client-supplied audit fields.
const resolveUserId = (req: Request) => {
  if (req.user && typeof req.user === 'object') {
    return (req.user as any).name || (req.user as any).username || (req.user as any).id || (req.user as any)._id || 'system';
  }
  if (typeof req.user === 'string' && req.user.length > 0) return req.user;
  return 'system';
};

// Return audit user id (prefer numeric/id fields). Used for deleted_by/deleted_at fields.
const getAuditUserId = (req: Request) => {
  if (req.user && typeof req.user === 'object') {
    return String((req.user as any).id || (req.user as any)._id || (req.user as any).username || (req.user as any).name);
  }
  return 'system';
};

import { Request, Response } from 'express';
import multer from 'multer';
import Budget from '../models/Budget';
import BudgetUsage from '../models/BudgetUsage';

// Budget CRUD operations
export const listBudgets = async (req: Request, res: Response) => {
  try {
    const budgets = await Budget.find({ $or: [{ status_aktv: true }, { active: true }] }).sort({ year: -1, name: 1 });
    res.status(200).json({ success: true, data: budgets });
  } catch (error) {
    console.error('❌ Error in listBudgets:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createBudget = async (req: Request, res: Response) => {
  try {
    const { name, year, total_amount } = req.body;
    if (!name || !year || total_amount === undefined) {
      return res.status(400).json({ message: 'name, year, and total_amount are required' });
    }
    const userId = resolveUserId(req);
    const budget = new Budget({
      name,
      year,
      total_amount,
      used_amount: 0,
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: userId,
      update_by: null,
      delete_by: null,
    });

    await budget.save();
    res.status(200).json({ success: true, message: 'Budget berhasil disimpan.', data: budget });
  } catch (error) {
    console.error('❌ Error in createBudget:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateBudget = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, year, total_amount } = req.body;
    if (!name || !year || total_amount === undefined) {
      return res.status(400).json({ message: 'name, year, and total_amount are required' });
    }
    const userId = resolveUserId(req);
    const budget = await Budget.findByIdAndUpdate(
      id,
      {
        name,
        year,
        total_amount,
        update_date: new Date(),
        update_by: userId,
      },
      { new: true }
    );
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    res.status(200).json({ success: true, message: 'Budget berhasil diupdate.', data: budget });
  } catch (error) {
    console.error('❌ Error in updateBudget:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteBudget = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getAuditUserId(req);
    const budget = await Budget.findByIdAndUpdate(
      id,
      {
        status_aktv: false,
        active: false,
        delete_date: new Date(),
        deleted_at: new Date(),
        delete_by: userId,
        deleted_by: userId,
      },
      { new: true }
    );
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    res.status(200).json({ success: true, message: 'Budget berhasil dihapus.', data: budget });
  } catch (error) {
    console.error('❌ Error in deleteBudget:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

// Budget Usage operations
export const listBudgetUsages = async (req: Request, res: Response) => {
  try {
    const { budget_id } = req.query;
    let query: any = { $or: [{ status_aktv: true }, { active: true }] };
    if (budget_id) {
      query.budget_id = budget_id;
    }
    const usages = await BudgetUsage.find(query)
      .populate('budget_id', 'name year')
      .sort({ usage_date: -1 });
    res.status(200).json({ success: true, data: usages });
  } catch (error) {
    console.error('❌ Error in listBudgetUsages:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const createBudgetUsage = async (req: any, res: Response) => {
  try {
    const { budget_id, amount_used, description, usage_date } = req.body;
    if (!budget_id || !amount_used || !description || !usage_date) {
      return res.status(400).json({ message: 'budget_id, amount_used, description, and usage_date are required' });
    }

    // Check if budget exists and has enough remaining amount
    const budget = await Budget.findById(budget_id);
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }
    if (budget.used_amount + amount_used > budget.total_amount) {
      return res.status(400).json({ message: 'Insufficient budget amount' });
    }

    const userId = resolveUserId(req);
    const attachment = req.file ? req.file.path : null;

    const usage = new BudgetUsage({
      budget_id,
      amount_used,
      description,
      attachment,
      usage_date: new Date(usage_date),
      input_date: new Date(),
      update_date: new Date(),
      delete_date: null,
      input_by: userId,
      update_by: null,
      delete_by: null,
    });

    await usage.save();

    // Update budget used_amount
    budget.used_amount += amount_used;
    budget.update_date = new Date();
    budget.update_by = userId;
    await budget.save();

    const populatedUsage = await BudgetUsage.findById(usage._id).populate('budget_id', 'name year');

    res.status(200).json({ success: true, message: 'Budget usage berhasil disimpan.', data: populatedUsage });
  } catch (error) {
    console.error('❌ Error in createBudgetUsage:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const updateBudgetUsage = async (req: any, res: Response) => {
  try {
    const { id } = req.params;
    const { amount_used, description, usage_date } = req.body;
    if (!amount_used || !description || !usage_date) {
      return res.status(400).json({ message: 'amount_used, description, and usage_date are required' });
    }

    const userId = resolveUserId(req);
    const existingUsage = await BudgetUsage.findById(id);
    if (!existingUsage) {
      return res.status(404).json({ message: 'Budget usage not found' });
    }

    const budget = await Budget.findById(existingUsage.budget_id);
    if (!budget) {
      return res.status(404).json({ message: 'Budget not found' });
    }

    // Calculate new used amount for budget
    const oldAmount = existingUsage.amount_used;
    const newUsedAmount = budget.used_amount - oldAmount + amount_used;

    if (newUsedAmount > budget.total_amount) {
      return res.status(400).json({ message: 'Insufficient budget amount' });
    }

    const attachment = req.file ? req.file.path : existingUsage.attachment;

    const usage = await BudgetUsage.findByIdAndUpdate(
      id,
      {
        amount_used,
        description,
        attachment,
        usage_date: new Date(usage_date),
        update_date: new Date(),
        update_by: userId,
      },
      { new: true }
    ).populate('budget_id', 'name year');

    // Update budget used_amount
    budget.used_amount = newUsedAmount;
    budget.update_date = new Date();
    budget.update_by = userId;
    await budget.save();

    res.status(200).json({ success: true, message: 'Budget usage berhasil diupdate.', data: usage });
  } catch (error) {
    console.error('❌ Error in updateBudgetUsage:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};

export const deleteBudgetUsage = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const userId = getAuditUserId(req);
    const usage = await BudgetUsage.findById(id);
    if (!usage) {
      return res.status(404).json({ message: 'Budget usage not found' });
    }

    const budget = await Budget.findById(usage.budget_id);
    if (budget) {
      budget.used_amount -= usage.amount_used;
      budget.update_date = new Date();
      budget.update_by = userId;
      await budget.save();
    }

    await BudgetUsage.findByIdAndUpdate(
      id,
      {
        status_aktv: false,
        active: false,
        delete_date: new Date(),
        deleted_at: new Date(),
        delete_by: userId,
        deleted_by: userId,
      },
      { new: true }
    );

    res.status(200).json({ success: true, message: 'Budget usage berhasil dihapus.' });
  } catch (error) {
    console.error('❌ Error in deleteBudgetUsage:', error);
    res.status(500).json({ message: 'Server error', error });
  }
};