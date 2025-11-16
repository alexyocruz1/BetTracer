# Phase 1 - Database & Foundation ✅ COMPLETE

## Summary

Phase 1 has been successfully completed! All database migration files, RLS policies, triggers, functions, and seed data have been created and are ready to be deployed to Supabase.

## What Was Accomplished

### ✅ Database Schema Migration (001_initial_schema.sql)
- Created `profiles` table (extends Supabase auth.users)
- Created `reference_items` table (teams, leagues, bet types, categories, responsible)
- Created `main_bets` table (user-specific bets with soft delete support)
- Created `legs` table (bet legs accessible via main_bet relationship)
- Created `daily_summary` table (daily aggregated analytics)
- Created performance indexes for common queries
- Created `update_updated_at_column()` function
- Created triggers for automatic `updated_at` timestamp updates
- Added table and column comments for documentation

### ✅ Profile Trigger Migration (002_profile_trigger.sql)
- Created `handle_new_user()` function to automatically create profiles
- Created trigger to fire on new user signup
- Ensures every new user gets a profile automatically

### ✅ RLS Policies Migration (003_rls_policies.sql)
- Enabled Row-Level Security on all tables
- Created policies for `profiles` (users can view/update own profile)
- Created policies for `main_bets` (users can only access their own bets)
- Created policies for `legs` (users access via main_bet relationship)
- Created policies for `daily_summary` (users can only access their own data)
- Created policies for `reference_items` (public read, authenticated write)
- Added policy comments for documentation

### ✅ Cumulative Profit Function Migration (004_cumulative_profit_function.sql)
- Created `calculate_cumulative_profit()` function
- Created `update_cumulative_profit()` trigger function
- Created trigger to update cumulative profit when bet state changes
- Created `recalculate_all_cumulative_profits()` helper function
- Ensures cumulative profit is always up-to-date

### ✅ Seed Data (001_reference_items.sql)
- Seeded **12 leagues** (Premier League, La Liga, Serie A, Bundesliga, etc.)
- Seeded **12 bet types** (Match Result, Over/Under, Both Teams to Score, etc.)
- Seeded **11 categories** (Standard, Live, Pre-match, Accumulator, etc.)
- Seeded **8 responsible sources** (Primary Account, Self, Tipster, etc.)
- Used `ON CONFLICT DO NOTHING` for idempotency

### ✅ Documentation
- **DATABASE_SETUP.md** - Comprehensive setup guide with step-by-step instructions
- **README.md** - Database directory documentation
- **verify_setup.sql** - Verification script to check database setup
- **run_migrations.sh** - Helper script for running migrations

## Database Structure

### Tables Created
1. **profiles** - User profiles extending Supabase auth.users
2. **reference_items** - Reference data (teams, leagues, bet types, etc.)
3. **main_bets** - Main bets table with user isolation
4. **legs** - Bet legs (accessed via main_bet relationship)
5. **daily_summary** - Daily aggregated analytics

### Indexes Created
- `idx_main_bets_user_date` - User bets by date
- `idx_main_bets_user_state` - User bets by state
- `idx_main_bets_date` - All bets by date
- `idx_legs_main_bet_id` - Legs by main bet
- `idx_legs_league` - Legs by league
- `idx_legs_responsible` - Legs by responsible
- `idx_legs_result_state` - Legs by result state
- `idx_reference_items_kind` - Reference items by kind
- `idx_reference_items_kind_name` - Reference items by kind and name
- `idx_daily_summary_user_date` - Daily summary by user and date
- `idx_daily_summary_date` - Daily summary by date

### Functions Created
1. `update_updated_at_column()` - Updates updated_at timestamp
2. `handle_new_user()` - Creates profile on user signup
3. `calculate_cumulative_profit(UUID)` - Calculates cumulative profit for a user
4. `update_cumulative_profit()` - Updates cumulative profit on bet state change
5. `recalculate_all_cumulative_profits()` - Recalculates all cumulative profits

### Triggers Created
1. `update_profiles_updated_at` - Updates profiles.updated_at
2. `update_main_bets_updated_at` - Updates main_bets.updated_at
3. `update_legs_updated_at` - Updates legs.updated_at
4. `update_reference_items_updated_at` - Updates reference_items.updated_at
5. `update_daily_summary_updated_at` - Updates daily_summary.updated_at
6. `on_auth_user_created` - Creates profile on user signup
7. `update_cumulative_profit_trigger` - Updates cumulative profit on bet state change

### RLS Policies Created
- **profiles**: 2 policies (view own, update own)
- **main_bets**: 4 policies (select own, insert own, update own, delete own)
- **legs**: 3 policies (select own, insert own, update own)
- **daily_summary**: 3 policies (select own, insert own, update own)
- **reference_items**: 4 policies (view all, insert authenticated, update authenticated, delete authenticated)

### Seed Data
- **Leagues**: 12 items
- **Bet Types**: 12 items
- **Categories**: 11 items
- **Responsible**: 8 items
- **Total**: 43 reference items

## Files Created

```
infra/database/
├── migrations/
│   ├── 001_initial_schema.sql
│   ├── 002_profile_trigger.sql
│   ├── 003_rls_policies.sql
│   └── 004_cumulative_profit_function.sql
├── seeds/
│   └── 001_reference_items.sql
├── DATABASE_SETUP.md
├── README.md
├── verify_setup.sql
└── run_migrations.sh
```

## Next Steps

### To Deploy Database

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Wait for project to be ready

2. **Run Migrations**
   - Go to SQL Editor in Supabase dashboard
   - Run migrations in order: 001, 002, 003, 004
   - See [DATABASE_SETUP.md](./infra/database/DATABASE_SETUP.md) for detailed instructions

3. **Seed Reference Data**
   - Run `seeds/001_reference_items.sql` in SQL Editor
   - Verify data was inserted

4. **Verify Setup**
   - Run `verify_setup.sql` in SQL Editor
   - Check that all tables, indexes, policies, functions, and triggers are created

5. **Configure Environment Variables**
   - Update backend `.env` with Supabase credentials
   - Update frontend `.env.local` with Supabase credentials

### Phase 2 - Backend MVP

Once the database is set up, proceed to Phase 2:
1. Set up Supabase client in backend
2. Implement JWT validation middleware
3. Implement bet endpoints (POST, GET, PATCH, DELETE)
4. Implement leg endpoints
5. Implement reference-items endpoints
6. Add input validation with Zod
7. Write tests
8. Set up API documentation

## Acceptance Criteria ✅

- [x] Database schema migration files created
- [x] RLS policies migration file created
- [x] Profile creation trigger created
- [x] Cumulative profit function created
- [x] Seed data script created
- [x] Database setup documentation created
- [x] Verification script created
- [x] Migration helper script created
- [x] All tables, indexes, triggers, functions, and policies defined
- [x] Reference data seeded (leagues, bet types, categories, responsible)

## Notes

- All migrations use `IF NOT EXISTS` and `DROP IF EXISTS` for idempotency
- RLS policies ensure users can only access their own data
- Triggers automatically handle profile creation and timestamp updates
- Cumulative profit is automatically calculated when bet state changes
- Seed data can be run multiple times safely (idempotent)
- All SQL files are well-documented with comments

## Ready for Deployment! 🚀

The database is now ready to be deployed to Supabase. Follow the instructions in [DATABASE_SETUP.md](./infra/database/DATABASE_SETUP.md) to set up your database.

Once the database is set up and verified, you can proceed to Phase 2 (Backend MVP) development.

