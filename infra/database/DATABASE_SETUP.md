# BetTracer Database Setup Guide

This guide will help you set up the BetTracer database in Supabase.

## Prerequisites

- Supabase account (free tier works)
- Access to Supabase SQL Editor

## Step 1: Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Sign in or create an account
3. Click "New Project"
4. Fill in project details:
   - **Name**: BetTracer (or your preferred name)
   - **Database Password**: Choose a strong password (save it!)
   - **Region**: Choose the closest region
   - **Pricing Plan**: Free tier is sufficient for MVP
5. Wait for the project to be created (2-3 minutes)

## Step 2: Get Your Supabase Credentials

1. Go to **Project Settings** > **API**
2. Copy the following values:
   - **Project URL** → `SUPABASE_URL`
   - **anon public** key → `SUPABASE_ANON_KEY`
   - **service_role** key → `SUPABASE_SERVICE_KEY` (⚠️ Keep this secret!)

3. Save these values - you'll need them for your backend and frontend `.env` files

## Step 3: Run Database Migrations

### Option A: Using Supabase SQL Editor (Recommended)

1. Go to **SQL Editor** in your Supabase dashboard
2. Run each migration file in order:

#### Migration 1: Initial Schema
   - Open `infra/database/migrations/001_initial_schema.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run" (or press Cmd/Ctrl + Enter)
   - Verify: You should see "Success. No rows returned"

#### Migration 2: Profile Trigger
   - Open `infra/database/migrations/002_profile_trigger.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run"
   - Verify: Success message

#### Migration 3: RLS Policies
   - Open `infra/database/migrations/003_rls_policies.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run"
   - Verify: Success message

#### Migration 4: Cumulative Profit Function
   - Open `infra/database/migrations/004_cumulative_profit_function.sql`
   - Copy the entire contents
   - Paste into SQL Editor
   - Click "Run"
   - Verify: Success message

### Option B: Using Supabase CLI (Advanced)

If you have Supabase CLI installed:

```bash
# Install Supabase CLI (if not installed)
npm install -g supabase

# Login to Supabase
supabase login

# Link your project
supabase link --project-ref your-project-ref

# Run migrations
supabase db push
```

## Step 4: Seed Reference Data

1. Go to **SQL Editor** in your Supabase dashboard
2. Open `infra/database/seeds/001_reference_items.sql`
3. Copy the entire contents
4. Paste into SQL Editor
5. Click "Run"
6. Verify: Check that reference items were inserted:
   ```sql
   SELECT kind, COUNT(*) as count
   FROM reference_items
   GROUP BY kind;
   ```

   You should see:
   - leagues: ~12 rows
   - bet_type: ~12 rows
   - category: ~11 rows
   - responsible: ~8 rows

## Step 5: Verify Database Setup

Run these queries in SQL Editor to verify everything is set up correctly:

### Check Tables
```sql
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public'
ORDER BY table_name;
```

Expected tables:
- `profiles`
- `reference_items`
- `main_bets`
- `legs`
- `daily_summary`

### Check Indexes
```sql
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public'
ORDER BY tablename, indexname;
```

### Check RLS Policies
```sql
SELECT schemaname, tablename, policyname 
FROM pg_policies 
WHERE schemaname = 'public'
ORDER BY tablename, policyname;
```

### Check Functions
```sql
SELECT routine_name, routine_type 
FROM information_schema.routines 
WHERE routine_schema = 'public'
ORDER BY routine_name;
```

Expected functions:
- `update_updated_at_column()`
- `handle_new_user()`
- `calculate_cumulative_profit(UUID)`
- `update_cumulative_profit()`
- `recalculate_all_cumulative_profits()`

### Check Triggers
```sql
SELECT trigger_name, event_object_table, action_statement 
FROM information_schema.triggers 
WHERE trigger_schema = 'public'
ORDER BY event_object_table, trigger_name;
```

## Step 6: Enable Email Authentication

1. Go to **Authentication** > **Providers** in Supabase dashboard
2. Enable **Email** provider
3. Configure email templates if needed (optional)
4. Set up email confirmation (optional for development)

## Step 7: Test Database Setup

### Test Profile Creation Trigger

1. Create a test user via Supabase Auth UI or API
2. Check if profile was automatically created:
   ```sql
   SELECT * FROM profiles WHERE id = 'your-user-id';
   ```

### Test RLS Policies

1. Sign up a test user
2. Try to create a bet (this will be tested in Phase 2)
3. Verify that users can only see their own data

## Step 8: Configure Environment Variables

Update your backend and frontend `.env` files with your Supabase credentials:

### Backend (.env)
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_KEY=your-service-role-key
```

### Frontend (.env.local)
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

## Troubleshooting

### Migration Errors

**Error: "relation already exists"**
- Some tables/functions might already exist
- The migrations use `IF NOT EXISTS` and `DROP IF EXISTS` to handle this
- If you see this error, you can safely ignore it or drop the existing objects first

**Error: "permission denied"**
- Make sure you're using the SQL Editor with proper permissions
- Check that you're connected to the correct project

**Error: "function does not exist"**
- Make sure you run migrations in order (001, 002, 003, 004)
- Check that previous migrations completed successfully

### RLS Policy Issues

**Users can't see their own data**
- Verify RLS is enabled: `SELECT * FROM pg_tables WHERE tablename = 'main_bets';`
- Check policies: `SELECT * FROM pg_policies WHERE tablename = 'main_bets';`
- Ensure users are authenticated when making queries

**Users can see other users' data**
- This is a security issue!
- Verify RLS policies are correctly set up
- Check that `auth.uid()` is working correctly
- Test with different user accounts

### Trigger Issues

**Profile not created on signup**
- Check that `handle_new_user()` function exists
- Verify trigger is created: `SELECT * FROM pg_trigger WHERE tgname = 'on_auth_user_created';`
- Check Supabase logs for errors

**Cumulative profit not updating**
- Verify `update_cumulative_profit()` function exists
- Check trigger is created: `SELECT * FROM pg_trigger WHERE tgname = 'update_cumulative_profit_trigger';`
- Manually test the function: `SELECT calculate_cumulative_profit('user-id');`

## Next Steps

Once the database is set up:

1. **Phase 2**: Set up backend API with Supabase client
2. **Phase 3**: Set up frontend with Supabase Auth
3. **Test**: Create test users and verify data isolation

## Additional Resources

- [Supabase Documentation](https://supabase.com/docs)
- [PostgreSQL Documentation](https://www.postgresql.org/docs/)
- [Row-Level Security Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [Supabase SQL Editor](https://supabase.com/docs/guides/database/tables)

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review Supabase logs in the dashboard
3. Check the migration files for syntax errors
4. Create an issue on GitHub with detailed error messages

Happy coding! 🚀

