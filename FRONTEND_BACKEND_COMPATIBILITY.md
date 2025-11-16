# Frontend-Backend Compatibility Check

This document verifies that all frontend changes are compatible with the backend and database.

## ✅ Changes Verified

### 1. Admin System
**Frontend Changes:**
- Added admin panel page (`/admin`)
- Added admin link to navbar (only visible to admins)
- Added `isAdmin` to auth context

**Backend Status:**
- ✅ Migration `005_add_admin_role.sql` exists - adds `is_admin` field to `profiles` table
- ✅ Backend middleware (`auth.middleware.ts`) checks `is_admin` from profiles
- ✅ Backend routes protect admin endpoints with `requireAdmin` middleware
- ✅ Reference items POST endpoint requires admin access

**Action Required:**
- ⚠️ **Run migration**: Execute `infra/database/migrations/005_add_admin_role.sql` in Supabase
- ⚠️ **Set admin user**: Run SQL to make a user admin (see `ADMIN_SETUP.md`)

**Status:** ✅ Compatible - Migration needs to be run

---

### 2. Main Bet Odds Field
**Frontend Changes:**
- Added main bet odds input field (decimal/American)
- Auto-calculates from leg odds if not manually set

**Backend Status:**
- ✅ Database schema supports `odds` field in `main_bets` table (optional, nullable)
- ✅ Backend schema validation accepts optional `odds: z.number().positive().optional()`
- ✅ Backend service calculates odds from legs if not provided:
  ```typescript
  if (!mainBetData.odds && legs.length > 0) {
    mainBetData.odds = legs.reduce((acc, leg) => acc * leg.odd, 1);
  }
  ```

**Action Required:**
- ✅ None - Fully compatible

**Status:** ✅ Compatible - No changes needed

---

### 3. Decimal/American Odds Conversion
**Frontend Changes:**
- Added odds conversion utilities (`lib/utils/odds.ts`)
- Added dual format input (decimal/American) for main bet and legs
- Converts American to decimal before sending to backend

**Backend Status:**
- ✅ Backend expects decimal odds (which is what we send)
- ✅ Backend validation accepts `z.number().positive()` for odds
- ✅ Database stores as `NUMERIC(12,6)` which supports decimal values

**Action Required:**
- ✅ None - Conversion is purely frontend, backend receives decimal as expected

**Status:** ✅ Compatible - No changes needed

---

### 4. SearchableSelect Component
**Frontend Changes:**
- Replaced dropdown `<select>` elements with searchable input component
- Still sends UUIDs for selected items

**Backend Status:**
- ✅ Backend accepts optional UUID fields:
  - `home_team_id`, `away_team_id`, `league_id`, `bet_type_id`, `category_id`, `responsible_id`
- ✅ Backend schema validation accepts `.optional()` for all these fields
- ✅ Database foreign keys allow NULL values

**Action Required:**
- ✅ None - Still sends same data format (UUIDs)

**Status:** ✅ Compatible - No changes needed

---

## Summary

### ✅ All Frontend Changes Are Compatible

**Required Actions:**
1. **Run Database Migration** (One-time setup):
   ```sql
   -- Run in Supabase SQL Editor
   -- File: infra/database/migrations/005_add_admin_role.sql
   ```

2. **Set Admin User** (One-time setup):
   ```sql
   -- Run in Supabase SQL Editor
   UPDATE profiles 
   SET is_admin = true 
   WHERE id = (SELECT id FROM auth.users WHERE email = 'your-email@example.com');
   ```

**No Backend Code Changes Required** - All frontend changes work with existing backend implementation.

---

## Testing Checklist

After running the migration, verify:

- [ ] Admin panel is accessible to admin users
- [ ] Admin panel is NOT accessible to non-admin users
- [ ] Main bet odds field works (manual entry and auto-calculation)
- [ ] Decimal/American odds conversion works correctly
- [ ] SearchableSelect works for all reference item types
- [ ] Bet creation works with all new features

