import { SupabaseClient } from '@supabase/supabase-js';
import { CreateBetRequest, MainBet, UpdateBetRequest, UpdateBetStateRequest } from '../types';
import { createError, errorCodes } from '../utils/errors';

export class BetsService {
  constructor(private supabase: SupabaseClient) {}

  async createBet(userId: string, betData: CreateBetRequest): Promise<MainBet> {
    try {
      const { legs, ...mainBetData } = betData;

      console.log('[BetsService] Creating bet for user:', userId);
      console.log('[BetsService] Bet data:', { ...mainBetData, legsCount: legs.length });

      // Calculate combined odds if not provided
      if (!mainBetData.odds && legs.length > 0) {
        mainBetData.odds = legs.reduce((acc: number, leg: any) => acc * leg.odd, 1);
      }

      // Start transaction by creating main bet first
      console.log('[BetsService] Inserting main bet...');
      const { data: mainBet, error: mainBetError } = await this.supabase
        .from('main_bets')
        .insert({
          ...mainBetData,
          user_id: userId,
        })
        .select()
        .single();

      if (mainBetError || !mainBet) {
        console.error('[BetsService] Failed to create main bet:', mainBetError);
        throw createError(errorCodes.INTERNAL_SERVER_ERROR, `Failed to create bet: ${mainBetError?.message || 'Unknown error'}`, 500);
      }

      console.log('[BetsService] Main bet created:', mainBet.id);

      // Create legs
      const legsData = legs.map((leg: any) => ({
        ...leg,
        main_bet_id: mainBet.id,
      }));

      console.log('[BetsService] Inserting legs...', legsData.length);
      const { error: legsError } = await this.supabase.from('legs').insert(legsData);

      if (legsError) {
        console.error('[BetsService] Failed to create legs:', legsError);
        // Rollback: delete main bet if legs creation fails
        await this.supabase.from('main_bets').delete().eq('id', mainBet.id);
        throw createError(errorCodes.INTERNAL_SERVER_ERROR, `Failed to create legs: ${legsError.message}`, 500);
      }

      console.log('[BetsService] Legs created successfully');

      // Fetch complete bet with legs
      console.log('[BetsService] Fetching complete bet with legs...');
      const completeBet = await this.getBetById(userId, mainBet.id);
      console.log('[BetsService] Bet created successfully:', completeBet.id);
      
      return completeBet;
    } catch (error: any) {
      console.error('[BetsService] Error in createBet:', error);
      throw error;
    }
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
      // First, get all bet IDs that have legs with this league_id
      const { data: legsWithLeague } = await this.supabase
        .from('legs')
        .select('main_bet_id')
        .eq('league_id', filters.league_id);
      
      if (legsWithLeague && legsWithLeague.length > 0) {
        const betIds = [...new Set(legsWithLeague.map((l: any) => l.main_bet_id))];
        query = query.in('id', betIds);
      } else {
        // No legs match, return empty result
        query = query.eq('id', 'no-matches');
      }
    }

    if (filters.responsible_id) {
      // First, get all bet IDs that have legs with this responsible_id
      const { data: legsWithResponsible } = await this.supabase
        .from('legs')
        .select('main_bet_id')
        .eq('responsible_id', filters.responsible_id);
      
      if (legsWithResponsible && legsWithResponsible.length > 0) {
        const betIds = [...new Set(legsWithResponsible.map((l: any) => l.main_bet_id))];
        query = query.in('id', betIds);
      } else {
        // No legs match, return empty result
        query = query.eq('id', 'no-matches');
      }
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
    try {
      console.log('[BetsService] Fetching bet:', betId, 'for user:', userId);
      
      const { data: mainBet, error: mainBetError } = await this.supabase
        .from('main_bets')
        .select('*')
        .eq('id', betId)
        .eq('user_id', userId)
        .is('deleted_at', null)
        .single();

      if (mainBetError || !mainBet) {
        console.error('[BetsService] Bet not found:', mainBetError);
        throw createError(errorCodes.NOT_FOUND, `Bet not found: ${mainBetError?.message || 'Unknown error'}`, 404);
      }

      console.log('[BetsService] Main bet fetched, fetching legs...');

      // Fetch legs
      const { data: legs, error: legsError } = await this.supabase
        .from('legs')
        .select('*')
        .eq('main_bet_id', betId);

      if (legsError) {
        console.error('[BetsService] Failed to fetch legs:', legsError);
        throw createError(errorCodes.INTERNAL_SERVER_ERROR, `Failed to fetch legs: ${legsError.message}`, 500);
      }

      console.log('[BetsService] Bet fetched successfully with', legs?.length || 0, 'legs');

      return {
        ...mainBet,
        legs: legs || [],
      } as MainBet;
    } catch (error: any) {
      console.error('[BetsService] Error in getBetById:', error);
      throw error;
    }
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

