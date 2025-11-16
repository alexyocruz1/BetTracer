import { SupabaseClient } from '@supabase/supabase-js';
import { ReferenceItem } from '../types';
import { createError, errorCodes } from '../utils/errors';

export class ReferenceItemsService {
  constructor(private supabase: SupabaseClient) {}

  async getReferenceItems(filters: {
    kind?: string;
    limit: number;
    offset: number;
  }): Promise<{ items: ReferenceItem[]; total: number }> {
    let query = this.supabase
      .from('reference_items')
      .select('*', { count: 'exact' })
      .order('name', { ascending: true });

    if (filters.kind) {
      query = query.eq('kind', filters.kind);
    }

    const { data, error, count } = await query
      .range(filters.offset, filters.offset + filters.limit - 1);

    if (error) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to fetch reference items', 500);
    }

    return {
      items: (data || []) as ReferenceItem[],
      total: count || 0,
    };
  }

  async createReferenceItem(itemData: {
    kind: string;
    name: string;
    metadata?: Record<string, unknown>;
  }): Promise<ReferenceItem> {
    const { data, error } = await this.supabase
      .from('reference_items')
      .insert(itemData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') {
        // Unique constraint violation
        throw createError(errorCodes.CONFLICT, 'Reference item already exists', 409);
      }
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to create reference item', 500);
    }

    return data as ReferenceItem;
  }
}

