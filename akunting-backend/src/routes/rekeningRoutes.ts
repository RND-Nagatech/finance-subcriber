import { Router } from 'express';
import { getAllRekenings, getRekeningById, createRekening, updateRekening, deleteRekening } from '../controllers/rekeningController';

const router = Router();

router.get('/', getAllRekenings);
router.get('/:id', getRekeningById);
router.post('/', createRekening);
router.put('/:id', updateRekening);
router.delete('/:id', deleteRekening);

export default router;
