# BetTracer Database

This directory contains all database-related files for the BetTracer project.

## Directory Structure

```
database/
├── migrations/          # Database migration files
│   ├── 001_initial_schema.sql
│   ├── 002_profile_trigger.sql
│   ├── 003_rls_policies.sql
│   └── 004_cumulative_profit_function.sql
├── seeds/               # Seed data files
│   └── 001_reference_items.sql
├── DATABASE_SETUP.md    # Detailed setup instructions
├── README.md           # This file
└── run_migrations.sh   # Migration helper script
```

## Migration Files

### 001_initial_schema.sql
Creates all core database tables:
- `profiles` - User profiles extending Supabase auth.users
- `reference_items` - Reference data (teams, leagues, bet types, etc.)
- `main_bets` - Main bets table
- `legs` - Bet legs table
- `daily_summary` - Daily aggregated analytics

Also creates:
- Indexes for performance
- Triggers for `updated_at` timestamps
- Functions for timestamp updates

### 002_profile_trigger.sql
Creates trigger to automatically create a profile when a new user signs up.

### 003_rls_policies.sql
Enables Row-Level Security (RLS) and creates policies for:
- Profiles
- Main bets
- Legs
- Daily summary
- Reference items

### 004_cumulative_profit_function.sql
Creates functions and triggers for:
- Calculating cumulative profit
- Updating cumulative profit when bet state changes
- Recalculating all cumulative profits (for data migration)

## Seed Files

### 001_reference_items.sql
Seeds initial reference data:
- **Leagues**: Premier League, La Liga, Serie A, Bundesliga, etc.
- **Bet Types**: Match Result, Over/Under, Both Teams to Score, etc.
- **Categories**: Standard, Live, Pre-match, Accumulator, etc.
- **Responsible**: Primary Account, Secondary Account, Self, Tipster, etc.

## Running Migrations

### Option 1: Using Supabase SQL Editor (Recommended)

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Open each migration file in order (001, 002, 003, 004)
4. Copy and paste the SQL
5. Run the SQL

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for detailed instructions.

### Option 2: Using Migration Script

```bash
./run_migrations.sh migrations/001_initial_schema.sql
```

This will display the SQL that you can copy and run in Supabase.

### Option 3: Using Supabase CLI

```bash
# Install Supabase CLI
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Running Seeds

After running migrations, seed the reference data:

1. Go to Supabase SQL Editor
2. Open `seeds/001_reference_items.sql`
3. Copy and paste the SQL
4. Run the SQL

Or use the migration script:

```bash
./run_migrations.sh seeds/001_reference_items.sql
```

## Verification

After running migrations, verify the setup:

```sql
-- Check tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;

-- Check indexes
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;

-- Check RLS policies
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- Check functions
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;

-- Check triggers
SELECT trigger_name, event_object_table 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;

-- Check reference items
SELECT kind, COUNT(*) as count
FROM reference_items
GROUP BY kind;
```

## Database Schema

### Tables

1. **profiles** - User profiles
   - Extends Supabase auth.users
   - Stores username, full_name, avatar_url

2. **reference_items** - Reference data
   - Kinds: team, league, bet_type, category, responsible
   - Normalized data structure

3. **main_bets** - Main bets
   - User-specific bets
   - Supports soft deletes (deleted_at)
   - Tracks cumulative profit

4. **legs** - Bet legs
   - Multiple legs per bet
   - Accessible via main_bet relationship
   - No direct user_id (for data isolation)

5. **daily_summary** - Daily analytics
   - Aggregated data per user per day
   - Used for dashboard and charts

### Security

- **Row-Level Security (RLS)** enabled on all tables
- Users can only access their own data
- Reference items are publicly readable
- Service role can bypass RLS for backend operations

### Performance

- Indexes on commonly queried columns
- Partial indexes for filtered queries (deleted_at IS NULL)
- Composite indexes for multi-column queries

## Troubleshooting

See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for troubleshooting tips.

## Next Steps

After setting up the database:

1. Configure environment variables in backend and frontend
2. Test database connection
3. Begin Phase 2: Backend MVP development

## Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row-Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [BetTracerGuide.md](../../BetTracerGuide.md) - Complete project documentation

