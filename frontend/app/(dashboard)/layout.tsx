'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/auth-context';
import Link from 'next/link';
import ThemeToggle from '@/components/ThemeToggle';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, signOut, isAdmin } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900">
      <nav className="bg-white dark:bg-gray-800 shadow">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <Link href="/" className="flex items-center px-2 py-2 text-xl font-bold text-primary-600 dark:text-primary-400">
                BetTracer
              </Link>
              {/* Desktop Navigation */}
              <div className="hidden sm:ml-6 sm:flex sm:space-x-8">
                <Link
                  href="/"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                    isActive('/', true)
                    ? 'border-b-2 border-primary-500 text-gray-900 dark:text-gray-100'
                    : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Dashboard
                </Link>
                <Link
                  href="/bets"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                    isActive('/bets')
                    ? 'border-b-2 border-primary-500 text-gray-900 dark:text-gray-100'
                    : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Bets
                </Link>
                <Link
                  href="/bets/new"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                    isActive('/bets/new', true)
                    ? 'border-b-2 border-primary-500 text-gray-900 dark:text-gray-100'
                    : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  New Bet
                </Link>
                <Link
                  href="/analytics"
                  className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                    isActive('/analytics', true)
                    ? 'border-b-2 border-primary-500 text-gray-900 dark:text-gray-100'
                    : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                  }`}
                >
                  Analytics
                </Link>
                {isAdmin && (
                  <Link
                    href="/admin"
                    className={`inline-flex items-center px-1 pt-1 text-sm font-medium transition-colors ${
                      isActive('/admin', true)
                    ? 'border-b-2 border-primary-500 text-gray-900 dark:text-gray-100'
                    : 'border-b-2 border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
                    }`}
                  >
                    Admin
                  </Link>
                )}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {/* Theme toggle */}
              <ThemeToggle />
              {/* Mobile menu button */}
              <button
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="sm:hidden inline-flex items-center justify-center p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 dark:text-gray-500 dark:hover:text-gray-400 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500 min-h-[44px] min-w-[44px]"
                aria-label="Toggle menu"
              >
                {mobileMenuOpen ? (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                ) : (
                  <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                  </svg>
                )}
              </button>
              {/* Desktop user info */}
              <div className="hidden sm:flex sm:items-center">
                <span className="text-gray-700 dark:text-gray-300 mr-4 text-sm truncate max-w-[200px]">{user.email}</span>
                <button
                  onClick={() => signOut()}
                  className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 px-3 py-2 rounded-md text-sm font-medium"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="sm:hidden border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
            <div className="px-2 pt-2 pb-3 space-y-1">
              <Link
                href="/"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium min-h-[44px] flex items-center ${
                  isActive('/', true)
                    ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                Dashboard
              </Link>
              <Link
                href="/bets"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium min-h-[44px] flex items-center ${
                  isActive('/bets')
                    ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                Bets
              </Link>
              <Link
                href="/bets/new"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium min-h-[44px] flex items-center ${
                  isActive('/bets/new', true)
                    ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                New Bet
              </Link>
              <Link
                href="/analytics"
                onClick={() => setMobileMenuOpen(false)}
                className={`block px-3 py-2 rounded-md text-base font-medium min-h-[44px] flex items-center ${
                  isActive('/analytics', true)
                    ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                    : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                }`}
              >
                Analytics
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMobileMenuOpen(false)}
                  className={`block px-3 py-2 rounded-md text-base font-medium min-h-[44px] flex items-center ${
                    isActive('/admin', true)
                      ? 'bg-primary-50 text-primary-700 border-l-4 border-primary-500 dark:bg-primary-900/20 dark:text-primary-300'
                      : 'text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-800'
                  }`}
                >
                  Admin
                </Link>
              )}
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                <div className="px-3 py-2 text-sm text-gray-700 dark:text-gray-300 truncate">{user.email}</div>
                <button
                  onClick={() => {
                    setMobileMenuOpen(false);
                    signOut();
                  }}
                  className="block w-full text-left px-3 py-2 rounded-md text-base font-medium text-gray-700 hover:bg-gray-50 hover:text-gray-900 dark:text-gray-300 dark:hover:bg-gray-700 dark:hover:text-gray-100 min-h-[44px]"
                >
                  Sign out
                </button>
              </div>
            </div>
          </div>
        )}
      </nav>
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}

