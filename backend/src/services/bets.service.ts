import { SupabaseClient } from '@supabase/supabase-js';
import { CreateBetRequest, MainBet, UpdateBetRequest, UpdateBetStateRequest } from '../types';
import { createError, errorCodes } from '../utils/errors';

export class BetsService {
  constructor(private supabase: SupabaseClient) {}

  async createBet(userId: string, betData: CreateBetRequest): Promise<MainBet> {
    const { legs, ...mainBetData } = betData;

    // Calculate combined odds if not provided
    if (!mainBetData.odds && legs.length > 0) {
      mainBetData.odds = legs.reduce((acc, leg) => acc * leg.odd, 1);
    }

    // Start transaction by creating main bet first
    const { data: mainBet, error: mainBetError } = await this.supabase
      .from('main_bets')
      .insert({
        ...mainBetData,
        user_id: userId,
      })
      .select()
      .single();

    if (mainBetError || !mainBet) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to create bet', 500);
    }

    // Create legs
    const legsData = legs.map((leg) => ({
      ...leg,
      main_bet_id: mainBet.id,
    }));

    const { error: legsError } = await this.supabase.from('legs').insert(legsData);

    if (legsError) {
      // Rollback: delete main bet if legs creation fails
      await this.supabase.from('main_bets').delete().eq('id', mainBet.id);
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to create legs', 500);
    }

    // Fetch complete bet with legs
    return this.getBetById(userId, mainBet.id);
  }

  async getBets(
    userId: string,
    filters: {
      start_date?: string;
      end_date?: string;
      state?: string;
      league_id?: string;
      responsible_id?: string;
      limit: number;
      offset: number;
    }
  ): Promise<{ bets: MainBet[]; total: number }> {
    let query = this.supabase
      .from('main_bets')
      .select('*', { count: 'exact' })
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('date', { ascending: false });

    if (filters.start_date) {
      query = query.gte('date', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('date', filters.end_date);
    }

    if (filters.state) {
      query = query.eq('state', filters.state);
    }

    if (filters.league_id) {
      query = query.in('id', (qb: any) =>
        qb
          .from('legs')
          .select('main_bet_id')
          .eq('league_id', filters.league_id)
      );
    }

    if (filters.responsible_id) {
      query = query.in('id', (qb: any) =>
        qb
          .from('legs')
          .select('main_bet_id')
          .eq('responsible_id', filters.responsible_id)
      );
    }

    const { data, error, count } = await query
      .range(filters.offset, filters.offset + filters.limit - 1);

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch bets', 500);
    }

    // Fetch legs for each bet
    const betsWithLegs = await Promise.all(
      (data || []).map(async (bet) => this.getBetById(userId, bet.id))
    );

    return {
      bets: betsWithLegs,
      total: count || 0,
    };
  }

  async getBetById(userId: string, betId: string): Promise<MainBet> {
    const { data: mainBet, error: mainBetError } = await this.supabase
      .from('main_bets')
      .select('*')
      .eq('id', betId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (mainBetError || !mainBet) {
      throw createError(errorCodes.NOT_FOUND, 'Bet not found', 404);
    }

    // Fetch legs
    const { data: legs, error: legsError } = await this.supabase
      .from('legs')
      .select('*')
      .eq('main_bet_id', betId);

    if (legsError) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch legs', 500);
    }

    return {
      ...mainBet,
      legs: legs || [],
    } as MainBet;
  }

  async updateBet(userId: string, betId: string, updateData: UpdateBetRequest): Promise<MainBet> {
    const { error } = await this.supabase
      .from('main_bets')
      .update(updateData)
      .eq('id', betId)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to update bet', 500);
    }

    return this.getBetById(userId, betId);
  }

  async updateBetState(
    userId: string,
    betId: string,
    stateData: UpdateBetStateRequest
  ): Promise<MainBet> {
    // Calculate profit_loss if not provided and state is won/lost
    let profitLoss = stateData.profit_loss;
    if (!profitLoss) {
      const bet = await this.getBetById(userId, betId);
      if (stateData.state === 'won') {
        profitLoss = bet.stake * (bet.odds || 1) - bet.stake;
      } else if (stateData.state === 'lost') {
        profitLoss = -bet.stake;
      } else {
        profitLoss = 0;
      }
    }

    const { error } = await this.supabase
      .from('main_bets')
      .update({
        state: stateData.state,
        profit_loss: profitLoss,
      })
      .eq('id', betId)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to update bet state', 500);
    }

    // Cumulative profit will be updated automatically by trigger
    return this.getBetById(userId, betId);
  }

  async deleteBet(userId: string, betId: string): Promise<void> {
    const { error } = await this.supabase
      .from('main_bets')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', betId)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to delete bet', 500);
    }
  }
}

