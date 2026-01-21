'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ReferenceItem } from '@/types';
import { InlineLoading, TableSkeleton } from '@/components/ui/LoadingSkeleton';

type ReferenceItemKind = 'team' | 'league' | 'bet_type' | 'category' | 'responsible';

export default function AdminPage() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<ReferenceItemKind>('league');
  const [items, setItems] = useState<ReferenceItem[]>([]);
  const [loading, setLoading] = useState(true); // Start as true to show loading initially
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null); // Error for fetching list
  const [submitError, setSubmitError] = useState<string | null>(null); // Error for submitting form
  const [formData, setFormData] = useState({
    name: '',
    metadata: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 100,
    total: 0,
    totalPages: 1,
  });
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/');
      return;
    }
    if (isAdmin && !authLoading) {
      // Reset form when switching tabs
      setFormData({ name: '', metadata: '' });
      setSubmitError(null);
      // Reset pagination when switching tabs
      setPagination({ page: 1, limit: 100, total: 0, totalPages: 1 });
      // Fetch items for the current tab
      fetchItems(1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, authLoading, activeTab]);

  const fetchItems = async (page: number = 1, limitOverride?: number) => {
    console.log('fetchItems called for:', activeTab, 'page:', page);
    setLoading(true);
    setError(null);
    
    const limit = limitOverride || pagination.limit;
    const offset = (page - 1) * limit;
    
    // Create a timeout promise to prevent infinite hanging
    let requestCompleted = false;
    const timeoutId = setTimeout(() => {
      if (!requestCompleted) {
        requestCompleted = true;
        console.error('[Admin] Request timeout - forcing completion');
        setError('Request timed out. Please check your connection and try again.');
        setItems([]);
        setLoading(false);
      }
    }, 60000); // 60 second safety timeout (increased to account for Render sleep time)
    
    try {
      console.log('Fetching items for kind:', activeTab, 'offset:', offset, 'limit:', limit);
      console.log('[Admin] API URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
      
      const response = await apiClient.get<{ data: ReferenceItem[]; meta?: { pagination: { page: number; limit: number; total: number; totalPages: number } } }>(
        `/api/reference-items?kind=${activeTab}&limit=${limit}&offset=${offset}`
      );
      
      if (requestCompleted) {
        // Timeout already fired, ignore response
        return;
      }
      
      requestCompleted = true;
      clearTimeout(timeoutId);
      
      console.log('Fetch items response:', response);
      console.log('Response data:', response.data);
      
      // API returns { data: items[], meta: { pagination: {...} } }
      const items = response.data?.data || [];
      const paginationMeta = response.data?.meta?.pagination;
      
      console.log('Items received:', items.length, items);
      setItems(Array.isArray(items) ? items : []);
      
      // Update pagination state
      if (paginationMeta) {
        setPagination({
          page: paginationMeta.page,
          limit: paginationMeta.limit,
          total: paginationMeta.total,
          totalPages: paginationMeta.totalPages,
        });
      }
      
      setLoading(false);
    } catch (error: any) {
      if (requestCompleted) {
        // Timeout already handled it
        return;
      }
      
      requestCompleted = true;
      clearTimeout(timeoutId);
      
      console.error('Failed to fetch items:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        status: error.response?.status,
        code: error.code,
        config: error.config ? {
          url: error.config.url,
          method: error.config.method,
          baseURL: error.config.baseURL,
        } : null,
      });
      
      // Check for timeout errors
      if (error.message?.includes('timeout') || error.code === 'ECONNABORTED') {
        setError('Request timed out. Please check your connection and try again.');
      } else if (error.response?.status === 401) {
        setError('Authentication failed. Please sign in again.');
      } else {
        const errorMessage = error.response?.data?.error?.message || error.message || 'Failed to load items';
        setError(errorMessage);
      }
      
      // Set empty array on error
      setItems([]);
      setLoading(false);
    } finally {
      // Ensure loading is always set to false, even if timeout already fired
      if (!requestCompleted) {
        console.log('Setting loading to false (fallback)');
        setLoading(false);
      }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      setSubmitError('Name is required');
      return;
    }

    // Capture current tab value to avoid stale closure
    const currentTab = activeTab;
    console.log('Submitting with tab:', currentTab, 'formData:', formData);

    setSubmitting(true);
    setSubmitError(null);
    setError(null); // Clear list error too
    try {
      let metadata: Record<string, unknown> = {};
      const metadataString = formData.metadata?.trim() || '';
      if (metadataString) {
        try {
          metadata = JSON.parse(metadataString);
          // Ensure it's an object
          if (typeof metadata !== 'object' || metadata === null || Array.isArray(metadata)) {
            throw new Error('Metadata must be an object');
          }
        } catch (parseError) {
          setSubmitError('Invalid JSON in metadata field. Use format: {"key": "value"}');
          setSubmitting(false);
          return;
        }
      }

      // Ensure metadata is properly formatted
      const requestData = {
        kind: currentTab,
        name: formData.name.trim(),
        metadata: Object.keys(metadata).length > 0 ? metadata : {},
      };
      
      console.log('Sending request with:', requestData);
      const response = await apiClient.post('/api/reference-items', requestData);

      console.log('Item added successfully:', response.data);

      // Reset form and clear errors
      setFormData({ name: '', metadata: '' });
      setSubmitError(null);
      
      // Refresh list for the current tab (use captured tab value)
      // Don't await - let it happen in background
      const refreshPromise = fetchItems(pagination.page);
      refreshPromise.catch((err) => {
        console.error('Error refreshing list:', err);
        // Don't show error to user, just log it
      });
      
      // Focus back on the name input for quick entry of next item
      setTimeout(() => {
        const nameInput = document.querySelector('input[type="text"]') as HTMLInputElement;
        if (nameInput) {
          nameInput.focus();
        }
      }, 100);
    } catch (error: any) {
      console.error('Error adding item:', error);
      // Extract a user-friendly error message
      let errorMessage = 'Failed to add item';
      
      if (error.response?.data?.error?.message) {
        errorMessage = error.response.data.error.message;
      } else if (error.response?.status === 409) {
        errorMessage = 'This item already exists (case-insensitive)';
      } else if (error.message) {
        // Handle network errors more gracefully
        if (error.message.includes('Network Error') || error.message.includes('timeout')) {
          errorMessage = 'Unable to connect to server. Please check your connection and try again.';
        } else {
          errorMessage = error.message;
        }
      }
      
      setSubmitError(errorMessage);
    } finally {
      // Always reset submitting state, even if there's an error
      setSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <InlineLoading message="Checking permissions..." />
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white mb-4">Access Denied</h1>
        <p className="text-gray-600 dark:text-gray-400">You need admin privileges to access this page.</p>
      </div>
    );
  }

  const tabs: { id: ReferenceItemKind; label: string }[] = [
    { id: 'league', label: 'Leagues' },
    { id: 'team', label: 'Teams' },
    { id: 'bet_type', label: 'Bet Types' },
    { id: 'category', label: 'Categories' },
    { id: 'responsible', label: 'Responsibles' },
  ];

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Admin Panel</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage reference items: leagues, teams, bet types, categories, and responsibles
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6 overflow-x-auto overflow-y-hidden">
        <nav className="-mb-px flex space-x-4 sm:space-x-8 min-w-max sm:min-w-0">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-3 border-b-2 font-medium text-sm whitespace-nowrap flex-shrink-0 min-h-[44px] flex items-center ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Add New Item Form */}
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Add New {tabs.find((t) => t.id === activeTab)?.label.slice(0, -1)}
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4" key={activeTab}>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                onKeyDown={(e) => {
                  // Clear error when user starts typing
                  if (submitError) {
                    setSubmitError(null);
                  }
                }}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900"
                placeholder={`Enter ${activeTab} name`}
                required
                autoFocus
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700">
                Metadata (JSON - optional)
              </label>
              <textarea
                value={formData.metadata}
                onChange={(e) => setFormData({ ...formData, metadata: e.target.value })}
                rows={4}
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2.5 font-mono text-base sm:text-sm"
                placeholder='{"key": "value"}'
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional JSON metadata. Example: {"{"}"country": "USA", "tier": 1{"}"}
              </p>
            </div>
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600 font-medium mb-1">Error:</p>
                <p className="text-sm text-red-700 whitespace-pre-wrap break-words">{submitError}</p>
                {submitError.includes('already exists') && (
                  <p className="text-xs text-red-600 mt-2">
                    💡 Tip: Use the search box on the right to find existing items before adding.
                  </p>
                )}
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !formData.name.trim()}
              className="w-full px-4 py-3 border border-transparent rounded-md shadow-sm text-base sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px]"
            >
              {submitting ? 'Adding...' : 'Add Item'}
            </button>
          </form>
        </div>

        {/* Existing Items List */}
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 gap-2">
            <h2 className="text-xl font-bold text-gray-900">
              Existing {tabs.find((t) => t.id === activeTab)?.label}
            </h2>
            {pagination.total > 0 && (
              <span className="text-sm font-normal text-gray-500">
                ({pagination.total} total, showing {items.length} on page {pagination.page} of {pagination.totalPages})
              </span>
            )}
          </div>
          
          {/* Search/Filter */}
          <div className="mb-4">
            <input
              type="text"
              placeholder={`Search ${activeTab}s...`}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          {loading ? (
            <div className="py-8">
              <TableSkeleton rows={5} cols={3} />
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-3 font-medium">{error}</div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  fetchItems(pagination.page);
                }}
                className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-500 dark:text-gray-400">
              No {activeTab}s found. Add one using the form on the left.
            </div>
          ) : (
            <>
              <div className="space-y-2 max-h-96 overflow-y-auto mb-4">
                {items
                  .filter((item) => {
                    if (!searchQuery.trim()) return true;
                    const query = searchQuery.toLowerCase();
                    return (
                      item.name.toLowerCase().includes(query) ||
                      (item.metadata && JSON.stringify(item.metadata).toLowerCase().includes(query))
                    );
                  })
                  .map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center p-3 border border-gray-200 rounded-md hover:bg-gray-50"
                    >
                      <div>
                        <div className="font-medium text-gray-900">{item.name}</div>
                        {item.metadata && Object.keys(item.metadata).length > 0 && (
                          <div className="text-xs text-gray-500 mt-1">
                            {JSON.stringify(item.metadata)}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                {searchQuery.trim() && items.filter((item) => {
                  const query = searchQuery.toLowerCase();
                  return (
                    item.name.toLowerCase().includes(query) ||
                    (item.metadata && JSON.stringify(item.metadata).toLowerCase().includes(query))
                  );
                }).length === 0 && (
                  <div className="text-center py-8 text-gray-500">
                    No items match "{searchQuery}"
                  </div>
                )}
              </div>
              
              {/* Pagination Controls */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4 border-t border-gray-200 pt-4">
                <div className="flex items-center gap-2 flex-wrap">
                  {pagination.totalPages > 1 && (
                    <>
                      <button
                        type="button"
                        onClick={() => fetchItems(pagination.page - 1)}
                        disabled={pagination.page === 1 || loading}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
                      >
                        Previous
                      </button>
                      <span className="text-sm text-gray-700">
                        Page {pagination.page} of {pagination.totalPages}
                      </span>
                      <button
                        type="button"
                        onClick={() => fetchItems(pagination.page + 1)}
                        disabled={pagination.page >= pagination.totalPages || loading}
                        className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0"
                      >
                        Next
                      </button>
                    </>
                  )}
                  {pagination.totalPages === 1 && pagination.total > 0 && (
                    <span className="text-sm text-gray-500">
                      Showing all {pagination.total} items
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className="text-sm text-gray-500 whitespace-nowrap">Items per page:</span>
                  <select
                    value={pagination.limit}
                    onChange={(e) => {
                      const newLimit = Number(e.target.value);
                      setPagination({ ...pagination, limit: newLimit, page: 1 });
                      fetchItems(1, newLimit);
                    }}
                    className="text-sm border border-gray-300 rounded-md px-2 py-1 text-base sm:text-sm min-h-[44px] sm:min-h-0"
                    disabled={loading}
                  >
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                    <option value={200}>200</option>
                    <option value={500}>500</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

