-- Migration: 008_casino_earnings_rls
-- Description: Add Row Level Security policies for casino_earnings table

-- Enable RLS on casino_earnings
ALTER TABLE casino_earnings ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their own casino earnings" ON casino_earnings;
DROP POLICY IF EXISTS "Users can insert their own casino earnings" ON casino_earnings;
DROP POLICY IF EXISTS "Users can update their own casino earnings" ON casino_earnings;
DROP POLICY IF EXISTS "Users can delete their own casino earnings" ON casino_earnings;

-- Create RLS policies for casino_earnings
CREATE POLICY "Users can view their own casino earnings"
  ON casino_earnings FOR SELECT
  USING (auth.uid() = user_id AND deleted_at IS NULL);

CREATE POLICY "Users can insert their own casino earnings"
  ON casino_earnings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own casino earnings"
  ON casino_earnings FOR UPDATE
  USING (auth.uid() = user_id AND deleted_at IS NULL)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own casino earnings"
  ON casino_earnings FOR DELETE
  USING (auth.uid() = user_id);
