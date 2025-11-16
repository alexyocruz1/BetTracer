# Admin Setup Guide

This guide explains how to set up admin users for the BetTracer application.

## Step 1: Run the Migration

First, you need to add the `is_admin` field to the profiles table:

1. Go to **Supabase Dashboard** → **SQL Editor**
2. Open the file: `infra/database/migrations/005_add_admin_role.sql`
3. Copy and paste the SQL into the editor
4. Click **Run**

This will:
- Add an `is_admin` boolean field to the `profiles` table
- Create an index for efficient admin queries

## Step 2: Make a User an Admin

After running the migration, you can make any user an admin by running this SQL:

```sql
-- Replace 'user@example.com' with the email of the user you want to make admin
UPDATE profiles 
SET is_admin = true 
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'user@example.com'
);
```

### Alternative: Make Admin by User ID

If you know the user's ID:

```sql
-- Replace 'user-id-here' with the actual user UUID
UPDATE profiles 
SET is_admin = true 
WHERE id = 'user-id-here';
```

### Verify Admin Status

To check if a user is an admin:

```sql
SELECT 
  p.id,
  u.email,
  p.is_admin
FROM profiles p
JOIN auth.users u ON u.id = p.id
WHERE u.email = 'user@example.com';
```

## Step 3: Access the Admin Panel

1. Log in to the application with the admin user account
2. You should see an **Admin** link in the navbar
3. Click it to access the admin panel

## Admin Features

Once you have admin access, you can:

- **Add Leagues**: Add new sports leagues
- **Add Teams**: Add teams to your database
- **Add Bet Types**: Create custom bet types
- **Add Categories**: Define betting categories
- **Add Responsibles**: Add betting sources/accounts

All changes are immediately available in the "New Bet" form and throughout the application.

## Removing Admin Access

To remove admin privileges from a user:

```sql
UPDATE profiles 
SET is_admin = false 
WHERE id = (
  SELECT id 
  FROM auth.users 
  WHERE email = 'user@example.com'
);
```

## Security Notes

- Only users with `is_admin = true` can access the admin panel
- The backend API enforces admin checks for creating reference items
- Regular users can view reference items but cannot create or modify them
- Admin status is checked on every request to ensure security

