import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validation.middleware';
import {
  getReferenceItemsSchema,
  createReferenceItemSchema,
} from '../schemas/reference-items.schema';
import { ReferenceItemsService } from '../services/reference-items.service';
import { ReferenceItemsController } from '../controllers/reference-items.controller';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

// Initialize services and controllers
const referenceItemsService = new ReferenceItemsService({} as any);
const referenceItemsController = new ReferenceItemsController(referenceItemsService);

// Middleware to inject supabase client
router.use(authenticate);
router.use((req: AuthRequest, res, next) => {
  if (req.supabaseClient) {
    referenceItemsService['supabase'] = req.supabaseClient;
  }
  next();
});

router.get('/', validate(getReferenceItemsSchema), referenceItemsController.getReferenceItems);
router.post('/', validate(createReferenceItemSchema), referenceItemsController.createReferenceItem);

export default router;

