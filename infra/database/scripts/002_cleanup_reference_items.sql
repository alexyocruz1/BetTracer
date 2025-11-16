-- BetTracer Database Cleanup Script
-- Script: 002_cleanup_reference_items
-- Description: Removes all existing reference items from the database
-- WARNING: This will delete all reference items. Make sure you have backups!

-- ============================================================================
-- WARNING: READ THIS FIRST
-- ============================================================================
-- This script will DELETE all reference items (leagues, teams, bet types, 
-- categories, responsibles) from your database.
--
-- IMPORTANT NOTES:
-- 1. If you have existing bets that reference these items, those foreign key
--    references will be set to NULL (the bets won't be deleted, but references will be lost)
-- 2. Make sure you have a backup if you want to restore this data later
-- 3. After running this, you can add your own custom reference items
--
-- ============================================================================

-- Step 1: Set all foreign key references to NULL in legs table
-- This prevents foreign key constraint violations when deleting reference items
UPDATE legs SET
  home_team_id = NULL,
  away_team_id = NULL,
  league_id = NULL,
  bet_type_id = NULL,
  category_id = NULL,
  responsible_id = NULL
WHERE home_team_id IS NOT NULL 
   OR away_team_id IS NOT NULL 
   OR league_id IS NOT NULL 
   OR bet_type_id IS NOT NULL 
   OR category_id IS NOT NULL 
   OR responsible_id IS NOT NULL;

-- Step 2: Delete all reference items
DELETE FROM reference_items;

-- Verify deletion
SELECT 
  kind, 
  COUNT(*) as count 
FROM reference_items 
GROUP BY kind;

-- Should return 0 rows if cleanup was successful

