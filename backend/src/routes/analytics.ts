import { Router } from 'express';
import { authenticate } from '../middleware/auth.middleware';
import { AnalyticsService } from '../services/analytics.service';
import { AnalyticsController } from '../controllers/analytics.controller';
import { AuthRequest } from '../middleware/auth.middleware';
import { asyncHandler } from '../utils/asyncHandler';

const router = Router();

// Initialize services and controllers
const analyticsService = new AnalyticsService({} as any);
const analyticsController = new AnalyticsController(analyticsService);

// Middleware to inject supabase client
router.use(authenticate);
router.use((req: AuthRequest, _res, next) => {
  if (req.supabaseClient) {
    analyticsService['supabase'] = req.supabaseClient;
  }
  next();
});

router.get('/summary', asyncHandler(analyticsController.getSummary));
router.get('/by-league', asyncHandler(analyticsController.getByLeague));
router.get('/by-responsible', asyncHandler(analyticsController.getByResponsible));
router.get('/by-bet-type', asyncHandler(analyticsController.getByBetType));
router.get('/by-category', asyncHandler(analyticsController.getByCategory));
router.get('/by-sport', asyncHandler(analyticsController.getBySport));
router.get('/leg-analytics', asyncHandler(analyticsController.getLegAnalytics));
router.get('/odds-analysis', asyncHandler(analyticsController.getOddsAnalysis));
router.get('/team-performance', asyncHandler(analyticsController.getTeamPerformance));
router.get('/best-worst-performers', asyncHandler(analyticsController.getBestWorstPerformers));
router.get('/streak-analysis', asyncHandler(analyticsController.getStreakAnalysis));
router.get('/time-series', asyncHandler(analyticsController.getTimeSeries));
router.get('/responsible-detailed', asyncHandler(analyticsController.getResponsibleDetailedAnalytics));
router.get('/by-legs', asyncHandler(analyticsController.getByLegs));
router.get('/temporal', asyncHandler(analyticsController.getTemporalAnalytics));
router.get('/stake-analysis', asyncHandler(analyticsController.getStakeAnalysis));
router.get('/combinations', asyncHandler(analyticsController.getCombinationAnalytics));
router.get('/risk-metrics', asyncHandler(analyticsController.getRiskMetrics));
router.get('/period-comparison', asyncHandler(analyticsController.getPeriodComparison));
router.get('/ev-analysis', asyncHandler(analyticsController.getEVAnalysis));
router.get('/recovery', asyncHandler(analyticsController.getRecoveryAnalysis));
router.get('/bankroll', asyncHandler(analyticsController.getBankrollAnalysis));
router.get('/frequency', asyncHandler(analyticsController.getFrequencyAnalysis));

export default router;

