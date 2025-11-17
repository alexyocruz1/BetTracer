'use client';

import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const router = useRouter();
  const timeoutRef = useRef<NodeJS.Timeout | null>(null);
  const timeoutFiredRef = useRef(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    timeoutFiredRef.current = false;

    // Add a safety timeout to ensure loading is always reset
    timeoutRef.current = setTimeout(() => {
      timeoutFiredRef.current = true;
      console.warn('[Login] Sign in taking too long, resetting loading state');
      setLoading(false);
      setError('Sign in is taking longer than expected. Please check your connection and try again.');
    }, 15000); // 15 second safety timeout

    try {
      await signIn(email, password);
      
      // Only proceed if timeout hasn't fired
      if (timeoutFiredRef.current) {
        return;
      }
      
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
      setLoading(false);
      
      // Wait a moment for auth state to update, then redirect
      setTimeout(() => {
        router.push('/');
        // Fallback redirect if router doesn't work
        setTimeout(() => {
          if (window.location.pathname !== '/') {
            window.location.href = '/';
          }
        }, 500);
      }, 100);
    } catch (err: any) {
      if (!timeoutFiredRef.current) {
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }
        console.error('[Login] Sign in error:', err);
        setError(err.message || 'Failed to sign in. Please check your credentials and try again.');
        setLoading(false);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8 bg-white rounded-lg shadow">
        <div>
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Sign in to BetTracer
          </h2>
        </div>
        <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email address
              </label>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Password
              </label>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="mt-1 block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-primary-500 focus:border-primary-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </div>
          <div>
            <button
              type="submit"
              disabled={loading}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50"
            >
              {loading ? 'Signing in...' : 'Sign in'}
            </button>
          </div>
          <div className="text-center">
            <a href="/signup" className="text-sm text-primary-600 hover:text-primary-500">
              Don't have an account? Sign up
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

