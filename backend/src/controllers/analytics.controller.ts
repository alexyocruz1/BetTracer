import { Response } from 'express';
import { AuthRequest } from '../middleware/auth.middleware';
import { AnalyticsService } from '../services/analytics.service';
import { sendSuccess } from '../utils/responses';

export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  getSummary = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const summary = await this.analyticsService.getSummary(
      userId,
      start_date as string,
      end_date as string
    );

    return sendSuccess(res, summary);
  };

  getByLeague = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const byLeague = await this.analyticsService.getByLeague(
      userId,
      start_date as string,
      end_date as string
    );

    return sendSuccess(res, byLeague);
  };

  getByResponsible = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const byResponsible = await this.analyticsService.getByResponsible(
      userId,
      start_date as string,
      end_date as string
    );

    return sendSuccess(res, byResponsible);
  };

  getTimeSeries = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { granularity = 'daily', start_date, end_date } = req.query;

    const timeSeries = await this.analyticsService.getTimeSeries(
      userId,
      granularity as 'daily' | 'weekly' | 'monthly',
      start_date as string,
      end_date as string
    );

    return sendSuccess(res, timeSeries);
  };
}

