# Custom Reference Data Guide

This guide will help you clean up the existing reference items and add your own custom data.

## Step-by-Step Instructions

### Step 1: Backup (Optional but Recommended)

Before cleaning up, you may want to see what's currently in your database:

```sql
-- View all current reference items
SELECT kind, name, metadata 
FROM reference_items 
ORDER BY kind, name;
```

If you want to keep a backup, you can export this data or copy it somewhere.

### Step 2: Clean Up Existing Data

1. **Go to Supabase Dashboard**
   - Navigate to your project
   - Click on **SQL Editor** in the left sidebar

2. **Run the Cleanup Script**
   - Open the file: `infra/database/scripts/002_cleanup_reference_items.sql`
   - Copy the entire contents
   - Paste it into the SQL Editor
   - Click **Run** (or press Cmd/Ctrl + Enter)

   This will delete all existing reference items.

3. **Verify Cleanup**
   - The script includes a verification query at the end
   - You should see 0 rows returned

### Step 3: Add Your Custom Data

1. **Edit the Template File**
   - Open: `infra/database/seeds/002_custom_reference_items.sql`
   - Edit the INSERT statements to add your own data
   - Remove the example entries and add your own

2. **Format for Adding Items**

   **For Leagues:**
   ```sql
   INSERT INTO reference_items (kind, name, metadata) VALUES
     ('league', 'Your League Name', '{"country": "Country", "tier": 1}'),
     ('league', 'Another League', '{"sport": "Sport"}')
   ON CONFLICT (kind, name) DO NOTHING;
   ```

   **For Teams:**
   ```sql
   INSERT INTO reference_items (kind, name, metadata) VALUES
     ('team', 'Team Name', '{"league": "League Name", "country": "Country"}'),
     ('team', 'Another Team', '{"league": "League Name"}')
   ON CONFLICT (kind, name) DO NOTHING;
   ```

   **For Bet Types:**
   ```sql
   INSERT INTO reference_items (kind, name, metadata) VALUES
     ('bet_type', 'Your Bet Type', '{"description": "Description"}')
   ON CONFLICT (kind, name) DO NOTHING;
   ```

   **For Categories:**
   ```sql
   INSERT INTO reference_items (kind, name, metadata) VALUES
     ('category', 'Your Category', '{"description": "Description"}')
   ON CONFLICT (kind, name) DO NOTHING;
   ```

   **For Responsibles:**
   ```sql
   INSERT INTO reference_items (kind, name, metadata) VALUES
     ('responsible', 'Account Name', '{"type": "account", "description": "Description"}'),
     ('responsible', 'Source Name', '{"type": "source", "description": "Description"}')
   ON CONFLICT (kind, name) DO NOTHING;
   ```

3. **Run Your Custom Script**
   - Copy your edited SQL from `002_custom_reference_items.sql`
   - Paste it into Supabase SQL Editor
   - Click **Run**

4. **Verify Your Data**
   ```sql
   -- View all your reference items
   SELECT kind, name, metadata 
   FROM reference_items 
   ORDER BY kind, name;
   ```

## Example: Complete Custom Data Setup

Here's a complete example you can customize:

```sql
-- ============================================================================
-- LEAGUES
-- ============================================================================
INSERT INTO reference_items (kind, name, metadata) VALUES
  ('league', 'Premier League', '{"country": "England", "tier": 1}'),
  ('league', 'NBA', '{"sport": "Basketball", "country": "USA"}'),
  ('league', 'UFC', '{"sport": "MMA", "country": "International"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- TEAMS
-- ============================================================================
INSERT INTO reference_items (kind, name, metadata) VALUES
  ('team', 'Arsenal', '{"league": "Premier League", "country": "England"}'),
  ('team', 'Liverpool', '{"league": "Premier League", "country": "England"}'),
  ('team', 'Lakers', '{"league": "NBA", "country": "USA"}'),
  ('team', 'Warriors', '{"league": "NBA", "country": "USA"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- BET TYPES
-- ============================================================================
INSERT INTO reference_items (kind, name, metadata) VALUES
  ('bet_type', 'Match Result', '{"description": "Home Win, Draw, or Away Win"}'),
  ('bet_type', 'Over/Under', '{"description": "Total goals/points over or under"}'),
  ('bet_type', 'Moneyline', '{"description": "Straight win/loss bet"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- CATEGORIES
-- ============================================================================
INSERT INTO reference_items (kind, name, metadata) VALUES
  ('category', 'Over', '{"description": "Over betting"}'),
  ('category', 'Under', '{"description": "Under betting"}'),
  ('category', 'Home', '{"description": "Home team betting"}'),
  ('category', 'Away', '{"description": "Away team betting"}')
ON CONFLICT (kind, name) DO NOTHING;

-- ============================================================================
-- RESPONSIBLES
-- ============================================================================
INSERT INTO reference_items (kind, name, metadata) VALUES
  ('responsible', 'Main Account', '{"type": "account", "description": "Primary betting account"}'),
  ('responsible', 'Secondary Account', '{"type": "account", "description": "Secondary account"}'),
  ('responsible', 'Self', '{"type": "person", "description": "My own bets"}')
ON CONFLICT (kind, name) DO NOTHING;
```

## Important Notes

1. **Metadata is Optional**: The `metadata` field is a JSON object. You can use it to store any additional information, or just use `'{}'` for empty metadata.

2. **Unique Constraint**: Each combination of `kind` and `name` must be unique. If you try to insert a duplicate, `ON CONFLICT DO NOTHING` will skip it.

3. **Foreign Keys**: If you have existing bets that reference old reference items, those foreign keys will be set to NULL after cleanup. The bets themselves won't be deleted, but the references will be lost.

4. **Adding More Later**: You can always add more reference items later by running additional INSERT statements, or by using the API endpoint `POST /api/reference-items`.

## Quick Reference

**File Locations:**
- Cleanup script: `infra/database/scripts/002_cleanup_reference_items.sql`
- Custom data template: `infra/database/seeds/002_custom_reference_items.sql`

**Supabase SQL Editor:**
- Go to: Supabase Dashboard → SQL Editor
- Paste your SQL and click Run

**Verify Your Data:**
```sql
SELECT kind, COUNT(*) as count 
FROM reference_items 
GROUP BY kind 
ORDER BY kind;
```

This will show you how many items you have of each kind.

