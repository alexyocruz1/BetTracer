# Backend API Testing Guide

## Overview

The BetTracer backend API uses Supabase JWT authentication. Most endpoints require a valid authentication token in the `Authorization` header.

## Endpoints

### Public Endpoints (No Auth Required)
- `GET /health` - Health check endpoint

### Protected Endpoints (Auth Required)
All `/api/*` endpoints require authentication:
- `/api/bets/*` - Bet management
- `/api/legs/*` - Leg management
- `/api/reference-items/*` - Reference data
- `/api/analytics/*` - Analytics data
- `/api/ml/*` - ML predictions

## Getting an Authentication Token

### Method 1: Using Supabase Dashboard (Easiest for Testing)

1. Go to your Supabase project dashboard
2. Navigate to **Authentication** > **Users**
3. Create a test user or use an existing one
4. Click on the user to view details
5. In the user details, you can generate a JWT token for testing
   - Or use the **Access Token** from the user's session

### Method 2: Using Supabase Auth API

You can get a token by signing in via the Supabase Auth API:

```bash
# Replace with your Supabase URL and anon key
SUPABASE_URL="https://your-project.supabase.co"
ANON_KEY="your-anon-key"

# Sign in (or sign up) to get a token
curl -X POST "${SUPABASE_URL}/auth/v1/token?grant_type=password" \
  -H "apikey: ${ANON_KEY}" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "your-password"
  }'
```

The response will include an `access_token` field. Copy this token.

### Method 3: Using the Frontend

1. Start the frontend: `cd frontend && npm run dev`
2. Sign up or log in at `http://localhost:3000/login`
3. Open browser DevTools (F12)
4. Go to **Application** > **Local Storage** > `http://localhost:3000`
5. Look for Supabase auth tokens or session data
6. Or check the **Network** tab for API requests and copy the `Authorization` header

### Method 4: Using a Test Script

Create a simple Node.js script to get a token:

```javascript
// get-token.js
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_ANON_KEY
);

async function getToken() {
  const { data, error } = await supabase.auth.signInWithPassword({
    email: 'test@example.com',
    password: 'your-password',
  });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log('Access Token:', data.session.access_token);
}

getToken();
```

Run it: `node get-token.js`

## Testing with curl

Once you have a token, use it in your curl commands:

```bash
# Set your token
TOKEN="your-jwt-token-here"

# Test health endpoint (no auth needed)
curl http://localhost:8080/health

# Test authenticated endpoint - Get bets
curl -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:8080/api/bets

# Test authenticated endpoint - Create a bet
curl -X POST \
  -H "Authorization: Bearer ${TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "date": "2025-01-15T12:00:00Z",
    "stake": 50.00,
    "odds": 2.5,
    "state": "pending",
    "legs": [
      {
        "league_id": "some-league-id",
        "bet_type": "Match Result",
        "category": "Home",
        "odd": 2.5,
        "result_state": "pending"
      }
    ]
  }' \
  http://localhost:8080/api/bets

# Test authenticated endpoint - Get reference items
curl -H "Authorization: Bearer ${TOKEN}" \
  "http://localhost:8080/api/reference-items?kind=league&limit=10&offset=0"

# Test authenticated endpoint - Get analytics summary
curl -H "Authorization: Bearer ${TOKEN}" \
  "http://localhost:8080/api/analytics/summary"
```

## Testing with a Helper Script

You can create a simple bash script to make testing easier:

```bash
#!/bin/bash
# test-api.sh

TOKEN="${1:-your-token-here}"
BASE_URL="http://localhost:8080"

echo "Testing Health Endpoint..."
curl -s "${BASE_URL}/health" | jq '.'

echo -e "\n\nTesting Get Bets..."
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/api/bets" | jq '.'

echo -e "\n\nTesting Get Reference Items..."
curl -s -H "Authorization: Bearer ${TOKEN}" \
  "${BASE_URL}/api/reference-items?kind=league&limit=5" | jq '.'
```

Make it executable: `chmod +x test-api.sh`
Run it: `./test-api.sh your-token-here`

## Common Issues

### 401 Unauthorized
- Token is missing or invalid
- Token has expired (Supabase tokens expire after 1 hour by default)
- Make sure the `Authorization` header format is: `Bearer <token>`

### 403 Forbidden
- User doesn't have permission (check RLS policies)
- User ID doesn't match the resource owner

### 500 Internal Server Error
- Check backend logs for details
- Verify Supabase connection and environment variables

## Quick Test Checklist

- [ ] Backend is running (`npm run dev`)
- [ ] Health endpoint works: `curl http://localhost:8080/health`
- [ ] You have a valid Supabase JWT token
- [ ] Token is included in `Authorization: Bearer <token>` header
- [ ] User exists in Supabase and has a profile created
- [ ] Database migrations have been run

## Notes

- Tokens expire after 1 hour (default Supabase setting)
- You'll need to refresh/re-login to get a new token
- For automated testing, consider using the service role key (bypasses RLS) - but be careful!
- The frontend automatically handles token refresh via Supabase client

