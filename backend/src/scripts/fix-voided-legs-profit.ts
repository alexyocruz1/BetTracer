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

function calculateEffectiveOdds(legs: Leg[], mainOdds: number): number {
  if (!legs || legs.length === 0) {
    return mainOdds;
  }

  const nonVoidedLegs = legs.filter(leg => leg.result_state !== 'void');
  
  if (nonVoidedLegs.length === 0) {
    // All legs are voided - return 1 (push)
    return 1;
  }

  // Check if leg odds are placeholders (all 1.0 or all 0)
  // This happens when user only knows combined odds but not individual leg odds
  const hasPlaceholderOdds = legs.every(leg => {
    const odd = Number(leg.odd || 1);
    return odd <= 1.01; // Consider 1.0 or less as placeholder
  });

  // If using placeholder odds, we can't calculate effective odds properly
  // Fall back to main bet odds (can't adjust for voided legs without real leg odds)
  if (hasPlaceholderOdds) {
    console.log(`  Using main bet odds (placeholder leg odds detected)`);
    return mainOdds;
  }

  // Calculate effective odds by multiplying non-voided legs
  const effectiveOdds = nonVoidedLegs.reduce((acc, leg) => {
    return acc * Number(leg.odd || 1);
  }, 1);

  // Verify calculated odds are reasonable
  // If leg odds product differs too much from main bet odds, use main bet odds
  const allLegsProduct = legs.reduce((acc, leg) => acc * Number(leg.odd || 1), 1);
  const oddsDifference = Math.abs(allLegsProduct - mainOdds);
  
  // If difference > 10% of main odds, leg odds might be placeholders or incorrect
  if (mainOdds > 0 && oddsDifference > mainOdds * 0.1) {
    console.log(`  Leg odds mismatch (product: ${allLegsProduct.toFixed(2)}, main: ${mainOdds.toFixed(2)}), using main bet odds`);
    return mainOdds;
  }

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

    // Filter to bets that either:
    // 1. Have at least one voided leg, OR
    // 2. Have placeholder leg odds (all legs ≤ 1.01)
    const betsNeedingFix = bets.filter((bet: any) => {
      if (!bet.legs || bet.legs.length === 0) return false;
      
      // Check for voided legs
      const hasVoidedLeg = bet.legs.some((leg: any) => leg.result_state === 'void');
      
      // Check for placeholder odds
      const hasPlaceholderOdds = bet.legs.every((leg: any) => {
        const odd = Number(leg.odd || 1);
        return odd <= 1.01;
      });
      
      return hasVoidedLeg || hasPlaceholderOdds;
    });

    console.log(`🎯 Found ${betsNeedingFix.length} bets that need fixing:\n`);
    const withVoided = betsNeedingFix.filter((bet: any) => 
      bet.legs.some((leg: any) => leg.result_state === 'void')
    ).length;
    const withPlaceholder = betsNeedingFix.filter((bet: any) => 
      bet.legs.every((leg: any) => Number(leg.odd || 1) <= 1.01)
    ).length;
    console.log(`  - ${withVoided} with voided legs`);
    console.log(`  - ${withPlaceholder} with placeholder odds\n`);

    if (betsNeedingFix.length === 0) {
      console.log('✅ No bets need fixing!');
      return;
    }

    let fixedCount = 0;
    let unchangedCount = 0;
    const updates: Array<{ id: string; oldProfit: number; newProfit: number; effectiveOdds: number }> = [];

    for (const bet of betsNeedingFix as any[]) {
      console.log(`\n🔍 Processing bet ${bet.id.substring(0, 8)}...`);
      console.log(`  Date: ${bet.date?.substring(0, 10)}`);
      console.log(`  State: ${bet.state}`);
      console.log(`  Stake: $${bet.stake}`);
      console.log(`  Main odds: ${bet.odds}`);
      console.log(`  Current profit: $${bet.profit_loss}`);
      console.log(`  Legs: ${bet.legs.length}`);
      bet.legs.forEach((leg: any, idx: number) => {
        console.log(`    Leg ${idx + 1}: odds=${leg.odd}, state=${leg.result_state}`);
      });
      
      const effectiveOdds = calculateEffectiveOdds(bet.legs, bet.odds);
      console.log(`  Calculated effective odds: ${effectiveOdds}`);
      
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
      
      console.log(`  Calculated profit: $${newProfitLoss}`);
      console.log(`  Difference: $${(newProfitLoss - oldProfitLoss).toFixed(2)}`);

      // Only update if the value is different
      if (Math.abs(newProfitLoss - oldProfitLoss) > 0.01) {
        console.log(`  ✅ Updating...`);
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
        console.log(`  ⚪ Already correct, skipping`);
        unchangedCount++;
      }
    }

    console.log('\n📋 Summary:');
    console.log(`✅ Fixed: ${fixedCount} bets`);
    console.log(`⚪ Unchanged: ${unchangedCount} bets (already correct)`);
    console.log(`📊 Total checked: ${betsNeedingFix.length} bets\n`);

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
