import { Request, Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../middleware/auth.middleware';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

export class MLController {
  predict = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const response = await axios.post(
        `${ML_SERVICE_URL}/predict`,
        req.body,
        {
          timeout: 10000, // 10 second timeout
        }
      );
      return res.json(response.data);
    } catch (error: any) {
      console.error('ML prediction error:', error.message);
      
      // If ML service is down, return a fallback response
      if (error.code === 'ECONNREFUSED' || error.response?.status >= 500) {
        return res.status(503).json({
          error: {
            message: 'ML service temporarily unavailable',
            details: 'Using fallback predictions',
          },
          // Fallback: simple probability calculation
          per_leg_probabilities: req.body.legs?.map((leg: any) => 1 / (leg.odd || 1.5)) || [],
          combined_probability: req.body.legs?.reduce((acc: number, leg: any) => acc * (1 / (leg.odd || 1.5)), 1) || 0,
        });
      }
      
      return res.status(500).json({
        error: {
          message: 'ML prediction failed',
          details: error.message,
        },
      });
    }
  };
}

export const mlController = new MLController();

