-- BetTracer Database Schema Migration
-- Migration: 001_initial_schema
-- Description: Creates all core tables, indexes, triggers, and functions

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- PROFILES TABLE
-- ============================================================================
-- Profiles table (extends Supabase auth.users)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT,
  full_name TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- REFERENCE ITEMS TABLE
-- ============================================================================
-- Reference items for teams, leagues, bet types, etc.
CREATE TABLE IF NOT EXISTS reference_items (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  kind TEXT NOT NULL CHECK (kind IN ('team','league','bet_type','category','responsible')),
  name TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(kind, name)
);

-- ============================================================================
-- MAIN BETS TABLE
-- ============================================================================
-- Main bets table
CREATE TABLE IF NOT EXISTS main_bets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  external_id TEXT,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  stake NUMERIC(12,2) NOT NULL CHECK (stake > 0),
  odds NUMERIC(12,6) CHECK (odds > 0),
  profit_loss NUMERIC(12,2),
  state TEXT CHECK (state IN ('pending','won','lost','void')) DEFAULT 'pending',
  cumulative_profit NUMERIC(14,2), -- Per-user cumulative profit over time
  notes TEXT,
  deleted_at TIMESTAMP WITH TIME ZONE, -- Soft delete support
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- LEGS TABLE
-- ============================================================================
-- Legs table (no user_id - accessed via main_bet relationship)
CREATE TABLE IF NOT EXISTS legs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  main_bet_id UUID NOT NULL REFERENCES main_bets(id) ON DELETE CASCADE,
  home_team_id UUID REFERENCES reference_items(id),
  away_team_id UUID REFERENCES reference_items(id),
  league_id UUID REFERENCES reference_items(id),
  bet_type_id UUID REFERENCES reference_items(id),
  category_id UUID REFERENCES reference_items(id),
  responsible_id UUID REFERENCES reference_items(id),
  odd NUMERIC(12,6) NOT NULL CHECK (odd > 0),
  result_state TEXT CHECK (result_state IN ('pending','won','lost','void')) DEFAULT 'pending',
  probability_est NUMERIC(5,4), -- ML predicted probability
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- ============================================================================
-- DAILY SUMMARY TABLE
-- ============================================================================
-- Analytics summary table (daily aggregates)
CREATE TABLE IF NOT EXISTS daily_summary (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  date DATE NOT NULL,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  total_stake NUMERIC(14,2),
  total_profit NUMERIC(14,2),
  win_rate NUMERIC(5,4),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(date, user_id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================
-- Performance indexes for common queries

-- Main bets indexes
CREATE INDEX IF NOT EXISTS idx_main_bets_user_date ON main_bets(user_id, date DESC) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_main_bets_user_state ON main_bets(user_id, state) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_main_bets_date ON main_bets(date DESC) WHERE deleted_at IS NULL;

-- Legs indexes
CREATE INDEX IF NOT EXISTS idx_legs_main_bet_id ON legs(main_bet_id);
CREATE INDEX IF NOT EXISTS idx_legs_league ON legs(league_id) WHERE league_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legs_responsible ON legs(responsible_id) WHERE responsible_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_legs_result_state ON legs(result_state);

-- Reference items indexes
CREATE INDEX IF NOT EXISTS idx_reference_items_kind ON reference_items(kind);
CREATE INDEX IF NOT EXISTS idx_reference_items_kind_name ON reference_items(kind, name);

-- Daily summary indexes
CREATE INDEX IF NOT EXISTS idx_daily_summary_user_date ON daily_summary(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_daily_summary_date ON daily_summary(date DESC);

-- ============================================================================
-- FUNCTIONS
-- ============================================================================
-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- ============================================================================
-- TRIGGERS
-- ============================================================================
-- Triggers for updated_at

-- Drop existing triggers if they exist
DROP TRIGGER IF EXISTS update_profiles_updated_at ON profiles;
DROP TRIGGER IF EXISTS update_main_bets_updated_at ON main_bets;
DROP TRIGGER IF EXISTS update_legs_updated_at ON legs;
DROP TRIGGER IF EXISTS update_reference_items_updated_at ON reference_items;
DROP TRIGGER IF EXISTS update_daily_summary_updated_at ON daily_summary;

-- Create triggers
CREATE TRIGGER update_profiles_updated_at 
  BEFORE UPDATE ON profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_main_bets_updated_at 
  BEFORE UPDATE ON main_bets
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_legs_updated_at 
  BEFORE UPDATE ON legs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_reference_items_updated_at 
  BEFORE UPDATE ON reference_items
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_daily_summary_updated_at 
  BEFORE UPDATE ON daily_summary
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users';
COMMENT ON TABLE reference_items IS 'Reference data for teams, leagues, bet types, categories, and responsible persons';
COMMENT ON TABLE main_bets IS 'Main bets table with user_id for data isolation';
COMMENT ON TABLE legs IS 'Bet legs (no user_id - accessed via main_bet relationship)';
COMMENT ON TABLE daily_summary IS 'Daily aggregated analytics per user';

COMMENT ON COLUMN main_bets.cumulative_profit IS 'Per-user cumulative profit over time';
COMMENT ON COLUMN main_bets.deleted_at IS 'Soft delete timestamp (NULL = not deleted)';
COMMENT ON COLUMN legs.probability_est IS 'ML predicted win probability';

