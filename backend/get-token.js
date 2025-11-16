#!/usr/bin/env node
/**
 * Helper script to get a Supabase JWT token for API testing
 * 
 * Usage:
 *   node get-token.js <email> <password>
 * 
 * Or set environment variables:
 *   SUPABASE_URL=... SUPABASE_ANON_KEY=... node get-token.js <email> <password>
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Error: Missing Supabase environment variables');
  console.error('   Make sure SUPABASE_URL and SUPABASE_ANON_KEY are set in .env');
  process.exit(1);
}

const email = process.argv[2];
const password = process.argv[3];

if (!email || !password) {
  console.error('❌ Error: Missing email or password');
  console.error('   Usage: node get-token.js <email> <password>');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function getToken() {
  try {
    console.log(`🔐 Signing in as ${email}...`);
    
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      console.error('❌ Authentication failed:', error.message);
      if (error.message.includes('Invalid login credentials')) {
        console.error('   Tip: Make sure the user exists in Supabase');
        console.error('   You can create a user via the Supabase dashboard or sign up first');
      }
      process.exit(1);
    }

    if (!data.session) {
      console.error('❌ No session returned');
      process.exit(1);
    }

    console.log('\n✅ Success! Here is your access token:\n');
    console.log(data.session.access_token);
    console.log('\n📋 Use it in your curl commands like this:\n');
    console.log(`curl -H "Authorization: Bearer ${data.session.access_token}" \\`);
    console.log('  http://localhost:8080/api/bets\n');
    console.log('💡 Tip: Tokens expire after 1 hour. Run this script again to get a new token.\n');
    
  } catch (error) {
    console.error('❌ Unexpected error:', error.message);
    process.exit(1);
  }
}

getToken();

