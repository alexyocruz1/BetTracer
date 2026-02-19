import { Router } from 'express';
import { casinoEarningsController } from '../controllers/casino-earnings.controller';
import { authenticate } from '../middleware/auth';
import { validateRequest } from '../middleware/validate';
import {
  createCasinoEarningSchema,
  updateCasinoEarningSchema,
  getCasinoEarningsSchema,
  getCasinoEarningSchema,
  deleteCasinoEarningSchema,
} from '../schemas/casino-earnings.schema';

const router = Router();

// All routes require authentication
router.use(authenticate);

// Create a new casino earning
router.post('/', validateRequest(createCasinoEarningSchema), casinoEarningsController.create);

// Get all casino earnings with filters
router.get('/', validateRequest(getCasinoEarningsSchema), casinoEarningsController.getAll);

// Get total casino earnings
router.get('/total', casinoEarningsController.getTotalEarnings);

// Get a specific casino earning
router.get('/:id', validateRequest(getCasinoEarningSchema), casinoEarningsController.getById);

// Update a casino earning
router.put('/:id', validateRequest(updateCasinoEarningSchema), casinoEarningsController.update);

// Delete a casino earning
router.delete('/:id', validateRequest(deleteCasinoEarningSchema), casinoEarningsController.delete);

export default router;
