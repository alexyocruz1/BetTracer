import { Router } from 'express';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createCasinoEarningSchema,
  updateCasinoEarningSchema,
  getCasinoEarningsSchema,
  getCasinoEarningSchema,
  deleteCasinoEarningSchema,
} from '../schemas/casino-earnings.schema';
import { CasinoEarningsService } from '../services/casino-earnings.service';
import { CasinoEarningsController } from '../controllers/casino-earnings.controller';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Initialize services and controllers
const casinoEarningsService = new CasinoEarningsService({} as any);
const casinoEarningsController = new CasinoEarningsController(casinoEarningsService);

// Middleware to inject supabase client
router.use(authenticate);
router.use((req: AuthRequest, _res, next) => {
  if (req.supabaseClient) {
    casinoEarningsService['supabase'] = req.supabaseClient;
  }
  next();
});

// Create a new casino earning
router.post('/', validate(createCasinoEarningSchema), asyncHandler(casinoEarningsController.create));

// Get all casino earnings with filters
router.get('/', validate(getCasinoEarningsSchema), asyncHandler(casinoEarningsController.getAll));

// Get total casino earnings (must come before /:id route)
router.get('/total', asyncHandler(casinoEarningsController.getTotalEarnings));

// Get a specific casino earning
router.get('/:id', validate(getCasinoEarningSchema), asyncHandler(casinoEarningsController.getById));

// Update a casino earning
router.put('/:id', validate(updateCasinoEarningSchema), asyncHandler(casinoEarningsController.update));

// Delete a casino earning
router.delete('/:id', validate(deleteCasinoEarningSchema), asyncHandler(casinoEarningsController.delete));

export default router;
