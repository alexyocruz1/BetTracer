import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Lazy-load environment variables to ensure dotenv has loaded them
const getSupabaseUrl = (): string => {
  const url = process.env.SUPABASE_URL;
  if (!url) {
    throw new Error('Missing SUPABASE_URL environment variable');
  }
  return url;
};

const getSupabaseServiceKey = (): string => {
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!key) {
    throw new Error('Missing SUPABASE_SERVICE_KEY environment variable');
  }
  return key;
};

const getSupabaseAnonKey = (): string => {
  const key = process.env.SUPABASE_ANON_KEY;
  if (!key) {
    throw new Error('Missing SUPABASE_ANON_KEY environment variable');
  }
  return key;
};

// Lazy-initialized admin client
let _supabaseAdmin: SupabaseClient | null = null;

// Service role client (bypasses RLS - use carefully!)
export const supabaseAdmin = (): SupabaseClient => {
  if (!_supabaseAdmin) {
    _supabaseAdmin = createClient(getSupabaseUrl(), getSupabaseServiceKey(), {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }
  return _supabaseAdmin;
};

// Create a client for a specific user (for RLS)
export const createUserClient = (accessToken: string): SupabaseClient => {
  return createClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
};

export default supabaseAdmin;

