import { Router } from 'express';
import multer, { StorageEngine } from 'multer';
import {
  listBudgets, createBudget, updateBudget, deleteBudget,
  listBudgetUsages, createBudgetUsage, updateBudgetUsage, deleteBudgetUsage
} from '../controllers/budgetController';
import { authenticate } from '../middleware/authMiddleware';

const router = Router();

// Configure multer for file uploads
const storage: StorageEngine = multer.diskStorage({
  destination: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, destination: string) => void) => {
    cb(null, 'uploads/budgets/');
  },
  filename: (req: Express.Request, file: Express.Multer.File, cb: (error: Error | null, filename: string) => void) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + '.' + file.mimetype.split('/')[1]);
  }
});

const upload = multer({ storage });

// Budget routes
router.get('/budgets', listBudgets);
router.post('/budgets', authenticate, createBudget);
router.put('/budgets/:id', authenticate, updateBudget);
router.delete('/budgets/:id', authenticate, deleteBudget);

// Budget Usage routes
router.get('/budget-usages', listBudgetUsages);
router.post('/budget-usages', authenticate, upload.single('attachment'), createBudgetUsage);
router.put('/budget-usages/:id', authenticate, upload.single('attachment'), updateBudgetUsage);
router.delete('/budget-usages/:id', authenticate, deleteBudgetUsage);

export default router;