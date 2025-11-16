-- BetTracer Database Migration
-- Migration: 005_add_admin_role
-- Description: Adds admin role support to profiles table

-- ============================================================================
-- ADD ADMIN FIELD TO PROFILES
-- ============================================================================
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS is_admin BOOLEAN DEFAULT false;

-- Create index for admin queries
CREATE INDEX IF NOT EXISTS idx_profiles_is_admin ON profiles(is_admin) WHERE is_admin = true;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON COLUMN profiles.is_admin IS 'Whether the user has admin privileges';

-- ============================================================================
-- SET ADMIN USER (OPTIONAL)
-- ============================================================================
-- To make a user an admin, run this query (replace 'user@example.com' with the admin email):
-- UPDATE profiles SET is_admin = true WHERE id = (SELECT id FROM auth.users WHERE email = 'user@example.com');

