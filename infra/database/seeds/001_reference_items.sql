-- BetTracer Database Seed
-- Seed: 001_reference_items
-- Description: Seeds initial reference data (leagues, bet types, categories, etc.)

-- ============================================================================
-- LEAGUES
-- ============================================================================
INSERT INTO reference_items (kind, name, metadata) VALUES
  ('league', 'Premier League', '{"country": "England", "tier": 1}'),
  ('league', 'La Liga', '{"country": "Spain", "tier": 1}'),
  ('league', 'Serie A', '{"country": "Italy", "tier": 1}'),
  ('league', 'Bundesliga', '{"country": "Germany", "tier": 1}'),
  ('league', 'Ligue 1', '{"country": "France", "tier": 1}'),
  ('league', 'MLS', '{"country": "USA", "tier": 1}'),
  ('league', 'Champions League', '{"type": "European", "tier": 1}'),
  ('league', 'Europa League', '{"type": "European", "tier": 2}'),
  ('league', 'NBA', '{"sport": "Basketball", "country": "USA"}'),
  ('league', 'NFL', '{"sport": "Football", "country": "USA"}'),
  ('league', 'NHL', '{"sport": "Hockey", "country": "USA"}'),
  ('league', 'MLB', '{"sport": "Baseball", "country": "USA"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- BET TYPES
-- ============================================================================
INSERT INTO reference_items (kind, name, metadata) VALUES
  ('bet_type', 'Match Result', '{"description": "Home Win, Draw, or Away Win"}'),
  ('bet_type', 'Over/Under', '{"description": "Total goals/points over or under a number"}'),
  ('bet_type', 'Both Teams to Score', '{"description": "BTTS - Yes or No"}'),
  ('bet_type', 'Double Chance', '{"description": "Two possible outcomes"}'),
  ('bet_type', 'Handicap', '{"description": "Point spread betting"}'),
  ('bet_type', 'Correct Score', '{"description": "Exact match score"}'),
  ('bet_type', 'Anytime Goalscorer', '{"description": "Player to score at any time"}'),
  ('bet_type', 'First Goalscorer', '{"description": "Player to score first"}'),
  ('bet_type', 'Player Props', '{"description": "Player-specific statistics"}'),
  ('bet_type', 'Team Props', '{"description": "Team-specific statistics"}'),
  ('bet_type', 'Moneyline', '{"description": "Straight win/loss bet"}'),
  ('bet_type', 'Parlay', '{"description": "Multiple bets combined"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- CATEGORIES
-- ============================================================================
INSERT INTO reference_items (kind, name, metadata) VALUES
  ('category', 'Standard', '{"description": "Standard betting category"}'),
  ('category', 'Live', '{"description": "In-play betting"}'),
  ('category', 'Pre-match', '{"description": "Before match starts"}'),
  ('category', 'Accumulator', '{"description": "Multiple selections combined"}'),
  ('category', 'Single', '{"description": "Single bet"}'),
  ('category', 'System', '{"description": "System betting"}'),
  ('category', 'Over', '{"description": "Over betting"}'),
  ('category', 'Under', '{"description": "Under betting"}'),
  ('category', 'Home', '{"description": "Home team betting"}'),
  ('category', 'Away', '{"description": "Away team betting"}'),
  ('category', 'Draw', '{"description": "Draw betting"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- RESPONSIBLE (Betting Sources/Accounts)
-- ============================================================================
INSERT INTO reference_items (kind, name, metadata) VALUES
  ('responsible', 'Primary Account', '{"type": "account", "description": "Main betting account"}'),
  ('responsible', 'Secondary Account', '{"type": "account", "description": "Secondary betting account"}'),
  ('responsible', 'Friend Account', '{"type": "account", "description": "Friend\'s account"}'),
  ('responsible', 'Self', '{"type": "person", "description": "Personal bets"}'),
  ('responsible', 'Tipster', '{"type": "source", "description": "Following tipster advice"}'),
  ('responsible', 'Algorithm', '{"type": "source", "description": "Algorithm-based betting"}'),
  ('responsible', 'Research', '{"type": "source", "description": "Research-based betting"}'),
  ('responsible', 'Intuition', '{"type": "source", "description": "Gut feeling"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- COMMENTS
-- ============================================================================
COMMENT ON TABLE reference_items IS 'Reference data seeded with common leagues, bet types, categories, and responsible sources';

