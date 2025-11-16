import { SupabaseClient } from '@supabase/supabase-js';
import {
  AnalyticsSummary,
  AnalyticsByLeague,
  AnalyticsByResponsible,
  TimeSeriesData,
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

  async getTimeSeries(
    userId: string,
    granularity: 'daily' | 'weekly' | 'monthly',
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

      if (granularity === 'daily') {
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
}

