-- BetTracer Database Migration
-- Migration: 003_rls_policies
-- Description: Enables Row-Level Security and creates RLS policies

-- ============================================================================
-- ENABLE ROW LEVEL SECURITY
-- ============================================================================
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE main_bets ENABLE ROW LEVEL SECURITY;
ALTER TABLE legs ENABLE ROW LEVEL SECURITY;
ALTER TABLE daily_summary ENABLE ROW LEVEL SECURITY;
ALTER TABLE reference_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DROP EXISTING POLICIES (if any)
-- ============================================================================
-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
DROP POLICY IF EXISTS "Users can update own profile" ON profiles;

DROP POLICY IF EXISTS "Users can select own main_bets" ON main_bets;
DROP POLICY IF EXISTS "Users can insert own main_bets" ON main_bets;
DROP POLICY IF EXISTS "Users can update own main_bets" ON main_bets;
DROP POLICY IF EXISTS "Users can delete own main_bets" ON main_bets;

DROP POLICY IF EXISTS "Users can select own legs" ON legs;
DROP POLICY IF EXISTS "Users can insert own legs" ON legs;
DROP POLICY IF EXISTS "Users can update own legs" ON legs;

DROP POLICY IF EXISTS "Users can select own daily_summary" ON daily_summary;
DROP POLICY IF EXISTS "Users can insert own daily_summary" ON daily_summary;
DROP POLICY IF EXISTS "Users can update own daily_summary" ON daily_summary;

DROP POLICY IF EXISTS "Anyone can view reference_items" ON reference_items;
DROP POLICY IF EXISTS "Authenticated users can insert reference_items" ON reference_items;
DROP POLICY IF EXISTS "Authenticated users can update reference_items" ON reference_items;
DROP POLICY IF EXISTS "Authenticated users can delete reference_items" ON reference_items;

-- ============================================================================
-- PROFILES POLICIES
-- ============================================================================
CREATE POLICY "Users can view own profile"
  ON profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id);

-- ============================================================================
-- MAIN BETS POLICIES
-- ============================================================================
CREATE POLICY "Users can select own main_bets"
  ON main_bets FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert own main_bets"
  ON main_bets FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own main_bets"
  ON main_bets FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own main_bets"
  ON main_bets FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================================================
-- LEGS POLICIES
-- ============================================================================
-- Users access legs via main_bet relationship (no direct user_id on legs)
CREATE POLICY "Users can select own legs"
  ON legs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM main_bets
      WHERE main_bets.id = legs.main_bet_id
      AND main_bets.user_id = auth.uid()
      AND main_bets.deleted_at IS NULL
    )
  );

CREATE POLICY "Users can insert own legs"
  ON legs FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM main_bets
      WHERE main_bets.id = legs.main_bet_id
      AND main_bets.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own legs"
  ON legs FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM main_bets
      WHERE main_bets.id = legs.main_bet_id
      AND main_bets.user_id = auth.uid()
    )
  );

-- ============================================================================
-- DAILY SUMMARY POLICIES
-- ============================================================================
CREATE POLICY "Users can select own daily_summary"
  ON daily_summary FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily_summary"
  ON daily_summary FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily_summary"
  ON daily_summary FOR UPDATE
  USING (auth.uid() = user_id);

-- ============================================================================
-- REFERENCE ITEMS POLICIES
-- ============================================================================
-- Reference items can be viewed by anyone (public read)
-- Only authenticated users can insert/update/delete
CREATE POLICY "Anyone can view reference_items"
  ON reference_items FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can insert reference_items"
  ON reference_items FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can update reference_items"
  ON reference_items FOR UPDATE
  USING (auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete reference_items"
  ON reference_items FOR DELETE
  USING (auth.role() = 'authenticated');

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON POLICY "Users can view own profile" ON profiles IS 'Users can only view their own profile';
COMMENT ON POLICY "Users can update own profile" ON profiles IS 'Users can only update their own profile';
COMMENT ON POLICY "Users can select own main_bets" ON main_bets IS 'Users can only see their own non-deleted bets';
COMMENT ON POLICY "Users can insert own main_bets" ON main_bets IS 'Users can only insert bets with their own user_id';
COMMENT ON POLICY "Users can update own main_bets" ON main_bets IS 'Users can only update their own bets';
COMMENT ON POLICY "Users can delete own main_bets" ON main_bets IS 'Users can only delete their own bets';
COMMENT ON POLICY "Users can select own legs" ON legs IS 'Users can only see legs of their own bets';
COMMENT ON POLICY "Users can insert own legs" ON legs IS 'Users can only insert legs for their own bets';
COMMENT ON POLICY "Users can update own legs" ON legs IS 'Users can only update legs of their own bets';

