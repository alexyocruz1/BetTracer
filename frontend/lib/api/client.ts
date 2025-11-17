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
        // Add timeout to getSession to prevent hanging (common in Edge)
        let sessionTimedOut = false;
        const sessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<{ data: { session: null }; error: null }>((resolve) => {
          setTimeout(() => {
            sessionTimedOut = true;
            console.warn('[API Client] getSession timeout after 3s, proceeding without token');
            resolve({ data: { session: null }, error: null });
          }, 3000); // 3 second timeout for session check
        });

        try {
          const result = await Promise.race([sessionPromise, timeoutPromise]);
          const { data: { session }, error } = result;

          if (error && !sessionTimedOut) {
            console.warn('[API Client] Error getting session:', error);
          } else if (session?.access_token) {
            config.headers.Authorization = `Bearer ${session.access_token}`;
          } else if (!sessionTimedOut) {
            // Only warn if we didn't timeout (timeout is expected in Edge)
            console.warn('[API Client] No auth token found!');
          }
        } catch (error) {
          console.error('[API Client] Failed to get session:', error);
          // Continue without auth token - let the backend handle it
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

