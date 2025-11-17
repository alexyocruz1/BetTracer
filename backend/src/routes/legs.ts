import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import { updateLegSchema, updateLegStateSchema } from '../schemas/legs.schema';
import { LegsService } from '../services/legs.service';
import { LegsController } from '../controllers/legs.controller';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Initialize services and controllers
const legsService = new LegsService({} as any);
const legsController = new LegsController(legsService);

// Middleware to inject supabase client
router.use(authenticate);
router.use((req: AuthRequest, res, next) => {
  if (req.supabaseClient) {
    legsService['supabase'] = req.supabaseClient;
  }
  next();
});

router.put('/:id', validate(updateLegSchema), asyncHandler(legsController.updateLeg));
router.patch('/:id/state', validate(updateLegStateSchema), asyncHandler(legsController.updateLegState));

export default router;

