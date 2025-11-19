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

    const totalStake = bets?.reduce((sum, b) => sum + Number(b.stake || 0), 0) || 0;
    const totalProfit =
      bets?.reduce((sum, b) => sum + Number(b.profit_loss || 0), 0) || 0;

    const winRate = totalBets > 0 ? wonBets / totalBets : 0;
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

      // Calculate win rate for this league
      const leagueBets = bets?.filter((b) =>
        b.legs?.some((l: any) => l.league_id === result.league_id)
      );
      const wonLeagueBets = leagueBets?.filter((b) => b.state === 'won').length || 0;
      result.win_rate = leagueBets?.length ? wonLeagueBets / leagueBets.length : 0;
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
      const wonResponsibleBets = responsibleBets?.filter((b) => b.state === 'won').length || 0;
      result.win_rate = responsibleBets?.length
        ? wonResponsibleBets / responsibleBets.length
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
      const wonBetTypeBets = betTypeBets?.filter((b) => b.state === 'won').length || 0;
      result.win_rate = betTypeBets?.length ? wonBetTypeBets / betTypeBets.length : 0;
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
      const wonCategoryBets = categoryBets?.filter((b) => b.state === 'won').length || 0;
      result.win_rate = categoryBets?.length ? wonCategoryBets / categoryBets.length : 0;
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
      .select('date, stake, odds, profit_loss, state')
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
      const odds = Number(bet.odds);
      if (!odds || odds < 1) return;

      let rangeLabel = '';
      for (const range of ranges) {
        if (odds >= range.min && (range.max === Infinity || odds < range.max)) {
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

      // Calculate win rate for this range
      const rangeBets = bets?.filter((b) => {
        const odds = Number(b.odds);
        if (!odds) return false;
        return odds >= result.min_odds && odds < (result.max_odds === 999 ? Infinity : result.max_odds);
      });
      const wonBets = rangeBets?.filter((b) => b.state === 'won').length || 0;
      result.win_rate = rangeBets?.length ? wonBets / rangeBets.length : 0;
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
          teamData.as_home.total_legs++;
          teamData.total.total_legs++;
          if (leg.result_state === 'won') {
            teamData.as_home.won_legs++;
            teamData.total.won_legs++;
            teamData.as_home.total_profit += profit;
            teamData.total.total_profit += profit;
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
          teamData.as_away.total_legs++;
          teamData.total.total_legs++;
          if (leg.result_state === 'won') {
            teamData.as_away.won_legs++;
            teamData.total.won_legs++;
            teamData.as_away.total_profit += profit;
            teamData.total.total_profit += profit;
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
    let query = this.supabase
      .from('main_bets')
      .select('date, state, profit_loss')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .in('state', ['won', 'lost'])
      .order('date', { ascending: true });

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data: bets, error } = await query;

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch streak analysis', 500);
    }

    if (!bets || bets.length === 0) {
      return {
        current_streak: { type: 'win', length: 0, start_date: '' },
        longest_win_streak: { length: 0, start_date: '', end_date: '' },
        longest_loss_streak: { length: 0, start_date: '', end_date: '' },
        recent_bets: [],
      };
    }

    // Calculate streaks
    let currentStreakType: 'win' | 'loss' = bets[bets.length - 1].state === 'won' ? 'win' : 'loss';
    let currentStreakLength = 1;
    let currentStreakStart = bets[bets.length - 1].date;

    for (let i = bets.length - 2; i >= 0; i--) {
      if (bets[i].state === currentStreakType) {
        currentStreakLength++;
        currentStreakStart = bets[i].date;
      } else {
        break;
      }
    }

    let longestWinStreak = { length: 0, start_date: '', end_date: '' };
    let longestLossStreak = { length: 0, start_date: '', end_date: '' };
    let currentWinStreak = 0;
    let currentLossStreak = 0;
    let winStreakStart = '';
    let lossStreakStart = '';

    for (let i = 0; i < bets.length; i++) {
      const bet = bets[i];
      if (bet.state === 'won') {
        if (currentLossStreak > 0) {
          if (currentLossStreak > longestLossStreak.length) {
            longestLossStreak = {
              length: currentLossStreak,
              start_date: lossStreakStart,
              end_date: bets[i - 1].date,
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
              end_date: bets[i - 1].date,
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
    if (currentWinStreak > longestWinStreak.length) {
      longestWinStreak = {
        length: currentWinStreak,
        start_date: winStreakStart,
        end_date: bets[bets.length - 1].date,
      };
    }
    if (currentLossStreak > longestLossStreak.length) {
      longestLossStreak = {
        length: currentLossStreak,
        start_date: lossStreakStart,
        end_date: bets[bets.length - 1].date,
      };
    }

    // Get recent bets (last 10)
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
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch responsible detailed analytics', 500);
    }

    // Group legs by responsible_id
    const responsibleMap = new Map<string, {
      responsible_id: string;
      responsible_name: string;
      bets: any[];
      legs: any[];
      leagueMap: Map<string, { league_id: string; league_name: string; profit: number; bet_count: number; stake: number; won: number; total: number }>;
      teamMap: Map<string, { team_id: string; team_name: string; bet_count: number }>;
      betTypeMap: Map<string, { bet_type_id: string; bet_type_name: string; profit: number; bet_count: number; stake: number; won: number; total: number }>;
      categoryMap: Map<string, { category_id: string; category_name: string; profit: number; bet_count: number; stake: number; won: number; total: number }>;
      legCountMap: Map<number, { bet_count: number; won: number; total_stake: number; total_profit: number }>;
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
            legCountMap: new Map(),
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
            });
          }
          const leagueData = responsibleData.leagueMap.get(leg.league_id)!;
          leagueData.bet_count += 1;
          leagueData.stake += Number(bet.stake || 0);
          leagueData.profit += Number(bet.profit_loss || 0);
          if (bet.state === 'won') leagueData.won += 1;
          leagueData.total += 1;
        }

        // Track teams (home and away)
        if (leg.home_team_id) {
          if (!responsibleData.teamMap.has(leg.home_team_id)) {
            responsibleData.teamMap.set(leg.home_team_id, {
              team_id: leg.home_team_id,
              team_name: '',
              bet_count: 0,
            });
          }
          responsibleData.teamMap.get(leg.home_team_id)!.bet_count += 1;
        }
        if (leg.away_team_id) {
          if (!responsibleData.teamMap.has(leg.away_team_id)) {
            responsibleData.teamMap.set(leg.away_team_id, {
              team_id: leg.away_team_id,
              team_name: '',
              bet_count: 0,
            });
          }
          responsibleData.teamMap.get(leg.away_team_id)!.bet_count += 1;
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
            });
          }
          const betTypeData = responsibleData.betTypeMap.get(leg.bet_type_id)!;
          betTypeData.bet_count += 1;
          betTypeData.stake += Number(bet.stake || 0);
          betTypeData.profit += Number(bet.profit_loss || 0);
          if (bet.state === 'won') betTypeData.won += 1;
          betTypeData.total += 1;
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
            });
          }
          const categoryData = responsibleData.categoryMap.get(leg.category_id)!;
          categoryData.bet_count += 1;
          categoryData.stake += Number(bet.stake || 0);
          categoryData.profit += Number(bet.profit_loss || 0);
          if (bet.state === 'won') categoryData.won += 1;
          categoryData.total += 1;
        }
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
    }

    // Fetch all reference items in one query
    const referenceItemsMap = new Map<string, string>();
    if (allReferenceIds.size > 0) {
      const referenceIdsArray = Array.from(allReferenceIds);
      // Supabase has a limit on IN queries, so batch if needed
      const batchSize = 100;
      for (let i = 0; i < referenceIdsArray.length; i += batchSize) {
        const batch = referenceIdsArray.slice(i, i + batchSize);
        const { data: referenceItems } = await this.supabase
          .from('reference_items')
          .select('id, name')
          .in('id', batch);
        
        if (referenceItems) {
          referenceItems.forEach(item => {
            referenceItemsMap.set(item.id, item.name);
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
        ? performanceByLegCount.reduce((best, current) => current.roi > best.roi ? current : best)
        : null;

      // Calculate summary
      const totalStake = data.bets.reduce((sum, b) => sum + Number(b.stake || 0), 0);
      const totalProfit = data.bets.reduce((sum, b) => sum + Number(b.profit_loss || 0), 0);
      const wonBets = data.bets.filter((b) => b.state === 'won').length;
      const winRate = data.bets.length > 0 ? wonBets / data.bets.length : 0;
      const roi = totalStake > 0 ? totalProfit / totalStake : 0;

      // Get league names and find most profitable
      const leagueDataArray = Array.from(data.leagueMap.values());
      leagueDataArray.forEach(leagueData => {
        leagueData.league_name = referenceItemsMap.get(leagueData.league_id) || '';
      });

      // Find most profitable league
      const mostProfitableLeague = leagueDataArray.length > 0
        ? leagueDataArray.reduce((best, current) => 
            current.profit > best.profit ? current : best
          )
        : null;

      // Find favorite league (most bets)
      const favoriteLeague = leagueDataArray.length > 0
        ? leagueDataArray.reduce((best, current) => 
            current.bet_count > best.bet_count ? current : best
          )
        : null;

      // Get team names and find favorite team
      const teamDataArray = Array.from(data.teamMap.values());
      teamDataArray.forEach(teamData => {
        teamData.team_name = referenceItemsMap.get(teamData.team_id) || '';
      });

      const favoriteTeam = teamDataArray.length > 0
        ? teamDataArray.reduce((best, current) => 
            current.bet_count > best.bet_count ? current : best
          )
        : null;

      // Get bet type names
      const betTypeDataArray = Array.from(data.betTypeMap.values());
      betTypeDataArray.forEach(betTypeData => {
        betTypeData.bet_type_name = referenceItemsMap.get(betTypeData.bet_type_id) || '';
      });

      // Get category names
      const categoryDataArray = Array.from(data.categoryMap.values());
      categoryDataArray.forEach(categoryData => {
        categoryData.category_name = referenceItemsMap.get(categoryData.category_id) || '';
      });

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
        } : null,
        favorite_league: favoriteLeague ? {
          league_id: favoriteLeague.league_id,
          league_name: favoriteLeague.league_name,
          bet_count: favoriteLeague.bet_count,
        } : null,
        favorite_team: favoriteTeam ? {
          team_id: favoriteTeam.team_id,
          team_name: favoriteTeam.team_name,
          bet_count: favoriteTeam.bet_count,
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
      });
    }

    return results;
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
      group.totalOdds += Number(bet.odds || 0);

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
      const winRate = betCount > 0 ? data.wonBets / betCount : 0;
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
          type: 'weekend',
          total_bets: 0,
          win_rate: 0,
          total_profit: 0,
          roi: 0,
          total_stake: 0,
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

    // Build day of week results
    const byDayOfWeek = Array.from(dayMap.entries())
      .map(([dayNum, data]) => ({
        day: dayNames[dayNum],
        day_number: dayNum,
        total_bets: data.bets.length,
        win_rate: data.bets.length > 0 ? data.won / data.bets.length : 0,
        total_profit: data.profit,
        roi: data.stake > 0 ? data.profit / data.stake : 0,
        total_stake: data.stake,
      }))
      .sort((a, b) => a.day_number - b.day_number);

    // Build hour results
    const byHour = Array.from(hourMap.entries())
      .map(([hour, data]) => ({
        hour,
        total_bets: data.bets.length,
        win_rate: data.bets.length > 0 ? data.won / data.bets.length : 0,
        total_profit: data.profit,
        total_stake: data.stake,
        roi: data.stake > 0 ? data.profit / data.stake : 0,
      }))
      .sort((a, b) => a.hour - b.hour);

    // Build month results
    const byMonth = Array.from(monthMap.values())
      .map((data) => ({
        month: data.month,
        month_number: data.monthNum,
        year: data.year,
        total_bets: data.bets.length,
        win_rate: data.bets.length > 0 ? data.won / data.bets.length : 0,
        total_profit: data.profit,
        roi: data.stake > 0 ? data.profit / data.stake : 0,
        total_stake: data.stake,
      }))
      .sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        return a.month_number - b.month_number;
      });

    // Weekend vs weekday - return both in an array format
    // Note: The type expects a single object, but we'll return weekend data
    // Frontend can calculate weekday from total - weekend if needed
    const weekendWinRate = weekendBets.bets.length > 0 ? weekendBets.won / weekendBets.bets.length : 0;
    const weekdayWinRate = weekdayBets.bets.length > 0 ? weekdayBets.won / weekdayBets.bets.length : 0;

    return {
      by_day_of_week: byDayOfWeek,
      by_hour: byHour,
      by_month: byMonth,
      weekend_vs_weekday: {
        type: 'weekend',
        total_bets: weekendBets.bets.length,
        win_rate: weekendWinRate,
        total_profit: weekendBets.profit,
        roi: weekendBets.stake > 0 ? weekendBets.profit / weekendBets.stake : 0,
        total_stake: weekendBets.stake,
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
      data.totalOdds += Number(bet.odds || 0);
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

    // Build results
    const leagueBetType = Array.from(leagueBetTypeMap.values()).map(data => ({
      league_id: data.league_id,
      league_name: refMap.get(data.league_id) || 'Unknown',
      bet_type_id: data.bet_type_id,
      bet_type_name: refMap.get(data.bet_type_id) || 'Unknown',
      total_bets: data.bets.length,
      win_rate: data.bets.length > 0 ? data.won / data.bets.length : 0,
      total_profit: data.profit,
      roi: data.stake > 0 ? data.profit / data.stake : 0,
      total_stake: data.stake,
    }));

    const responsibleLeague = Array.from(responsibleLeagueMap.values()).map(data => ({
      responsible_id: data.responsible_id,
      responsible_name: refMap.get(data.responsible_id) || 'Unknown',
      league_id: data.league_id,
      league_name: refMap.get(data.league_id) || 'Unknown',
      total_bets: data.bets.length,
      win_rate: data.bets.length > 0 ? data.won / data.bets.length : 0,
      total_profit: data.profit,
      roi: data.stake > 0 ? data.profit / data.stake : 0,
      total_stake: data.stake,
    }));

    const categoryLegs = Array.from(categoryLegsMap.values()).map(data => ({
      category_id: data.category_id,
      category_name: refMap.get(data.category_id) || 'Unknown',
      num_legs: data.num_legs,
      total_bets: data.bets.length,
      win_rate: data.bets.length > 0 ? data.won / data.bets.length : 0,
      total_profit: data.profit,
      roi: data.stake > 0 ? data.profit / data.stake : 0,
    }));

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
    const profitChange = previousSummary.total_profit !== 0
      ? ((currentSummary.total_profit - previousSummary.total_profit) / Math.abs(previousSummary.total_profit)) * 100
      : currentSummary.total_profit - previousSummary.total_profit;
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
      const odds = Number(bet.odds || 0);
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
            data.totalOdds += odds;
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
            data.totalOdds += odds;
            data.stake += stake;
            data.profit += profit;
          }
        }
      });
    });

    // Build EV by category
    // Expected ROI = (odds * probability) - 1, where probability is the implied probability from odds
    // But we use actual win rate as the probability estimate
    const evByCategory = Array.from(categoryMap.entries()).map(([categoryId, data]) => {
      const betCount = data.bets.length;
      const avgOdds = betCount > 0 ? data.totalOdds / betCount : 0;
      const actualWinRate = data.bets.filter(b => b.state === 'won').length / betCount;
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

    // Build EV by bet type
    const evByBetType = Array.from(betTypeMap.entries()).map(([betTypeId, data]) => {
      const betCount = data.bets.length;
      const avgOdds = betCount > 0 ? data.totalOdds / betCount : 0;
      const actualWinRate = data.bets.filter(b => b.state === 'won').length / betCount;
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

    // Overall EV
    const allBets = bets || [];
    const totalStake = allBets.reduce((sum, b) => sum + Number(b.stake || 0), 0);
    const totalProfit = allBets.reduce((sum, b) => sum + Number(b.profit_loss || 0), 0);
    const overallROI = totalStake > 0 ? totalProfit / totalStake : 0;
    const avgOdds = allBets.length > 0
      ? allBets.reduce((sum, b) => sum + Number(b.odds || 0), 0) / allBets.length
      : 0;
    const overallWinRate = allBets.length > 0
      ? allBets.filter(b => b.state === 'won').length / allBets.length
      : 0;
    // Expected ROI using overall win rate
    const expectedROI = (avgOdds * overallWinRate) - 1;
    const overallEV = overallROI - expectedROI;

    // Value bets: Bets where actual ROI exceeded expected ROI based on category/bet type averages
    // For each bet, compare its actual result to the expected result for its category/bet type
    const valueBets = allBets
      .map(b => {
        const odds = Number(b.odds || 0);
        const stake = Number(b.stake || 0);
        const profit = Number(b.profit_loss || 0);
        const actualROI = stake > 0 ? profit / stake : 0;
        
        // Find expected ROI from category or bet type
        let expectedROIForBet = expectedROI; // Default to overall
        const categoryId = b.legs?.[0]?.category_id;
        const betTypeId = b.legs?.[0]?.bet_type_id;
        
        if (categoryId && categoryMap.has(categoryId)) {
          const catData = categoryMap.get(categoryId)!;
          const catWinRate = catData.bets.filter(bet => bet.state === 'won').length / catData.bets.length;
          const catAvgOdds = catData.bets.length > 0 
            ? catData.bets.reduce((sum, bet) => sum + Number(bet.odds || 0), 0) / catData.bets.length 
            : odds;
          expectedROIForBet = (catAvgOdds * catWinRate) - 1;
        } else if (betTypeId && betTypeMap.has(betTypeId)) {
          const btData = betTypeMap.get(betTypeId)!;
          const btWinRate = btData.bets.filter(bet => bet.state === 'won').length / btData.bets.length;
          const btAvgOdds = btData.bets.length > 0 
            ? btData.bets.reduce((sum, bet) => sum + Number(bet.odds || 0), 0) / btData.bets.length 
            : odds;
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

    const postLossWinRate = postLossBets.length > 0
      ? postLossBets.filter(b => b.state === 'won').length / postLossBets.length
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
    const avgOdds = bets.length > 0
      ? bets.reduce((sum, b) => sum + Number(b.odds || 0), 0) / bets.length
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

