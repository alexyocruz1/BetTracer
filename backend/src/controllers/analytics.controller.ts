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
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );

    return sendSuccess(res, summary);
  };

  getByLeague = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const byLeague = await this.analyticsService.getByLeague(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );

    return sendSuccess(res, byLeague);
  };

  getByResponsible = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const byResponsible = await this.analyticsService.getByResponsible(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );

    return sendSuccess(res, byResponsible);
  };

  getTimeSeries = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { granularity = 'all-time', start_date, end_date } = req.query;

    const timeSeries = await this.analyticsService.getTimeSeries(
      userId,
      granularity as 'daily' | 'weekly' | 'monthly' | 'all-time',
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );

    return sendSuccess(res, timeSeries);
  };

  getByBetType = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const byBetType = await this.analyticsService.getByBetType(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, byBetType);
  };

  getByCategory = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const byCategory = await this.analyticsService.getByCategory(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, byCategory);
  };

  getLegAnalytics = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const legAnalytics = await this.analyticsService.getLegAnalytics(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, legAnalytics);
  };

  getOddsAnalysis = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const oddsAnalysis = await this.analyticsService.getOddsAnalysis(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, oddsAnalysis);
  };

  getTeamPerformance = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const teamPerformance = await this.analyticsService.getTeamPerformance(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, teamPerformance);
  };

  getBestWorstPerformers = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const performers = await this.analyticsService.getBestWorstPerformers(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, performers);
  };

  getStreakAnalysis = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const streakAnalysis = await this.analyticsService.getStreakAnalysis(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, streakAnalysis);
  };

  getByLegs = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const byLegs = await this.analyticsService.getByLegs(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );

    return sendSuccess(res, byLegs);
  };

  getResponsibleDetailedAnalytics = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const detailedAnalytics = await this.analyticsService.getResponsibleDetailedAnalytics(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, detailedAnalytics);
  };

  getTemporalAnalytics = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const temporal = await this.analyticsService.getTemporalAnalytics(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, temporal);
  };

  getStakeAnalysis = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const stakeAnalysis = await this.analyticsService.getStakeAnalysis(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, stakeAnalysis);
  };

  getCombinationAnalytics = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const combinations = await this.analyticsService.getCombinationAnalytics(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, combinations);
  };

  getRiskMetrics = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const riskMetrics = await this.analyticsService.getRiskMetrics(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, riskMetrics);
  };

  getPeriodComparison = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const comparison = await this.analyticsService.getPeriodComparison(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, comparison);
  };

  getEVAnalysis = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const evAnalysis = await this.analyticsService.getEVAnalysis(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, evAnalysis);
  };

  getRecoveryAnalysis = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const recovery = await this.analyticsService.getRecoveryAnalysis(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, recovery);
  };

  getBankrollAnalysis = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const bankroll = await this.analyticsService.getBankrollAnalysis(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, bankroll);
  };

  getFrequencyAnalysis = async (req: AuthRequest, res: Response): Promise<Response> => {
    const userId = req.user!.id;
    const { start_date, end_date } = req.query;

    const frequency = await this.analyticsService.getFrequencyAnalysis(
      userId,
      start_date && String(start_date).trim() ? String(start_date).trim() : undefined,
      end_date && String(end_date).trim() ? String(end_date).trim() : undefined
    );
    return sendSuccess(res, frequency);
  };
}

