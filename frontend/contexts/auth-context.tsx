'use client';

import { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/client';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isAdmin: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);

  // Fetch admin status from backend
  const fetchAdminStatus = async (userId: string) => {
    try {
      // We'll check admin status by trying to access an admin endpoint
      // Or we can fetch profile directly from Supabase
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', userId)
        .single();
      
      setIsAdmin(profile?.is_admin || false);
    } catch (error) {
      console.error('Failed to fetch admin status:', error);
      setIsAdmin(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    let timeoutId: NodeJS.Timeout;

    // Set a timeout to ensure loading is always set to false
    // Reduced to 5 seconds - if Supabase takes longer, there's likely a network issue
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] Session check timeout after 5s - assuming no session (check network/Supabase connection)');
        // Explicitly set user and session to null on timeout
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    }, 5000); // 5 second timeout

    // Get initial session with error handling
    supabase.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (!mounted) return;
        
        clearTimeout(timeoutId);
        
        if (error) {
          console.error('[Auth] Error getting session:', error);
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        setSession(session);
        setUser(session?.user ?? null);
        
        if (session?.user) {
          try {
            await fetchAdminStatus(session.user.id);
          } catch (error) {
            console.error('[Auth] Error fetching admin status:', error);
            setIsAdmin(false);
          }
        } else {
          setIsAdmin(false);
        }
        
        setLoading(false);
      })
      .catch((error) => {
        if (!mounted) return;
        clearTimeout(timeoutId);
        console.error('[Auth] Failed to get session:', error);
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (!mounted) return;
      
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        try {
          await fetchAdminStatus(session.user.id);
        } catch (error) {
          console.error('[Auth] Error fetching admin status:', error);
          setIsAdmin(false);
        }
      } else {
        setIsAdmin(false);
      }
      
      setLoading(false);
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    // Since network requests succeed but promise might hang, use a race with session check
    const signInPromise = supabase.auth.signInWithPassword({ email, password });
    
    // Also start checking for session after a short delay (workaround for Edge)
    const sessionCheckPromise = new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 20; // Check for 2 seconds (20 * 100ms)
      
      const checkSession = async () => {
        attempts++;
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (session?.user) {
          resolve();
        } else if (error) {
          reject(error);
        } else if (attempts >= maxAttempts) {
          reject(new Error('Sign in may have succeeded but session not found. Please refresh the page.'));
        } else {
          setTimeout(checkSession, 100);
        }
      };
      
      // Start checking after 500ms (give network request time to complete)
      setTimeout(checkSession, 500);
    });

    try {
      // Race between the signIn promise and session check
      // This handles cases where signIn promise hangs but session is created
      await Promise.race([
        signInPromise.then(({ data, error }) => {
          if (error) throw error;
          if (!data?.session) throw new Error('Sign in succeeded but no session was created');
        }),
        sessionCheckPromise,
      ]);
    } catch (error: any) {
      // Handle Supabase errors
      if (error.error) {
        throw error.error;
      }
      
      // Handle other errors
      throw error;
    }
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  };

  const signOut = async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isAdmin, signIn, signUp, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

