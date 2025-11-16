import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import axios from 'axios';
import { sendSuccess, sendError } from '../utils/responses';
import { AuthRequest } from '../middleware/auth.middleware';

const router = Router();

const ML_API_URL = process.env.ML_API_URL || 'http://localhost:8000';

router.use(authenticate);

router.post('/predict', async (req: AuthRequest, res) => {
  try {
    const { legs, stake } = req.body;
    const userId = req.user!.id;

    const response = await axios.post(`${ML_API_URL}/predict`, {
      legs,
      stake,
      user_id: userId,
    });

    return sendSuccess(res, response.data.data);
  } catch (error: any) {
    console.error('ML prediction error:', error);
    return sendError(
      res,
      'ML_SERVICE_ERROR',
      error.response?.data?.detail || 'Failed to get prediction',
      500
    );
  }
});

export default router;

