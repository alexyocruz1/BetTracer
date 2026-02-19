-- Migration: 007_casino_earnings
-- Description: Adds casino_earnings table for tracking casino winnings and bonuses

-- ============================================================================
-- CASINO EARNINGS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS casino_earnings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  amount NUMERIC(12,2) NOT NULL, -- Can be positive (win) or negative (loss)
  source TEXT NOT NULL, -- Name of the casino game, promotion, or source
  type TEXT NOT NULL CHECK (type IN ('casino_bet', 'daily_bonus', 'free_spins', 'cashback', 'promotion', 'other')),
  notes TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete support
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- INDEXES
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_casino_earnings_user_date ON casino_earnings(user_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_casino_earnings_user_type ON casino_earnings(user_id, type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_casino_earnings_date ON casino_earnings(date DESC) WHERE deleted_at IS NULL;

-- ============================================================================
-- TRIGGER
-- ============================================================================
CREATE TRIGGER update_casino_earnings_updated_at 
  BEFORE UPDATE ON casino_earnings
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE casino_earnings IS 'Casino winnings, bonuses, and other gambling income';
COMMENT ON COLUMN casino_earnings.amount IS 'Amount won or received (can be positive for wins or negative for losses)';
COMMENT ON COLUMN casino_earnings.source IS 'Name of the casino game, promotion, or source';
COMMENT ON COLUMN casino_earnings.type IS 'Type of earning: casino_bet, daily_bonus, free_spins, cashback, promotion, or other';
COMMENT ON COLUMN casino_earnings.deleted_at IS 'Soft delete timestamp (NULL = not deleted)';
