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

    // Calculate win rates and get team names
    const results = Array.from(teamMap.values());
    for (const result of results) {
      result.as_home.win_rate = result.as_home.total_legs > 0 ? result.as_home.won_legs / result.as_home.total_legs : 0;
      result.as_away.win_rate = result.as_away.total_legs > 0 ? result.as_away.won_legs / result.as_away.total_legs : 0;
      result.total.win_rate = result.total.total_legs > 0 ? result.total.won_legs / result.total.total_legs : 0;

      const { data: team } = await this.supabase
        .from('reference_items')
        .select('name')
        .eq('id', result.team_id)
        .single();

      if (team) {
        result.team_name = team.name;
      }
    }

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

    // Fetch reference item names and build results
    const results: ResponsibleDetailedAnalytics[] = [];
    for (const [responsibleId, data] of responsibleMap.entries()) {
      // Get responsible name
      const { data: responsible } = await this.supabase
        .from('reference_items')
        .select('name')
        .eq('id', responsibleId)
        .single();

      const responsibleName = responsible?.name || 'Unknown';

      // Calculate summary
      const totalStake = data.bets.reduce((sum, b) => sum + Number(b.stake || 0), 0);
      const totalProfit = data.bets.reduce((sum, b) => sum + Number(b.profit_loss || 0), 0);
      const wonBets = data.bets.filter((b) => b.state === 'won').length;
      const winRate = data.bets.length > 0 ? wonBets / data.bets.length : 0;
      const roi = totalStake > 0 ? totalProfit / totalStake : 0;

      // Get league names and find most profitable
      const leagueDataArray = Array.from(data.leagueMap.values());
      for (const leagueData of leagueDataArray) {
        const { data: league } = await this.supabase
          .from('reference_items')
          .select('name')
          .eq('id', leagueData.league_id)
          .single();
        if (league) {
          leagueData.league_name = league.name;
        }
      }

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
      for (const teamData of teamDataArray) {
        const { data: team } = await this.supabase
          .from('reference_items')
          .select('name')
          .eq('id', teamData.team_id)
          .single();
        if (team) {
          teamData.team_name = team.name;
        }
      }

      const favoriteTeam = teamDataArray.length > 0
        ? teamDataArray.reduce((best, current) => 
            current.bet_count > best.bet_count ? current : best
          )
        : null;

      // Get bet type names
      const betTypeDataArray = Array.from(data.betTypeMap.values());
      for (const betTypeData of betTypeDataArray) {
        const { data: betType } = await this.supabase
          .from('reference_items')
          .select('name')
          .eq('id', betTypeData.bet_type_id)
          .single();
        if (betType) {
          betTypeData.bet_type_name = betType.name;
        }
      }

      // Get category names
      const categoryDataArray = Array.from(data.categoryMap.values());
      for (const categoryData of categoryDataArray) {
        const { data: category } = await this.supabase
          .from('reference_items')
          .select('name')
          .eq('id', categoryData.category_id)
          .single();
        if (category) {
          categoryData.category_name = category.name;
        }
      }

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
      });
    }

    return results;
  }
}

