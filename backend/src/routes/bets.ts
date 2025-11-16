import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  createBetSchema,
  getBetsSchema,
  getBetSchema,
  updateBetSchema,
  updateBetStateSchema,
  deleteBetSchema,
} from '../schemas/bets.schema';
import { BetsService } from '../services/bets.service';
import { BetsController } from '../controllers/bets.controller';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Initialize services and controllers
const betsService = new BetsService({} as any);
const betsController = new BetsController(betsService);

// Middleware to inject supabase client
router.use(authenticate);
router.use((req: AuthRequest, res, next) => {
  if (req.supabaseClient) {
    betsService['supabase'] = req.supabaseClient;
  }
  next();
});

router.post('/', validate(createBetSchema), betsController.createBet);
router.get('/', validate(getBetsSchema), betsController.getBets);
router.get('/:id', validate(getBetSchema), betsController.getBet);
router.patch('/:id', validate(updateBetSchema), betsController.updateBet);
router.patch('/:id/state', validate(updateBetStateSchema), betsController.updateBetState);
router.delete('/:id', validate(deleteBetSchema), betsController.deleteBet);

export default router;

