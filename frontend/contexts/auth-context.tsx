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

    // Helper to get session from localStorage (fast, synchronous)
    const getSessionFromStorage = (): { access_token: string; user: any } | null => {
      if (typeof window === 'undefined') return null;
      
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
        
        if (projectRef) {
          const storageKey = `sb-${projectRef}-auth-token`;
          const stored = localStorage.getItem(storageKey);
          
          if (stored) {
            const parsed = JSON.parse(stored);
            if (parsed?.access_token && parsed?.user) {
              return {
                access_token: parsed.access_token,
                user: parsed.user,
              };
            }
          }
        }
      } catch (e) {
        // Ignore errors
      }
      return null;
    };

    // Try localStorage first (fast path)
    const storedSession = getSessionFromStorage();
    if (storedSession && mounted) {
      // We have a token, create a minimal session object
      // The full session will be fetched in the background
      const session = {
        access_token: storedSession.access_token,
        refresh_token: '', // Will be updated when real session loads
        expires_in: 3600,
        expires_at: Math.floor(Date.now() / 1000) + 3600,
        token_type: 'bearer',
        user: storedSession.user,
      } as Session;
      
      setSession(session);
      setUser(storedSession.user);
      
      // Fetch admin status
      fetchAdminStatus(storedSession.user.id).catch(() => {
        setIsAdmin(false);
      });
      
      setLoading(false);
      
      // Still try to get the real session in the background (for refresh tokens, etc.)
      supabase.auth.getSession().then(({ data: { session: realSession } }) => {
        if (mounted && realSession) {
          setSession(realSession);
          setUser(realSession.user);
        }
      }).catch(() => {
        // Ignore - we already have a session from localStorage
      });
      
      return () => {
        mounted = false;
      };
    }

    // No token in localStorage, try getSession() with timeout
    timeoutId = setTimeout(() => {
      if (mounted) {
        console.warn('[Auth] Session check timeout after 3s - no session found');
        setSession(null);
        setUser(null);
        setIsAdmin(false);
        setLoading(false);
      }
    }, 3000); // 3 second timeout

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
    // Since network requests succeed but promise might hang, use localStorage check as primary method
    const signInPromise = supabase.auth.signInWithPassword({ email, password });
    
    // Check localStorage for token (fast, synchronous)
    const checkLocalStorage = (): string | null => {
      if (typeof window === 'undefined') return null;
      
      try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
        const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
        
        if (projectRef) {
          const storageKey = `sb-${projectRef}-auth-token`;
          const stored = localStorage.getItem(storageKey);
          
          if (stored) {
            const parsed = JSON.parse(stored);
            return parsed?.access_token || null;
          }
        }
      } catch (e) {
        // Ignore errors
      }
      return null;
    };
    
    // Also start checking for session/token after a short delay
    const tokenCheckPromise = new Promise<void>((resolve, reject) => {
      let attempts = 0;
      const maxAttempts = 30; // Check for 3 seconds (30 * 100ms)
      
      const checkToken = () => {
        attempts++;
        
        // Check localStorage first (fast)
        const token = checkLocalStorage();
        if (token) {
          resolve();
          return;
        }
        
        // Fallback: check getSession (slower)
        if (attempts % 3 === 0) { // Only check getSession every 3rd attempt
          supabase.auth.getSession().then(({ data: { session }, error }) => {
            if (session?.user) {
              resolve();
            } else if (error && attempts >= maxAttempts) {
              reject(error);
            } else if (attempts < maxAttempts) {
              setTimeout(checkToken, 100);
            }
          }).catch(() => {
            if (attempts < maxAttempts) {
              setTimeout(checkToken, 100);
            }
          });
        } else {
          if (attempts >= maxAttempts) {
            // Check localStorage one more time before giving up
            const finalToken = checkLocalStorage();
            if (finalToken) {
              resolve();
            } else {
              reject(new Error('Sign in may have succeeded but session not found. Please refresh the page.'));
            }
          } else {
            setTimeout(checkToken, 100);
          }
        }
      };
      
      // Start checking after 300ms (give network request time to complete)
      setTimeout(checkToken, 300);
    });

    try {
      // Race between the signIn promise and token check
      // This handles cases where signIn promise hangs but token is saved to localStorage
      await Promise.race([
        signInPromise.then(({ data, error }) => {
          if (error) throw error;
          if (!data?.session) {
            // Even if signIn promise resolves without session, check localStorage
            const token = checkLocalStorage();
            if (!token) {
              throw new Error('Sign in succeeded but no session was created');
            }
          }
        }),
        tokenCheckPromise,
      ]);
    } catch (error: any) {
      // Before throwing error, check localStorage one more time
      const token = checkLocalStorage();
      if (token) {
        // Token exists, sign-in actually succeeded
        return;
      }
      
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

