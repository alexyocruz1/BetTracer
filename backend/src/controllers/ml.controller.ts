import { Request, Response } from 'express';
import axios from 'axios';
import { AuthRequest } from '../middleware/auth.middleware';
import { AnalyticsService } from '../services/analytics.service';
import { ReferenceItemsService } from '../services/reference-items.service';
import crypto from 'crypto';

const ML_SERVICE_URL = process.env.ML_SERVICE_URL || 'http://localhost:8000';

// In-memory cache for ML predictions
interface CacheEntry {
  data: any;
  timestamp: number;
  expiresAt: number;
}

const predictionCache = new Map<string, CacheEntry>();
// Cache TTL: 10 minutes - balances freshness with resource efficiency
// User analytics (win rates, streaks) don't change dramatically in minutes
// But predictions should update reasonably frequently for active betting
const CACHE_TTL = parseInt(process.env.ML_CACHE_TTL || '600000', 10); // 10 minutes default, configurable
const CACHE_MAX_SIZE = 1000; // Max cache entries

// Clean up expired cache entries periodically
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of predictionCache.entries()) {
    if (entry.expiresAt < now) {
      predictionCache.delete(key);
    }
  }
  // If cache is too large, remove oldest entries
  if (predictionCache.size > CACHE_MAX_SIZE) {
    const entries = Array.from(predictionCache.entries())
      .sort((a, b) => a[1].timestamp - b[1].timestamp);
    const toRemove = entries.slice(0, predictionCache.size - CACHE_MAX_SIZE);
    toRemove.forEach(([key]) => predictionCache.delete(key));
  }
}, 60000); // Clean up every minute

function generateCacheKey(userId: string, payload: any): string {
  // Create a hash of the prediction request
  const keyData = JSON.stringify({
    userId,
    legs: payload.legs?.map((l: any) => ({
      odd: l.odd,
      league_id: l.league_id,
      bet_type_id: l.bet_type_id,
      category_id: l.category_id,
      responsible_id: l.responsible_id,
    })),
    stake: payload.stake,
  });
  return crypto.createHash('sha256').update(keyData).digest('hex');
}

// Invalidate cache for a user when their analytics change (e.g., bet state updated)
// Note: Since cache keys are hashed, we clear all entries when user data changes
// This is acceptable because cache TTL is short (10 min) and user actions are infrequent
export function invalidateUserMLCache(userId: string): void {
  const beforeSize = predictionCache.size;
  // Clear all cache entries when user analytics change
  // Alternative: Could track userId in cache entries for selective invalidation
  predictionCache.clear();
  console.log(`[MLController] Invalidated ML cache (${beforeSize} entries cleared) for user ${userId}`);
}

export class MLController {
  constructor(
    private analyticsService: AnalyticsService,
    private referenceItemsService: ReferenceItemsService
  ) {}

  predict = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.id;
      
      // Check cache first
      const cacheKey = generateCacheKey(userId, req.body);
      const cached = predictionCache.get(cacheKey);
      if (cached && cached.expiresAt > Date.now()) {
        console.log('[MLController] Returning cached prediction');
        return res.json(cached.data);
      }
      
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

      // Fetch reference items to populate league and bet type names
      let referenceItemsMap: Map<string, string> = new Map();
      try {
        const [leaguesRes, betTypesRes] = await Promise.all([
          this.referenceItemsService.getReferenceItems({ kind: 'league', limit: 1000, offset: 0 }),
          this.referenceItemsService.getReferenceItems({ kind: 'bet_type', limit: 1000, offset: 0 }),
        ]);
        
        leaguesRes.items.forEach(item => {
          referenceItemsMap.set(item.id, item.name);
        });
        betTypesRes.items.forEach(item => {
          referenceItemsMap.set(item.id, item.name);
        });
      } catch (refError) {
        console.error('Error fetching reference items for ML:', refError);
        // Continue without names - will fall back to IDs
      }

      // Enrich legs with league and bet type names
      const enrichedLegs = (req.body.legs || []).map((leg: any) => ({
        ...leg,
        league_name: leg.league_id ? referenceItemsMap.get(leg.league_id) : undefined,
        bet_type_name: leg.bet_type_id ? referenceItemsMap.get(leg.bet_type_id) : undefined,
      }));

      // Prepare request body with analytics
      const requestBody = {
        ...req.body,
        legs: enrichedLegs,
        user_id: userId,
        user_analytics: userAnalytics,
      };

      const response = await axios.post(`${ML_SERVICE_URL}/predict`, requestBody, {
        timeout: 15000, // Increased timeout for analytics processing
      });

      // Cache the response
      const cacheEntry: CacheEntry = {
        data: response.data,
        timestamp: Date.now(),
        expiresAt: Date.now() + CACHE_TTL,
      };
      predictionCache.set(cacheKey, cacheEntry);

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

  recommend = async (req: AuthRequest, res: Response): Promise<Response> => {
    try {
      const userId = req.user!.id;
      
      console.log('[MLController] Generating bet recommendations for user:', userId);

      // Fetch comprehensive analytics
      const [
        summary,
        byLeague,
        byBetType,
        byCategory,
        byLegs,
        temporal,
        responsible,
        teamPerformance,
      ] = await Promise.all([
        this.analyticsService.getSummary(userId).catch(() => null),
        this.analyticsService.getByLeague(userId).catch(() => null),
        this.analyticsService.getByBetType(userId).catch(() => null),
        this.analyticsService.getByCategory(userId).catch(() => null),
        this.analyticsService.getByLegs(userId).catch(() => null),
        this.analyticsService.getTemporalAnalytics(userId).catch(() => null),
        this.analyticsService.getResponsibleDetailedAnalytics(userId).catch(() => null),
        this.analyticsService.getTeamPerformance(userId).catch(() => null),
      ]);

      // Fetch reference items
      const [teams, leagues, betTypes, categories, responsibles] = await Promise.all([
        this.referenceItemsService.getReferenceItems({ kind: 'team', limit: 1000, offset: 0 }).catch(() => ({ items: [], total: 0 })),
        this.referenceItemsService.getReferenceItems({ kind: 'league', limit: 1000, offset: 0 }).catch(() => ({ items: [], total: 0 })),
        this.referenceItemsService.getReferenceItems({ kind: 'bet_type', limit: 1000, offset: 0 }).catch(() => ({ items: [], total: 0 })),
        this.referenceItemsService.getReferenceItems({ kind: 'category', limit: 1000, offset: 0 }).catch(() => ({ items: [], total: 0 })),
        this.referenceItemsService.getReferenceItems({ kind: 'responsible', limit: 1000, offset: 0 }).catch(() => ({ items: [], total: 0 })),
      ]);

      // Build maps for quick lookup
      const teamsMap = new Map(teams.items.map((t) => [t.id, t]));
      const leaguesMap = new Map(leagues.items.map((l) => [l.id, l]));
      const betTypesMap = new Map(betTypes.items.map((bt) => [bt.id, bt]));
      const categoriesMap = new Map(categories.items.map((c) => [c.id, c]));
      const responsiblesMap = new Map(responsibles.items.map((r) => [r.id, r]));

      // Find best performing entities
      const bestLeagues = (byLeague || [])
        .filter(l => l.win_rate > 0.5 && l.bet_count >= 3)
        .sort((a, b) => b.win_rate - a.win_rate)
        .slice(0, 10);

      const bestBetTypes = (byBetType || [])
        .filter(bt => bt.win_rate > 0.5 && bt.bet_count >= 3)
        .sort((a, b) => b.win_rate - a.win_rate)
        .slice(0, 10);

      const bestCategories = (byCategory || [])
        .filter(c => c.win_rate > 0.5 && c.bet_count >= 3)
        .sort((a, b) => b.win_rate - a.win_rate)
        .slice(0, 10);

      const bestLegCounts = (byLegs || [])
        .filter(l => l.win_rate > 0.5 && l.bet_count >= 3)
        .sort((a, b) => b.win_rate - a.win_rate)
        .slice(0, 5);

      // Get best performing responsibles
      const bestResponsibles = (responsible || [])
        .filter(r => r.summary.win_rate > 0.5 && r.summary.bet_count >= 3)
        .sort((a, b) => b.summary.win_rate - a.summary.win_rate)
        .slice(0, 5);

      // Get optimal day of week
      const optimalDay = temporal?.by_day_of_week
        ? temporal.by_day_of_week
            .filter(day => day.total_bets >= 3)
            .sort((a, b) => b.win_rate - a.win_rate)[0]?.day_number?.toString() || null
        : null;

      // Generate recommendations per responsible
      const recommendations: any[] = [];

      for (const resp of bestResponsibles) {
        const respId = resp.responsible_id;
        const respName = responsiblesMap.get(respId)?.name || 'Unknown';

        // Get this responsible's best performing combinations
        const respLeagues = bestLeagues.filter(l => 
          // We'll use leagues that have good overall performance
          l.win_rate > 0.55
        ).slice(0, 3);

        const respBetTypes = bestBetTypes.slice(0, 3);
        const respCategories = bestCategories.slice(0, 3);

        // Generate 2-3 recommendations per responsible
        for (let i = 0; i < Math.min(3, respLeagues.length); i++) {
          const league = respLeagues[i];
          const betType = respBetTypes[i % respBetTypes.length];
          const category = respCategories[i % respCategories.length];
          const legCount = bestLegCounts[0]?.num_legs || 2;

          // Get teams from this league (if available)
          // For now, we'll create a generic recommendation
          const recommendation = {
            responsible_id: respId,
            responsible_name: respName,
            league_id: league.league_id,
            league_name: leaguesMap.get(league.league_id)?.name || 'Unknown League',
            bet_type_id: betType.bet_type_id,
            bet_type_name: betTypesMap.get(betType.bet_type_id)?.name || 'Unknown Bet Type',
            category_id: category.category_id,
            category_name: categoriesMap.get(category.category_id)?.name || 'Unknown Category',
            recommended_leg_count: legCount,
            recommended_day: optimalDay,
            confidence_score: (league.win_rate + betType.win_rate + category.win_rate) / 3,
            reasoning: [
              `League "${leaguesMap.get(league.league_id)?.name}" has ${(league.win_rate * 100).toFixed(1)}% win rate`,
              `Bet type "${betTypesMap.get(betType.bet_type_id)?.name}" has ${(betType.win_rate * 100).toFixed(1)}% win rate`,
              `Category "${categoriesMap.get(category.category_id)?.name}" has ${(category.win_rate * 100).toFixed(1)}% win rate`,
              `${respName} has ${(resp.summary.win_rate * 100).toFixed(1)}% win rate`,
            ],
          };

          recommendations.push(recommendation);
        }
      }

      // If no responsibles, generate general recommendations
      if (recommendations.length === 0) {
        for (let i = 0; i < Math.min(3, bestLeagues.length); i++) {
          const league = bestLeagues[i];
          const betType = bestBetTypes[i % bestBetTypes.length];
          const category = bestCategories[i % bestCategories.length];

          recommendations.push({
            responsible_id: null,
            responsible_name: 'General',
            league_id: league.league_id,
            league_name: leaguesMap.get(league.league_id)?.name || 'Unknown League',
            bet_type_id: betType.bet_type_id,
            bet_type_name: betTypesMap.get(betType.bet_type_id)?.name || 'Unknown Bet Type',
            category_id: category.category_id,
            category_name: categoriesMap.get(category.category_id)?.name || 'Unknown Category',
            recommended_leg_count: bestLegCounts[0]?.num_legs || 2,
            recommended_day: optimalDay,
            confidence_score: (league.win_rate + betType.win_rate + category.win_rate) / 3,
            reasoning: [
              `League "${leaguesMap.get(league.league_id)?.name}" has ${(league.win_rate * 100).toFixed(1)}% win rate`,
              `Bet type "${betTypesMap.get(betType.bet_type_id)?.name}" has ${(betType.win_rate * 100).toFixed(1)}% win rate`,
              `Category "${categoriesMap.get(category.category_id)?.name}" has ${(category.win_rate * 100).toFixed(1)}% win rate`,
            ],
          });
        }
      }

      // Sort by confidence score
      recommendations.sort((a, b) => b.confidence_score - a.confidence_score);

      return res.json({
        data: recommendations,
        meta: {
          total: recommendations.length,
          generated_at: new Date().toISOString(),
        },
      });
    } catch (error: any) {
      console.error('[MLController] Recommendation error:', error);
      return res.status(500).json({
        error: {
          message: 'Failed to generate recommendations',
          details: error.message,
        },
      });
    }
  };
}

