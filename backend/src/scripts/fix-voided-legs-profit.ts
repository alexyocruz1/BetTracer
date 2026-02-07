/**
 * Script to fix profit_loss for bets with voided legs
 * This recalculates profit using effective odds (excluding voided legs)
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY!;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment variables');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

interface Leg {
  id: string;
  odd: number;
  result_state: 'pending' | 'won' | 'lost' | 'void';
}

interface Bet {
  id: string;
  stake: number;
  odds: number;
  state: 'pending' | 'won' | 'lost' | 'void';
  profit_loss: number | null;
  legs: Leg[];
}

function calculateEffectiveOdds(legs: Leg[]): number {
  if (!legs || legs.length === 0) {
    return 0;
  }

  const nonVoidedLegs = legs.filter(leg => leg.result_state !== 'void');
  
  if (nonVoidedLegs.length === 0) {
    // All legs are voided - return 1 (push)
    return 1;
  }

  // Calculate effective odds by multiplying non-voided legs
  const effectiveOdds = nonVoidedLegs.reduce((acc, leg) => {
    return acc * Number(leg.odd || 1);
  }, 1);

  return effectiveOdds;
}

async function fixVoidedLegsProfit() {
  console.log('🔧 Starting to fix profit_loss for bets with voided legs...\n');

  try {
    // Fetch all won or lost bets with their legs
    const { data: bets, error } = await supabase
      .from('main_bets')
      .select('id, stake, odds, state, profit_loss, legs(id, odd, result_state)')
      .in('state', ['won', 'lost'])
      .is('deleted_at', null);

    if (error) {
      throw new Error(`Failed to fetch bets: ${error.message}`);
    }

    if (!bets || bets.length === 0) {
      console.log('No bets found to process.');
      return;
    }

    console.log(`📊 Found ${bets.length} resolved bets to check.\n`);

    // Filter to only bets that have at least one voided leg
    const betsWithVoidedLegs = bets.filter((bet: any) => 
      bet.legs && bet.legs.length > 0 && bet.legs.some((leg: any) => leg.result_state === 'void')
    );

    console.log(`🎯 Found ${betsWithVoidedLegs.length} bets with voided legs that need fixing.\n`);

    if (betsWithVoidedLegs.length === 0) {
      console.log('✅ No bets need fixing!');
      return;
    }

    let fixedCount = 0;
    let unchangedCount = 0;
    const updates: Array<{ id: string; oldProfit: number; newProfit: number; effectiveOdds: number }> = [];

    for (const bet of betsWithVoidedLegs as any[]) {
      const effectiveOdds = calculateEffectiveOdds(bet.legs);
      let newProfitLoss: number;

      if (bet.state === 'won') {
        newProfitLoss = bet.stake * effectiveOdds - bet.stake;
      } else if (bet.state === 'lost') {
        newProfitLoss = -bet.stake;
      } else {
        newProfitLoss = 0;
      }

      // Round to 2 decimal places for comparison
      newProfitLoss = Math.round(newProfitLoss * 100) / 100;
      const oldProfitLoss = bet.profit_loss !== null ? Math.round(bet.profit_loss * 100) / 100 : 0;

      // Only update if the value is different
      if (Math.abs(newProfitLoss - oldProfitLoss) > 0.01) {
        const { error: updateError } = await supabase
          .from('main_bets')
          .update({ profit_loss: newProfitLoss })
          .eq('id', bet.id);

        if (updateError) {
          console.error(`❌ Failed to update bet ${bet.id}: ${updateError.message}`);
        } else {
          fixedCount++;
          updates.push({
            id: bet.id,
            oldProfit: oldProfitLoss,
            newProfit: newProfitLoss,
            effectiveOdds: effectiveOdds,
          });
        }
      } else {
        unchangedCount++;
      }
    }

    console.log('\n📋 Summary:');
    console.log(`✅ Fixed: ${fixedCount} bets`);
    console.log(`⚪ Unchanged: ${unchangedCount} bets (already correct)`);
    console.log(`📊 Total checked: ${betsWithVoidedLegs.length} bets\n`);

    if (updates.length > 0) {
      console.log('📝 Updated bets:');
      updates.forEach(update => {
        const diff = update.newProfit - update.oldProfit;
        const diffSign = diff >= 0 ? '+' : '';
        console.log(
          `  Bet ${update.id.substring(0, 8)}... | ` +
          `Old: $${update.oldProfit.toFixed(2)} → New: $${update.newProfit.toFixed(2)} ` +
          `(${diffSign}$${diff.toFixed(2)}) | Effective Odds: ${update.effectiveOdds.toFixed(2)}`
        );
      });
    }

    console.log('\n✨ Migration complete!');
  } catch (error: any) {
    console.error('❌ Error during migration:', error.message);
    process.exit(1);
  }
}

// Run the migration
fixVoidedLegsProfit()
  .then(() => {
    process.exit(0);
  })
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
