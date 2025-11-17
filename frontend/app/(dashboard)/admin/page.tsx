'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/auth-context';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ReferenceItem } from '@/types';

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

  useEffect(() => {
    if (!authLoading && !isAdmin) {
      router.push('/');
      return;
    }
    if (isAdmin && !authLoading) {
      // Reset form when switching tabs
      setFormData({ name: '', metadata: '' });
      setSubmitError(null);
      // Fetch items for the current tab
      fetchItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAdmin, authLoading, activeTab]);

  const fetchItems = async () => {
    console.log('fetchItems called for:', activeTab);
    setLoading(true);
    setError(null);
    
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
    }, 20000); // 20 second safety timeout
    
    try {
      console.log('Fetching items for kind:', activeTab);
      console.log('[Admin] API URL:', process.env.NEXT_PUBLIC_BACKEND_URL);
      
      const response = await apiClient.get<{ data: ReferenceItem[] }>(
        `/api/reference-items?kind=${activeTab}&limit=100`
      );
      
      if (requestCompleted) {
        // Timeout already fired, ignore response
        return;
      }
      
      requestCompleted = true;
      clearTimeout(timeoutId);
      
      console.log('Fetch items response:', response);
      console.log('Response data:', response.data);
      
      // API returns { data: items[] }
      const items = response.data?.data || [];
      console.log('Items received:', items.length, items);
      setItems(Array.isArray(items) ? items : []);
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
    } finally {
      if (!requestCompleted) {
        // Only set loading to false if timeout hasn't already done it
        console.log('Setting loading to false');
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
      const refreshPromise = fetchItems();
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
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!isAdmin) {
    return (
      <div className="text-center py-12">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Access Denied</h1>
        <p className="text-gray-600">You need admin privileges to access this page.</p>
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
        <h1 className="text-3xl font-bold text-gray-900">Admin Panel</h1>
        <p className="mt-2 text-sm text-gray-600">
          Manage reference items: leagues, teams, bet types, categories, and responsibles
        </p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
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
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
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
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
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
                className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2 font-mono text-sm"
                placeholder='{"key": "value"}'
              />
              <p className="mt-1 text-xs text-gray-500">
                Optional JSON metadata. Example: {"{"}"country": "USA", "tier": 1{"}"}
              </p>
            </div>
            {submitError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-md">
                <p className="text-sm text-red-600">{submitError}</p>
              </div>
            )}
            <button
              type="submit"
              disabled={submitting || !formData.name.trim()}
              className="w-full px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Adding...' : 'Add Item'}
            </button>
          </form>
        </div>

        {/* Existing Items List */}
        <div className="bg-white shadow rounded-lg p-6">
          <h2 className="text-xl font-bold text-gray-900 mb-4">
            Existing {tabs.find((t) => t.id === activeTab)?.label} ({items.length})
          </h2>
          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading...</div>
          ) : error ? (
            <div className="text-center py-8">
              <div className="text-red-600 mb-3 font-medium">{error}</div>
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  fetchItems();
                }}
                className="px-4 py-2 text-sm text-white bg-primary-600 hover:bg-primary-700 rounded-md transition-colors"
              >
                Try again
              </button>
            </div>
          ) : items.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              No {activeTab}s found. Add one using the form on the left.
            </div>
          ) : (
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {items.map((item) => (
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
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

