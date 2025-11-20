import { Request, Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../middleware/auth.middleware';
import { AnalyticsService } from '../services/analytics.service';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

export class MLController {
  constructor(private analyticsService: AnalyticsService) {}

  predict = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.id;
      
      // Fetch user analytics data for enhanced predictions
      let userAnalytics = null;
      try {
        // Fetch all analytics in parallel for better performance
        const [
          summary,
          byLeague,
          byBetType,
          byLegs,
          temporal,
          streak,
          responsible,
          combination,
        ] = await Promise.all([
          this.analyticsService.getSummary(userId).catch(() => null),
          this.analyticsService.getByLeague(userId).catch(() => null),
          this.analyticsService.getByBetType(userId).catch(() => null),
          this.analyticsService.getByLegs(userId).catch(() => null),
          this.analyticsService.getTemporalAnalytics(userId).catch(() => null),
          this.analyticsService.getStreakAnalysis(userId).catch(() => null),
          this.analyticsService.getResponsibleDetailedAnalytics(userId).catch(() => null),
          this.analyticsService.getCombinationAnalytics(userId).catch(() => null),
        ]);

        // Build league win rates map
        const leagueWinRates: Record<string, number> = {};
        if (byLeague) {
          byLeague.forEach((league) => {
            if (league.league_id) {
              leagueWinRates[league.league_id] = league.win_rate;
            }
          });
        }

        // Build bet type win rates map
        const betTypeWinRates: Record<string, number> = {};
        if (byBetType) {
          byBetType.forEach((bt) => {
            if (bt.bet_type_id) {
              betTypeWinRates[bt.bet_type_id] = bt.win_rate;
            }
          });
        }

        // Build leg count win rates map
        const legCountWinRates: Record<number, number> = {};
        if (byLegs) {
          byLegs.forEach((leg) => {
            if (leg.num_legs !== undefined) {
              legCountWinRates[leg.num_legs] = leg.win_rate;
            }
          });
        }

        // Build responsible win rates map
        const responsibleWinRates: Record<string, number> = {};
        if (responsible) {
          responsible.forEach((resp) => {
            if (resp.responsible_id) {
              responsibleWinRates[resp.responsible_id] = resp.summary.win_rate;
            }
          });
        }

        // Build temporal win rates
        const temporalWinRates: any = {};
        if (temporal) {
          // Day of week win rates
          if (temporal.by_day_of_week && temporal.by_day_of_week.length > 0) {
            temporalWinRates.day_of_week = {};
            temporal.by_day_of_week.forEach((day) => {
              temporalWinRates.day_of_week[day.day_number] = day.win_rate;
            });
          }

          // Weekend vs weekday
          if (temporal.weekend_vs_weekday) {
            temporalWinRates.is_weekend = {
              1: temporal.weekend_vs_weekday.weekend.win_rate,
              0: temporal.weekend_vs_weekday.weekday.win_rate,
            };
          }
        }

        // Build combination performance map
        const combinationPerformance: Record<string, { wins: number; losses: number }> = {};
        if (combination && combination.league_bet_type) {
          combination.league_bet_type.forEach((combo: any) => {
            const key = `${combo.league_id || ''}_${combo.bet_type_id || ''}`;
            const totalBets = combo.total_bets || 0;
            const winRate = combo.win_rate || 0;
            const wins = Math.round(totalBets * winRate);
            const losses = totalBets - wins;
            combinationPerformance[key] = {
              wins,
              losses,
            };
          });
        }

        // Calculate recent performance (last 7 and 30 days)
        const now = new Date();
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

        const [recent7Days, recent30Days] = await Promise.all([
          this.analyticsService.getSummary(userId, sevenDaysAgo.toISOString()).catch(() => null),
          this.analyticsService.getSummary(userId, thirtyDaysAgo.toISOString()).catch(() => null),
        ]);

        userAnalytics = {
          overall_win_rate: summary?.win_rate || null,
          overall_roi: summary?.roi || null,
          cumulative_profit: summary?.cumulative_profit || null,
          total_stake: summary?.total_stake || null,
          league_win_rates: Object.keys(leagueWinRates).length > 0 ? leagueWinRates : null,
          bet_type_win_rates: Object.keys(betTypeWinRates).length > 0 ? betTypeWinRates : null,
          responsible_win_rates: Object.keys(responsibleWinRates).length > 0 ? responsibleWinRates : null,
          leg_count_win_rates: Object.keys(legCountWinRates).length > 0 ? legCountWinRates : null,
          temporal_win_rates: Object.keys(temporalWinRates).length > 0 ? temporalWinRates : null,
          current_streak: streak
            ? {
                type: streak.current_streak.type,
                length: streak.current_streak.length,
              }
            : null,
          recent_performance: {
            last_7_days_profit: recent7Days?.total_profit || 0,
            last_30_days_profit: recent30Days?.total_profit || 0,
          },
          combination_performance:
            Object.keys(combinationPerformance).length > 0 ? combinationPerformance : null,
        };
      } catch (analyticsError) {
        console.error('Error fetching analytics for ML:', analyticsError);
        // Continue without analytics - ML service will use defaults
      }

      // Prepare request body with analytics
      const requestBody = {
        ...req.body,
        user_id: userId,
        user_analytics: userAnalytics,
      };

      const response = await axios.post(`${ML_SERVICE_URL}/predict`, requestBody, {
        timeout: 15000, // Increased timeout for analytics processing
      });

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
          combined_probability:
            req.body.legs?.reduce((acc: number, leg: any) => acc * (1 / (leg.odd || 1.5)), 1) || 0,
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

