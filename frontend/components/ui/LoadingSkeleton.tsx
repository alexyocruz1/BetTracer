'use client';

// Simple loading spinner
export const LoadingSpinner = ({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg'; className?: string }) => {
  const sizeClasses = {
    sm: 'h-4 w-4',
    md: 'h-8 w-8',
    lg: 'h-12 w-12',
  };

  return (
    <div className={`inline-block animate-spin rounded-full border-b-2 border-primary-600 dark:border-primary-400 ${sizeClasses[size]} ${className}`} />
  );
};

// Full page loading skeleton
export const PageLoadingSkeleton = ({ message = 'Loading...' }: { message?: string }) => {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-gray-900 px-4">
      <div className="text-center">
        <LoadingSpinner size="lg" className="mx-auto" />
        <p className="mt-4 text-gray-600 dark:text-gray-400 text-sm sm:text-base">{message}</p>
      </div>
    </div>
  );
};

// Card loading skeleton
export const CardSkeleton = ({ className = '' }: { className?: string }) => {
  return (
    <div className={`bg-white dark:bg-gray-800 shadow rounded-lg p-6 animate-pulse ${className}`}>
      <div className="h-5 bg-gray-200 dark:bg-gray-700 rounded w-3/4 mb-4"></div>
      <div className="space-y-3">
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-full"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-5/6"></div>
        <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-4/6"></div>
      </div>
    </div>
  );
};

// Table loading skeleton
export const TableSkeleton = ({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) => {
  return (
    <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
      <div className="animate-pulse">
        {/* Header */}
        <div className="bg-gray-50 dark:bg-gray-900 px-6 py-3 border-b border-gray-200 dark:border-gray-700">
          <div className="flex space-x-4">
            {Array.from({ length: cols }).map((_, i) => (
              <div key={i} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
            ))}
          </div>
        </div>
        {/* Rows */}
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {Array.from({ length: rows }).map((_, rowIdx) => (
            <div key={rowIdx} className="px-6 py-4">
              <div className="flex space-x-4">
                {Array.from({ length: cols }).map((_, colIdx) => (
                  <div key={colIdx} className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-24"></div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// Summary cards loading skeleton
export const SummaryCardsSkeleton = () => {
  return (
    <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg p-5 animate-pulse border border-gray-200 dark:border-gray-700">
          <div className="h-8 bg-gray-200 dark:bg-gray-700 rounded w-24 mb-2"></div>
          <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-32"></div>
        </div>
      ))}
    </div>
  );
};

// Inline loading with spinner and text
export const InlineLoading = ({ message = 'Loading...', className = '' }: { message?: string; className?: string }) => {
  return (
    <div className={`flex items-center justify-center py-12 ${className}`}>
      <div className="text-center">
        <LoadingSpinner className="mx-auto" />
        <p className="mt-4 text-gray-600 dark:text-gray-400 text-sm">{message}</p>
      </div>
    </div>
  );
};
