-- BetTracer Database Migration
-- Migration: 004_cumulative_profit_function
-- Description: Creates function to calculate and update cumulative profit

-- ============================================================================
-- FUNCTION: Calculate Cumulative Profit
-- ============================================================================
-- Function to calculate cumulative profit for a user when a bet state changes
CREATE OR REPLACE FUNCTION calculate_cumulative_profit(p_user_id UUID)
RETURNS NUMERIC AS $$
DECLARE
  v_cumulative_profit NUMERIC(14,2);
BEGIN
  -- Calculate cumulative profit from all resolved bets (won, lost, void)
  -- For won bets: add profit_loss
  -- For lost bets: profit_loss is negative (stake loss), so we add it
  -- For void bets: profit_loss is 0 or NULL, so no change
  SELECT COALESCE(SUM(profit_loss), 0)
  INTO v_cumulative_profit
  FROM main_bets
  WHERE user_id = p_user_id
    AND state IN ('won', 'lost', 'void')
    AND deleted_at IS NULL
    AND profit_loss IS NOT NULL;
  
  RETURN COALESCE(v_cumulative_profit, 0);
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- FUNCTION: Update Cumulative Profit on Bet State Change
-- ============================================================================
-- Function to update cumulative profit when a bet state changes
CREATE OR REPLACE FUNCTION update_cumulative_profit()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if state changed and bet is resolved
  IF (NEW.state != OLD.state OR NEW.profit_loss != OLD.profit_loss) 
     AND NEW.state IN ('won', 'lost', 'void')
     AND NEW.deleted_at IS NULL THEN
    
    -- Calculate and update cumulative profit for the user
    NEW.cumulative_profit := calculate_cumulative_profit(NEW.user_id);
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- TRIGGER: Update Cumulative Profit
-- ============================================================================
-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS update_cumulative_profit_trigger ON main_bets;

-- Create trigger to update cumulative profit when bet state or profit_loss changes
CREATE TRIGGER update_cumulative_profit_trigger
  BEFORE UPDATE ON main_bets
  FOR EACH ROW
  WHEN (OLD.state IS DISTINCT FROM NEW.state OR OLD.profit_loss IS DISTINCT FROM NEW.profit_loss)
  EXECUTE FUNCTION update_cumulative_profit();

-- ============================================================================
-- FUNCTION: Recalculate All Cumulative Profits
-- ============================================================================
-- Helper function to recalculate cumulative profits for all users
-- Useful for data migration or fixing inconsistencies
CREATE OR REPLACE FUNCTION recalculate_all_cumulative_profits()
RETURNS void AS $$
DECLARE
  v_user_id UUID;
  v_cumulative_profit NUMERIC(14,2);
BEGIN
  -- Loop through all users with bets
  FOR v_user_id IN SELECT DISTINCT user_id FROM main_bets WHERE deleted_at IS NULL
  LOOP
    -- Calculate cumulative profit for this user
    v_cumulative_profit := calculate_cumulative_profit(v_user_id);
    
    -- Update all bets for this user with the cumulative profit
    -- (This updates the cumulative_profit column for consistency)
    UPDATE main_bets
    SET cumulative_profit = v_cumulative_profit
    WHERE user_id = v_user_id
      AND deleted_at IS NULL;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON FUNCTION calculate_cumulative_profit(UUID) IS 'Calculates cumulative profit for a user from all resolved bets';
COMMENT ON FUNCTION update_cumulative_profit() IS 'Trigger function to update cumulative profit when bet state or profit_loss changes';
COMMENT ON FUNCTION recalculate_all_cumulative_profits() IS 'Recalculates cumulative profits for all users (useful for data migration)';

