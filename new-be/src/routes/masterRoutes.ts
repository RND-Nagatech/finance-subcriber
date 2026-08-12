import { Router } from 'express';
import bankRoutes from './bankRoutes';
import perusahaanRoutes from './perusahaanRoutes';
import rekeningRoutes from './rekeningRoutes';
import {
  listProgram, createProgram, updateProgram, deleteProgram,
} from '../controllers/masterController';
import {
  createGroup,
  deleteGroup,
  listGroup,
  listGroupOptions,
  updateGroup,
} from '../controllers/groupController';
import {
  createGroupProgram,
  deleteGroupProgram,
  listGroupProgram,
  listGroupProgramOptions,
  updateGroupProgram,
} from '../controllers/groupProgramController';
import { authenticate } from '../middleware/authMiddleware';
const router = Router();

// Program routes
router.get('/program', listProgram);
router.post('/program', authenticate, createProgram);
router.put('/program/:id', authenticate, updateProgram);
router.delete('/program/:id', authenticate, deleteProgram);

// Group routes
router.get('/group', listGroup);
router.get('/group/options', listGroupOptions);
router.post('/group', authenticate, createGroup);
router.put('/group/:id', authenticate, updateGroup);
router.delete('/group/:id', authenticate, deleteGroup);

// Group Program routes
router.get('/group-program', listGroupProgram);
router.get('/group-program/options', listGroupProgramOptions);
router.post('/group-program', authenticate, createGroupProgram);
router.put('/group-program/:id', authenticate, updateGroupProgram);
router.delete('/group-program/:id', authenticate, deleteGroupProgram);

router.use('/bank', bankRoutes);
router.use('/perusahaan', perusahaanRoutes);
router.use('/rekening', rekeningRoutes);

export default router;
