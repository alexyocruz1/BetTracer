import axios, { AxiosInstance } from 'axios';
import { supabase } from '../supabase/client';

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080';

class ApiClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      timeout: 30000, // 30 second timeout (increased for bet creation with multiple legs)
    });

    // Add auth token to requests
    this.client.interceptors.request.use(
      async (config) => {
        // Try to get session with timeout, fallback to localStorage if needed
        let sessionTimedOut = false;
        let session: { access_token?: string } | null = null;
        
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }; error: null }>((resolve) => {
          setTimeout(() => {
            sessionTimedOut = true;
            resolve({ data: { session: null }, error: null });
          }, 2000); // 2 second timeout for session check
        });

        try {
          const result = await Promise.race([sessionPromise, timeoutPromise]);
          const { data: sessionData, error } = result;

          if (error && !sessionTimedOut) {
            console.warn('[API Client] Error getting session:', error);
          } else if (sessionData?.access_token) {
            session = sessionData;
          }
        } catch (error) {
          console.error('[API Client] Failed to get session:', error);
        }

        // If getSession timed out or failed, try localStorage fallback
        if (!session?.access_token && sessionTimedOut && typeof window !== 'undefined') {
          try {
            // Supabase stores session in localStorage with key pattern: sb-<project-ref>-auth-token
            // Try to find it by searching for keys that match the pattern
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
            
            if (projectRef) {
              const storageKey = `sb-${projectRef}-auth-token`;
              const stored = localStorage.getItem(storageKey);
              
              if (stored) {
                try {
                  const parsed = JSON.parse(stored);
                  // Supabase stores it as { access_token, expires_at, etc. }
                  if (parsed?.access_token) {
                    session = { access_token: parsed.access_token };
                    // Don't log - this is expected fallback behavior
                  }
                } catch (e) {
                  // Invalid JSON, ignore
                }
              }
            }
          } catch (e) {
            // localStorage access failed, ignore
          }
        }

        // Set authorization header if we have a token
        if (session?.access_token) {
          config.headers.Authorization = `Bearer ${session.access_token}`;
        } else if (sessionTimedOut) {
          // Only log if we timed out and couldn't get token from localStorage either
          // This is expected in Edge sometimes, so use debug level
          console.debug('[API Client] getSession timeout, proceeding without token');
        } else {
          // No session and didn't timeout - user might not be logged in
          console.debug('[API Client] No auth token found');
        }

        return config;
      },
      (error) => {
        return Promise.reject(error);
      }
    );

    // Handle errors
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        console.error('[API Client] Request failed:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message,
        });
        
        if (error.response?.status === 401) {
          // Handle unauthorized - redirect to login
          supabase.auth.signOut().catch(console.error);
          // Use setTimeout to avoid navigation during render
          setTimeout(() => {
            window.location.href = '/login';
          }, 0);
        }
        
        // Handle network errors (common in Edge)
        if (!error.response && error.message) {
          if (error.message.includes('timeout') || error.message.includes('Network Error')) {
            console.error('[API Client] Network error - check your connection');
          }
        }
        
        return Promise.reject(error);
      }
    );
  }

  get api() {
    return this.client;
  }
}

export const apiClient = new ApiClient().api;

