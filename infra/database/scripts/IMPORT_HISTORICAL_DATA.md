# Import Historical Data Guide

This guide explains how to import your historical betting data from CSV files into the BetTracer database.

## Files Required

1. `mainBets.csv` - Main bet data (should be in project root)
2. `legs.csv` - Leg data (should be in project root)
3. `references.csv` - Reference items (should be in project root)

## Prerequisites

1. **Get your User ID**: You need the UUID of the user who should own these bets.
   - Option A: Use your current logged-in user ID
   - Option B: Create new users for "Alexy Cruz" and "Anthony Escobar" if you want separate accounts
   
   To get your user ID:
   - Check Supabase Dashboard → Authentication → Users
   - Or run: `SELECT id FROM auth.users WHERE email = 'your-email@example.com';`

2. **Set Environment Variables**: 
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_SERVICE_ROLE_KEY` - Your Supabase service role key (from Supabase Dashboard → Settings → API)
   - `IMPORT_USER_ID` - The UUID of the user who should own these bets

## Method 1: Node.js Script (Recommended)

### Setup

1. Install dependencies (if not already installed):
   ```bash
   cd backend
   npm install @supabase/supabase-js dotenv
   ```

2. Set environment variables in `backend/.env`:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   IMPORT_USER_ID=your_user_uuid_here
   ```

### Run Import

```bash
cd infra/database/scripts
node 004_import_historical_data.js
```

The script will:
1. Parse all CSV files
2. Create all reference items (leagues, teams, bet types, categories, responsibles)
3. Create main bets with proper dates and states
4. Create legs with proper foreign key references

## Method 2: Manual SQL Import

If you prefer SQL, you can:

1. Run `003_import_historical_data.sql` to create reference items
2. Manually insert main bets and legs using SQL INSERT statements

**Note**: This method is more tedious and error-prone. The Node.js script is recommended.

## Data Mapping

### Main Bets CSV Columns:
- **Date**: Parsed as "October 1, 2025" → ISO timestamp
- **Stake**: "$3.00" → 3.00 (numeric)
- **American Odds**: "130" → converted to decimal odds
- **Decimal Odds**: "2.30" → 2.30 (numeric)
- **State**: "Win" → "won", "Loss" → "lost"
- **Profit/Loss**: "$-3.00" → -3.00 (numeric)
- **Cumulative Profit**: "$-3.00" → -3.00 (numeric)
- **Responsible**: Stored as reference item (not user mapping)

### Legs CSV Columns:
- **Main Bet ID**: Maps to main_bets.id
- **League**: Maps to reference_items (kind='league')
- **Home Team**: Maps to reference_items (kind='team')
- **Away Team**: Maps to reference_items (kind='team')
- **Category**: Maps to reference_items (kind='category')
- **Bet Type**: Maps to reference_items (kind='bet_type')
- **American Odds**: "-313" → converted to decimal
- **Decimal Odds**: "1.32" → 1.32 (numeric)
- **Result State**: "Win" → "won", "Loss" → "lost"
- **Responsible**: Maps to reference_items (kind='responsible')

## Important Notes

1. **User Ownership**: All bets will be assigned to the user specified in `IMPORT_USER_ID`. If you want separate users for "Alexy Cruz" and "Anthony Escobar", you'll need to:
   - Create separate users in Supabase
   - Run the import script twice with different `IMPORT_USER_ID` values
   - Filter the CSV data by "Responsible" field

2. **Reference Items**: The script automatically creates all unique reference items. Duplicates are handled gracefully (case-insensitive).

3. **Date Format**: Dates are parsed from "October 1, 2025" format. All times are set to 12:00:00 UTC.

4. **State Mapping**: 
   - "Win" → "won"
   - "Loss" → "lost"
   - Other states remain as-is

## Troubleshooting

### Error: "User ID not found"
- Make sure `IMPORT_USER_ID` is set correctly
- Verify the user exists in Supabase auth.users table

### Error: "Reference item already exists"
- This is normal - the script uses `ON CONFLICT DO NOTHING` to handle duplicates
- The import will continue

### Error: "Foreign key constraint violation"
- Make sure reference items are created before main bets
- Make sure main bets are created before legs
- The Node.js script handles this automatically

### CSV Parsing Errors
- Make sure CSV files are tab-separated (not comma-separated)
- Check that all required columns are present
- Verify file encoding is UTF-8

## Verification

After import, verify the data:

```sql
-- Check main bets count
SELECT COUNT(*) FROM main_bets WHERE user_id = 'your-user-id';

-- Check legs count
SELECT COUNT(*) FROM legs 
WHERE main_bet_id IN (
  SELECT id FROM main_bets WHERE user_id = 'your-user-id'
);

-- Check reference items
SELECT kind, COUNT(*) FROM reference_items GROUP BY kind;
```

## Next Steps

After importing:
1. Verify data in the frontend
2. Check analytics are calculating correctly
3. Review bet details to ensure all legs are properly linked

