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
        // Unique constraint violation - find all similar items (case-insensitive match)
        try {
          const { data: existingItems } = await this.supabase
            .from('reference_items')
            .select('name')
            .eq('kind', itemData.kind)
            .ilike('name', normalizedName);
          
          if (existingItems && existingItems.length > 0) {
            const existingNames = existingItems.map(item => `"${item.name}"`).join(', ');
            const count = existingItems.length;
            const message = count === 1
              ? `A ${itemData.kind} with this name already exists (case-insensitive). Existing: ${existingNames}`
              : `${count} ${itemData.kind}s with this name already exist (case-insensitive). Existing: ${existingNames}`;
            
            throw createError(
              errorCodes.CONFLICT,
              message,
              409
            );
          }
        } catch (lookupError: any) {
          // If it's our custom error, re-throw it
          if (lookupError.statusCode === 409) {
            throw lookupError;
          }
          // If lookup fails, try to find any similar items
          try {
            const { data: similarItems } = await this.supabase
              .from('reference_items')
              .select('name')
              .eq('kind', itemData.kind)
              .ilike('name', `%${normalizedName}%`)
              .limit(5);
            
            if (similarItems && similarItems.length > 0) {
              const similarNames = similarItems.map(item => `"${item.name}"`).join(', ');
              throw createError(
                errorCodes.CONFLICT,
                `A ${itemData.kind} with this name already exists. Similar items: ${similarNames}`,
                409
              );
            }
          } catch (similarError: any) {
            // If it's our custom error, re-throw it
            if (similarError.statusCode === 409) {
              throw similarError;
            }
          }
        }
        
        throw createError(
          errorCodes.CONFLICT,
          `A ${itemData.kind} with this name already exists (case-insensitive)`,
          409
        );
      }
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to create reference item', 500);
    }

    console.log('Item created successfully:', data.id);
    return data as ReferenceItem;
  }
}

