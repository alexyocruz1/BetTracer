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
        // Fast path: Try localStorage first (synchronous, no async overhead)
        let accessToken: string | null = null;
        
        if (typeof window !== 'undefined') {
          try {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
            const projectRef = supabaseUrl.split('//')[1]?.split('.')[0] || '';
            
            if (projectRef) {
              const storageKey = `sb-${projectRef}-auth-token`;
              const stored = localStorage.getItem(storageKey);
              
              if (stored) {
                try {
                  const parsed = JSON.parse(stored);
                  // Check if token is expired
                  const expiresAt = parsed?.expires_at;
                  if (expiresAt && Date.now() / 1000 < expiresAt) {
                    accessToken = parsed?.access_token || null;
                  } else if (parsed?.access_token) {
                    // Token exists but might be expired, still try it
                    // Backend will reject if truly expired
                    accessToken = parsed.access_token;
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

        // If we got a token from localStorage, use it immediately
        if (accessToken) {
          config.headers.Authorization = `Bearer ${accessToken}`;
          return config;
        }

        // Fallback: Try getSession() with very short timeout (only if localStorage failed)
        // This is mainly to refresh expired tokens
        try {
          const sessionPromise = supabase.auth.getSession();
          const timeoutPromise = new Promise<{ data: { session: null }; error: null }>((resolve) => {
            setTimeout(() => {
              resolve({ data: { session: null }, error: null });
            }, 1000); // Very short timeout since we already tried localStorage
          });

          const result = await Promise.race([sessionPromise, timeoutPromise]);
          const { data: sessionData } = result;

          if (sessionData?.access_token) {
            config.headers.Authorization = `Bearer ${sessionData.access_token}`;
          }
        } catch (error) {
          // Silently fail - we already tried localStorage
          // If both fail, request will proceed without token (backend will handle auth)
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

