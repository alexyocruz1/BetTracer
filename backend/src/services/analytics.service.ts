import { SupabaseClient } from '@supabase/supabase-js';
import {
  AnalyticsSummary,
  AnalyticsByLeague,
  AnalyticsByResponsible,
  AnalyticsByBetType,
  AnalyticsByCategory,
  TimeSeriesData,
  LegAnalytics,
  OddsAnalysis,
  TeamPerformance,
  BestWorstPerformers,
  StreakAnalysis,
  ResponsibleDetailedAnalytics,
  AnalyticsByLegs,
  TemporalAnalytics,
  StakeAnalysis,
  CombinationAnalytics,
  RiskMetrics,
  PeriodComparison,
  EVAnalysis,
  RecoveryAnalysis,
  BankrollAnalysis,
  FrequencyAnalysis,
} from '../types';
import { createError, errorCodes } from '../utils/errors';

export class AnalyticsService {
  constructor(private supabase: SupabaseClient) {}

  // Calculate dynamic thresholds based on dataset size
  // Thresholds scale with total bets/legs to balance insight availability with statistical quality
  private getMinSampleSizes(totalBets: number, totalLegs: number): {
    TEAM: number;
    LEAGUE: number;
    CATEGORY: number;
    BET_TYPE: number;
    DAY: number;
    HOUR: number;
    MONTH: number;
    ODDS_RANGE: number;
    COMBINATION: number;
    LEG_LEVEL: number;
  } {
    // Bet-level thresholds: Scale from 2 (small dataset) to 7 (large dataset)
    // Formula: min(7, max(2, Math.ceil(totalBets / 30)))
    // This means: 2 for <60 bets, 3 for 60-90, 4 for 90-120, 5 for 120-150, etc., up to 7
    const betLevelThreshold = Math.min(7, Math.max(2, Math.ceil(totalBets / 30)));
    
    // Time-based thresholds: Scale from 1 (small) to 3 (large)
    // Lower because there are only 7 days, 24 hours, 12 months
    const timeBasedThreshold = Math.min(3, Math.max(1, Math.ceil(totalBets / 50)));
    
    // Leg-level thresholds: Scale from 5 (small dataset) to 15 (large dataset)
    // Formula: min(15, max(5, Math.ceil(totalLegs / 30)))
    // This means: 5 for <150 legs, 6 for 150-180, 7 for 180-210, etc., up to 15
    const legLevelThreshold = Math.min(15, Math.max(5, Math.ceil(totalLegs / 30)));

    return {
      TEAM: betLevelThreshold,
      LEAGUE: betLevelThreshold,
      CATEGORY: betLevelThreshold,
      BET_TYPE: betLevelThreshold,
      DAY: timeBasedThreshold,
      HOUR: timeBasedThreshold,
      MONTH: timeBasedThreshold,
      ODDS_RANGE: timeBasedThreshold,
      COMBINATION: timeBasedThreshold,
      LEG_LEVEL: legLevelThreshold,
    };
  }

  // Helper function to determine confidence level based on sample size
  private getConfidenceLevel(sampleSize: number, minThreshold: number): 'high' | 'moderate' | 'low' {
    if (sampleSize >= minThreshold * 2) return 'high';
    if (sampleSize >= minThreshold) return 'moderate';
    return 'low';
  }

  // Helper function to check if sample size is statistically significant
  private isStatisticallySignificant(sampleSize: number, minThreshold: number): boolean {
    return sampleSize >= minThreshold;
  }

  // Helper function to calculate effective odds excluding voided legs
  private calculateEffectiveOdds(bet: any): number {
    if (!bet.legs || bet.legs.length === 0) {
      return Number(bet.odds || 0);
    }

    const nonVoidedLegs = bet.legs.filter((leg: any) => leg.result_state !== 'void');
    
    if (nonVoidedLegs.length === 0) {
      // All legs are voided
      return 0;
    }

    // Calculate effective odds by multiplying non-voided legs
    const effectiveOdds = nonVoidedLegs.reduce((acc: number, leg: any) => {
      return acc * Number(leg.odd || 1);
    }, 1);

    return effectiveOdds;
  }

  async getSummary(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsSummary> {
    let query = this.supabase
      .from('main_bets')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: bets, error } = await query;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch summary', 500);
    }

    const totalBets = bets?.length || 0;
    const wonBets = bets?.filter((b) => b.state === 'won').length || 0;
    const lostBets = bets?.filter((b) => b.state === 'lost').length || 0;
    const pendingBets = bets?.filter((b) => b.state === 'pending').length || 0;
    // Only count resolved bets (won/lost) for win rate calculation
    const resolvedBets = wonBets + lostBets;

    const totalStake = bets?.reduce((sum, b) => sum + Number(b.stake || 0), 0) || 0;
    const totalProfit =
      bets?.reduce((sum, b) => sum + Number(b.profit_loss || 0), 0) || 0;

    const winRate = resolvedBets > 0 ? wonBets / resolvedBets : 0;
    const roi = totalStake > 0 ? totalProfit / totalStake : 0;

    const cumulativeProfit = bets?.reduce((sum, b) => {
      if (b.cumulative_profit !== null && b.cumulative_profit !== undefined) {
        return Math.max(sum, Number(b.cumulative_profit));
      }
      return sum;
    }, 0) || totalProfit;

    return {
      total_stake: totalStake,
      total_profit: totalProfit,
      roi,
      win_rate: winRate,
      total_bets: totalBets,
      won_bets: wonBets,
      lost_bets: lostBets,
      pending_bets: pendingBets,
      cumulative_profit: cumulativeProfit,
    };
  }

  async getByLeague(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsByLeague[]> {
    // Get all bets with legs
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch by league', 500);
    }

    // Group by league
    const leagueMap = new Map<string, AnalyticsByLeague>();

    bets?.forEach((bet) => {
      bet.legs?.forEach((leg: any) => {
        if (!leg.league_id) return;

        const leagueId = leg.league_id;
        if (!leagueMap.has(leagueId)) {
          leagueMap.set(leagueId, {
            league_id: leagueId,
            league_name: '', // Will be filled from reference_items
            total_stake: 0,
            total_profit: 0,
            roi: 0,
            win_rate: 0,
            bet_count: 0,
          });
        }

        const leagueData = leagueMap.get(leagueId)!;
        leagueData.total_stake += Number(bet.stake || 0);
        leagueData.total_profit += Number(bet.profit_loss || 0);
        leagueData.bet_count += 1;
      });
    });

    // Calculate ROI and win rate, and get league names
    const results = Array.from(leagueMap.values());
    for (const result of results) {
      result.roi = result.total_stake > 0 ? result.total_profit / result.total_stake : 0;

      // Get league name
      const { data: league } = await this.supabase
        .from('reference_items')
        .select('name')
        .eq('id', result.league_id)
        .single();

      if (league) {
        result.league_name = league.name;
      }

      // Calculate win rate for this league (exclude pending bets)
      const leagueBets = bets?.filter((b) =>
        b.legs?.some((l: any) => l.league_id === result.league_id)
      );
      const resolvedLeagueBets = leagueBets?.filter((b) => b.state === 'won' || b.state === 'lost') || [];
      const wonLeagueBets = resolvedLeagueBets.filter((b) => b.state === 'won').length || 0;
      result.win_rate = resolvedLeagueBets.length > 0 ? wonLeagueBets / resolvedLeagueBets.length : 0;
    }

    return results;
  }

  async getByResponsible(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsByResponsible[]> {
    // Similar to getByLeague but grouped by responsible_id
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch by responsible', 500);
    }

    const responsibleMap = new Map<string, AnalyticsByResponsible>();

    bets?.forEach((bet) => {
      bet.legs?.forEach((leg: any) => {
        if (!leg.responsible_id) return;

        const responsibleId = leg.responsible_id;
        if (!responsibleMap.has(responsibleId)) {
          responsibleMap.set(responsibleId, {
            responsible_id: responsibleId,
            responsible_name: '',
            total_stake: 0,
            total_profit: 0,
            roi: 0,
            win_rate: 0,
            bet_count: 0,
          });
        }

        const responsibleData = responsibleMap.get(responsibleId)!;
        responsibleData.total_stake += Number(bet.stake || 0);
        responsibleData.total_profit += Number(bet.profit_loss || 0);
        responsibleData.bet_count += 1;
      });
    });

    const results = Array.from(responsibleMap.values());
    for (const result of results) {
      result.roi = result.total_stake > 0 ? result.total_profit / result.total_stake : 0;

      const { data: responsible } = await this.supabase
        .from('reference_items')
        .select('name')
        .eq('id', result.responsible_id)
        .single();

      if (responsible) {
        result.responsible_name = responsible.name;
      }

      const responsibleBets = bets?.filter((b) =>
        b.legs?.some((l: any) => l.responsible_id === result.responsible_id)
      );
      const resolvedResponsibleBets = responsibleBets?.filter((b) => b.state === 'won' || b.state === 'lost') || [];
      const wonResponsibleBets = resolvedResponsibleBets.filter((b) => b.state === 'won').length || 0;
      result.win_rate = resolvedResponsibleBets.length > 0
        ? wonResponsibleBets / resolvedResponsibleBets.length
        : 0;
    }

    return results;
  }

  async getByBetType(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsByBetType[]> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch by bet type', 500);
    }

    const betTypeMap = new Map<string, AnalyticsByBetType>();

    bets?.forEach((bet) => {
      bet.legs?.forEach((leg: any) => {
        if (!leg.bet_type_id) return;

        const betTypeId = leg.bet_type_id;
        if (!betTypeMap.has(betTypeId)) {
          betTypeMap.set(betTypeId, {
            bet_type_id: betTypeId,
            bet_type_name: '',
            total_stake: 0,
            total_profit: 0,
            roi: 0,
            win_rate: 0,
            bet_count: 0,
          });
        }

        const betTypeData = betTypeMap.get(betTypeId)!;
        betTypeData.total_stake += Number(bet.stake || 0);
        betTypeData.total_profit += Number(bet.profit_loss || 0);
        betTypeData.bet_count += 1;
      });
    });

    const results = Array.from(betTypeMap.values());
    for (const result of results) {
      result.roi = result.total_stake > 0 ? result.total_profit / result.total_stake : 0;

      const { data: betType } = await this.supabase
        .from('reference_items')
        .select('name')
        .eq('id', result.bet_type_id)
        .single();

      if (betType) {
        result.bet_type_name = betType.name;
      }

      const betTypeBets = bets?.filter((b) =>
        b.legs?.some((l: any) => l.bet_type_id === result.bet_type_id)
      );
      const resolvedBetTypeBets = betTypeBets?.filter((b) => b.state === 'won' || b.state === 'lost') || [];
      const wonBetTypeBets = resolvedBetTypeBets.filter((b) => b.state === 'won').length || 0;
      result.win_rate = resolvedBetTypeBets.length > 0 ? wonBetTypeBets / resolvedBetTypeBets.length : 0;
    }

    return results;
  }

  async getByCategory(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsByCategory[]> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch by category', 500);
    }

    const categoryMap = new Map<string, AnalyticsByCategory>();

    bets?.forEach((bet) => {
      bet.legs?.forEach((leg: any) => {
        if (!leg.category_id) return;

        const categoryId = leg.category_id;
        if (!categoryMap.has(categoryId)) {
          categoryMap.set(categoryId, {
            category_id: categoryId,
            category_name: '',
            total_stake: 0,
            total_profit: 0,
            roi: 0,
            win_rate: 0,
            bet_count: 0,
          });
        }

        const categoryData = categoryMap.get(categoryId)!;
        categoryData.total_stake += Number(bet.stake || 0);
        categoryData.total_profit += Number(bet.profit_loss || 0);
        categoryData.bet_count += 1;
      });
    });

    const results = Array.from(categoryMap.values());
    for (const result of results) {
      result.roi = result.total_stake > 0 ? result.total_profit / result.total_stake : 0;

      const { data: category } = await this.supabase
        .from('reference_items')
        .select('name')
        .eq('id', result.category_id)
        .single();

      if (category) {
        result.category_name = category.name;
      }

      const categoryBets = bets?.filter((b) =>
        b.legs?.some((l: any) => l.category_id === result.category_id)
      );
      const resolvedCategoryBets = categoryBets?.filter((b) => b.state === 'won' || b.state === 'lost') || [];
      const wonCategoryBets = resolvedCategoryBets.filter((b) => b.state === 'won').length || 0;
      result.win_rate = resolvedCategoryBets.length > 0 ? wonCategoryBets / resolvedCategoryBets.length : 0;
    }

    return results;
  }

  async getTimeSeries(
    userId: string,
    granularity: 'daily' | 'weekly' | 'monthly' | 'all-time',
    startDate?: string,
    endDate?: string
  ): Promise<TimeSeriesData[]> {
    let query = this.supabase
      .from('main_bets')
      .select('date, stake, profit_loss, state')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: bets, error } = await query;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch time series', 500);
    }

    // Group by date based on granularity
    const dateMap = new Map<string, TimeSeriesData>();

    bets?.forEach((bet) => {
      const date = new Date(bet.date);
      let key: string;

      if (granularity === 'daily' || granularity === 'all-time') {
        key = date.toISOString().split('T')[0];
      } else if (granularity === 'weekly') {
        const weekStart = new Date(date);
        weekStart.setDate(date.getDate() - date.getDay());
        key = weekStart.toISOString().split('T')[0];
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      if (!dateMap.has(key)) {
        dateMap.set(key, {
          date: key,
          stake: 0,
          profit: 0,
          bet_count: 0,
        });
      }

      const data = dateMap.get(key)!;
      data.stake += Number(bet.stake || 0);
      data.profit += Number(bet.profit_loss || 0);
      data.bet_count += 1;
    });

    return Array.from(dateMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }

  async getLegAnalytics(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<LegAnalytics> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch leg analytics', 500);
    }

    let totalLegs = 0;
    let wonLegs = 0;
    let lostLegs = 0;
    let pendingLegs = 0;
    let voidLegs = 0;
    let totalLegOdds = 0;

    const leagueMap = new Map<string, { total: number; won: number }>();
    const betTypeMap = new Map<string, { total: number; won: number }>();

    bets?.forEach((bet) => {
      bet.legs?.forEach((leg: any) => {
        totalLegs++;
        totalLegOdds += Number(leg.odd || 0);

        if (leg.result_state === 'won') wonLegs++;
        else if (leg.result_state === 'lost') lostLegs++;
        else if (leg.result_state === 'void') voidLegs++;
        else pendingLegs++;

        // Track by league
        if (leg.league_id) {
          if (!leagueMap.has(leg.league_id)) {
            leagueMap.set(leg.league_id, { total: 0, won: 0 });
          }
          const leagueData = leagueMap.get(leg.league_id)!;
          leagueData.total++;
          if (leg.result_state === 'won') leagueData.won++;
        }

        // Track by bet type
        if (leg.bet_type_id) {
          if (!betTypeMap.has(leg.bet_type_id)) {
            betTypeMap.set(leg.bet_type_id, { total: 0, won: 0 });
          }
          const betTypeData = betTypeMap.get(leg.bet_type_id)!;
          betTypeData.total++;
          if (leg.result_state === 'won') betTypeData.won++;
        }
      });
    });

    const legWinRate = totalLegs > 0 ? wonLegs / (wonLegs + lostLegs + voidLegs) : 0;
    const avgLegOdds = totalLegs > 0 ? totalLegOdds / totalLegs : 0;

    // Get league names
    const performanceByLeague = [];
    for (const [leagueId, data] of leagueMap.entries()) {
      const { data: league } = await this.supabase
        .from('reference_items')
        .select('name')
        .eq('id', leagueId)
        .single();

      performanceByLeague.push({
        league_id: leagueId,
        league_name: league?.name || 'Unknown',
        total_legs: data.total,
        won_legs: data.won,
        win_rate: data.total > 0 ? data.won / data.total : 0,
      });
    }

    // Get bet type names
    const performanceByBetType = [];
    for (const [betTypeId, data] of betTypeMap.entries()) {
      const { data: betType } = await this.supabase
        .from('reference_items')
        .select('name')
        .eq('id', betTypeId)
        .single();

      performanceByBetType.push({
        bet_type_id: betTypeId,
        bet_type_name: betType?.name || 'Unknown',
        total_legs: data.total,
        won_legs: data.won,
        win_rate: data.total > 0 ? data.won / data.total : 0,
      });
    }

    return {
      total_legs: totalLegs,
      won_legs: wonLegs,
      lost_legs: lostLegs,
      pending_legs: pendingLegs,
      void_legs: voidLegs,
      leg_win_rate: legWinRate,
      avg_leg_odds: avgLegOdds,
      performance_by_league: performanceByLeague,
      performance_by_bet_type: performanceByBetType,
    };
  }

  async getOddsAnalysis(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<OddsAnalysis[]> {
    let query = this.supabase
      .from('main_bets')
      .select('date, stake, odds, profit_loss, state, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .not('odds', 'is', null);

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: bets, error } = await query;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch odds analysis', 500);
    }

    // Define odds ranges
    const ranges = [
      { label: '1.0-1.5', min: 1.0, max: 1.5 },
      { label: '1.5-2.0', min: 1.5, max: 2.0 },
      { label: '2.0-2.5', min: 2.0, max: 2.5 },
      { label: '2.5-3.0', min: 2.5, max: 3.0 },
      { label: '3.0-4.0', min: 3.0, max: 4.0 },
      { label: '4.0+', min: 4.0, max: Infinity },
    ];

    const rangeMap = new Map<string, OddsAnalysis>();

    ranges.forEach((range) => {
      rangeMap.set(range.label, {
        range: range.label,
        min_odds: range.min,
        max_odds: range.max === Infinity ? 999 : range.max,
        total_bets: 0,
        total_stake: 0,
        total_profit: 0,
        roi: 0,
        win_rate: 0,
      });
    });

    bets?.forEach((bet) => {
      // Use effective odds (excluding voided legs) for analytics
      const effectiveOdds = this.calculateEffectiveOdds(bet);
      if (!effectiveOdds || effectiveOdds < 1) return;

      let rangeLabel = '';
      for (const range of ranges) {
        if (effectiveOdds >= range.min && (range.max === Infinity || effectiveOdds < range.max)) {
          rangeLabel = range.label;
          break;
        }
      }

      if (rangeLabel && rangeMap.has(rangeLabel)) {
        const rangeData = rangeMap.get(rangeLabel)!;
        rangeData.total_bets++;
        rangeData.total_stake += Number(bet.stake || 0);
        rangeData.total_profit += Number(bet.profit_loss || 0);
      }
    });

    // Calculate ROI and win rate for each range
    const results = Array.from(rangeMap.values());
    for (const result of results) {
      result.roi = result.total_stake > 0 ? result.total_profit / result.total_stake : 0;

      // Calculate win rate for this range (exclude pending bets)
      const rangeBets = bets?.filter((b) => {
        const odds = Number(b.odds);
        if (!odds) return false;
        return odds >= result.min_odds && odds < (result.max_odds === 999 ? Infinity : result.max_odds);
      });
      const resolvedRangeBets = rangeBets?.filter((b) => b.state === 'won' || b.state === 'lost') || [];
      const wonBets = resolvedRangeBets.filter((b) => b.state === 'won').length || 0;
      result.win_rate = resolvedRangeBets.length > 0 ? wonBets / resolvedRangeBets.length : 0;
    }

    return results.filter((r) => r.total_bets > 0);
  }

  async getTeamPerformance(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TeamPerformance[]> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch team performance', 500);
    }

    const teamMap = new Map<string, TeamPerformance>();

    bets?.forEach((bet) => {
      bet.legs?.forEach((leg: any) => {
        const profit = Number(bet.profit_loss || 0);

        // Process home team
        if (leg.home_team_id) {
          if (!teamMap.has(leg.home_team_id)) {
            teamMap.set(leg.home_team_id, {
              team_id: leg.home_team_id,
              team_name: '',
              as_home: { total_legs: 0, won_legs: 0, win_rate: 0, total_profit: 0 },
              as_away: { total_legs: 0, won_legs: 0, win_rate: 0, total_profit: 0 },
              total: { total_legs: 0, won_legs: 0, win_rate: 0, total_profit: 0 },
            });
          }
          const teamData = teamMap.get(leg.home_team_id)!;
          // Only count resolved legs (won/lost/void) for win rate calculation
          if (leg.result_state !== 'pending') {
            teamData.as_home.total_legs++;
            teamData.total.total_legs++;
            if (leg.result_state === 'won') {
              teamData.as_home.won_legs++;
              teamData.total.won_legs++;
              teamData.as_home.total_profit += profit;
              teamData.total.total_profit += profit;
            }
          }
        }

        // Process away team
        if (leg.away_team_id) {
          if (!teamMap.has(leg.away_team_id)) {
            teamMap.set(leg.away_team_id, {
              team_id: leg.away_team_id,
              team_name: '',
              as_home: { total_legs: 0, won_legs: 0, win_rate: 0, total_profit: 0 },
              as_away: { total_legs: 0, won_legs: 0, win_rate: 0, total_profit: 0 },
              total: { total_legs: 0, won_legs: 0, win_rate: 0, total_profit: 0 },
            });
          }
          const teamData = teamMap.get(leg.away_team_id)!;
          // Only count resolved legs (won/lost/void) for win rate calculation
          if (leg.result_state !== 'pending') {
            teamData.as_away.total_legs++;
            teamData.total.total_legs++;
            if (leg.result_state === 'won') {
              teamData.as_away.won_legs++;
              teamData.total.won_legs++;
              teamData.as_away.total_profit += profit;
              teamData.total.total_profit += profit;
            }
          }
        }
      });
    });

    // Calculate win rates
    const results = Array.from(teamMap.values());
    results.forEach(result => {
      result.as_home.win_rate = result.as_home.total_legs > 0 ? result.as_home.won_legs / result.as_home.total_legs : 0;
      result.as_away.win_rate = result.as_away.total_legs > 0 ? result.as_away.won_legs / result.as_away.total_legs : 0;
      result.total.win_rate = result.total.total_legs > 0 ? result.total.won_legs / result.total.total_legs : 0;
    });

    // Batch fetch all team names
    const teamIds = results.map(r => r.team_id);
    const teamNamesMap = new Map<string, string>();
    if (teamIds.length > 0) {
      const batchSize = 100;
      for (let i = 0; i < teamIds.length; i += batchSize) {
        const batch = teamIds.slice(i, i + batchSize);
        const { data: teams } = await this.supabase
          .from('reference_items')
          .select('id, name')
          .in('id', batch);
        
        if (teams) {
          teams.forEach(team => {
            teamNamesMap.set(team.id, team.name);
          });
        }
      }
    }

    // Set team names
    results.forEach(result => {
      result.team_name = teamNamesMap.get(result.team_id) || '';
    });

    return results.filter((r) => r.total.total_legs > 0);
  }

  async getBestWorstPerformers(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<BestWorstPerformers> {
    const [byLeague, byBetType, byCategory] = await Promise.all([
      this.getByLeague(userId, startDate, endDate),
      this.getByBetType(userId, startDate, endDate),
      this.getByCategory(userId, startDate, endDate),
    ]);

    return {
      best_leagues: byLeague.sort((a, b) => b.total_profit - a.total_profit).slice(0, 5),
      worst_leagues: byLeague.sort((a, b) => a.total_profit - b.total_profit).slice(0, 5),
      best_bet_types: byBetType.sort((a, b) => b.total_profit - a.total_profit).slice(0, 5),
      worst_bet_types: byBetType.sort((a, b) => a.total_profit - b.total_profit).slice(0, 5),
      best_categories: byCategory.sort((a, b) => b.total_profit - a.total_profit).slice(0, 5),
      worst_categories: byCategory.sort((a, b) => a.total_profit - b.total_profit).slice(0, 5),
    };
  }

  async getStreakAnalysis(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<StreakAnalysis> {
    // For current streak, we need ALL bets including today, regardless of filters
    // CRITICAL: No date filters applied to this query - it gets ALL bets for the user
    // This ensures today's bets are ALWAYS included in current streak calculation
    let allBetsQuery = this.supabase
      .from('main_bets')
      .select('date, state, profit_loss')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('state', ['won', 'lost', 'pending'])
      .order('date', { ascending: true });
    // NOTE: No .gte() or .lte() date filters here - this ensures ALL bets are fetched

    // For longest streaks, we can apply date filters
    let filteredQuery = this.supabase
      .from('main_bets')
      .select('date, state, profit_loss')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('state', ['won', 'lost'])
      .order('date', { ascending: true });

    if (startDate) {
      filteredQuery = filteredQuery.gte('date', startDate);
    }
    if (endDate) {
      // Parse the endDate and ensure it includes the full day
      let endDateParsed: Date;
      if (endDate.includes('T')) {
        endDateParsed = new Date(endDate);
      } else {
        // If it's just a date string, create date at end of day
        endDateParsed = new Date(endDate);
        endDateParsed.setHours(23, 59, 59, 999);
      }
      filteredQuery = filteredQuery.lte('date', endDateParsed.toISOString());
    }

    // Fetch all bets for current streak (always includes today)
    const { data: allBets, error: allBetsError } = await allBetsQuery;
    
    // Fetch filtered bets for longest streaks (if filters are applied)
    const { data: filteredBets, error: filteredError } = startDate || endDate 
      ? await filteredQuery 
      : { data: allBets, error: allBetsError };

    if (allBetsError || filteredError) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch streak analysis', 500);
    }

    // Use all bets for current streak calculation (includes today)
    const bets = allBets || [];
    // Use filtered bets for longest streaks
    const betsForLongest = filteredBets || bets;

    if (!bets || bets.length === 0) {
      return {
        current_streak: { type: 'win', length: 0, start_date: '' },
        longest_win_streak: { length: 0, start_date: '', end_date: '' },
        longest_loss_streak: { length: 0, start_date: '', end_date: '' },
        recent_bets: [],
      };
    }

    // Calculate current streak from the most recent bets
    // Filter to only resolved bets (won/lost) for streak calculation
    // Pending bets don't count in streaks, but we need to see them to know if there are newer bets
    const resolvedBets = bets.filter(b => b.state === 'won' || b.state === 'lost');
    
    if (resolvedBets.length === 0) {
      return {
        current_streak: { type: 'win', length: 0, start_date: '' },
        longest_win_streak: { length: 0, start_date: '', end_date: '' },
        longest_loss_streak: { length: 0, start_date: '', end_date: '' },
        recent_bets: bets.slice(-10).reverse().map((bet) => ({
          date: bet.date,
          state: bet.state as 'won' | 'lost' | 'pending' | 'void',
          profit_loss: bet.profit_loss,
        })),
      };
    }

    // Calculate current streak from resolved bets
    // IMPORTANT: We fetch ALL bets (no date filter) so today's bets are always included
    // Start from the MOST RECENT resolved bet (last in array since sorted ascending by date)
    // This ensures today's bets are included if they're marked as won/lost
    const mostRecentBet = resolvedBets[resolvedBets.length - 1];
    const mostRecentState = mostRecentBet.state; // 'won' or 'lost'
    let currentStreakType: 'win' | 'loss' = mostRecentState === 'won' ? 'win' : 'loss';
    let currentStreakLength = 1;
    let currentStreakStart = mostRecentBet.date;

    // Go backwards from the most recent bet to count consecutive wins/losses
    // This builds the current streak from the most recent bet backwards
    // IMPORTANT: Compare state ('won'/'lost') not streak type ('win'/'loss')
    for (let i = resolvedBets.length - 2; i >= 0; i--) {
      if (resolvedBets[i].state === mostRecentState) {
        currentStreakLength++;
        currentStreakStart = resolvedBets[i].date;
      } else {
        break; // Streak broken, stop counting
      }
    }

    let longestWinStreak = { length: 0, start_date: '', end_date: '' };
    let longestLossStreak = { length: 0, start_date: '', end_date: '' };
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let winStreakStart = '';
    let lossStreakStart = '';

    // Calculate longest streaks using filtered bets (if filters applied)
    for (let i = 0; i < betsForLongest.length; i++) {
      const bet = betsForLongest[i];
      if (bet.state === 'won') {
        if (currentLossStreak > 0) {
          if (currentLossStreak > longestLossStreak.length) {
            longestLossStreak = {
              length: currentLossStreak,
              start_date: lossStreakStart,
              end_date: betsForLongest[i - 1].date,
            };
          }
          currentLossStreak = 0;
        }
        if (currentWinStreak === 0) {
          winStreakStart = bet.date;
        }
        currentWinStreak++;
      } else if (bet.state === 'lost') {
        if (currentWinStreak > 0) {
          if (currentWinStreak > longestWinStreak.length) {
            longestWinStreak = {
              length: currentWinStreak,
              start_date: winStreakStart,
              end_date: betsForLongest[i - 1].date,
            };
          }
          currentWinStreak = 0;
        }
        if (currentLossStreak === 0) {
          lossStreakStart = bet.date;
        }
        currentLossStreak++;
      }
    }

    // Check final streaks
    if (currentWinStreak > longestWinStreak.length && betsForLongest.length > 0) {
      longestWinStreak = {
        length: currentWinStreak,
        start_date: winStreakStart,
        end_date: betsForLongest[betsForLongest.length - 1].date,
      };
    }
    if (currentLossStreak > longestLossStreak.length && betsForLongest.length > 0) {
      longestLossStreak = {
        length: currentLossStreak,
        start_date: lossStreakStart,
        end_date: betsForLongest[betsForLongest.length - 1].date,
      };
    }

    // Get recent bets (last 10) - include all bets (won, lost, pending)
    const recentBets = bets
      .slice(-10)
      .reverse()
      .map((bet) => ({
        date: bet.date,
        state: bet.state as 'won' | 'lost' | 'pending' | 'void',
        profit_loss: bet.profit_loss,
      }));

    return {
      current_streak: {
        type: currentStreakType,
        length: currentStreakLength,
        start_date: currentStreakStart,
      },
      longest_win_streak: longestWinStreak,
      longest_loss_streak: longestLossStreak,
      recent_bets: recentBets,
    };
  }

  async getResponsibleDetailedAnalytics(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<ResponsibleDetailedAnalytics[]> {
    try {
      // Get all bets with legs
      let betsQuery = this.supabase
        .from('main_bets')
        .select('*, legs(*)')
        .eq('user_id', userId)
        .is('deleted_at', null);

      if (startDate) {
        betsQuery = betsQuery.gte('date', startDate);
      }

      if (endDate) {
        betsQuery = betsQuery.lte('date', endDate);
      }

      const { data: bets, error } = await betsQuery;

      if (error) {
        console.error('[AnalyticsService] Error fetching bets for responsible detailed analytics:', error);
        throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch responsible detailed analytics', 500);
      }

      if (!bets || bets.length === 0) {
        return [];
      }

    // Calculate total bets and legs for dynamic thresholds
    const totalBets = bets?.length || 0;
    const totalLegs = bets?.reduce((sum, bet) => sum + (bet.legs?.length || 0), 0) || 0;
    const minSampleSizes = this.getMinSampleSizes(totalBets, totalLegs);

    // Group legs by responsible_id
    const responsibleMap = new Map<string, {
      responsible_id: string;
      responsible_name: string;
      bets: any[];
      legs: any[];
      leagueMap: Map<string, { league_id: string; league_name: string; profit: number; bet_count: number; stake: number; won: number; total: number; processedBets: Set<string> }>;
      teamMap: Map<string, { team_id: string; team_name: string; profit: number; bet_count: number; stake: number; won: number; total: number; processedBets: Set<string> }>;
      betTypeMap: Map<string, { bet_type_id: string; bet_type_name: string; profit: number; bet_count: number; stake: number; won: number; total: number; processedBets: Set<string> }>;
      categoryMap: Map<string, { category_id: string; category_name: string; profit: number; bet_count: number; stake: number; won: number; total: number; processedBets: Set<string> }>;
      dayMap: Map<number, { day: string; day_number: number; profit: number; bet_count: number; stake: number; won: number; total: number; processedBets: Set<string> }>;
      hourMap: Map<number, { hour: number; profit: number; bet_count: number; stake: number; won: number; total: number; processedBets: Set<string> }>;
      monthMap: Map<string, { month: string; month_number: number; year: number; profit: number; bet_count: number; stake: number; won: number; total: number; processedBets: Set<string> }>;
      oddsRangeMap: Map<string, { range: string; min_odds: number; max_odds: number; profit: number; bet_count: number; stake: number; won: number; total: number; processedBets: Set<string> }>;
      legCountMap: Map<number, { bet_count: number; won: number; total_stake: number; total_profit: number }>;
      // Leg-level tracking (based on leg.result_state, not bet.state)
      legLeagueMap: Map<string, { league_id: string; league_name: string; leg_count: number; won_legs: number; total_resolved: number }>;
      legTeamMap: Map<string, { team_id: string; team_name: string; leg_count: number; won_legs: number; total_resolved: number }>;
      legCategoryMap: Map<string, { category_id: string; category_name: string; leg_count: number; won_legs: number; total_resolved: number }>;
      legBetTypeMap: Map<string, { bet_type_id: string; bet_type_name: string; leg_count: number; won_legs: number; total_resolved: number }>;
      legDayMap: Map<number, { day: string; day_number: number; leg_count: number; won_legs: number; total_resolved: number }>;
    }>();

    // Process all bets and legs
    bets?.forEach((bet) => {
      bet.legs?.forEach((leg: any) => {
        if (!leg.responsible_id) return;

        const responsibleId = leg.responsible_id;
        if (!responsibleMap.has(responsibleId)) {
          responsibleMap.set(responsibleId, {
            responsible_id: responsibleId,
            responsible_name: '',
            bets: [],
            legs: [],
            leagueMap: new Map(),
            teamMap: new Map(),
            betTypeMap: new Map(),
            categoryMap: new Map(),
            dayMap: new Map(),
            hourMap: new Map(),
            monthMap: new Map(),
            oddsRangeMap: new Map(),
            legCountMap: new Map(),
            legLeagueMap: new Map(),
            legTeamMap: new Map(),
            legCategoryMap: new Map(),
            legBetTypeMap: new Map(),
            legDayMap: new Map(),
          });
        }

        const responsibleData = responsibleMap.get(responsibleId)!;
        if (!responsibleData.bets.includes(bet)) {
          responsibleData.bets.push(bet);
        }
        responsibleData.legs.push(leg);

        // Track leagues
        if (leg.league_id) {
          if (!responsibleData.leagueMap.has(leg.league_id)) {
            responsibleData.leagueMap.set(leg.league_id, {
              league_id: leg.league_id,
              league_name: '',
              profit: 0,
              bet_count: 0,
              stake: 0,
              won: 0,
              total: 0,
              processedBets: new Set(),
            });
          }
          const leagueData = responsibleData.leagueMap.get(leg.league_id)!;
          // Only count stake/profit/bet_count once per bet
          if (!leagueData.processedBets.has(bet.id)) {
            leagueData.stake += Number(bet.stake || 0);
            leagueData.profit += Number(bet.profit_loss || 0);
            leagueData.bet_count += 1; // Count unique bets
            if (bet.state === 'won') leagueData.won += 1;
            if (bet.state === 'won' || bet.state === 'lost') leagueData.total += 1;
            leagueData.processedBets.add(bet.id);
          }
        }

        // Track teams (home and away) with profit tracking
        if (leg.home_team_id) {
          if (!responsibleData.teamMap.has(leg.home_team_id)) {
            responsibleData.teamMap.set(leg.home_team_id, {
              team_id: leg.home_team_id,
              team_name: '',
              profit: 0,
              bet_count: 0,
              stake: 0,
              won: 0,
              total: 0,
              processedBets: new Set(),
            });
          }
          const teamData = responsibleData.teamMap.get(leg.home_team_id)!;
          // Only count stake/profit/bet_count once per bet
          if (!teamData.processedBets.has(bet.id)) {
            teamData.stake += Number(bet.stake || 0);
            teamData.profit += Number(bet.profit_loss || 0);
            teamData.bet_count += 1; // Count unique bets
            if (bet.state === 'won') teamData.won += 1;
            if (bet.state === 'won' || bet.state === 'lost') teamData.total += 1;
            teamData.processedBets.add(bet.id);
          }
        }
        if (leg.away_team_id) {
          if (!responsibleData.teamMap.has(leg.away_team_id)) {
            responsibleData.teamMap.set(leg.away_team_id, {
              team_id: leg.away_team_id,
              team_name: '',
              profit: 0,
              bet_count: 0,
              stake: 0,
              won: 0,
              total: 0,
              processedBets: new Set(),
            });
          }
          const teamData = responsibleData.teamMap.get(leg.away_team_id)!;
          // Only count stake/profit/bet_count once per bet
          if (!teamData.processedBets.has(bet.id)) {
            teamData.stake += Number(bet.stake || 0);
            teamData.profit += Number(bet.profit_loss || 0);
            teamData.bet_count += 1; // Count unique bets
            if (bet.state === 'won') teamData.won += 1;
            if (bet.state === 'won' || bet.state === 'lost') teamData.total += 1;
            teamData.processedBets.add(bet.id);
          }
        }

        // Track bet types
        if (leg.bet_type_id) {
          if (!responsibleData.betTypeMap.has(leg.bet_type_id)) {
            responsibleData.betTypeMap.set(leg.bet_type_id, {
              bet_type_id: leg.bet_type_id,
              bet_type_name: '',
              profit: 0,
              bet_count: 0,
              stake: 0,
              won: 0,
              total: 0,
              processedBets: new Set(),
            });
          }
          const betTypeData = responsibleData.betTypeMap.get(leg.bet_type_id)!;
          // Only count stake/profit/bet_count once per bet
          if (!betTypeData.processedBets.has(bet.id)) {
            betTypeData.stake += Number(bet.stake || 0);
            betTypeData.profit += Number(bet.profit_loss || 0);
            betTypeData.bet_count += 1; // Count unique bets
            if (bet.state === 'won') betTypeData.won += 1;
            if (bet.state === 'won' || bet.state === 'lost') betTypeData.total += 1;
            betTypeData.processedBets.add(bet.id);
          }
        }

        // Track categories
        if (leg.category_id) {
          if (!responsibleData.categoryMap.has(leg.category_id)) {
            responsibleData.categoryMap.set(leg.category_id, {
              category_id: leg.category_id,
              category_name: '',
              profit: 0,
              bet_count: 0,
              stake: 0,
              won: 0,
              total: 0,
              processedBets: new Set(),
            });
          }
          const categoryData = responsibleData.categoryMap.get(leg.category_id)!;
          // Only count stake/profit/bet_count once per bet
          if (!categoryData.processedBets.has(bet.id)) {
            categoryData.stake += Number(bet.stake || 0);
            categoryData.profit += Number(bet.profit_loss || 0);
            categoryData.bet_count += 1; // Count unique bets
            if (bet.state === 'won') categoryData.won += 1;
            if (bet.state === 'won' || bet.state === 'lost') categoryData.total += 1;
            categoryData.processedBets.add(bet.id);
          }
        }

        // Track day of week (bet-level: uses bet.date and bet.state)
        // Note: A bet is counted once per day, even if it has multiple legs on that day
        // Bet-level uses bet.state (bet resolved), while leg-level uses leg.result_state (leg resolved)
        // This can cause discrepancies: e.g., 6 bets resolved but only 5 legs resolved (one leg still pending)
        const betDate = new Date(bet.date);
        const dayOfWeek = betDate.getDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if (!responsibleData.dayMap.has(dayOfWeek)) {
          responsibleData.dayMap.set(dayOfWeek, {
              day: dayNames[dayOfWeek],
              day_number: dayOfWeek,
              profit: 0,
              bet_count: 0,
              stake: 0,
              won: 0,
              total: 0,
              processedBets: new Set(),
            });
          }
          const dayData = responsibleData.dayMap.get(dayOfWeek)!;
          // Only count stake/profit/bet_count once per bet
          if (!dayData.processedBets.has(bet.id)) {
            dayData.stake += Number(bet.stake || 0);
            dayData.profit += Number(bet.profit_loss || 0);
            dayData.bet_count += 1; // Count unique bets
            if (bet.state === 'won') dayData.won += 1;
            if (bet.state === 'won' || bet.state === 'lost') dayData.total += 1;
            dayData.processedBets.add(bet.id);
          }

        // Track hour of day
        const hour = betDate.getHours();
        if (!responsibleData.hourMap.has(hour)) {
          responsibleData.hourMap.set(hour, {
              hour,
              profit: 0,
              bet_count: 0,
              stake: 0,
              won: 0,
              total: 0,
              processedBets: new Set(),
            });
          }
          const hourData = responsibleData.hourMap.get(hour)!;
          // Only count stake/profit/bet_count once per bet
          if (!hourData.processedBets.has(bet.id)) {
            hourData.stake += Number(bet.stake || 0);
            hourData.profit += Number(bet.profit_loss || 0);
            hourData.bet_count += 1; // Count unique bets
            if (bet.state === 'won') hourData.won += 1;
            if (bet.state === 'won' || bet.state === 'lost') hourData.total += 1;
            hourData.processedBets.add(bet.id);
          }

        // Track month
        const month = betDate.getMonth();
        const year = betDate.getFullYear();
        const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
        const monthKey = `${year}-${month}`;
        if (!responsibleData.monthMap.has(monthKey)) {
          responsibleData.monthMap.set(monthKey, {
              month: monthNames[month],
              month_number: month + 1,
              year,
              profit: 0,
              bet_count: 0,
              stake: 0,
              won: 0,
              total: 0,
              processedBets: new Set(),
            });
          }
          const monthData = responsibleData.monthMap.get(monthKey)!;
          // Only count stake/profit/bet_count once per bet
          if (!monthData.processedBets.has(bet.id)) {
            monthData.stake += Number(bet.stake || 0);
            monthData.profit += Number(bet.profit_loss || 0);
            monthData.bet_count += 1; // Count unique bets
            if (bet.state === 'won') monthData.won += 1;
            if (bet.state === 'won' || bet.state === 'lost') monthData.total += 1;
            monthData.processedBets.add(bet.id);
          }

        // Track odds ranges
        const effectiveOdds = this.calculateEffectiveOdds(bet);
        if (effectiveOdds && effectiveOdds >= 1) {
          const oddsRanges = [
            { min: 1.0, max: 1.5, label: '1.0-1.5' },
            { min: 1.5, max: 2.0, label: '1.5-2.0' },
            { min: 2.0, max: 3.0, label: '2.0-3.0' },
            { min: 3.0, max: 5.0, label: '3.0-5.0' },
            { min: 5.0, max: 10.0, label: '5.0-10.0' },
            { min: 10.0, max: Infinity, label: '10.0+' },
          ];
          let rangeLabel = '';
          for (const range of oddsRanges) {
            if (effectiveOdds >= range.min && (range.max === Infinity || effectiveOdds < range.max)) {
              rangeLabel = range.label;
              break;
            }
          }
          if (rangeLabel) {
            if (!responsibleData.oddsRangeMap.has(rangeLabel)) {
              const range = oddsRanges.find(r => r.label === rangeLabel)!;
              responsibleData.oddsRangeMap.set(rangeLabel, {
                range: rangeLabel,
                min_odds: range.min,
                max_odds: range.max === Infinity ? 999 : range.max,
                profit: 0,
                bet_count: 0,
                stake: 0,
                won: 0,
                total: 0,
                processedBets: new Set(),
              });
            }
            const oddsData = responsibleData.oddsRangeMap.get(rangeLabel)!;
            // Only count stake/profit/bet_count once per bet
            if (!oddsData.processedBets.has(bet.id)) {
              oddsData.stake += Number(bet.stake || 0);
              oddsData.profit += Number(bet.profit_loss || 0);
              oddsData.bet_count += 1; // Count unique bets
              if (bet.state === 'won') oddsData.won += 1;
              if (bet.state === 'won' || bet.state === 'lost') oddsData.total += 1;
              oddsData.processedBets.add(bet.id);
            }
          }
        }

        // ============================================================
        // LEG-LEVEL TRACKING (based on leg.result_state, not bet.state)
        // ============================================================
        
        // Track leg-level leagues
        if (leg.league_id) {
          if (!responsibleData.legLeagueMap.has(leg.league_id)) {
            responsibleData.legLeagueMap.set(leg.league_id, {
              league_id: leg.league_id,
              league_name: '',
              leg_count: 0,
              won_legs: 0,
              total_resolved: 0,
            });
          }
          const legLeagueData = responsibleData.legLeagueMap.get(leg.league_id)!;
          legLeagueData.leg_count += 1;
          if (leg.result_state === 'won') {
            legLeagueData.won_legs += 1;
            legLeagueData.total_resolved += 1;
          } else if (leg.result_state === 'lost') {
            legLeagueData.total_resolved += 1;
          }
          // Note: pending and void legs are excluded from total_resolved
        }

        // Track leg-level teams
        if (leg.home_team_id) {
          if (!responsibleData.legTeamMap.has(leg.home_team_id)) {
            responsibleData.legTeamMap.set(leg.home_team_id, {
              team_id: leg.home_team_id,
              team_name: '',
              leg_count: 0,
              won_legs: 0,
              total_resolved: 0,
            });
          }
          const legTeamData = responsibleData.legTeamMap.get(leg.home_team_id)!;
          legTeamData.leg_count += 1;
          if (leg.result_state === 'won') {
            legTeamData.won_legs += 1;
            legTeamData.total_resolved += 1;
          } else if (leg.result_state === 'lost') {
            legTeamData.total_resolved += 1;
          }
        }
        if (leg.away_team_id) {
          if (!responsibleData.legTeamMap.has(leg.away_team_id)) {
            responsibleData.legTeamMap.set(leg.away_team_id, {
              team_id: leg.away_team_id,
              team_name: '',
              leg_count: 0,
              won_legs: 0,
              total_resolved: 0,
            });
          }
          const legTeamData = responsibleData.legTeamMap.get(leg.away_team_id)!;
          legTeamData.leg_count += 1;
          if (leg.result_state === 'won') {
            legTeamData.won_legs += 1;
            legTeamData.total_resolved += 1;
          } else if (leg.result_state === 'lost') {
            legTeamData.total_resolved += 1;
          }
        }

        // Track leg-level categories
        if (leg.category_id) {
          if (!responsibleData.legCategoryMap.has(leg.category_id)) {
            responsibleData.legCategoryMap.set(leg.category_id, {
              category_id: leg.category_id,
              category_name: '',
              leg_count: 0,
              won_legs: 0,
              total_resolved: 0,
            });
          }
          const legCategoryData = responsibleData.legCategoryMap.get(leg.category_id)!;
          legCategoryData.leg_count += 1;
          if (leg.result_state === 'won') {
            legCategoryData.won_legs += 1;
            legCategoryData.total_resolved += 1;
          } else if (leg.result_state === 'lost') {
            legCategoryData.total_resolved += 1;
          }
        }

        // Track leg-level bet types
        if (leg.bet_type_id) {
          if (!responsibleData.legBetTypeMap.has(leg.bet_type_id)) {
            responsibleData.legBetTypeMap.set(leg.bet_type_id, {
              bet_type_id: leg.bet_type_id,
              bet_type_name: '',
              leg_count: 0,
              won_legs: 0,
              total_resolved: 0,
            });
          }
          const legBetTypeData = responsibleData.legBetTypeMap.get(leg.bet_type_id)!;
          legBetTypeData.leg_count += 1;
          if (leg.result_state === 'won') {
            legBetTypeData.won_legs += 1;
            legBetTypeData.total_resolved += 1;
          } else if (leg.result_state === 'lost') {
            legBetTypeData.total_resolved += 1;
          }
        }

        // Track leg-level days (leg-level: uses bet.date and leg.result_state)
        // Note: Each leg is counted separately, and only resolved legs (won/lost) count toward total_resolved
        // This can differ from bet-level counts if a bet is marked as resolved but has pending legs
        const legBetDate = new Date(bet.date);
        const legDayOfWeek = legBetDate.getDay();
        const legDayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        if (!responsibleData.legDayMap.has(legDayOfWeek)) {
          responsibleData.legDayMap.set(legDayOfWeek, {
            day: legDayNames[legDayOfWeek],
            day_number: legDayOfWeek,
            leg_count: 0,
            won_legs: 0,
            total_resolved: 0,
          });
        }
        const legDayData = responsibleData.legDayMap.get(legDayOfWeek)!;
        legDayData.leg_count += 1; // Count all legs (including pending/void)
        if (leg.result_state === 'won') {
          legDayData.won_legs += 1;
          legDayData.total_resolved += 1;
        } else if (leg.result_state === 'lost') {
          legDayData.total_resolved += 1;
        }
        // Note: pending and void legs are excluded from total_resolved
      });
    });

    // Collect all unique reference item IDs to fetch in batch
    const allReferenceIds = new Set<string>();
    for (const [responsibleId, data] of responsibleMap.entries()) {
      allReferenceIds.add(responsibleId);
      for (const leagueData of data.leagueMap.values()) {
        allReferenceIds.add(leagueData.league_id);
      }
      for (const teamData of data.teamMap.values()) {
        allReferenceIds.add(teamData.team_id);
      }
      for (const betTypeData of data.betTypeMap.values()) {
        allReferenceIds.add(betTypeData.bet_type_id);
      }
      for (const categoryData of data.categoryMap.values()) {
        allReferenceIds.add(categoryData.category_id);
      }
      // Include leg-level IDs
      for (const legLeagueData of data.legLeagueMap.values()) {
        allReferenceIds.add(legLeagueData.league_id);
      }
      for (const legTeamData of data.legTeamMap.values()) {
        allReferenceIds.add(legTeamData.team_id);
      }
      for (const legBetTypeData of data.legBetTypeMap.values()) {
        allReferenceIds.add(legBetTypeData.bet_type_id);
      }
      for (const legCategoryData of data.legCategoryMap.values()) {
        allReferenceIds.add(legCategoryData.category_id);
      }
    }

    // Fetch all reference items in one query
    const referenceItemsMap = new Map<string, string>();
    if (allReferenceIds.size > 0) {
      const referenceIdsArray = Array.from(allReferenceIds);
      // Supabase has a limit on IN queries, so batch if needed
      const batchSize = 100;
      for (let i = 0; i < referenceIdsArray.length; i += batchSize) {
        const batch = referenceIdsArray.slice(i, i + batchSize);
        const { data: referenceItems, error: refError } = await this.supabase
          .from('reference_items')
          .select('id, name')
          .in('id', batch);
        
        if (refError) {
          console.error('[AnalyticsService] Error fetching reference items:', refError);
          // Continue without reference items - names will be 'Unknown'
        } else if (referenceItems) {
          referenceItems.forEach(item => {
            if (item && item.id && item.name) {
              referenceItemsMap.set(item.id, item.name);
            }
          });
        }
      }
    }

    // Fetch reference item names and build results
    const results: ResponsibleDetailedAnalytics[] = [];
    for (const [responsibleId, data] of responsibleMap.entries()) {
      const responsibleName = referenceItemsMap.get(responsibleId) || 'Unknown';

      // Calculate leg count performance
      const legCountStats = new Map<number, { bet_count: number; won: number; total_stake: number; total_profit: number }>();
      data.bets.forEach((bet) => {
        const responsibleLegs = bet.legs?.filter((leg: any) => leg.responsible_id === responsibleId) || [];
        const numLegs = responsibleLegs.length;
        if (numLegs === 0) return;
        if (!legCountStats.has(numLegs)) {
          legCountStats.set(numLegs, {
            bet_count: 0,
            won: 0,
            total_stake: 0,
            total_profit: 0,
          });
        }
        const stats = legCountStats.get(numLegs)!;
        stats.bet_count += 1;
        if (bet.state === 'won') stats.won += 1;
        stats.total_stake += Number(bet.stake || 0);
        stats.total_profit += Number(bet.profit_loss || 0);
      });

      const performanceByLegCount = Array.from(legCountStats.entries()).map(([numLegs, stats]) => ({
        num_legs: numLegs,
        bet_count: stats.bet_count,
        win_rate: stats.bet_count > 0 ? stats.won / stats.bet_count : 0,
        total_profit: stats.total_profit,
        roi: stats.total_stake > 0 ? stats.total_profit / stats.total_stake : 0,
        total_stake: stats.total_stake,
      })).sort((a, b) => a.num_legs - b.num_legs);

      const bestLegCount = performanceByLegCount.length > 0
        ? performanceByLegCount.reduce((best, current) => {
            // If ROI is equal, prefer the one with more bets (more data points)
            if (current.roi > best.roi) return current;
            if (current.roi === best.roi && current.bet_count > best.bet_count) return current;
            return best;
          })
        : null;

      // Calculate summary (exclude pending bets from win rate)
      const totalStake = data.bets.reduce((sum, b) => sum + Number(b.stake || 0), 0);
      const totalProfit = data.bets.reduce((sum, b) => sum + Number(b.profit_loss || 0), 0);
      const resolvedBets = data.bets.filter((b) => b.state === 'won' || b.state === 'lost');
      const wonBets = resolvedBets.filter((b) => b.state === 'won').length;
      const winRate = resolvedBets.length > 0 ? wonBets / resolvedBets.length : 0;
      const roi = totalStake > 0 ? totalProfit / totalStake : 0;

      // Get league names and find most profitable
      const leagueDataArray = Array.from(data.leagueMap.values());
      leagueDataArray.forEach(leagueData => {
        leagueData.league_name = referenceItemsMap.get(leagueData.league_id) || '';
      });

      // Find most profitable league
      const mostProfitableLeague = leagueDataArray.length > 0
        ? leagueDataArray.reduce((best, current) => {
            // If profit is equal, prefer the one with more bets (more data points)
            if (current.profit > best.profit) return current;
            if (current.profit === best.profit && current.bet_count > best.bet_count) return current;
            return best;
          })
        : null;

      // Find favorite league (most bets)
      const favoriteLeague = leagueDataArray.length > 0
        ? leagueDataArray.reduce((best, current) => 
            current.bet_count > best.bet_count ? current : best
          )
        : null;

      // Get team names and find most profitable and favorite team
      const teamDataArray = Array.from(data.teamMap.values());
      teamDataArray.forEach(teamData => {
        teamData.team_name = referenceItemsMap.get(teamData.team_id) || '';
      });

      const mostProfitableTeam = teamDataArray.length > 0
        ? teamDataArray.reduce((best, current) => {
            if (current.profit > best.profit) return current;
            if (current.profit === best.profit && current.bet_count > best.bet_count) return current;
            return best;
          })
        : null;

      const favoriteTeam = teamDataArray.length > 0
        ? teamDataArray.reduce((best, current) => 
            current.bet_count > best.bet_count ? current : best
          )
        : null;

      // Get bet type names and find most profitable and favorite
      const betTypeDataArray = Array.from(data.betTypeMap.values());
      betTypeDataArray.forEach(betTypeData => {
        betTypeData.bet_type_name = referenceItemsMap.get(betTypeData.bet_type_id) || '';
      });

      const mostProfitableBetType = betTypeDataArray.length > 0
        ? betTypeDataArray.reduce((best, current) => {
            if (current.profit > best.profit) return current;
            if (current.profit === best.profit && current.bet_count > best.bet_count) return current;
            return best;
          })
        : null;

      const favoriteBetType = betTypeDataArray.length > 0
        ? betTypeDataArray.reduce((best, current) => 
            current.bet_count > best.bet_count ? current : best
          )
        : null;

      // Get category names and find most profitable and favorite
      const categoryDataArray = Array.from(data.categoryMap.values());
      categoryDataArray.forEach(categoryData => {
        categoryData.category_name = referenceItemsMap.get(categoryData.category_id) || '';
      });

      const mostProfitableCategory = categoryDataArray.length > 0
        ? categoryDataArray.reduce((best, current) => {
            if (current.profit > best.profit) return current;
            if (current.profit === best.profit && current.bet_count > best.bet_count) return current;
            return best;
          })
        : null;

      const favoriteCategory = categoryDataArray.length > 0
        ? categoryDataArray.reduce((best, current) => 
            current.bet_count > best.bet_count ? current : best
          )
        : null;

      // Get day data and find most profitable and favorite
      const dayDataArray = Array.from(data.dayMap.values());
      const mostProfitableDay = dayDataArray.length > 0
        ? dayDataArray.reduce((best, current) => {
            if (current.profit > best.profit) return current;
            if (current.profit === best.profit && current.bet_count > best.bet_count) return current;
            return best;
          })
        : null;

      const favoriteDay = dayDataArray.length > 0
        ? dayDataArray.reduce((best, current) => 
            current.bet_count > best.bet_count ? current : best
          )
        : null;

      // Find best/worst win rate and ROI (only consider statistically significant samples)
      const bestWinRateLeague = leagueDataArray.length > 0
        ? leagueDataArray
            .filter(l => l.total > 0 && this.isStatisticallySignificant(l.total, minSampleSizes.LEAGUE))
            .reduce((best, current) => {
              const currentWR = current.total > 0 ? current.won / current.total : 0;
              const bestWR = best.total > 0 ? best.won / best.total : 0;
              // If win rates are equal, prefer the one with more resolved bets (more data points)
              if (currentWR > bestWR) return current;
              if (currentWR === bestWR && current.total > best.total) return current;
              return best;
            }, null as any)
        : null;

      const worstWinRateLeague = leagueDataArray.length > 0
        ? leagueDataArray
            .filter(l => l.total > 0 && this.isStatisticallySignificant(l.total, minSampleSizes.LEAGUE))
            .reduce((worst, current) => {
              const currentWR = current.total > 0 ? current.won / current.total : 0;
              const worstWR = worst.total > 0 ? worst.won / worst.total : 0;
              // If win rates are equal, prefer the one with more resolved bets (more data points)
              if (currentWR < worstWR) return current;
              if (currentWR === worstWR && current.total > worst.total) return current;
              return worst;
            }, null as any)
        : null;

      const filteredLeaguesWithStake = leagueDataArray.filter(l => l.stake > 0);
      const bestROILeague = filteredLeaguesWithStake.length > 0
        ? filteredLeaguesWithStake.reduce((best, current) => {
            const currentROI = current.stake > 0 ? current.profit / current.stake : 0;
            const bestROI = best.stake > 0 ? best.profit / best.stake : 0;
            // If ROI is equal, prefer the one with more stake (more data points)
            if (currentROI > bestROI) return current;
            if (currentROI === bestROI && current.stake > best.stake) return current;
            return best;
          })
        : null;

      const worstROILeague = filteredLeaguesWithStake.length > 0
        ? filteredLeaguesWithStake.reduce((worst, current) => {
            const currentROI = current.stake > 0 ? current.profit / current.stake : 0;
            const worstROI = worst.stake > 0 ? worst.profit / worst.stake : 0;
            // If ROI is equal, prefer the one with more stake (more data points)
            if (currentROI < worstROI) return current;
            if (currentROI === worstROI && current.stake > worst.stake) return current;
            return worst;
          })
        : null;

      // Find worst performers (opposite of most profitable)
      const worstProfitableLeague = leagueDataArray.length > 0
        ? leagueDataArray.reduce((worst, current) => {
            if (current.profit < worst.profit) return current;
            if (current.profit === worst.profit && current.bet_count > worst.bet_count) return current;
            return worst;
          })
        : null;

      const worstProfitableTeam = teamDataArray.length > 0
        ? teamDataArray.reduce((worst, current) => {
            if (current.profit < worst.profit) return current;
            if (current.profit === worst.profit && current.bet_count > worst.bet_count) return current;
            return worst;
          })
        : null;

      const worstProfitableCategory = categoryDataArray.length > 0
        ? categoryDataArray.reduce((worst, current) => {
            if (current.profit < worst.profit) return current;
            if (current.profit === worst.profit && current.bet_count > worst.bet_count) return current;
            return worst;
          })
        : null;

      const worstProfitableBetType = betTypeDataArray.length > 0
        ? betTypeDataArray.reduce((worst, current) => {
            if (current.profit < worst.profit) return current;
            if (current.profit === worst.profit && current.bet_count > worst.bet_count) return current;
            return worst;
          })
        : null;

      const worstProfitableDay = dayDataArray.length > 0
        ? dayDataArray.reduce((worst, current) => {
            if (current.profit < worst.profit) return current;
            if (current.profit === worst.profit && current.bet_count > worst.bet_count) return current;
            return worst;
          })
        : null;

      // Get hour data and find best/worst (only consider statistically significant samples)
      const hourDataArray = Array.from(data.hourMap.values());
      const bestHour = hourDataArray.length > 0
        ? hourDataArray
            .filter(h => this.isStatisticallySignificant(h.total, minSampleSizes.HOUR))
            .reduce((best, current) => {
              const currentROI = current.stake > 0 ? current.profit / current.stake : 0;
              const bestROI = best.stake > 0 ? best.profit / best.stake : 0;
              if (currentROI > bestROI) return current;
              if (currentROI === bestROI && current.bet_count > best.bet_count) return current;
              return best;
            }, null as any)
        : null;

      const worstHour = hourDataArray.length > 0
        ? hourDataArray
            .filter(h => this.isStatisticallySignificant(h.total, minSampleSizes.HOUR))
            .reduce((worst, current) => {
              const currentROI = current.stake > 0 ? current.profit / current.stake : 0;
              const worstROI = worst.stake > 0 ? worst.profit / worst.stake : 0;
              if (currentROI < worstROI) return current;
              if (currentROI === worstROI && current.bet_count > worst.bet_count) return current;
              return worst;
            }, null as any)
        : null;

      // Get month data and find best/worst (only consider statistically significant samples)
      const monthDataArray = Array.from(data.monthMap.values());
      const bestMonth = monthDataArray.length > 0
        ? monthDataArray
            .filter(m => this.isStatisticallySignificant(m.total, minSampleSizes.MONTH))
            .reduce((best, current) => {
              const currentROI = current.stake > 0 ? current.profit / current.stake : 0;
              const bestROI = best.stake > 0 ? best.profit / best.stake : 0;
              if (currentROI > bestROI) return current;
              if (currentROI === bestROI && current.bet_count > best.bet_count) return current;
              return best;
            }, null as any)
        : null;

      const worstMonth = monthDataArray.length > 0
        ? monthDataArray
            .filter(m => this.isStatisticallySignificant(m.total, minSampleSizes.MONTH))
            .reduce((worst, current) => {
              const currentROI = current.stake > 0 ? current.profit / current.stake : 0;
              const worstROI = worst.stake > 0 ? worst.profit / worst.stake : 0;
              if (currentROI < worstROI) return current;
              if (currentROI === worstROI && current.bet_count > worst.bet_count) return current;
              return worst;
            }, null as any)
        : null;

      // Get odds range data and find best/worst (only consider statistically significant samples)
      const oddsRangeDataArray = Array.from(data.oddsRangeMap.values());
      const bestOddsRange = oddsRangeDataArray.length > 0
        ? oddsRangeDataArray
            .filter(o => this.isStatisticallySignificant(o.total, minSampleSizes.ODDS_RANGE))
            .reduce((best, current) => {
              const currentROI = current.stake > 0 ? current.profit / current.stake : 0;
              const bestROI = best.stake > 0 ? best.profit / best.stake : 0;
              if (currentROI > bestROI) return current;
              if (currentROI === bestROI && current.bet_count > best.bet_count) return current;
              return best;
            }, null as any)
        : null;

      const worstOddsRange = oddsRangeDataArray.length > 0
        ? oddsRangeDataArray
            .filter(o => this.isStatisticallySignificant(o.total, minSampleSizes.ODDS_RANGE))
            .reduce((worst, current) => {
              const currentROI = current.stake > 0 ? current.profit / current.stake : 0;
              const worstROI = worst.stake > 0 ? worst.profit / worst.stake : 0;
              if (currentROI < worstROI) return current;
              if (currentROI === worstROI && current.bet_count > worst.bet_count) return current;
              return worst;
            }, null as any)
        : null;

      // ============================================================
      // LEG-LEVEL CALCULATIONS (based on leg.result_state)
      // ============================================================
      
      // Get leg-level league data
      const legLeagueDataArray = Array.from(data.legLeagueMap.values());
      legLeagueDataArray.forEach(legLeagueData => {
        legLeagueData.league_name = referenceItemsMap.get(legLeagueData.league_id) || '';
      });

      const bestLegWinRateLeague = legLeagueDataArray.length > 0
        ? legLeagueDataArray
            .filter(l => l.total_resolved > 0 && this.isStatisticallySignificant(l.total_resolved, minSampleSizes.LEG_LEVEL))
            .reduce((best, current) => {
              const currentWR = current.total_resolved > 0 ? current.won_legs / current.total_resolved : 0;
              const bestWR = best.total_resolved > 0 ? best.won_legs / best.total_resolved : 0;
              // If win rates are equal, prefer the one with more legs (more data points)
              if (currentWR > bestWR) return current;
              if (currentWR === bestWR && current.leg_count > best.leg_count) return current;
              return best;
            }, null as any)
        : null;

      const worstLegWinRateLeague = legLeagueDataArray.length > 0
        ? legLeagueDataArray
            .filter(l => l.total_resolved > 0 && this.isStatisticallySignificant(l.total_resolved, minSampleSizes.LEG_LEVEL))
            .reduce((worst, current) => {
              const currentWR = current.total_resolved > 0 ? current.won_legs / current.total_resolved : 0;
              const worstWR = worst.total_resolved > 0 ? worst.won_legs / worst.total_resolved : 0;
              // If win rates are equal, prefer the one with more legs (more data points)
              if (currentWR < worstWR) return current;
              if (currentWR === worstWR && current.leg_count > worst.leg_count) return current;
              return worst;
            }, null as any)
        : null;

      const favoriteLegLeague = legLeagueDataArray.length > 0
        ? legLeagueDataArray.reduce((best, current) => 
            current.leg_count > best.leg_count ? current : best
          )
        : null;

      // Get leg-level team data
      const legTeamDataArray = Array.from(data.legTeamMap.values());
      legTeamDataArray.forEach(legTeamData => {
        legTeamData.team_name = referenceItemsMap.get(legTeamData.team_id) || '';
      });

      const bestLegWinRateTeam = legTeamDataArray.length > 0
        ? legTeamDataArray
            .filter(t => t.total_resolved > 0 && this.isStatisticallySignificant(t.total_resolved, minSampleSizes.LEG_LEVEL))
            .reduce((best, current) => {
              const currentWR = current.total_resolved > 0 ? current.won_legs / current.total_resolved : 0;
              const bestWR = best.total_resolved > 0 ? best.won_legs / best.total_resolved : 0;
              // If win rates are equal, prefer the one with more legs (more data points)
              if (currentWR > bestWR) return current;
              if (currentWR === bestWR && current.leg_count > best.leg_count) return current;
              return best;
            }, null as any)
        : null;

      const worstLegWinRateTeam = legTeamDataArray.length > 0
        ? legTeamDataArray
            .filter(t => t.total_resolved > 0 && this.isStatisticallySignificant(t.total_resolved, minSampleSizes.LEG_LEVEL))
            .reduce((worst, current) => {
              const currentWR = current.total_resolved > 0 ? current.won_legs / current.total_resolved : 0;
              const worstWR = worst.total_resolved > 0 ? worst.won_legs / worst.total_resolved : 0;
              // If win rates are equal, prefer the one with more legs (more data points)
              if (currentWR < worstWR) return current;
              if (currentWR === worstWR && current.leg_count > worst.leg_count) return current;
              return worst;
            }, null as any)
        : null;

      const favoriteLegTeam = legTeamDataArray.length > 0
        ? legTeamDataArray.reduce((best, current) => 
            current.leg_count > best.leg_count ? current : best
          )
        : null;

      // Get leg-level category data
      const legCategoryDataArray = Array.from(data.legCategoryMap.values());
      legCategoryDataArray.forEach(legCategoryData => {
        legCategoryData.category_name = referenceItemsMap.get(legCategoryData.category_id) || '';
      });

      const bestLegWinRateCategory = legCategoryDataArray.length > 0
        ? legCategoryDataArray
            .filter(c => c.total_resolved > 0 && this.isStatisticallySignificant(c.total_resolved, minSampleSizes.LEG_LEVEL))
            .reduce((best, current) => {
              const currentWR = current.total_resolved > 0 ? current.won_legs / current.total_resolved : 0;
              const bestWR = best.total_resolved > 0 ? best.won_legs / best.total_resolved : 0;
              // If win rates are equal, prefer the one with more legs (more data points)
              if (currentWR > bestWR) return current;
              if (currentWR === bestWR && current.leg_count > best.leg_count) return current;
              return best;
            }, null as any)
        : null;

      const worstLegWinRateCategory = legCategoryDataArray.length > 0
        ? legCategoryDataArray
            .filter(c => c.total_resolved > 0 && this.isStatisticallySignificant(c.total_resolved, minSampleSizes.LEG_LEVEL))
            .reduce((worst, current) => {
              const currentWR = current.total_resolved > 0 ? current.won_legs / current.total_resolved : 0;
              const worstWR = worst.total_resolved > 0 ? worst.won_legs / worst.total_resolved : 0;
              // If win rates are equal, prefer the one with more legs (more data points)
              if (currentWR < worstWR) return current;
              if (currentWR === worstWR && current.leg_count > worst.leg_count) return current;
              return worst;
            }, null as any)
        : null;

      const favoriteLegCategory = legCategoryDataArray.length > 0
        ? legCategoryDataArray.reduce((best, current) => 
            current.leg_count > best.leg_count ? current : best
          )
        : null;

      // Get leg-level bet type data
      const legBetTypeDataArray = Array.from(data.legBetTypeMap.values());
      legBetTypeDataArray.forEach(legBetTypeData => {
        legBetTypeData.bet_type_name = referenceItemsMap.get(legBetTypeData.bet_type_id) || '';
      });

      const bestLegWinRateBetType = legBetTypeDataArray.length > 0
        ? legBetTypeDataArray
            .filter(bt => bt.total_resolved > 0 && this.isStatisticallySignificant(bt.total_resolved, minSampleSizes.LEG_LEVEL))
            .reduce((best, current) => {
              const currentWR = current.total_resolved > 0 ? current.won_legs / current.total_resolved : 0;
              const bestWR = best.total_resolved > 0 ? best.won_legs / best.total_resolved : 0;
              // If win rates are equal, prefer the one with more legs (more data points)
              if (currentWR > bestWR) return current;
              if (currentWR === bestWR && current.leg_count > best.leg_count) return current;
              return best;
            }, null as any)
        : null;

      const worstLegWinRateBetType = legBetTypeDataArray.length > 0
        ? legBetTypeDataArray
            .filter(bt => bt.total_resolved > 0 && this.isStatisticallySignificant(bt.total_resolved, minSampleSizes.LEG_LEVEL))
            .reduce((worst, current) => {
              const currentWR = current.total_resolved > 0 ? current.won_legs / current.total_resolved : 0;
              const worstWR = worst.total_resolved > 0 ? worst.won_legs / worst.total_resolved : 0;
              // If win rates are equal, prefer the one with more legs (more data points)
              if (currentWR < worstWR) return current;
              if (currentWR === worstWR && current.leg_count > worst.leg_count) return current;
              return worst;
            }, null as any)
        : null;

      const favoriteLegBetType = legBetTypeDataArray.length > 0
        ? legBetTypeDataArray.reduce((best, current) => 
            current.leg_count > best.leg_count ? current : best
          )
        : null;

      // Get leg-level day data
      const legDayDataArray = Array.from(data.legDayMap.values());
      const bestLegWinRateDay = legDayDataArray.length > 0
        ? legDayDataArray
            .filter(d => d.total_resolved > 0 && this.isStatisticallySignificant(d.total_resolved, minSampleSizes.LEG_LEVEL))
            .reduce((best, current) => {
              const currentWR = current.total_resolved > 0 ? current.won_legs / current.total_resolved : 0;
              const bestWR = best.total_resolved > 0 ? best.won_legs / best.total_resolved : 0;
              // If win rates are equal, prefer the one with more legs (more data points)
              if (currentWR > bestWR) return current;
              if (currentWR === bestWR && current.leg_count > best.leg_count) return current;
              return best;
            }, null as any)
        : null;

      const worstLegWinRateDay = legDayDataArray.length > 0
        ? legDayDataArray
            .filter(d => d.total_resolved > 0 && this.isStatisticallySignificant(d.total_resolved, minSampleSizes.LEG_LEVEL))
            .reduce((worst, current) => {
              const currentWR = current.total_resolved > 0 ? current.won_legs / current.total_resolved : 0;
              const worstWR = worst.total_resolved > 0 ? worst.won_legs / worst.total_resolved : 0;
              // If win rates are equal, prefer the one with more legs (more data points)
              if (currentWR < worstWR) return current;
              if (currentWR === worstWR && current.leg_count > worst.leg_count) return current;
              return worst;
            }, null as any)
        : null;

      const favoriteLegDay = legDayDataArray.length > 0
        ? legDayDataArray.reduce((best, current) => 
            current.leg_count > best.leg_count ? current : best
          )
        : null;

      // Build performance arrays
      const performanceByLeague = leagueDataArray.map(league => ({
        league_id: league.league_id,
        league_name: league.league_name,
        total_stake: league.stake,
        total_profit: league.profit,
        roi: league.stake > 0 ? league.profit / league.stake : 0,
        win_rate: league.total > 0 ? league.won / league.total : 0,
        bet_count: league.bet_count,
      }));

      const performanceByBetType = betTypeDataArray.map(bt => ({
        bet_type_id: bt.bet_type_id,
        bet_type_name: bt.bet_type_name,
        total_stake: bt.stake,
        total_profit: bt.profit,
        roi: bt.stake > 0 ? bt.profit / bt.stake : 0,
        win_rate: bt.total > 0 ? bt.won / bt.total : 0,
        bet_count: bt.bet_count,
      }));

      const performanceByCategory = categoryDataArray.map(cat => ({
        category_id: cat.category_id,
        category_name: cat.category_name,
        total_stake: cat.stake,
        total_profit: cat.profit,
        roi: cat.stake > 0 ? cat.profit / cat.stake : 0,
        win_rate: cat.total > 0 ? cat.won / cat.total : 0,
        bet_count: cat.bet_count,
      }));

      results.push({
        responsible_id: responsibleId,
        responsible_name: responsibleName,
        summary: {
          total_stake: totalStake,
          total_profit: totalProfit,
          roi,
          win_rate: winRate,
          bet_count: data.bets.length,
        },
        most_profitable_league: mostProfitableLeague ? {
          league_id: mostProfitableLeague.league_id,
          league_name: mostProfitableLeague.league_name,
          total_profit: mostProfitableLeague.profit,
          bet_count: mostProfitableLeague.bet_count,
          win_rate: mostProfitableLeague.total > 0 ? mostProfitableLeague.won / mostProfitableLeague.total : 0,
          wins: mostProfitableLeague.won,
          total_resolved: mostProfitableLeague.total,
        } : null,
        most_profitable_team: mostProfitableTeam ? {
          team_id: mostProfitableTeam.team_id,
          team_name: mostProfitableTeam.team_name,
          total_profit: mostProfitableTeam.profit,
          bet_count: mostProfitableTeam.bet_count,
          win_rate: mostProfitableTeam.total > 0 ? mostProfitableTeam.won / mostProfitableTeam.total : 0,
          wins: mostProfitableTeam.won,
          total_resolved: mostProfitableTeam.total,
        } : null,
        most_profitable_category: mostProfitableCategory ? {
          category_id: mostProfitableCategory.category_id,
          category_name: mostProfitableCategory.category_name,
          total_profit: mostProfitableCategory.profit,
          bet_count: mostProfitableCategory.bet_count,
          win_rate: mostProfitableCategory.total > 0 ? mostProfitableCategory.won / mostProfitableCategory.total : 0,
          wins: mostProfitableCategory.won,
          total_resolved: mostProfitableCategory.total,
        } : null,
        most_profitable_bet_type: mostProfitableBetType ? {
          bet_type_id: mostProfitableBetType.bet_type_id,
          bet_type_name: mostProfitableBetType.bet_type_name,
          total_profit: mostProfitableBetType.profit,
          bet_count: mostProfitableBetType.bet_count,
          win_rate: mostProfitableBetType.total > 0 ? mostProfitableBetType.won / mostProfitableBetType.total : 0,
          wins: mostProfitableBetType.won,
          total_resolved: mostProfitableBetType.total,
        } : null,
        most_profitable_day: mostProfitableDay ? {
          day: mostProfitableDay.day,
          day_number: mostProfitableDay.day_number,
          total_profit: mostProfitableDay.profit,
          bet_count: mostProfitableDay.bet_count,
          win_rate: mostProfitableDay.total > 0 ? mostProfitableDay.won / mostProfitableDay.total : 0,
          wins: mostProfitableDay.won,
          total_resolved: mostProfitableDay.total,
        } : null,
        favorite_league: favoriteLeague ? {
          league_id: favoriteLeague.league_id,
          league_name: favoriteLeague.league_name,
          bet_count: favoriteLeague.bet_count,
          win_rate: favoriteLeague.total > 0 ? favoriteLeague.won / favoriteLeague.total : 0,
          wins: favoriteLeague.won,
          total_resolved: favoriteLeague.total,
        } : null,
        favorite_team: favoriteTeam ? {
          team_id: favoriteTeam.team_id,
          team_name: favoriteTeam.team_name,
          bet_count: favoriteTeam.bet_count,
          win_rate: favoriteTeam.total > 0 ? favoriteTeam.won / favoriteTeam.total : 0,
          wins: favoriteTeam.won,
          total_resolved: favoriteTeam.total,
        } : null,
        favorite_category: favoriteCategory ? {
          category_id: favoriteCategory.category_id,
          category_name: favoriteCategory.category_name,
          bet_count: favoriteCategory.bet_count,
          win_rate: favoriteCategory.total > 0 ? favoriteCategory.won / favoriteCategory.total : 0,
          wins: favoriteCategory.won,
          total_resolved: favoriteCategory.total,
        } : null,
        favorite_bet_type: favoriteBetType ? {
          bet_type_id: favoriteBetType.bet_type_id,
          bet_type_name: favoriteBetType.bet_type_name,
          bet_count: favoriteBetType.bet_count,
          win_rate: favoriteBetType.total > 0 ? favoriteBetType.won / favoriteBetType.total : 0,
          wins: favoriteBetType.won,
          total_resolved: favoriteBetType.total,
        } : null,
        favorite_day: favoriteDay ? {
          day: favoriteDay.day,
          day_number: favoriteDay.day_number,
          bet_count: favoriteDay.bet_count,
          win_rate: favoriteDay.total > 0 ? favoriteDay.won / favoriteDay.total : 0,
          wins: favoriteDay.won,
          total_resolved: favoriteDay.total,
        } : null,
        performance_by_league: performanceByLeague,
        performance_by_bet_type: performanceByBetType,
        performance_by_category: performanceByCategory,
        performance_by_leg_count: performanceByLegCount,
        best_leg_count: bestLegCount ? {
          num_legs: bestLegCount.num_legs,
          bet_count: bestLegCount.bet_count,
          win_rate: bestLegCount.win_rate,
          total_profit: bestLegCount.total_profit,
          roi: bestLegCount.roi,
          total_stake: bestLegCount.total_stake,
        } : null,
        best_win_rate_league: bestWinRateLeague ? {
          league_id: bestWinRateLeague.league_id,
          league_name: bestWinRateLeague.league_name,
          win_rate: bestWinRateLeague.total > 0 ? bestWinRateLeague.won / bestWinRateLeague.total : 0,
          bet_count: bestWinRateLeague.bet_count,
        } : null,
        worst_win_rate_league: worstWinRateLeague ? {
          league_id: worstWinRateLeague.league_id,
          league_name: worstWinRateLeague.league_name,
          win_rate: worstWinRateLeague.total > 0 ? worstWinRateLeague.won / worstWinRateLeague.total : 0,
          bet_count: worstWinRateLeague.bet_count,
        } : null,
        best_roi_league: bestROILeague ? {
          league_id: bestROILeague.league_id,
          league_name: bestROILeague.league_name,
          roi: bestROILeague.stake > 0 ? bestROILeague.profit / bestROILeague.stake : 0,
          bet_count: bestROILeague.bet_count,
        } : null,
        worst_roi_league: worstROILeague ? {
          league_id: worstROILeague.league_id,
          league_name: worstROILeague.league_name,
          roi: worstROILeague.stake > 0 ? worstROILeague.profit / worstROILeague.stake : 0,
          bet_count: worstROILeague.bet_count,
        } : null,
        worst_profitable_league: worstProfitableLeague ? {
          league_id: worstProfitableLeague.league_id,
          league_name: worstProfitableLeague.league_name,
          total_profit: worstProfitableLeague.profit,
          bet_count: worstProfitableLeague.bet_count,
          win_rate: worstProfitableLeague.total > 0 ? worstProfitableLeague.won / worstProfitableLeague.total : 0,
          wins: worstProfitableLeague.won,
          total_resolved: worstProfitableLeague.total,
        } : null,
        worst_profitable_team: worstProfitableTeam ? {
          team_id: worstProfitableTeam.team_id,
          team_name: worstProfitableTeam.team_name,
          total_profit: worstProfitableTeam.profit,
          bet_count: worstProfitableTeam.bet_count,
          win_rate: worstProfitableTeam.total > 0 ? worstProfitableTeam.won / worstProfitableTeam.total : 0,
          wins: worstProfitableTeam.won,
          total_resolved: worstProfitableTeam.total,
        } : null,
        worst_profitable_category: worstProfitableCategory ? {
          category_id: worstProfitableCategory.category_id,
          category_name: worstProfitableCategory.category_name,
          total_profit: worstProfitableCategory.profit,
          bet_count: worstProfitableCategory.bet_count,
          win_rate: worstProfitableCategory.total > 0 ? worstProfitableCategory.won / worstProfitableCategory.total : 0,
          wins: worstProfitableCategory.won,
          total_resolved: worstProfitableCategory.total,
        } : null,
        worst_profitable_bet_type: worstProfitableBetType ? {
          bet_type_id: worstProfitableBetType.bet_type_id,
          bet_type_name: worstProfitableBetType.bet_type_name,
          total_profit: worstProfitableBetType.profit,
          bet_count: worstProfitableBetType.bet_count,
          win_rate: worstProfitableBetType.total > 0 ? worstProfitableBetType.won / worstProfitableBetType.total : 0,
          wins: worstProfitableBetType.won,
          total_resolved: worstProfitableBetType.total,
        } : null,
        worst_profitable_day: worstProfitableDay ? {
          day: worstProfitableDay.day,
          day_number: worstProfitableDay.day_number,
          total_profit: worstProfitableDay.profit,
          bet_count: worstProfitableDay.bet_count,
          win_rate: worstProfitableDay.total > 0 ? worstProfitableDay.won / worstProfitableDay.total : 0,
          wins: worstProfitableDay.won,
          total_resolved: worstProfitableDay.total,
        } : null,
        best_hour: bestHour ? {
          hour: bestHour.hour,
          roi: bestHour.stake > 0 ? bestHour.profit / bestHour.stake : 0,
          win_rate: bestHour.total > 0 ? bestHour.won / bestHour.total : 0,
          total_profit: bestHour.profit,
          bet_count: bestHour.bet_count,
        } : null,
        worst_hour: worstHour ? {
          hour: worstHour.hour,
          roi: worstHour.stake > 0 ? worstHour.profit / worstHour.stake : 0,
          win_rate: worstHour.total > 0 ? worstHour.won / worstHour.total : 0,
          total_profit: worstHour.profit,
          bet_count: worstHour.bet_count,
        } : null,
        best_month: bestMonth ? {
          month: bestMonth.month,
          month_number: bestMonth.month_number,
          year: bestMonth.year,
          roi: bestMonth.stake > 0 ? bestMonth.profit / bestMonth.stake : 0,
          win_rate: bestMonth.total > 0 ? bestMonth.won / bestMonth.total : 0,
          total_profit: bestMonth.profit,
          bet_count: bestMonth.bet_count,
        } : null,
        worst_month: worstMonth ? {
          month: worstMonth.month,
          month_number: worstMonth.month_number,
          year: worstMonth.year,
          roi: worstMonth.stake > 0 ? worstMonth.profit / worstMonth.stake : 0,
          win_rate: worstMonth.total > 0 ? worstMonth.won / worstMonth.total : 0,
          total_profit: worstMonth.profit,
          bet_count: worstMonth.bet_count,
        } : null,
        best_odds_range: bestOddsRange ? {
          range: bestOddsRange.range,
          min_odds: bestOddsRange.min_odds,
          max_odds: bestOddsRange.max_odds,
          roi: bestOddsRange.stake > 0 ? bestOddsRange.profit / bestOddsRange.stake : 0,
          win_rate: bestOddsRange.total > 0 ? bestOddsRange.won / bestOddsRange.total : 0,
          total_profit: bestOddsRange.profit,
          bet_count: bestOddsRange.bet_count,
        } : null,
        worst_odds_range: worstOddsRange ? {
          range: worstOddsRange.range,
          min_odds: worstOddsRange.min_odds,
          max_odds: worstOddsRange.max_odds,
          roi: worstOddsRange.stake > 0 ? worstOddsRange.profit / worstOddsRange.stake : 0,
          win_rate: worstOddsRange.total > 0 ? worstOddsRange.won / worstOddsRange.total : 0,
          total_profit: worstOddsRange.profit,
          bet_count: worstOddsRange.bet_count,
        } : null,
        // Leg-level analytics (based on leg.result_state)
        leg_best_win_rate_league: bestLegWinRateLeague ? {
          league_id: bestLegWinRateLeague.league_id,
          league_name: bestLegWinRateLeague.league_name,
          win_rate: bestLegWinRateLeague.total_resolved > 0 ? bestLegWinRateLeague.won_legs / bestLegWinRateLeague.total_resolved : 0,
          leg_count: bestLegWinRateLeague.leg_count,
          wins: bestLegWinRateLeague.won_legs,
          total_resolved: bestLegWinRateLeague.total_resolved,
        } : null,
        leg_worst_win_rate_league: worstLegWinRateLeague ? {
          league_id: worstLegWinRateLeague.league_id,
          league_name: worstLegWinRateLeague.league_name,
          win_rate: worstLegWinRateLeague.total_resolved > 0 ? worstLegWinRateLeague.won_legs / worstLegWinRateLeague.total_resolved : 0,
          leg_count: worstLegWinRateLeague.leg_count,
          wins: worstLegWinRateLeague.won_legs,
          total_resolved: worstLegWinRateLeague.total_resolved,
        } : null,
        leg_favorite_league: favoriteLegLeague ? {
          league_id: favoriteLegLeague.league_id,
          league_name: favoriteLegLeague.league_name,
          leg_count: favoriteLegLeague.leg_count,
          win_rate: favoriteLegLeague.total_resolved > 0 ? favoriteLegLeague.won_legs / favoriteLegLeague.total_resolved : 0,
          wins: favoriteLegLeague.won_legs,
          total_resolved: favoriteLegLeague.total_resolved,
        } : null,
        leg_best_win_rate_team: bestLegWinRateTeam ? {
          team_id: bestLegWinRateTeam.team_id,
          team_name: bestLegWinRateTeam.team_name,
          win_rate: bestLegWinRateTeam.total_resolved > 0 ? bestLegWinRateTeam.won_legs / bestLegWinRateTeam.total_resolved : 0,
          leg_count: bestLegWinRateTeam.leg_count,
          wins: bestLegWinRateTeam.won_legs,
          total_resolved: bestLegWinRateTeam.total_resolved,
        } : null,
        leg_worst_win_rate_team: worstLegWinRateTeam ? {
          team_id: worstLegWinRateTeam.team_id,
          team_name: worstLegWinRateTeam.team_name,
          win_rate: worstLegWinRateTeam.total_resolved > 0 ? worstLegWinRateTeam.won_legs / worstLegWinRateTeam.total_resolved : 0,
          leg_count: worstLegWinRateTeam.leg_count,
          wins: worstLegWinRateTeam.won_legs,
          total_resolved: worstLegWinRateTeam.total_resolved,
        } : null,
        leg_favorite_team: favoriteLegTeam ? {
          team_id: favoriteLegTeam.team_id,
          team_name: favoriteLegTeam.team_name,
          leg_count: favoriteLegTeam.leg_count,
          win_rate: favoriteLegTeam.total_resolved > 0 ? favoriteLegTeam.won_legs / favoriteLegTeam.total_resolved : 0,
          wins: favoriteLegTeam.won_legs,
          total_resolved: favoriteLegTeam.total_resolved,
        } : null,
        leg_best_win_rate_category: bestLegWinRateCategory ? {
          category_id: bestLegWinRateCategory.category_id,
          category_name: bestLegWinRateCategory.category_name,
          win_rate: bestLegWinRateCategory.total_resolved > 0 ? bestLegWinRateCategory.won_legs / bestLegWinRateCategory.total_resolved : 0,
          leg_count: bestLegWinRateCategory.leg_count,
          wins: bestLegWinRateCategory.won_legs,
          total_resolved: bestLegWinRateCategory.total_resolved,
        } : null,
        leg_worst_win_rate_category: worstLegWinRateCategory ? {
          category_id: worstLegWinRateCategory.category_id,
          category_name: worstLegWinRateCategory.category_name,
          win_rate: worstLegWinRateCategory.total_resolved > 0 ? worstLegWinRateCategory.won_legs / worstLegWinRateCategory.total_resolved : 0,
          leg_count: worstLegWinRateCategory.leg_count,
          wins: worstLegWinRateCategory.won_legs,
          total_resolved: worstLegWinRateCategory.total_resolved,
        } : null,
        leg_favorite_category: favoriteLegCategory ? {
          category_id: favoriteLegCategory.category_id,
          category_name: favoriteLegCategory.category_name,
          leg_count: favoriteLegCategory.leg_count,
          win_rate: favoriteLegCategory.total_resolved > 0 ? favoriteLegCategory.won_legs / favoriteLegCategory.total_resolved : 0,
          wins: favoriteLegCategory.won_legs,
          total_resolved: favoriteLegCategory.total_resolved,
        } : null,
        leg_best_win_rate_bet_type: bestLegWinRateBetType ? {
          bet_type_id: bestLegWinRateBetType.bet_type_id,
          bet_type_name: bestLegWinRateBetType.bet_type_name,
          win_rate: bestLegWinRateBetType.total_resolved > 0 ? bestLegWinRateBetType.won_legs / bestLegWinRateBetType.total_resolved : 0,
          leg_count: bestLegWinRateBetType.leg_count,
          wins: bestLegWinRateBetType.won_legs,
          total_resolved: bestLegWinRateBetType.total_resolved,
        } : null,
        leg_worst_win_rate_bet_type: worstLegWinRateBetType ? {
          bet_type_id: worstLegWinRateBetType.bet_type_id,
          bet_type_name: worstLegWinRateBetType.bet_type_name,
          win_rate: worstLegWinRateBetType.total_resolved > 0 ? worstLegWinRateBetType.won_legs / worstLegWinRateBetType.total_resolved : 0,
          leg_count: worstLegWinRateBetType.leg_count,
          wins: worstLegWinRateBetType.won_legs,
          total_resolved: worstLegWinRateBetType.total_resolved,
        } : null,
        leg_favorite_bet_type: favoriteLegBetType ? {
          bet_type_id: favoriteLegBetType.bet_type_id,
          bet_type_name: favoriteLegBetType.bet_type_name,
          leg_count: favoriteLegBetType.leg_count,
          win_rate: favoriteLegBetType.total_resolved > 0 ? favoriteLegBetType.won_legs / favoriteLegBetType.total_resolved : 0,
          wins: favoriteLegBetType.won_legs,
          total_resolved: favoriteLegBetType.total_resolved,
        } : null,
        leg_best_win_rate_day: bestLegWinRateDay ? {
          day: bestLegWinRateDay.day,
          day_number: bestLegWinRateDay.day_number,
          win_rate: bestLegWinRateDay.total_resolved > 0 ? bestLegWinRateDay.won_legs / bestLegWinRateDay.total_resolved : 0,
          leg_count: bestLegWinRateDay.leg_count,
          wins: bestLegWinRateDay.won_legs,
          total_resolved: bestLegWinRateDay.total_resolved,
        } : null,
        leg_worst_win_rate_day: worstLegWinRateDay ? {
          day: worstLegWinRateDay.day,
          day_number: worstLegWinRateDay.day_number,
          win_rate: worstLegWinRateDay.total_resolved > 0 ? worstLegWinRateDay.won_legs / worstLegWinRateDay.total_resolved : 0,
          leg_count: worstLegWinRateDay.leg_count,
          wins: worstLegWinRateDay.won_legs,
          total_resolved: worstLegWinRateDay.total_resolved,
        } : null,
        leg_favorite_day: favoriteLegDay ? {
          day: favoriteLegDay.day,
          day_number: favoriteLegDay.day_number,
          leg_count: favoriteLegDay.leg_count,
          win_rate: favoriteLegDay.total_resolved > 0 ? favoriteLegDay.won_legs / favoriteLegDay.total_resolved : 0,
          wins: favoriteLegDay.won_legs,
          total_resolved: favoriteLegDay.total_resolved,
        } : null,
      });
    }

    return results;
    } catch (error: any) {
      console.error('[AnalyticsService] Error in getResponsibleDetailedAnalytics:', error);
      // Re-throw if it's already a createError
      if (error.statusCode) {
        throw error;
      }
      // Otherwise wrap in a generic error
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, `Failed to get responsible detailed analytics: ${error.message || 'Unknown error'}`, 500);
    }
  }

  async getByLegs(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<AnalyticsByLegs[]> {
    // Get all bets with legs
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch bets by legs', 500);
    }

    if (!bets || bets.length === 0) {
      return [];
    }

    // Group bets by number of legs
    const betsByLegs = new Map<number, {
      bets: any[];
      totalStake: number;
      totalProfit: number;
      wonBets: number;
      lostBets: number;
      totalOdds: number;
    }>();

    for (const bet of bets) {
      const legs = bet.legs || [];
      const numLegs = legs.length;

      if (numLegs === 0) continue; // Skip bets with no legs

      if (!betsByLegs.has(numLegs)) {
        betsByLegs.set(numLegs, {
          bets: [],
          totalStake: 0,
          totalProfit: 0,
          wonBets: 0,
          lostBets: 0,
          totalOdds: 0,
        });
      }

      const group = betsByLegs.get(numLegs)!;
      group.bets.push(bet);
      group.totalStake += Number(bet.stake || 0);
      group.totalProfit += Number(bet.profit_loss || 0);
      // Use effective odds (excluding voided legs) for analytics
      const effectiveOdds = this.calculateEffectiveOdds(bet);
      group.totalOdds += effectiveOdds;

      if (bet.state === 'won') {
        group.wonBets++;
      } else if (bet.state === 'lost') {
        group.lostBets++;
      }
    }

    // Convert to array and calculate metrics
    const results: AnalyticsByLegs[] = [];

    for (const [numLegs, data] of Array.from(betsByLegs.entries()).sort((a, b) => a[0] - b[0])) {
      const betCount = data.bets.length;
      const resolvedBets = data.wonBets + data.lostBets;
      const winRate = resolvedBets > 0 ? data.wonBets / resolvedBets : 0;
      const roi = data.totalStake > 0 ? data.totalProfit / data.totalStake : 0;
      const avgOdds = betCount > 0 ? data.totalOdds / betCount : 0;

      results.push({
        num_legs: numLegs,
        total_stake: data.totalStake,
        total_profit: data.totalProfit,
        roi,
        win_rate: winRate,
        bet_count: betCount,
        won_bets: data.wonBets,
        lost_bets: data.lostBets,
        avg_odds: avgOdds,
      });
    }

    return results;
  }

  async getTemporalAnalytics(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<TemporalAnalytics> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch temporal analytics', 500);
    }

    if (!bets || bets.length === 0) {
      return {
        by_day_of_week: [],
        by_hour: [],
        by_month: [],
        weekend_vs_weekday: {
          weekend: {
            total_bets: 0,
            win_rate: 0,
            total_profit: 0,
            roi: 0,
            total_stake: 0,
          },
          weekday: {
            total_bets: 0,
            win_rate: 0,
            total_profit: 0,
            roi: 0,
            total_stake: 0,
          },
        },
      };
    }

    // Day of week analysis
    const dayMap = new Map<number, { bets: any[]; stake: number; profit: number; won: number }>();
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    
    // Hour analysis
    const hourMap = new Map<number, { bets: any[]; stake: number; profit: number; won: number }>();
    
    // Month analysis
    const monthMap = new Map<string, { bets: any[]; stake: number; profit: number; won: number; month: string; monthNum: number; year: number }>();
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    
    // Weekend vs weekday
    let weekendBets = { bets: [] as any[], stake: 0, profit: 0, won: 0 };
    let weekdayBets = { bets: [] as any[], stake: 0, profit: 0, won: 0 };

    bets.forEach((bet) => {
      const betDate = new Date(bet.date);
      const dayOfWeek = betDate.getDay();
      const hour = betDate.getHours();
      const month = betDate.getMonth();
      const year = betDate.getFullYear();
      const monthKey = `${year}-${month}`;

      // Day of week
      if (!dayMap.has(dayOfWeek)) {
        dayMap.set(dayOfWeek, { bets: [], stake: 0, profit: 0, won: 0 });
      }
      const dayData = dayMap.get(dayOfWeek)!;
      dayData.bets.push(bet);
      dayData.stake += Number(bet.stake || 0);
      dayData.profit += Number(bet.profit_loss || 0);
      if (bet.state === 'won') dayData.won++;

      // Hour
      if (!hourMap.has(hour)) {
        hourMap.set(hour, { bets: [], stake: 0, profit: 0, won: 0 });
      }
      const hourData = hourMap.get(hour)!;
      hourData.bets.push(bet);
      hourData.stake += Number(bet.stake || 0);
      hourData.profit += Number(bet.profit_loss || 0);
      if (bet.state === 'won') hourData.won++;

      // Month
      if (!monthMap.has(monthKey)) {
        monthMap.set(monthKey, { bets: [], stake: 0, profit: 0, won: 0, month: monthNames[month], monthNum: month + 1, year });
      }
      const monthData = monthMap.get(monthKey)!;
      monthData.bets.push(bet);
      monthData.stake += Number(bet.stake || 0);
      monthData.profit += Number(bet.profit_loss || 0);
      if (bet.state === 'won') monthData.won++;

      // Weekend vs weekday
      if (dayOfWeek === 0 || dayOfWeek === 6) {
        weekendBets.bets.push(bet);
        weekendBets.stake += Number(bet.stake || 0);
        weekendBets.profit += Number(bet.profit_loss || 0);
        if (bet.state === 'won') weekendBets.won++;
      } else {
        weekdayBets.bets.push(bet);
        weekdayBets.stake += Number(bet.stake || 0);
        weekdayBets.profit += Number(bet.profit_loss || 0);
        if (bet.state === 'won') weekdayBets.won++;
      }
    });

    // Build day of week results (exclude pending bets from win rate)
    const byDayOfWeek = Array.from(dayMap.entries())
      .map(([dayNum, data]) => {
        const resolvedBets = data.bets.filter(b => b.state === 'won' || b.state === 'lost');
        return {
          day: dayNames[dayNum],
          day_number: dayNum,
          total_bets: data.bets.length,
          win_rate: resolvedBets.length > 0 ? data.won / resolvedBets.length : 0,
          total_profit: data.profit,
          roi: data.stake > 0 ? data.profit / data.stake : 0,
          total_stake: data.stake,
        };
      })
      .sort((a, b) => a.day_number - b.day_number);

    // Build hour results (exclude pending bets from win rate)
    const byHour = Array.from(hourMap.entries())
      .map(([hour, data]) => {
        const resolvedBets = data.bets.filter(b => b.state === 'won' || b.state === 'lost');
        return {
          hour,
          total_bets: data.bets.length,
          win_rate: resolvedBets.length > 0 ? data.won / resolvedBets.length : 0,
          total_profit: data.profit,
          total_stake: data.stake,
          roi: data.stake > 0 ? data.profit / data.stake : 0,
        };
      })
      .sort((a, b) => a.hour - b.hour);

    // Build month results (exclude pending bets from win rate)
    const byMonth = Array.from(monthMap.values())
      .map((data) => {
        const resolvedBets = data.bets.filter(b => b.state === 'won' || b.state === 'lost');
        return {
          month: data.month,
          month_number: data.monthNum,
          year: data.year,
          total_bets: data.bets.length,
          win_rate: resolvedBets.length > 0 ? data.won / resolvedBets.length : 0,
          total_profit: data.profit,
          roi: data.stake > 0 ? data.profit / data.stake : 0,
          total_stake: data.stake,
        };
      })
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month_number - b.month_number;
      });

    // Weekend vs weekday (exclude pending bets from win rate)
    const resolvedWeekendBets = weekendBets.bets.filter(b => b.state === 'won' || b.state === 'lost');
    const resolvedWeekdayBets = weekdayBets.bets.filter(b => b.state === 'won' || b.state === 'lost');
    const weekendWinRate = resolvedWeekendBets.length > 0 ? weekendBets.won / resolvedWeekendBets.length : 0;
    const weekdayWinRate = resolvedWeekdayBets.length > 0 ? weekdayBets.won / resolvedWeekdayBets.length : 0;

    return {
      by_day_of_week: byDayOfWeek,
      by_hour: byHour,
      by_month: byMonth,
      weekend_vs_weekday: {
        weekend: {
          total_bets: weekendBets.bets.length,
          win_rate: weekendWinRate,
          total_profit: weekendBets.profit,
          roi: weekendBets.stake > 0 ? weekendBets.profit / weekendBets.stake : 0,
          total_stake: weekendBets.stake,
        },
        weekday: {
          total_bets: weekdayBets.bets.length,
          win_rate: weekdayWinRate,
          total_profit: weekdayBets.profit,
          roi: weekdayBets.stake > 0 ? weekdayBets.profit / weekdayBets.stake : 0,
          total_stake: weekdayBets.stake,
        },
      },
    };
  }

  async getStakeAnalysis(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<StakeAnalysis[]> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch stake analysis', 500);
    }

    if (!bets || bets.length === 0) {
      return [];
    }

    // Define stake ranges
    const ranges = [
      { min: 0, max: 10, label: '$0-10' },
      { min: 10, max: 25, label: '$10-25' },
      { min: 25, max: 50, label: '$25-50' },
      { min: 50, max: 100, label: '$50-100' },
      { min: 100, max: 250, label: '$100-250' },
      { min: 250, max: 500, label: '$250-500' },
      { min: 500, max: Infinity, label: '$500+' },
    ];

    const rangeMap = new Map<string, {
      bets: any[];
      stake: number;
      profit: number;
      won: number;
      lost: number;
      totalOdds: number;
    }>();

    bets.forEach((bet) => {
      const stake = Number(bet.stake || 0);
      const range = ranges.find(r => stake >= r.min && stake < r.max);
      if (!range) return;

      if (!rangeMap.has(range.label)) {
        rangeMap.set(range.label, {
          bets: [],
          stake: 0,
          profit: 0,
          won: 0,
          lost: 0,
          totalOdds: 0,
        });
      }

      const data = rangeMap.get(range.label)!;
      data.bets.push(bet);
      data.stake += stake;
      data.profit += Number(bet.profit_loss || 0);
      // Use effective odds (excluding voided legs) for analytics
      const effectiveOdds = this.calculateEffectiveOdds(bet);
      data.totalOdds += effectiveOdds;
      if (bet.state === 'won') data.won++;
      if (bet.state === 'lost') data.lost++;
    });

    return ranges
      .filter(r => rangeMap.has(r.label))
      .map((range) => {
        const data = rangeMap.get(range.label)!;
        const betCount = data.bets.length;
        return {
          stake_range: range.label,
          min_stake: range.min,
          max_stake: range.max === Infinity ? 999999 : range.max,
          total_bets: betCount,
          win_rate: betCount > 0 ? data.won / betCount : 0,
          total_stake: data.stake,
          total_profit: data.profit,
          roi: data.stake > 0 ? data.profit / data.stake : 0,
          avg_odds: betCount > 0 ? data.totalOdds / betCount : 0,
          won_bets: data.won,
          lost_bets: data.lost,
        };
      });
  }

  async getCombinationAnalytics(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<CombinationAnalytics> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch combination analytics', 500);
    }

    // Get reference items
    const { data: referenceItems } = await this.supabase
      .from('reference_items')
      .select('id, name, kind');

    const refMap = new Map<string, string>();
    referenceItems?.forEach(item => {
      refMap.set(item.id, item.name);
    });

    // League × Bet Type
    const leagueBetTypeMap = new Map<string, {
      league_id: string;
      bet_type_id: string;
      bets: any[];
      stake: number;
      profit: number;
      won: number;
    }>();

    // Responsible × League
    const responsibleLeagueMap = new Map<string, {
      responsible_id: string;
      league_id: string;
      bets: any[];
      stake: number;
      profit: number;
      won: number;
    }>();

    // Category × Legs
    const categoryLegsMap = new Map<string, {
      category_id: string;
      num_legs: number;
      bets: any[];
      stake: number;
      profit: number;
      won: number;
    }>();

    bets?.forEach((bet) => {
      const legs = bet.legs || [];
      const numLegs = legs.length;

      legs.forEach((leg: any) => {
        // League × Bet Type
        if (leg.league_id && leg.bet_type_id) {
          const key = `${leg.league_id}-${leg.bet_type_id}`;
          if (!leagueBetTypeMap.has(key)) {
            leagueBetTypeMap.set(key, {
              league_id: leg.league_id,
              bet_type_id: leg.bet_type_id,
              bets: [],
              stake: 0,
              profit: 0,
              won: 0,
            });
          }
          const data = leagueBetTypeMap.get(key)!;
          if (!data.bets.includes(bet)) {
            data.bets.push(bet);
            data.stake += Number(bet.stake || 0);
            data.profit += Number(bet.profit_loss || 0);
            if (bet.state === 'won') data.won++;
          }
        }

        // Responsible × League
        if (leg.responsible_id && leg.league_id) {
          const key = `${leg.responsible_id}-${leg.league_id}`;
          if (!responsibleLeagueMap.has(key)) {
            responsibleLeagueMap.set(key, {
              responsible_id: leg.responsible_id,
              league_id: leg.league_id,
              bets: [],
              stake: 0,
              profit: 0,
              won: 0,
            });
          }
          const data = responsibleLeagueMap.get(key)!;
          if (!data.bets.includes(bet)) {
            data.bets.push(bet);
            data.stake += Number(bet.stake || 0);
            data.profit += Number(bet.profit_loss || 0);
            if (bet.state === 'won') data.won++;
          }
        }

        // Category × Legs
        if (leg.category_id) {
          const key = `${leg.category_id}-${numLegs}`;
          if (!categoryLegsMap.has(key)) {
            categoryLegsMap.set(key, {
              category_id: leg.category_id,
              num_legs: numLegs,
              bets: [],
              stake: 0,
              profit: 0,
              won: 0,
            });
          }
          const data = categoryLegsMap.get(key)!;
          if (!data.bets.includes(bet)) {
            data.bets.push(bet);
            data.stake += Number(bet.stake || 0);
            data.profit += Number(bet.profit_loss || 0);
            if (bet.state === 'won') data.won++;
          }
        }
      });
    });

    // Build results (exclude pending bets from win rate calculation)
    const leagueBetType = Array.from(leagueBetTypeMap.values()).map(data => {
      const resolvedBets = data.bets.filter(b => b.state === 'won' || b.state === 'lost');
      return {
        league_id: data.league_id,
        league_name: refMap.get(data.league_id) || 'Unknown',
        bet_type_id: data.bet_type_id,
        bet_type_name: refMap.get(data.bet_type_id) || 'Unknown',
        total_bets: data.bets.length,
        win_rate: resolvedBets.length > 0 ? data.won / resolvedBets.length : 0,
        total_profit: data.profit,
        roi: data.stake > 0 ? data.profit / data.stake : 0,
        total_stake: data.stake,
      };
    });

    const responsibleLeague = Array.from(responsibleLeagueMap.values()).map(data => {
      const resolvedBets = data.bets.filter(b => b.state === 'won' || b.state === 'lost');
      return {
        responsible_id: data.responsible_id,
        responsible_name: refMap.get(data.responsible_id) || 'Unknown',
        league_id: data.league_id,
        league_name: refMap.get(data.league_id) || 'Unknown',
        total_bets: data.bets.length,
        win_rate: resolvedBets.length > 0 ? data.won / resolvedBets.length : 0,
        total_profit: data.profit,
        roi: data.stake > 0 ? data.profit / data.stake : 0,
        total_stake: data.stake,
      };
    });

    const categoryLegs = Array.from(categoryLegsMap.values()).map(data => {
      const resolvedBets = data.bets.filter(b => b.state === 'won' || b.state === 'lost');
      return {
        category_id: data.category_id,
        category_name: refMap.get(data.category_id) || 'Unknown',
        num_legs: data.num_legs,
        total_bets: data.bets.length,
        win_rate: resolvedBets.length > 0 ? data.won / resolvedBets.length : 0,
        total_profit: data.profit,
        roi: data.stake > 0 ? data.profit / data.stake : 0,
      };
    });

    // Top combinations (simplified - can be enhanced)
    const topCombinations = [
      ...leagueBetType.slice(0, 10).map(c => ({
        factors: [c.league_name, c.bet_type_name],
        total_bets: c.total_bets,
        win_rate: c.win_rate,
        roi: c.roi,
        total_profit: c.total_profit,
        total_stake: c.total_stake,
      })),
    ].sort((a, b) => b.roi - a.roi).slice(0, 10);

    return {
      league_bet_type: leagueBetType,
      responsible_league: responsibleLeague,
      category_legs: categoryLegs,
      top_combinations: topCombinations,
    };
  }

  async getRiskMetrics(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<RiskMetrics> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('state', ['won', 'lost']); // Only completed bets

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch risk metrics', 500);
    }

    if (!bets || bets.length === 0) {
      return {
        volatility: 0,
        consistency_score: 0,
        max_drawdown: {
          amount: 0,
          start_date: '',
          end_date: '',
          duration_days: 0,
        },
        sharpe_ratio: 0,
        profit_distribution: [],
        average_win: 0,
        average_loss: 0,
        profit_factor: 0,
        largest_win: 0,
        largest_loss: 0,
        win_loss_ratio: 0,
      };
    }

    const profits = bets.map(b => Number(b.profit_loss || 0));
    const wins = profits.filter(p => p > 0);
    const losses = profits.filter(p => p < 0);

    // Calculate metrics
    const avgProfit = profits.reduce((a, b) => a + b, 0) / profits.length;
    const variance = profits.reduce((sum, p) => sum + Math.pow(p - avgProfit, 2), 0) / profits.length;
    const volatility = Math.sqrt(variance);

    const averageWin = wins.length > 0 ? wins.reduce((a, b) => a + b, 0) / wins.length : 0;
    const averageLoss = losses.length > 0 ? Math.abs(losses.reduce((a, b) => a + b, 0) / losses.length) : 0;
    // Profit factor = total wins / total losses (absolute values)
    const totalWins = wins.reduce((a, b) => a + b, 0);
    const totalLosses = Math.abs(losses.reduce((a, b) => a + b, 0));
    const profitFactor = totalLosses > 0 ? totalWins / totalLosses : (totalWins > 0 ? Infinity : 0);
    const winLossRatio = averageLoss > 0 ? averageWin / averageLoss : 0;

    const largestWin = wins.length > 0 ? Math.max(...wins) : 0;
    const largestLoss = losses.length > 0 ? Math.min(...losses) : 0;

    // Consistency score (0-100, based on how consistent profits are)
    const consistencyScore = volatility > 0 ? Math.max(0, Math.min(100, 100 - (volatility / Math.abs(avgProfit || 1)) * 50)) : 100;

    // Sharpe ratio (simplified - risk-free rate = 0)
    const sharpeRatio = volatility > 0 ? avgProfit / volatility : 0;

    // Max drawdown
    let maxDrawdown = { amount: 0, start_date: '', end_date: '', duration_days: 0 };
    let peak = 0;
    let drawdownStart = '';
    let currentDrawdown = 0;

    bets.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    let cumulative = 0;

    bets.forEach((bet) => {
      cumulative += Number(bet.profit_loss || 0);
      if (cumulative > peak) {
        peak = cumulative;
        drawdownStart = '';
        currentDrawdown = 0;
      } else {
        const drawdown = peak - cumulative;
        if (drawdown > currentDrawdown) {
          currentDrawdown = drawdown;
          if (!drawdownStart) drawdownStart = bet.date;
        }
      }
      if (currentDrawdown > maxDrawdown.amount) {
        maxDrawdown = {
          amount: currentDrawdown,
          start_date: drawdownStart,
          end_date: bet.date,
          duration_days: Math.ceil((new Date(bet.date).getTime() - new Date(drawdownStart).getTime()) / (1000 * 60 * 60 * 24)),
        };
      }
    });

    // Profit distribution
    const distributionRanges = [
      { min: -Infinity, max: -100, label: '$-100+' },
      { min: -100, max: -50, label: '$-100 to -$50' },
      { min: -50, max: 0, label: '$-50 to $0' },
      { min: 0, max: 50, label: '$0 to $50' },
      { min: 50, max: 100, label: '$50 to $100' },
      { min: 100, max: Infinity, label: '$100+' },
    ];

    const profitDistribution = distributionRanges.map(range => ({
      range: range.label,
      count: profits.filter(p => p >= range.min && p < range.max).length,
    }));

    return {
      volatility,
      consistency_score: consistencyScore,
      max_drawdown: maxDrawdown,
      sharpe_ratio: sharpeRatio,
      profit_distribution: profitDistribution,
      average_win: averageWin,
      average_loss: averageLoss,
      profit_factor: profitFactor,
      largest_win: largestWin,
      largest_loss: largestLoss,
      win_loss_ratio: winLossRatio,
    };
  }

  async getPeriodComparison(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<PeriodComparison> {
    // If no dates provided, compare last 30 days vs previous 30 days
    let currentStart: string;
    let currentEnd: string;
    let previousStart: string;
    let previousEnd: string;

    if (startDate && endDate) {
      currentStart = startDate;
      currentEnd = endDate;
      const currentDuration = new Date(endDate).getTime() - new Date(startDate).getTime();
      previousEnd = new Date(new Date(startDate).getTime() - 1).toISOString().split('T')[0];
      previousStart = new Date(new Date(previousEnd).getTime() - currentDuration).toISOString().split('T')[0];
    } else {
      const today = new Date();
      currentEnd = today.toISOString().split('T')[0];
      currentStart = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      previousEnd = new Date(new Date(currentStart).getTime() - 1).toISOString().split('T')[0];
      previousStart = new Date(new Date(previousEnd).getTime() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    }

    const [currentSummary, previousSummary] = await Promise.all([
      this.getSummary(userId, currentStart, currentEnd),
      this.getSummary(userId, previousStart, previousEnd),
    ]);

    const betsChange = previousSummary.total_bets > 0
      ? ((currentSummary.total_bets - previousSummary.total_bets) / previousSummary.total_bets) * 100
      : 0;
    const winRateChange = currentSummary.win_rate - previousSummary.win_rate;
    // Calculate profit change with better handling of small denominators
    let profitChange: number;
    if (previousSummary.total_profit === 0) {
      // If previous was 0, show absolute change
      profitChange = currentSummary.total_profit;
    } else if (Math.abs(previousSummary.total_profit) < 1) {
      // If previous profit is very small (< $1), show absolute change to avoid misleading percentages
      profitChange = currentSummary.total_profit - previousSummary.total_profit;
    } else {
      // Normal percentage calculation
      profitChange = ((currentSummary.total_profit - previousSummary.total_profit) / Math.abs(previousSummary.total_profit)) * 100;
      // Cap at reasonable percentage to avoid misleading numbers
      if (Math.abs(profitChange) > 1000) {
        // If change is > 1000%, show absolute change instead
        profitChange = currentSummary.total_profit - previousSummary.total_profit;
      }
    }
    const roiChange = currentSummary.roi - previousSummary.roi;
    const stakeChange = previousSummary.total_stake > 0
      ? ((currentSummary.total_stake - previousSummary.total_stake) / previousSummary.total_stake) * 100
      : 0;

    let trend: 'improving' | 'declining' | 'stable' = 'stable';
    if (roiChange > 0.05) trend = 'improving';
    else if (roiChange < -0.05) trend = 'declining';

    return {
      current_period: {
        start_date: currentStart,
        end_date: currentEnd,
        total_bets: currentSummary.total_bets,
        win_rate: currentSummary.win_rate,
        total_profit: currentSummary.total_profit,
        roi: currentSummary.roi,
        total_stake: currentSummary.total_stake,
      },
      previous_period: {
        start_date: previousStart,
        end_date: previousEnd,
        total_bets: previousSummary.total_bets,
        win_rate: previousSummary.win_rate,
        total_profit: previousSummary.total_profit,
        roi: previousSummary.roi,
        total_stake: previousSummary.total_stake,
      },
      change: {
        bets_change: betsChange,
        win_rate_change: winRateChange,
        profit_change: profitChange,
        roi_change: roiChange,
        stake_change: stakeChange,
      },
      trend,
    };
  }

  async getEVAnalysis(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<EVAnalysis> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('state', ['won', 'lost']);

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch EV analysis', 500);
    }

    // Get reference items
    const { data: referenceItems } = await this.supabase
      .from('reference_items')
      .select('id, name, kind');

    const refMap = new Map<string, string>();
    referenceItems?.forEach(item => {
      refMap.set(item.id, item.name);
    });

    // Calculate EV by category
    const categoryMap = new Map<string, {
      bets: any[];
      totalOdds: number;
      stake: number;
      profit: number;
    }>();

    // Calculate EV by bet type
    const betTypeMap = new Map<string, {
      bets: any[];
      totalOdds: number;
      stake: number;
      profit: number;
    }>();

    bets?.forEach((bet) => {
      // Use effective odds (excluding voided legs) for analytics
      const effectiveOdds = this.calculateEffectiveOdds(bet);
      const stake = Number(bet.stake || 0);
      const profit = Number(bet.profit_loss || 0);
      // Note: We'll calculate expected ROI using actual win rates per category/bet type, not per bet

      bet.legs?.forEach((leg: any) => {
        if (leg.category_id) {
          if (!categoryMap.has(leg.category_id)) {
            categoryMap.set(leg.category_id, { bets: [], totalOdds: 0, stake: 0, profit: 0 });
          }
          const data = categoryMap.get(leg.category_id)!;
          if (!data.bets.includes(bet)) {
            data.bets.push(bet);
            data.totalOdds += effectiveOdds;
            data.stake += stake;
            data.profit += profit;
          }
        }

        if (leg.bet_type_id) {
          if (!betTypeMap.has(leg.bet_type_id)) {
            betTypeMap.set(leg.bet_type_id, { bets: [], totalOdds: 0, stake: 0, profit: 0 });
          }
          const data = betTypeMap.get(leg.bet_type_id)!;
          if (!data.bets.includes(bet)) {
            data.bets.push(bet);
            data.totalOdds += effectiveOdds;
            data.stake += stake;
            data.profit += profit;
          }
        }
      });
    });

    // Build EV by category (exclude pending bets from win rate)
    // Expected ROI = (odds * probability) - 1, where probability is the implied probability from odds
    // But we use actual win rate as the probability estimate
    const evByCategory = Array.from(categoryMap.entries()).map(([categoryId, data]) => {
      const betCount = data.bets.length;
      const avgOdds = betCount > 0 ? data.totalOdds / betCount : 0;
      const resolvedBets = data.bets.filter(b => b.state === 'won' || b.state === 'lost');
      const actualWinRate = resolvedBets.length > 0 ? resolvedBets.filter(b => b.state === 'won').length / resolvedBets.length : 0;
      // Expected ROI using actual win rate as probability estimate
      // If avgOdds is 2.0 and win rate is 60%, expected ROI = (2.0 * 0.6) - 1 = 0.2 (20%)
      const expectedROI = (avgOdds * actualWinRate) - 1;
      const actualROI = data.stake > 0 ? data.profit / data.stake : 0;

      return {
        category_id: categoryId,
        category_name: refMap.get(categoryId) || 'Unknown',
        avg_odds: avgOdds,
        win_rate: actualWinRate,
        expected_roi: expectedROI,
        actual_roi: actualROI,
        ev_difference: actualROI - expectedROI,
        bet_count: betCount,
      };
    });

    // Build EV by bet type (exclude pending bets from win rate)
    const evByBetType = Array.from(betTypeMap.entries()).map(([betTypeId, data]) => {
      const betCount = data.bets.length;
      const avgOdds = betCount > 0 ? data.totalOdds / betCount : 0;
      const resolvedBets = data.bets.filter(b => b.state === 'won' || b.state === 'lost');
      const actualWinRate = resolvedBets.length > 0 ? resolvedBets.filter(b => b.state === 'won').length / resolvedBets.length : 0;
      const expectedROI = (avgOdds * actualWinRate) - 1;
      const actualROI = data.stake > 0 ? data.profit / data.stake : 0;

      return {
        bet_type_id: betTypeId,
        bet_type_name: refMap.get(betTypeId) || 'Unknown',
        avg_odds: avgOdds,
        win_rate: actualWinRate,
        expected_roi: expectedROI,
        actual_roi: actualROI,
        ev_difference: actualROI - expectedROI,
        bet_count: betCount,
      };
    });

    // Overall EV (exclude pending bets from win rate)
    const allBets = bets || [];
    const totalStake = allBets.reduce((sum, b) => sum + Number(b.stake || 0), 0);
    const totalProfit = allBets.reduce((sum, b) => sum + Number(b.profit_loss || 0), 0);
    const overallROI = totalStake > 0 ? totalProfit / totalStake : 0;
    // Use effective odds (excluding voided legs) for analytics
    const avgOdds = allBets.length > 0
      ? allBets.reduce((sum, b) => sum + this.calculateEffectiveOdds(b), 0) / allBets.length
      : 0;
    const resolvedAllBets = allBets.filter(b => b.state === 'won' || b.state === 'lost');
    const overallWinRate = resolvedAllBets.length > 0
      ? resolvedAllBets.filter(b => b.state === 'won').length / resolvedAllBets.length
      : 0;
    // Expected ROI using overall win rate
    const expectedROI = (avgOdds * overallWinRate) - 1;
    const overallEV = overallROI - expectedROI;

    // Value bets: Bets where actual ROI exceeded expected ROI based on category/bet type averages
    // For each bet, compare its actual result to the expected result for its category/bet type
    const valueBets = allBets
      .map(b => {
        // Use effective odds (excluding voided legs) for analytics
        const effectiveOdds = this.calculateEffectiveOdds(b);
        const stake = Number(b.stake || 0);
        const profit = Number(b.profit_loss || 0);
        const actualROI = stake > 0 ? profit / stake : 0;
        
        // Find expected ROI from category or bet type
        let expectedROIForBet = expectedROI; // Default to overall
        const categoryId = b.legs?.[0]?.category_id;
        const betTypeId = b.legs?.[0]?.bet_type_id;
        
        if (categoryId && categoryMap.has(categoryId)) {
          const catData = categoryMap.get(categoryId)!;
          const resolvedCatBets = catData.bets.filter(bet => bet.state === 'won' || bet.state === 'lost');
          const catWinRate = resolvedCatBets.length > 0 ? resolvedCatBets.filter(bet => bet.state === 'won').length / resolvedCatBets.length : 0;
          const catAvgOdds = catData.bets.length > 0 
            ? catData.totalOdds / catData.bets.length
            : effectiveOdds;
          expectedROIForBet = (catAvgOdds * catWinRate) - 1;
        } else if (betTypeId && betTypeMap.has(betTypeId)) {
          const btData = betTypeMap.get(betTypeId)!;
          const resolvedBtBets = btData.bets.filter(bet => bet.state === 'won' || bet.state === 'lost');
          const btWinRate = resolvedBtBets.length > 0 ? resolvedBtBets.filter(bet => bet.state === 'won').length / resolvedBtBets.length : 0;
          const btAvgOdds = btData.bets.length > 0 
            ? btData.totalOdds / btData.bets.length
            : effectiveOdds;
          expectedROIForBet = (btAvgOdds * btWinRate) - 1;
        }
        
        return {
          bet: b,
          actualROI,
          expectedROI: expectedROIForBet,
          isValueBet: actualROI > expectedROIForBet,
        };
      })
      .filter(v => v.isValueBet)
      .sort((a, b) => (b.actualROI - b.expectedROI) - (a.actualROI - a.expectedROI))
      .slice(0, 20)
      .map(v => ({
        bet_id: v.bet.id,
        date: v.bet.date,
        odds: Number(v.bet.odds || 0),
        stake: Number(v.bet.stake || 0),
        expected_value: v.expectedROI * Number(v.bet.stake || 0),
        actual_result: Number(v.bet.profit_loss || 0),
        category: v.bet.legs?.[0]?.category_id ? refMap.get(v.bet.legs[0].category_id) : undefined,
      }));

    return {
      overall_ev: overallEV,
      ev_by_category: evByCategory,
      ev_by_bet_type: evByBetType,
      value_bets: valueBets,
    };
  }

  async getRecoveryAnalysis(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<RecoveryAnalysis> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('state', ['won', 'lost'])
      .order('date', { ascending: true });

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch recovery analysis', 500);
    }

    if (!bets || bets.length === 0) {
      return {
        avg_recovery_time_days: 0,
        recovery_rate: 0,
        post_loss_performance: {
          bets_after_loss: 0,
          win_rate: 0,
          avg_profit: 0,
          total_profit: 0,
        },
        longest_recovery_period: {
          days: 0,
          start_date: '',
          end_date: '',
          loss_amount: 0,
          recovered_amount: 0,
        },
        recovery_periods: [],
      };
    }

    // Find recovery periods
    let cumulative = 0;
    let peak = 0;
    const recoveryPeriods: Array<{
      start_date: string;
      end_date: string;
      loss_amount: number;
      recovery_days: number;
      recovered: boolean;
    }> = [];

    let currentLossStart = '';
    let currentLossAmount = 0;
    let longestRecovery = { days: 0, start_date: '', end_date: '', loss_amount: 0, recovered_amount: 0 };

    bets.forEach((bet, index) => {
      const profit = Number(bet.profit_loss || 0);
      cumulative += profit;

      if (cumulative < peak) {
        // In a drawdown
        if (!currentLossStart) {
          currentLossStart = bet.date;
          currentLossAmount = peak - cumulative;
        } else {
          currentLossAmount = peak - cumulative;
        }
      } else {
        // Recovered or new peak
        if (currentLossStart) {
          // Recovery completed
          const recoveryDays = Math.ceil(
            (new Date(bet.date).getTime() - new Date(currentLossStart).getTime()) / (1000 * 60 * 60 * 24)
          );
          recoveryPeriods.push({
            start_date: currentLossStart,
            end_date: bet.date,
            loss_amount: currentLossAmount,
            recovery_days: recoveryDays,
            recovered: true,
          });

          if (recoveryDays > longestRecovery.days) {
            longestRecovery = {
              days: recoveryDays,
              start_date: currentLossStart,
              end_date: bet.date,
              loss_amount: currentLossAmount,
              recovered_amount: cumulative - (peak - currentLossAmount),
            };
          }

          currentLossStart = '';
          currentLossAmount = 0;
        }
        peak = cumulative;
      }
    });

    // Calculate recovery metrics
    const completedRecoveries = recoveryPeriods.filter(r => r.recovered);
    const avgRecoveryTime = completedRecoveries.length > 0
      ? completedRecoveries.reduce((sum, r) => sum + r.recovery_days, 0) / completedRecoveries.length
      : 0;

    // Calculate recovery rate: how much of losses have been recovered
    // Total losses = sum of all negative profit_loss values
    const totalLosses = bets
      .filter(b => b.state === 'lost')
      .reduce((sum, b) => sum + Math.abs(Number(b.profit_loss || 0)), 0);
    
    // Total recovered = current cumulative profit (if positive)
    // If cumulative is negative, we haven't recovered anything
    const totalRecovered = Math.max(0, cumulative);
    const recoveryRate = totalLosses > 0 ? (totalRecovered / totalLosses) * 100 : 0;

    // Post-loss performance
    const postLossBets: any[] = [];
    bets.forEach((bet, index) => {
      if (bet.state === 'lost' && index < bets.length - 1) {
        // Get next bet after a loss
        const nextBet = bets[index + 1];
        if (nextBet) postLossBets.push(nextBet);
      }
    });

    const resolvedPostLossBets = postLossBets.filter(b => b.state === 'won' || b.state === 'lost');
    const postLossWinRate = resolvedPostLossBets.length > 0
      ? resolvedPostLossBets.filter(b => b.state === 'won').length / resolvedPostLossBets.length
      : 0;
    const postLossAvgProfit = postLossBets.length > 0
      ? postLossBets.reduce((sum, b) => sum + Number(b.profit_loss || 0), 0) / postLossBets.length
      : 0;
    const postLossTotalProfit = postLossBets.reduce((sum, b) => sum + Number(b.profit_loss || 0), 0);

    return {
      avg_recovery_time_days: avgRecoveryTime,
      recovery_rate: recoveryRate,
      post_loss_performance: {
        bets_after_loss: postLossBets.length,
        win_rate: postLossWinRate,
        avg_profit: postLossAvgProfit,
        total_profit: postLossTotalProfit,
      },
      longest_recovery_period: longestRecovery,
      recovery_periods: recoveryPeriods.slice(0, 20), // Limit to 20 most recent
    };
  }

  async getBankrollAnalysis(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<BankrollAnalysis> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*, legs(*)')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: true });

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch bankroll analysis', 500);
    }

    if (!bets || bets.length === 0) {
      return {
        current_bankroll: 0,
        starting_bankroll: 0,
        growth_rate: 0,
        stake_percentage_distribution: [],
        kelly_criterion: {
          recommended_stake_pct: 0,
          current_avg_stake_pct: 0,
          difference: 0,
        },
        health_score: 0,
        risk_level: 'low',
        bankroll_history: [],
      };
    }

    // Calculate starting bankroll estimate
    // Strategy: Estimate from first bet stake (assume user had at least 10x the first stake)
    // Or use cumulative profit to work backwards if available
    const firstBet = bets[0];
    let startingBankroll = 1000; // Default fallback
    
    if (firstBet) {
      const firstStake = Number(firstBet.stake || 0);
      // Estimate starting bankroll as 10x first stake, with minimum $100
      startingBankroll = Math.max(100, firstStake * 10);
      
      // If we have cumulative profit data, we can work backwards more accurately
      // But for now, use the estimate
    }

    // Calculate bankroll over time
    // Note: profit_loss is net (winnings - stake for wins, -stake for losses)
    // So: bankroll = starting_bankroll + sum(profit_loss)
    let bankroll = startingBankroll;
    const bankrollHistory: Array<{ date: string; amount: number }> = [];
    const bankrollAtBet: Map<string, number> = new Map(); // Track bankroll at time of each bet

    bets.forEach((bet) => {
      // Store bankroll before this bet for stake percentage calculation
      bankrollAtBet.set(bet.id, bankroll);
      
      // Update bankroll after this bet's result
      bankroll += Number(bet.profit_loss || 0);
      
      bankrollHistory.push({
        date: bet.date,
        amount: bankroll,
      });
    });

    const currentBankroll = bankroll;
    const growthRate = startingBankroll > 0 ? ((currentBankroll - startingBankroll) / startingBankroll) * 100 : 0;

    // Stake percentage distribution
    // IMPORTANT: Use bankroll at the time each bet was placed, not current bankroll
    const stakePctRanges = [
      { min: 0, max: 1, label: '0-1%' },
      { min: 1, max: 2, label: '1-2%' },
      { min: 2, max: 5, label: '2-5%' },
      { min: 5, max: 10, label: '5-10%' },
      { min: 10, max: Infinity, label: '10%+' },
    ];

    const stakePctMap = new Map<string, { count: number; totalProfit: number; totalStake: number }>();

    bets.forEach((bet) => {
      const stake = Number(bet.stake || 0);
      // Use bankroll at the time this bet was placed
      const bankrollAtTime = bankrollAtBet.get(bet.id) || startingBankroll;
      const stakePct = bankrollAtTime > 0 ? (stake / bankrollAtTime) * 100 : 0;
      const range = stakePctRanges.find(r => stakePct >= r.min && stakePct < r.max);
      if (!range) return;

      if (!stakePctMap.has(range.label)) {
        stakePctMap.set(range.label, { count: 0, totalProfit: 0, totalStake: 0 });
      }
      const data = stakePctMap.get(range.label)!;
      data.count++;
      data.totalProfit += Number(bet.profit_loss || 0);
      data.totalStake += stake;
    });

    const stakePctDistribution = stakePctRanges
      .filter(r => stakePctMap.has(r.label))
      .map(range => {
        const data = stakePctMap.get(range.label)!;
        return {
          range: range.label,
          bet_count: data.count,
          avg_roi: data.totalStake > 0 ? data.totalProfit / data.totalStake : 0,
          total_profit: data.totalProfit,
        };
      });

    // Kelly Criterion (simplified)
    const winRate = bets.filter(b => b.state === 'won').length / bets.length;
    // Use effective odds (excluding voided legs) for analytics
    const avgOdds = bets.length > 0
      ? bets.reduce((sum, b) => sum + this.calculateEffectiveOdds(b), 0) / bets.length
      : 0;
    const kellyPct = avgOdds > 0 ? (winRate * avgOdds - 1) / (avgOdds - 1) : 0;
    const recommendedStakePct = Math.max(0, Math.min(25, kellyPct * 100)); // Cap at 25%

    const avgStake = bets.reduce((sum, b) => sum + Number(b.stake || 0), 0) / bets.length;
    const currentAvgStakePct = currentBankroll > 0 ? (avgStake / currentBankroll) * 100 : 0;

    // Health score (0-100)
    let healthScore = 50; // Base score
    if (growthRate > 0) healthScore += 20;
    if (growthRate > 10) healthScore += 10;
    if (currentAvgStakePct <= 5) healthScore += 10;
    if (currentAvgStakePct > 10) healthScore -= 20;
    if (winRate > 0.5) healthScore += 10;
    healthScore = Math.max(0, Math.min(100, healthScore));

    const riskLevel: 'low' | 'medium' | 'high' =
      currentAvgStakePct <= 2 ? 'low' :
      currentAvgStakePct <= 5 ? 'medium' : 'high';

    return {
      current_bankroll: currentBankroll,
      starting_bankroll: startingBankroll,
      growth_rate: growthRate,
      stake_percentage_distribution: stakePctDistribution,
      kelly_criterion: {
        recommended_stake_pct: recommendedStakePct,
        current_avg_stake_pct: currentAvgStakePct,
        difference: recommendedStakePct - currentAvgStakePct,
      },
      health_score: healthScore,
      risk_level: riskLevel,
      bankroll_history: bankrollHistory.slice(-30), // Last 30 data points
    };
  }

  async getFrequencyAnalysis(
    userId: string,
    startDate?: string,
    endDate?: string
  ): Promise<FrequencyAnalysis> {
    let betsQuery = this.supabase
      .from('main_bets')
      .select('*')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: true });

    if (startDate) {
      betsQuery = betsQuery.gte('date', startDate);
    }

    if (endDate) {
      betsQuery = betsQuery.lte('date', endDate);
    }

    const { data: bets, error } = await betsQuery;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch frequency analysis', 500);
    }

    if (!bets || bets.length === 0) {
      return {
        bets_per_day: [],
        avg_bets_per_day: 0,
        avg_bets_per_week: 0,
        most_active_day: { day: '', bet_count: 0 },
        activity_trend: 'stable',
        frequency_performance: [],
      };
    }

    // Group by date
    const dateMap = new Map<string, { bets: any[]; profit: number }>();
    bets.forEach((bet) => {
      const date = bet.date.split('T')[0];
      if (!dateMap.has(date)) {
        dateMap.set(date, { bets: [], profit: 0 });
      }
      const data = dateMap.get(date)!;
      data.bets.push(bet);
      data.profit += Number(bet.profit_loss || 0);
    });

    const betsPerDay = Array.from(dateMap.entries())
      .map(([date, data]) => ({
        date,
        bet_count: data.bets.length,
        total_profit: data.profit,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const totalDays = betsPerDay.length;
    const avgBetsPerDay = totalDays > 0 ? bets.length / totalDays : 0;
    const avgBetsPerWeek = avgBetsPerDay * 7;

    // Most active day
    const mostActive = betsPerDay.reduce((best, current) =>
      current.bet_count > best.bet_count ? current : best,
      betsPerDay[0]
    );

    // Activity trend
    const firstHalf = betsPerDay.slice(0, Math.floor(betsPerDay.length / 2));
    const secondHalf = betsPerDay.slice(Math.floor(betsPerDay.length / 2));
    const firstHalfAvg = firstHalf.length > 0
      ? firstHalf.reduce((sum, d) => sum + d.bet_count, 0) / firstHalf.length
      : 0;
    const secondHalfAvg = secondHalf.length > 0
      ? secondHalf.reduce((sum, d) => sum + d.bet_count, 0) / secondHalf.length
      : 0;

    const activityTrend: 'increasing' | 'decreasing' | 'stable' =
      secondHalfAvg > firstHalfAvg * 1.1 ? 'increasing' :
      secondHalfAvg < firstHalfAvg * 0.9 ? 'decreasing' : 'stable';

    // Frequency performance
    const frequencyRanges = [
      { min: 0, max: 1, label: '0-1 bets/day' },
      { min: 1, max: 2, label: '1-2 bets/day' },
      { min: 2, max: 3, label: '2-3 bets/day' },
      { min: 3, max: 5, label: '3-5 bets/day' },
      { min: 5, max: Infinity, label: '5+ bets/day' },
    ];

    const frequencyMap = new Map<string, { bets: any[]; profit: number; stake: number; won: number }>();

    betsPerDay.forEach((day) => {
      const range = frequencyRanges.find(r => day.bet_count >= r.min && day.bet_count < r.max);
      if (!range) return;

      if (!frequencyMap.has(range.label)) {
        frequencyMap.set(range.label, { bets: [], profit: 0, stake: 0, won: 0 });
      }
      const data = frequencyMap.get(range.label)!;
      day.bet_count; // This is the count for the day
      // We need to get actual bets for this day
      const dayBets = dateMap.get(day.date)?.bets || [];
      dayBets.forEach(bet => {
        if (!data.bets.includes(bet)) {
          data.bets.push(bet);
          data.stake += Number(bet.stake || 0);
          data.profit += Number(bet.profit_loss || 0);
          if (bet.state === 'won') data.won++;
        }
      });
    });

    const frequencyPerformance = frequencyRanges
      .filter(r => frequencyMap.has(r.label))
      .map(range => {
        const data = frequencyMap.get(range.label)!;
        const betCount = data.bets.length;
        return {
          frequency_range: range.label,
          bet_count: betCount,
          win_rate: betCount > 0 ? data.won / betCount : 0,
          roi: data.stake > 0 ? data.profit / data.stake : 0,
          total_profit: data.profit,
        };
      });

    return {
      bets_per_day: betsPerDay,
      avg_bets_per_day: avgBetsPerDay,
      avg_bets_per_week: avgBetsPerWeek,
      most_active_day: {
        day: mostActive.date,
        bet_count: mostActive.bet_count,
      },
      activity_trend: activityTrend,
      frequency_performance: frequencyPerformance,
    };
  }
}

