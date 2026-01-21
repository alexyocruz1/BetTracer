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
    
    // Track current session token and user ID to avoid stale closures
    let currentSessionToken: string | null = null;
    let currentUserId: string | null = null;

    // Always use getSession() to ensure we get a valid, non-expired session
    // getSession() handles token refresh automatically if needed
    // The auth state change listener will also handle session updates

    // Get initial session with timeout and proper expiration handling
    timeoutId = setTimeout(() => {
      if (mounted && !sessionSetByAuthStateChange) {
        // Only clear session if auth state change hasn't already set it
        // This prevents clearing session when Render is slow but auth state change fires
        console.warn('[Auth] Session check timeout after 15s - checking if session exists in storage');
        
        // Before clearing, check localStorage for session persistence
        // This handles cases where getSession() times out but session is still valid
        try {
          const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
          const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
          
          if (projectRef && typeof window !== 'undefined') {
            const storageKey = `sb-${projectRef}-auth-token`;
            const stored = localStorage.getItem(storageKey);
            
            if (stored) {
              const parsed = JSON.parse(stored);
              if (parsed?.access_token) {
                // Session exists in storage, don't clear - let auth state change handle it
                console.log('[Auth] Session found in storage, waiting for auth state change');
                setLoading(false);
                return;
              }
            }
          }
        } catch (e) {
          // Ignore storage errors
        }
        
        // No session in storage either, but don't clear state yet
        // Let auth state change handle it - it might still fire
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
          // Don't clear session here - check localStorage first
          // Auth state change will handle it properly
          try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
            
            if (projectRef && typeof window !== 'undefined') {
              const storageKey = `sb-${projectRef}-auth-token`;
              const stored = localStorage.getItem(storageKey);
              
              if (stored) {
                const parsed = JSON.parse(stored);
                if (parsed?.access_token) {
                  // Session exists in storage, don't clear - let auth state change handle it
                  console.log('[Auth] Session found in storage despite getSession error');
                  setLoading(false);
                  return;
                }
              }
            }
          } catch (e) {
            // Ignore storage errors
          }
          
          // No session in storage, clear state
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
                
                // Track current session token and user ID for visibility change handler
                currentSessionToken = refreshData.session.access_token || null;
                currentUserId = refreshData.session.user?.id || null;
                
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
          
          // Track current session token and user ID for visibility change handler
          currentSessionToken = session.access_token || null;
          currentUserId = session.user?.id || null;
          
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
          currentSessionToken = null;
          currentUserId = null;
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
      // Always update to ensure state is in sync with Supabase
      setSession(session);
      setUser(session?.user ?? null);
      
      // Track current session token and user ID for visibility change handler
      currentSessionToken = session?.access_token || null;
      currentUserId = session?.user?.id || null;
      
      // Update admin status if we have a user
      // Always fetch admin status when we have a session to ensure it's up-to-date
      // This fixes the issue where admin tab doesn't appear on refresh
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
    // Use debouncing to prevent rapid-fire calls that could interfere with button clicks
    let visibilityTimeout: NodeJS.Timeout | null = null;
    let isHandlingVisibility = false;
    
    const handleVisibilityChange = async () => {
      if (!mounted || typeof document === 'undefined') return;
      
      // Debounce: wait 1000ms before handling visibility change
      // Increased debounce to prevent interference with button clicks when switching tabs
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
      
      visibilityTimeout = setTimeout(async () => {
        if (!mounted || isHandlingVisibility) return;
        
        if (document.visibilityState === 'visible') {
          isHandlingVisibility = true;
          
          try {
            // Get current session state using a function to avoid stale closure
            const getCurrentState = () => {
              // Use a ref-like pattern by checking localStorage for the latest token
              try {
                const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
                const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
                if (projectRef && typeof window !== 'undefined') {
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
            
            // Only check session if token might have changed (check localStorage first)
            const storedToken = getCurrentState();
            if (storedToken === currentSessionToken && currentSessionToken !== null) {
              // Token hasn't changed, skip the check to avoid unnecessary API calls
              isHandlingVisibility = false;
              return;
            }
            
            // Only check session if we don't already have a valid one
            // This prevents unnecessary API calls that could interfere with button clicks
            const { data: { session: currentSession }, error } = await supabase.auth.getSession();
            
            if (error) {
              console.error('[Auth] Error refreshing session on visibility change:', error);
              // Only redirect if we're not already on login page and we had a session before
              if (currentSessionToken && typeof window !== 'undefined' && window.location.pathname !== '/login') {
                currentSessionToken = null;
                currentUserId = null;
                setSession(null);
                setUser(null);
                setIsAdmin(false);
                window.location.href = '/login';
              }
              isHandlingVisibility = false;
              return;
            }

            // Only update state if session actually changed or is expired/about to expire
            if (currentSession) {
              const expiresAt = currentSession.expires_at;
              if (expiresAt) {
                const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
                
                // Only refresh if token expires within 2 minutes (more conservative)
                // This prevents unnecessary refreshes that could interfere with operations
                if (expiresIn < 120 && currentSession.refresh_token) {
                  try {
                    const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession(currentSession);
                    
                    if (refreshError || !refreshData?.session) {
                      console.error('[Auth] Failed to refresh session on visibility change:', refreshError);
                      // Only sign out if we're not on login page
                      if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
                        await supabase.auth.signOut();
                        currentSessionToken = null;
                        currentUserId = null;
                        setSession(null);
                        setUser(null);
                        setIsAdmin(false);
                        window.location.href = '/login';
                      }
                      isHandlingVisibility = false;
                      return;
                    }
                    
                    // Session refreshed successfully - only update if it actually changed
                    if (refreshData.session.access_token !== currentSessionToken) {
                      currentSessionToken = refreshData.session.access_token || null;
                      currentUserId = refreshData.session.user?.id || null;
                      setSession(refreshData.session);
                      setUser(refreshData.session.user);
                      // Always fetch admin status to ensure it's up-to-date
                      if (refreshData.session.user) {
                        await fetchAdminStatus(refreshData.session.user.id);
                      }
                    }
                  } catch (refreshErr) {
                    console.error('[Auth] Error during session refresh on visibility change:', refreshErr);
                    // Don't sign out on error - let the user continue working
                    // The API client will handle 401 errors
                  }
                } else {
                  // Session is still valid - only update if it actually changed
                  if (currentSession.access_token !== currentSessionToken) {
                    currentSessionToken = currentSession.access_token || null;
                    currentUserId = currentSession.user?.id || null;
                    setSession(currentSession);
                    setUser(currentSession.user);
                    // Always fetch admin status to ensure it's up-to-date
                    if (currentSession.user) {
                      await fetchAdminStatus(currentSession.user.id);
                    }
                  }
                }
              } else {
                // No expiration info - only update if session actually changed
                if (currentSession.access_token !== currentSessionToken) {
                  currentSessionToken = currentSession.access_token || null;
                  currentUserId = currentSession.user?.id || null;
                  setSession(currentSession);
                  setUser(currentSession.user);
                  // Always fetch admin status to ensure it's up-to-date
                  if (currentSession.user) {
                    await fetchAdminStatus(currentSession.user.id);
                  }
                }
              }
            } else {
              // No session found - only clear if we had one before
              if (currentSessionToken && typeof window !== 'undefined' && window.location.pathname !== '/login') {
                currentSessionToken = null;
                currentUserId = null;
                setSession(null);
                setUser(null);
                setIsAdmin(false);
                window.location.href = '/login';
              }
            }
          } catch (err) {
            console.error('[Auth] Error handling visibility change:', err);
            // Don't clear session on error - let user continue working
          } finally {
            isHandlingVisibility = false;
          }
        }
      }, 1000); // 1000ms debounce to prevent interference with button clicks
    };

    // Add visibility change listener
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange);
    }

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      if (visibilityTimeout) {
        clearTimeout(visibilityTimeout);
      }
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

