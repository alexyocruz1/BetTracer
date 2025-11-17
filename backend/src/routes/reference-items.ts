import { Router } from 'express';
import { authenticate, requireAdmin } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getReferenceItemsSchema,
  createReferenceItemSchema,
} from '../schemas/reference-items.schema';
import { ReferenceItemsService } from '../services/reference-items.service';
import { ReferenceItemsController } from '../controllers/reference-items.controller';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Initialize services and controllers
const referenceItemsService = new ReferenceItemsService({} as any);
const referenceItemsController = new ReferenceItemsController(referenceItemsService);

// Middleware to inject supabase client
router.use(authenticate);
router.use((req: AuthRequest, _res, next) => {
  if (req.supabaseClient) {
    referenceItemsService['supabase'] = req.supabaseClient;
  }
  next();
});

// GET is available to all authenticated users
router.get('/', validate(getReferenceItemsSchema), asyncHandler(referenceItemsController.getReferenceItems));

// POST requires admin access
router.post('/', requireAdmin, validate(createReferenceItemSchema), asyncHandler(referenceItemsController.createReferenceItem));

export default router;

