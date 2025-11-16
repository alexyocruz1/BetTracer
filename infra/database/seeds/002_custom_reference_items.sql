-- BetTracer Custom Reference Items
-- Seed: 002_custom_reference_items
-- Description: Add your own custom leagues, teams, bet types, categories, and responsibles
-- 
-- INSTRUCTIONS:
-- 1. Edit this file and add your own data below
-- 2. Run this script in Supabase SQL Editor after cleaning up existing data
-- 3. Format: INSERT INTO reference_items (kind, name, metadata) VALUES (...)
--
-- ============================================================================
-- LEAGUES
-- ============================================================================
-- Add your leagues here. Examples:
INSERT INTO reference_items (kind, name, metadata) VALUES
  -- ('league', 'Your League Name', '{"country": "Country", "tier": 1}'),
  -- ('league', 'Another League', '{"sport": "Sport", "country": "Country"}'),
  ('league', 'Premier League', '{"country": "England", "tier": 1}'),
  ('league', 'La Liga', '{"country": "Spain", "tier": 1}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- TEAMS
-- ============================================================================
-- Add your teams here. Examples:
INSERT INTO reference_items (kind, name, metadata) VALUES
  -- ('team', 'Team Name', '{"league": "League Name", "country": "Country"}'),
  -- ('team', 'Another Team', '{"league": "League Name", "city": "City"}'),
  ('team', 'Manchester United', '{"league": "Premier League", "country": "England"}'),
  ('team', 'Real Madrid', '{"league": "La Liga", "country": "Spain"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- BET TYPES
-- ============================================================================
-- Add your bet types here. Examples:
INSERT INTO reference_items (kind, name, metadata) VALUES
  -- ('bet_type', 'Your Bet Type', '{"description": "Description"}'),
  ('bet_type', 'Match Result', '{"description": "Home Win, Draw, or Away Win"}'),
  ('bet_type', 'Over/Under', '{"description": "Total goals/points over or under a number"}'),
  ('bet_type', 'Both Teams to Score', '{"description": "BTTS - Yes or No"}'),
  ('bet_type', 'Moneyline', '{"description": "Straight win/loss bet"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- CATEGORIES
-- ============================================================================
-- Add your categories here. Examples:
INSERT INTO reference_items (kind, name, metadata) VALUES
  -- ('category', 'Your Category', '{"description": "Description"}'),
  ('category', 'Over', '{"description": "Over betting"}'),
  ('category', 'Under', '{"description": "Under betting"}'),
  ('category', 'Home', '{"description": "Home team betting"}'),
  ('category', 'Away', '{"description": "Away team betting"}'),
  ('category', 'Draw', '{"description": "Draw betting"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- RESPONSIBLES (Betting Sources/Accounts)
-- ============================================================================
-- Add your responsible sources here. Examples:
INSERT INTO reference_items (kind, name, metadata) VALUES
  -- ('responsible', 'Your Account Name', '{"type": "account", "description": "Description"}'),
  -- ('responsible', 'Your Source', '{"type": "source", "description": "Description"}'),
  ('responsible', 'Primary Account', '{"type": "account", "description": "Main betting account"}'),
  ('responsible', 'Self', '{"type": "person", "description": "Personal bets"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- VERIFICATION
-- ============================================================================
-- Run this query to verify your data was inserted:
-- SELECT kind, name, metadata FROM reference_items ORDER BY kind, name;

