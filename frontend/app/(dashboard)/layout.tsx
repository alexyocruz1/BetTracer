'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  // Helper function to determine if a nav link is active
  const isActive = (path: string, exact: boolean = false) => {
    if (!pathname) return false;
    
    if (exact) {
      return pathname === path;
    }
    if (path === '/bets') {
      // Special handling for /bets - should match /bets and /bets/[id] but not /bets/new
      return pathname.startsWith('/bets') && pathname !== '/bets/new';
    }
    return pathname.startsWith(path);
  };

  useEffect(() => {
    // Only redirect if we're sure there's no user (after loading completes)
    if (!loading && !user) {
      console.log('[Dashboard Layout] No user found, redirecting to login');
      // Use replace to avoid adding to history stack (prevents back button issues in Edge)
      // Add a small delay to ensure state is fully updated
      const timer = setTimeout(() => {
        // Try router.replace first, fallback to window.location for Edge compatibility
        try {
          router.replace('/login');
          // Fallback: if router doesn't work, use window.location
          setTimeout(() => {
            if (window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
              console.warn('[Dashboard Layout] Router replace failed, using window.location');
              window.location.href = '/login';
            }
          }, 500);
        } catch (error) {
          console.error('[Dashboard Layout] Redirect error:', error);
          window.location.href = '/login';
        }
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [user, loading, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-lg">Loading...</div>
      </div>
    );
  }

  if (!user) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <nav className="bg-white shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <Link href="/" className="flex items-center px-2 py-2 text-xl font-bold text-primary-600">
                BetTracer
              </Link>
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                    isActive('/', true)
                      ? 'border-b-2 border-primary-500 text-gray-900'
                      : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/bets"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                    isActive('/bets')
                      ? 'border-b-2 border-primary-500 text-gray-900'
                      : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Bets
                </Link>
                <Link
                  href="/bets/new"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                    isActive('/bets/new', true)
                      ? 'border-b-2 border-primary-500 text-gray-900'
                      : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  New Bet
                </Link>
                <Link
                  href="/analytics"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                    isActive('/analytics', true)
                      ? 'border-b-2 border-primary-500 text-gray-900'
                      : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                  }`}
                >
                  Analytics
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                      isActive('/admin', true)
                        ? 'border-b-2 border-primary-500 text-gray-900'
                        : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
                    }`}
                  >
                    Admin
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center">
              <span className="text-gray-700 mr-4">{user.email}</span>
              <button
                onClick={() => signOut()}
                className="text-gray-500 hover:text-gray-700 px-3 py-2 rounded-md text-sm font-medium"
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

