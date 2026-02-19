import { SupabaseClient } from '@supabase/supabase-js';

export interface CasinoEarning {
  id: string;
  user_id: string;
  date: string;
  amount: number;
  source: string;
  type: 'casino_bet' | 'daily_bonus' | 'free_spins' | 'cashback' | 'promotion' | 'other';
  notes?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CreateCasinoEarningInput {
  user_id: string;
  date: string;
  amount: number;
  source: string;
  type: 'casino_bet' | 'daily_bonus' | 'free_spins' | 'cashback' | 'promotion' | 'other';
  notes?: string;
}

export interface UpdateCasinoEarningInput {
  date?: string;
  amount?: number;
  source?: string;
  type?: 'casino_bet' | 'daily_bonus' | 'free_spins' | 'cashback' | 'promotion' | 'other';
  notes?: string;
}

export interface GetCasinoEarningsFilters {
  user_id: string;
  start_date?: string;
  end_date?: string;
  type?: string;
  limit?: number;
  offset?: number;
}

export class CasinoEarningsService {
  constructor(private supabase: SupabaseClient) {}

  async create(input: CreateCasinoEarningInput): Promise<CasinoEarning> {
    const { data, error } = await this.supabase
      .from('casino_earnings')
      .insert({
        user_id: input.user_id,
        date: input.date,
        amount: input.amount,
        source: input.source,
        type: input.type,
        notes: input.notes,
      })
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create casino earning: ${error.message}`);
    }

    return data;
  }

  async getById(id: string, userId: string): Promise<CasinoEarning | null> {
    const { data, error } = await this.supabase
      .from('casino_earnings')
      .select('*')
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to fetch casino earning: ${error.message}`);
    }

    return data;
  }

  async getAll(filters: GetCasinoEarningsFilters): Promise<{ data: CasinoEarning[]; total: number }> {
    let query = this.supabase
      .from('casino_earnings')
      .select('*', { count: 'exact' })
      .eq('user_id', filters.user_id)
      .is('deleted_at', null)
      .order('date', { ascending: false });

    if (filters.start_date) {
      query = query.gte('date', filters.start_date);
    }

    if (filters.end_date) {
      query = query.lte('date', filters.end_date);
    }

    if (filters.type) {
      query = query.eq('type', filters.type);
    }

    if (filters.limit) {
      query = query.limit(filters.limit);
    }

    if (filters.offset) {
      query = query.range(filters.offset, filters.offset + (filters.limit || 20) - 1);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Failed to fetch casino earnings: ${error.message}`);
    }

    return {
      data: data || [],
      total: count || 0,
    };
  }

  async update(id: string, userId: string, input: UpdateCasinoEarningInput): Promise<CasinoEarning> {
    const { data, error } = await this.supabase
      .from('casino_earnings')
      .update(input)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to update casino earning: ${error.message}`);
    }

    return data;
  }

  async delete(id: string, userId: string): Promise<void> {
    const { error } = await this.supabase
      .from('casino_earnings')
      .update({ deleted_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to delete casino earning: ${error.message}`);
    }
  }

  async getTotalEarnings(userId: string, startDate?: string, endDate?: string): Promise<number> {
    let query = this.supabase
      .from('casino_earnings')
      .select('amount')
      .eq('user_id', userId)
      .is('deleted_at', null);

    if (startDate) {
      query = query.gte('date', startDate);
    }

    if (endDate) {
      query = query.lte('date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to calculate total earnings: ${error.message}`);
    }

    return data?.reduce((sum: number, item: { amount: number }) => sum + parseFloat(item.amount.toString()), 0) || 0;
  }
}
