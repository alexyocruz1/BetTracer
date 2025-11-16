import { SupabaseClient } from '@supabase/supabase-js';
import { Leg } from '../types';
import { createError, errorCodes } from '../utils/errors';

export class LegsService {
  constructor(private supabase: SupabaseClient) {}

  async updateLeg(userId: string, legId: string, updateData: Partial<Leg>): Promise<Leg> {
    // Verify leg belongs to user's bet
    const { data: leg, error: legError } = await this.supabase
      .from('legs')
      .select('*, main_bets!inner(user_id)')
      .eq('id', legId)
      .single();

    if (legError || !leg) {
      throw createError(errorCodes.NOT_FOUND, 'Leg not found', 404);
    }

    if ((leg.main_bets as any).user_id !== userId) {
      throw createError(errorCodes.FORBIDDEN, 'Not authorized to update this leg', 403);
    }

    const { data: updatedLeg, error: updateError } = await this.supabase
      .from('legs')
      .update(updateData)
      .eq('id', legId)
      .select()
      .single();

    if (updateError || !updatedLeg) {
      throw createError(errorCodes.INTERNAL_SERVER_ERROR, 'Failed to update leg', 500);
    }

    return updatedLeg as Leg;
  }

  async updateLegState(userId: string, legId: string, resultState: string): Promise<Leg> {
    return this.updateLeg(userId, legId, { result_state: resultState as any });
  }
}

