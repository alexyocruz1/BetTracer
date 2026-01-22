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
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
      timeout: 90000, // 90 second timeout (increased to account for Render sleep time and slow responses)
    });

    // Add auth token to requests
    this.client.interceptors.request.use(
      async (config) => {
        try {
          // Always use getSession() to ensure we have a valid, refreshed token
          // getSession() will automatically refresh expired tokens if autoRefreshToken is enabled
          const { data: { session }, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error('[API Client] Error getting session:', error);
            // If session retrieval fails, try to continue without token
            // Backend will handle authentication
            return config;
          }

          if (session?.access_token) {
            // Check if token is about to expire (within 5 minutes)
            const expiresAt = session.expires_at;
            if (expiresAt) {
              const expiresIn = expiresAt - Math.floor(Date.now() / 1000);
              
              // If token expires soon, try to refresh it
              if (expiresIn < 300 && session.refresh_token) {
                try {
                  const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession(session);
                  if (!refreshError && refreshData?.session?.access_token) {
                    config.headers.Authorization = `Bearer ${refreshData.session.access_token}`;
                    return config;
                  }
                } catch (refreshErr) {
                  console.warn('[API Client] Failed to refresh session:', refreshErr);
                  // Continue with current token, backend will handle if it's expired
                }
              }
            }
            
            config.headers.Authorization = `Bearer ${session.access_token}`;
          }
        } catch (error) {
          // If session retrieval completely fails, proceed without token
          // Backend will return 401 if authentication is required
          console.warn('[API Client] Failed to get session for request:', error);
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
      async (error) => {
        console.error('[API Client] Request failed:', {
          url: error.config?.url,
          method: error.config?.method,
          status: error.response?.status,
          message: error.message,
        });
        
        if (error.response?.status === 401) {
          // Check if we can refresh the session before signing out
          try {
            const { data: { session }, error: sessionError } = await supabase.auth.getSession();
            
            if (sessionError || !session) {
              // No valid session, sign out and redirect
              await supabase.auth.signOut();
              if (typeof window !== 'undefined') {
                window.location.href = '/login';
              }
              return Promise.reject(error);
            }

            // Try to refresh the session if it exists
            if (session.refresh_token) {
              const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession(session);
              
              if (!refreshError && refreshData?.session?.access_token) {
                // Session refreshed successfully, retry the original request
                const originalRequest = error.config;
                if (originalRequest) {
                  originalRequest.headers.Authorization = `Bearer ${refreshData.session.access_token}`;
                  // Retry the request with the new token
                  return this.client.request(originalRequest);
                }
              }
            }

            // Refresh failed or no refresh token, sign out and redirect
            await supabase.auth.signOut();
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
          } catch (authError) {
            console.error('[API Client] Auth error during 401 handling:', authError);
            // Sign out on any error during auth handling
            await supabase.auth.signOut().catch(console.error);
            if (typeof window !== 'undefined') {
              window.location.href = '/login';
            }
          }
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

