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
    let sessionSetByAuthStateChange = false;

    // Always use getSession() to ensure we get a valid, non-expired session
    // getSession() handles token refresh automatically if needed
    // The auth state change listener will also handle session updates

    // Get initial session with timeout and proper expiration handling
    timeoutId = setTimeout(() => {
      if (mounted && !sessionSetByAuthStateChange) {
        // Only clear session if auth state change hasn't already set it
        // This prevents clearing session when Render is slow but auth state change fires
        console.warn('[Auth] Session check timeout after 15s - checking if session exists');
        // Don't clear session immediately, let auth state change handle it
        // Just stop loading
        setLoading(false);
      }
    }, 15000); // Increased to 15 seconds to account for Render sleep time

    // Get initial session with error handling and expiration check
    // Note: Even if this times out, onAuthStateChange will still fire and handle the session
    supabase.auth
      .getSession()
      .then(async ({ data: { session }, error }) => {
        if (!mounted) return;
        
        // Clear timeout since we got a response
        clearTimeout(timeoutId);
        
        // If auth state change already set the session, don't overwrite it
        if (sessionSetByAuthStateChange) {
          return;
        }
        
        if (error) {
          console.error('[Auth] Error getting session:', error);
          // Don't clear session here if auth state change might set it
          // Let auth state change handle it
          setSession(null);
          setUser(null);
          setIsAdmin(false);
          setLoading(false);
          return;
        }

        // Check if session exists and is valid
        if (session) {
          const expiresAt = session.expires_at;
          
          // Check if session is expired
          if (expiresAt && expiresAt < Math.floor(Date.now() / 1000)) {
            console.warn('[Auth] Session expired, attempting refresh...');
            
            // Try to refresh the expired session
            if (session.refresh_token) {
              try {
                const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession(session);
                
                if (refreshError || !refreshData?.session) {
                  console.error('[Auth] Failed to refresh expired session:', refreshError);
                  setSession(null);
                  setUser(null);
                  setIsAdmin(false);
                  setLoading(false);
                  return;
                }
                
                // Session refreshed successfully
                setSession(refreshData.session);
                setUser(refreshData.session.user);
                
                if (refreshData.session.user) {
                  try {
                    await fetchAdminStatus(refreshData.session.user.id);
                  } catch (error) {
                    console.error('[Auth] Error fetching admin status:', error);
                    setIsAdmin(false);
                  }
                } else {
                  setIsAdmin(false);
                }
                
                setLoading(false);
                return;
              } catch (refreshErr) {
                console.error('[Auth] Error during session refresh:', refreshErr);
                setSession(null);
                setUser(null);
                setIsAdmin(false);
                setLoading(false);
                return;
              }
            } else {
              // No refresh token, session is invalid
              console.warn('[Auth] Session expired and no refresh token available');
              setSession(null);
              setUser(null);
              setIsAdmin(false);
              setLoading(false);
              return;
            }
          }
          
          // Session is valid, use it
          setSession(session);
          setUser(session.user);
          
          if (session.user) {
            try {
              await fetchAdminStatus(session.user.id);
            } catch (error) {
              console.error('[Auth] Error fetching admin status:', error);
              setIsAdmin(false);
            }
          } else {
            setIsAdmin(false);
          }
        } else {
          // No session found
          setSession(null);
          setUser(null);
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

    // Listen for auth changes - this will fire even if getSession() times out
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mounted) return;
      
      console.log('[Auth] Auth state changed:', event, session ? 'session exists' : 'no session');
      
      // Mark that auth state change has set the session
      sessionSetByAuthStateChange = true;
      
      // Clear the timeout since auth state change fired
      clearTimeout(timeoutId);
      
      // Update session and user state
      setSession(session);
      setUser(session?.user ?? null);
      
      // Update admin status if we have a user
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

    // Listen for visibility changes (when user returns to tab)
    const handleVisibilityChange = async () => {
      if (!mounted || typeof document === 'undefined') return;
      
      if (document.visibilityState === 'visible') {
        // User returned to the tab, refresh session to check if it's still valid
        try {
          const { data: { session: currentSession }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('[Auth] Error refreshing session on visibility change:', error);
            // If session check fails, clear state and redirect to login
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
            return;
          }

          // If we have a session but it's expired or about to expire, try to refresh it
          if (currentSession) {
            const expiresAt = currentSession.expires_at;
            if (expiresAt) {
              const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
              
              // If token expires within 5 minutes, refresh it
              if (expiresIn < 300 && currentSession.refresh_token) {
                try {
                  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession(currentSession);
                  
                  if (refreshError || !refreshData?.session) {
                    console.error('[Auth] Failed to refresh session on visibility change:', refreshError);
                    // Session refresh failed, sign out
                    await supabase.auth.signOut();
                    setSession(null);
                    setUser(null);
                    setIsAdmin(false);
                    if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                      window.location.href = '/login';
                    }
                    return;
                  }
                  
                  // Session refreshed successfully
                  setSession(refreshData.session);
                  setUser(refreshData.session.user);
                  if (refreshData.session.user) {
                    await fetchAdminStatus(refreshData.session.user.id);
                  }
                } catch (refreshErr) {
                  console.error('[Auth] Error during session refresh on visibility change:', refreshErr);
                  await supabase.auth.signOut();
                  setSession(null);
                  setUser(null);
                  setIsAdmin(false);
                  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                    window.location.href = '/login';
                  }
                }
              } else {
                // Session is still valid, just update state
                setSession(currentSession);
                setUser(currentSession.user);
                if (currentSession.user) {
                  await fetchAdminStatus(currentSession.user.id);
                }
              }
            } else {
              // No expiration info, just update state
              setSession(currentSession);
              setUser(currentSession.user);
              if (currentSession.user) {
                await fetchAdminStatus(currentSession.user.id);
              }
            }
          } else {
            // No session found, clear state
            setSession(null);
            setUser(null);
            setIsAdmin(false);
            if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
              window.location.href = '/login';
            }
          }
        } catch (err) {
          console.error('[Auth] Error handling visibility change:', err);
        }
      }
    };

    // Add visibility change listener
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange);
      }
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

