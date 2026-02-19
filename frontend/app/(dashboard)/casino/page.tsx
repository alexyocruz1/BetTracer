'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { CasinoEarning } from '@/types';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';

export default function CasinoPage() {
  const [earnings, setEarnings] = useState<CasinoEarning[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(20);
  const [showAddForm, setShowAddForm] = useState(false);

  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [typeFilter, setTypeFilter] = useState<string>('');

  // Form state
  const [formData, setFormData] = useState({
    date: new Date().toISOString(),
    amount: 0,
    source: '',
    type: 'casino_bet' as const,
    notes: '',
  });
  const [amountInput, setAmountInput] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchEarnings();
  }, [currentPage, startDate, endDate, typeFilter]);

  const fetchEarnings = async () => {
    try {
      setLoading(true);
      const offset = (currentPage - 1) * limit;
      const params = new URLSearchParams({
        limit: limit.toString(),
        offset: offset.toString(),
      });

      if (startDate) {
        params.append('start_date', new Date(startDate).toISOString());
      }
      if (endDate) {
        const endDateTime = new Date(endDate);
        endDateTime.setHours(23, 59, 59, 999);
        params.append('end_date', endDateTime.toISOString());
      }
      if (typeFilter) {
        params.append('type', typeFilter);
      }

      const [earningsRes, totalRes] = await Promise.all([
        apiClient.get<{
          data: CasinoEarning[];
          meta?: { pagination: { total: number; totalPages: number; page: number; limit: number } };
        }>(`/api/casino-earnings?${params.toString()}`),
        apiClient.get<{ data: { total: number } }>('/api/casino-earnings/total'),
      ]);

      const earningsData = earningsRes.data.data || [];
      const pagination = earningsRes.data.meta?.pagination;

      setEarnings(earningsData);
      setTotalPages(pagination?.totalPages || 1);
      setTotalEarnings(totalRes.data.data.total);
    } catch (error) {
      console.error('Failed to fetch casino earnings:', error);
      setEarnings([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (saving) return;

    setSaving(true);
    try {
      await apiClient.post('/api/casino-earnings', formData);
      setShowAddForm(false);
      resetForm();
      fetchEarnings();
    } catch (error: any) {
      console.error('Failed to create casino earning:', error);
      alert(error.response?.data?.error?.message || error.message || 'Failed to add casino earning');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this casino earning?')) return;

    try {
      await apiClient.delete(`/api/casino-earnings/${id}`);
      fetchEarnings();
    } catch (error: any) {
      console.error('Failed to delete casino earning:', error);
      alert(error.response?.data?.error?.message || 'Failed to delete casino earning');
    }
  };

  const resetForm = () => {
    setFormData({
      date: new Date().toISOString(),
      amount: 0,
      source: '',
      type: 'casino_bet',
      notes: '',
    });
    setAmountInput('');
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFilterChange = () => {
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setTypeFilter('');
    setCurrentPage(1);
  };

  const getTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      casino_bet: 'Casino Bet',
      daily_bonus: 'Daily Bonus',
      free_spins: 'Free Spins',
      cashback: 'Cashback',
      promotion: 'Promotion',
      other: 'Other',
    };
    return labels[type] || type;
  };

  const getTypeBadgeColor = (type: string) => {
    const colors: Record<string, string> = {
      casino_bet: 'bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300',
      daily_bonus: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
      free_spins: 'bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300',
      cashback: 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300',
      promotion: 'bg-pink-100 dark:bg-pink-900/30 text-pink-800 dark:text-pink-300',
      other: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
    };
    return colors[type] || colors.other;
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4 animate-pulse"></div>
        <TableSkeleton rows={8} cols={5} />
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Casino Earnings</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Track your casino winnings, bonuses, and other gambling income
          </p>
          <div className="mt-3 inline-flex items-center px-4 py-2 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
            <span className="text-sm font-medium text-gray-600 dark:text-gray-400 mr-2">Total Earnings:</span>
            <span className={`text-xl font-bold ${totalEarnings >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
              {totalEarnings >= 0 ? '+' : ''}${totalEarnings.toFixed(2)}
            </span>
          </div>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 min-h-[44px] w-full sm:w-auto"
        >
          {showAddForm ? 'Cancel' : '+ Add Earning'}
        </button>
      </div>

      {/* Add Form */}
      {showAddForm && (
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6 mb-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Add Casino Earning</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label htmlFor="earning-date" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Date *</label>
                <input
                  id="earning-date"
                  type="datetime-local"
                  value={(() => {
                    const date = new Date(formData.date);
                    const year = date.getFullYear();
                    const month = String(date.getMonth() + 1).padStart(2, '0');
                    const day = String(date.getDate()).padStart(2, '0');
                    const hours = String(date.getHours()).padStart(2, '0');
                    const minutes = String(date.getMinutes()).padStart(2, '0');
                    return `${year}-${month}-${day}T${hours}:${minutes}`;
                  })()}
                  onChange={(e) => {
                    const localDateString = e.target.value;
                    if (localDateString) {
                      const [datePart, timePart] = localDateString.split('T');
                      const [year, month, day] = datePart.split('-').map(Number);
                      const [hours, minutes] = timePart.split(':').map(Number);
                      const localDate = new Date(year, month - 1, day, hours, minutes);
                      setFormData({ ...formData, date: localDate.toISOString() });
                    }
                  }}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-h-[44px]"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Amount *</label>
                <input
                  type="text"
                  inputMode="decimal"
                  pattern="-?[0-9]*\.?[0-9]*"
                  value={amountInput}
                  onChange={(e) => {
                    const value = e.target.value;
                    if (value === '' || value === '-' || /^-?\d*\.?\d*$/.test(value)) {
                      setAmountInput(value);
                      const numValue = value === '' || value === '-' || value === '.' || value === '-.' ? 0 : parseFloat(value);
                      if (!isNaN(numValue)) {
                        setFormData({ ...formData, amount: numValue });
                      }
                    }
                  }}
                  placeholder="100.00 (use negative for losses)"
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-h-[44px]"
                  required
                />
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  Enter positive for winnings, negative for losses
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Source *</label>
                <input
                  type="text"
                  value={formData.source}
                  onChange={(e) => setFormData({ ...formData, source: e.target.value })}
                  placeholder="e.g., Blackjack, Slots, Daily Reward"
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-h-[44px]"
                  required
                />
              </div>
              <div>
                <label htmlFor="earning-type" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type *</label>
                <select
                  id="earning-type"
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value as any })}
                  className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-h-[44px]"
                  required
                >
                  <option value="casino_bet">Casino Bet</option>
                  <option value="daily_bonus">Daily Bonus</option>
                  <option value="free_spins">Free Spins</option>
                  <option value="cashback">Cashback</option>
                  <option value="promotion">Promotion</option>
                  <option value="other">Other</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Notes (optional)</label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={2}
                className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700"
                placeholder="Add any notes..."
              />
            </div>

            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => {
                  setShowAddForm(false);
                  resetForm();
                }}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-md text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px]"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 min-h-[44px]"
              >
                {saving ? 'Saving...' : 'Add Earning'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                handleFilterChange();
              }}
              aria-label="Filter start date"
              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                handleFilterChange();
              }}
              aria-label="Filter end date"
              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Type</label>
            <select
              value={typeFilter}
              onChange={(e) => {
                setTypeFilter(e.target.value);
                handleFilterChange();
              }}
              aria-label="Filter by type"
              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 min-h-[44px]"
            >
              <option value="">All Types</option>
              <option value="casino_bet">Casino Bet</option>
              <option value="daily_bonus">Daily Bonus</option>
              <option value="free_spins">Free Spins</option>
              <option value="cashback">Cashback</option>
              <option value="promotion">Promotion</option>
              <option value="other">Other</option>
            </select>
          </div>
          {(startDate || endDate || typeFilter) && (
            <div className="flex items-end">
              <button
                onClick={clearFilters}
                className="w-full px-4 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px]"
              >
                Clear Filters
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Earnings List */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-900">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Source
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {earnings.map((earning) => (
                <tr key={earning.id} className="hover:bg-gray-50 dark:hover:bg-gray-700">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {new Date(earning.date).toLocaleDateString('en-US', {
                      month: 'short',
                      day: 'numeric',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">
                    {earning.source}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getTypeBadgeColor(earning.type)}`}>
                      {getTypeLabel(earning.type)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <span className={`font-semibold ${earning.amount >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                      {earning.amount >= 0 ? '+' : ''}${earning.amount.toFixed(2)}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 dark:text-gray-400 max-w-xs truncate">
                    {earning.notes || '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <button
                      onClick={() => handleDelete(earning.id)}
                      className="text-red-600 hover:text-red-800 dark:text-red-400 dark:hover:text-red-300"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {earnings.length === 0 && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No casino earnings found</h3>
            <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
              Get started by adding your first casino earning.
            </p>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="bg-white dark:bg-gray-800 px-4 py-3 flex items-center justify-between border-t border-gray-200 dark:border-gray-700 sm:px-6 mt-6 rounded-lg shadow">
          <div className="flex-1 flex justify-between sm:hidden">
            <button
              onClick={() => handlePageChange(currentPage - 1)}
              disabled={currentPage === 1}
              className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => handlePageChange(currentPage + 1)}
              disabled={currentPage === totalPages}
              className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md text-gray-700 dark:text-gray-300 bg-white dark:bg-gray-700 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
          <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
            <div>
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Previous
                </button>
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
