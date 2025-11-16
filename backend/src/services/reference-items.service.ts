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
    console.log('Creating reference item:', { kind: itemData.kind, name: itemData.name });
    
    // Normalize name: trim whitespace and convert to title case for consistency
    // Title case: "premier league" -> "Premier League"
    const normalizeName = (name: string): string => {
      return name
        .trim()
        .split(/\s+/)
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');
    };

    const normalizedName = normalizeName(itemData.name);
    console.log('Normalized name:', normalizedName);

    // Skip duplicate check - let the database handle it via unique constraint
    // This is more efficient and prevents hanging queries
    // The database will throw a unique constraint error if duplicate exists

    // Insert with normalized name
    const { data, error } = await this.supabase
      .from('reference_items')
      .insert({
        ...itemData,
        name: normalizedName,
      })
      .select()
      .single();

    if (error) {
      console.error('Insert error:', error);
      if (error.code === '23505') {
        // Unique constraint violation - could be case-sensitive or case-insensitive
        // Try to find the existing item to show a better error message
        try {
          const { data: existing } = await this.supabase
            .from('reference_items')
            .select('name')
            .eq('kind', itemData.kind)
            .ilike('name', normalizedName)
            .limit(1)
            .single();
          
          if (existing) {
            throw createError(
              errorCodes.CONFLICT,
              `A ${itemData.kind} with this name already exists (case-insensitive). Existing: "${existing.name}"`,
              409
            );
          }
        } catch (lookupError: any) {
          // If lookup fails, just use generic message
        }
        
        throw createError(
          errorCodes.CONFLICT,
          `A ${itemData.kind} with this name already exists`,
          409
        );
      }
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to create reference item', 500);
    }

    console.log('Item created successfully:', data.id);
    return data as ReferenceItem;
  }
}

