'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { MainBet, ReferenceItem } from '@/types';
import Link from 'next/link';
import { TableSkeleton } from '@/components/ui/LoadingSkeleton';

export default function BetsPage() {
  const [bets, setBets] = useState<MainBet[]>([]);
  const [loading, setLoading] = useState(true);
  const [referenceItems, setReferenceItems] = useState<Map<string, ReferenceItem>>(new Map());
  const [totalBets, setTotalBets] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [limit] = useState(20);
  
  // Filters
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [stateFilter, setStateFilter] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    let requestCompleted = false;

    // Safety timeout to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      if (!requestCompleted && !cancelled) {
        requestCompleted = true;
        console.error('[Bets] Request timeout - forcing completion');
        setBets([]);
        setLoading(false);
      }
    }, 60000); // 60 second safety timeout (increased to account for Render sleep time)
    
    const fetchReferenceItems = async () => {
      try {
        const { data } = await apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?limit=1000');
        const itemsMap = new Map<string, ReferenceItem>();
        data.data.forEach(item => {
          itemsMap.set(item.id, item);
        });
        if (!cancelled) {
          setReferenceItems(itemsMap);
        }
      } catch (error) {
        console.error('Failed to fetch reference items:', error);
      }
    };
    
    const fetchBets = async () => {
      try {
        await fetchReferenceItems();
        if (requestCompleted || cancelled) return;

        const offset = (currentPage - 1) * limit;
        const params = new URLSearchParams({
          limit: limit.toString(),
          offset: offset.toString(),
        });

        if (startDate) {
          params.append('start_date', new Date(startDate).toISOString());
        }
        if (endDate) {
          // Set end date to end of day
          const endDateTime = new Date(endDate);
          endDateTime.setHours(23, 59, 59, 999);
          params.append('end_date', endDateTime.toISOString());
        }
        if (stateFilter) {
          params.append('state', stateFilter);
        }

        const betsRes = await apiClient.get<{ 
          data: MainBet[];
          meta?: { pagination: { total: number; totalPages: number; page: number; limit: number } };
        }>(`/api/bets?${params.toString()}`);
        
        if (requestCompleted || cancelled) return;

        const betsData = betsRes.data.data || [];
        const pagination = betsRes.data.meta?.pagination;

        requestCompleted = true;
        clearTimeout(timeoutId);
        setBets(betsData);
        setTotalBets(pagination?.total || 0);
        setTotalPages(pagination?.totalPages || 1);
        setLoading(false);
      } catch (error) {
        if (requestCompleted || cancelled) return;
        
        requestCompleted = true;
        clearTimeout(timeoutId);
        console.error('Failed to fetch bets:', error);
        setBets([]);
        setLoading(false);
      } finally {
        // Ensure loading is always set to false, even if timeout already fired
        if (!cancelled && !requestCompleted) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    };
    
    fetchBets();
    
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [currentPage, startDate, endDate, stateFilter, limit]);

  const getReferenceName = (id?: string): string => {
    if (!id) return '';
    const item = referenceItems.get(id);
    return item?.name || '';
  };

  const getResponsiblesForBet = (bet: MainBet): string[] => {
    if (!bet.legs || bet.legs.length === 0) return [];
    const responsibleIds = bet.legs
      .map(leg => leg.responsible_id)
      .filter((id): id is string => !!id);
    const uniqueIds = [...new Set(responsibleIds)];
    return uniqueIds.map(id => getReferenceName(id)).filter(name => name !== '');
  };

  const getUniqueMatchesForBet = (bet: MainBet): string[] => {
    if (!bet.legs || bet.legs.length === 0) return [];
    
    // Create unique match identifiers
    const matchesMap = new Map<string, { homeTeam: string; awayTeam: string }>();
    
    bet.legs.forEach(leg => {
      // Only add if both teams are present
      if (leg.home_team_id && leg.away_team_id) {
        // Create a unique key for the match (sorted to handle potential duplicates with swapped teams)
        const matchKey = [leg.home_team_id, leg.away_team_id].sort().join('-');
        
        if (!matchesMap.has(matchKey)) {
          const homeTeam = getReferenceName(leg.home_team_id);
          const awayTeam = getReferenceName(leg.away_team_id);
          
          if (homeTeam && awayTeam) {
            matchesMap.set(matchKey, { homeTeam, awayTeam });
          }
        }
      }
    });
    
    // Convert to array of match strings
    return Array.from(matchesMap.values()).map(
      ({ homeTeam, awayTeam }) => `${homeTeam} vs ${awayTeam}`
    );
  };

  const handlePageChange = (page: number) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleFilterChange = () => {
    setCurrentPage(1); // Reset to first page when filters change
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setStateFilter('');
    setCurrentPage(1);
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4 animate-pulse"></div>
          <div className="flex flex-wrap gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-10 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse"></div>
            ))}
          </div>
        </div>
        <TableSkeleton rows={8} cols={6} />
      </div>
    );
  }

  // Calculate page range for pagination buttons
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 7;
    
    if (totalPages <= maxVisible) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('...');
        for (let i = totalPages - 4; i <= totalPages; i++) {
          pages.push(i);
        }
      } else {
        pages.push(1);
        pages.push('...');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) {
          pages.push(i);
        }
        pages.push('...');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6 flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Bets</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            View and manage your bets
            {totalBets > 0 && (
              <span className="block sm:inline sm:ml-2 text-gray-500 mt-1 sm:mt-0">
                (Showing {((currentPage - 1) * limit) + 1}-{Math.min(currentPage * limit, totalBets)} of {totalBets})
              </span>
            )}
          </p>
        </div>
        <Link
          href="/bets/new"
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 min-h-[44px] w-full sm:w-auto"
        >
          New Bet
        </Link>
      </div>

      {/* Filters */}
      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
            <input
              type="date"
              title="Start Date"
              value={startDate}
              onChange={(e) => {
                setStartDate(e.target.value);
                handleFilterChange();
              }}
              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
            <input
              type="date"
              title="End Date"
              value={endDate}
              onChange={(e) => {
                setEndDate(e.target.value);
                handleFilterChange();
              }}
              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent min-h-[44px]"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">State</label>
            <select
              title="State"
              value={stateFilter}
              onChange={(e) => {
                setStateFilter(e.target.value);
                handleFilterChange();
              }}
              className="block w-full border border-gray-300 dark:border-gray-600 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-white bg-white dark:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-primary-500 dark:focus:ring-primary-400 focus:border-transparent min-h-[44px]"
            >
              <option value="">All States</option>
              <option value="pending">Pending</option>
              <option value="won">Won</option>
              <option value="lost">Lost</option>
              <option value="void">Void</option>
            </select>
          </div>
          {(startDate || endDate || stateFilter) && (
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

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {bets.map((bet) => {
          const responsibles = getResponsiblesForBet(bet);
          const matches = getUniqueMatchesForBet(bet);
          const profitLoss = bet.profit_loss !== null && bet.profit_loss !== undefined ? bet.profit_loss : null;
          const isProfit = profitLoss !== null && profitLoss >= 0;
          const isLoss = profitLoss !== null && profitLoss < 0;
          
          const getStateConfig = () => {
            switch (bet.state) {
              case 'won':
                return {
                  bg: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800',
                  badge: 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300',
                  icon: (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                  ),
                };
              case 'lost':
                return {
                  bg: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
                  badge: 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300',
                  icon: (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ),
                };
              case 'void':
                return {
                  bg: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
                  badge: 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300',
                  icon: (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  ),
                };
              default:
                return {
                  bg: 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800',
                  badge: 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300',
                  icon: (
                    <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                    </svg>
                  ),
                };
            }
          };

          const stateConfig = getStateConfig();

          return (
            <Link
              key={bet.id}
              href={`/bets/${bet.id}`}
              className={`block bg-white dark:bg-gray-800 rounded-lg border-2 ${stateConfig.bg} shadow-sm hover:shadow-md transition-all duration-200 hover:scale-[1.01] overflow-hidden`}
            >
              <div className="p-5">
                {/* Header Row */}
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-lg ${stateConfig.badge}`}>
                      {stateConfig.icon}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold ${stateConfig.badge}`}>
                          {bet.state.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                        {new Date(bet.date).toLocaleDateString('en-US', { 
                          month: 'short', 
                          day: 'numeric', 
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </div>
                    </div>
                  </div>
                  {profitLoss !== null && (
                    <div className={`text-right ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                      <div className="text-xs font-medium mb-1">P/L</div>
                      <div className={`text-2xl font-bold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                        {isProfit ? '+' : ''}${profitLoss.toFixed(2)}
                      </div>
                    </div>
                  )}
                </div>

                {/* Matches */}
                {matches.length > 0 && (
                  <div className="mb-3 pb-3 border-b border-gray-200 dark:border-gray-700">
                    <div className="flex flex-wrap gap-1.5">
                      {matches.map((match, index) => (
                        <span
                          key={index}
                          className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300"
                        >
                          {match}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* Main Stats Grid */}
                <div className="grid grid-cols-3 gap-2 sm:gap-4 mb-4">
                  <div className="bg-white/60 dark:bg-gray-700/60 rounded-lg p-2 sm:p-3 border border-gray-200 dark:border-gray-600">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Stake</div>
                    <div className="text-sm sm:text-lg font-bold text-gray-900 dark:text-gray-100">${bet.stake.toFixed(2)}</div>
                  </div>
                  <div className="bg-white/60 dark:bg-gray-700/60 rounded-lg p-2 sm:p-3 border border-gray-200 dark:border-gray-600">
                    <div className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Odds</div>
                    <div className="text-sm sm:text-lg font-bold text-primary-600 dark:text-primary-400">{bet.odds?.toFixed(2)}x</div>
                  </div>
                  <div className="bg-white/60 dark:bg-gray-700/60 rounded-lg p-2 sm:p-3 border border-gray-200 dark:border-gray-600">
                    <div className="text-xs font-medium text-gray-500 mb-1">Legs</div>
                    <div className="text-sm sm:text-lg font-bold text-gray-900">{bet.legs?.length || 0}</div>
                  </div>
                </div>

                {/* Footer Info */}
                <div className="flex items-center justify-between pt-3 border-t border-gray-200">
                  {responsibles.length > 0 ? (
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                      <span className="font-medium text-gray-700">{responsibles.join(', ')}</span>
                    </div>
                  ) : (
                    <div className="text-sm text-gray-400">No responsible assigned</div>
                  )}
                  {profitLoss === null && (
                    <div className="text-sm text-gray-400 italic">Pending result</div>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>
      {bets.length === 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 border-dashed border-gray-200 dark:border-gray-700 text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-white">No bets found</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            Get started by creating your first bet.
          </p>
          <div className="mt-6">
            <Link
              href="/bets/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
            >
              Create your first bet
            </Link>
          </div>
        </div>
      )}

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
                Showing <span className="font-medium">{((currentPage - 1) * limit) + 1}</span> to{' '}
                <span className="font-medium">{Math.min(currentPage * limit, totalBets)}</span> of{' '}
                <span className="font-medium">{totalBets}</span> results
              </p>
            </div>
            <div>
              <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                <button
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  className="relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Previous</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
                {getPageNumbers().map((page, index) => (
                  page === '...' ? (
                    <span key={`ellipsis-${index}`} className="relative inline-flex items-center px-4 py-2 border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-300">
                      ...
                    </span>
                  ) : (
                    <button
                      key={page}
                      onClick={() => handlePageChange(page as number)}
                      className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                        currentPage === page
                          ? 'z-10 bg-primary-50 dark:bg-primary-900/30 border-primary-500 dark:border-primary-400 text-primary-600 dark:text-primary-400'
                          : 'bg-white dark:bg-gray-700 border-gray-300 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600'
                      }`}
                    >
                      {page}
                    </button>
                  )
                ))}
                <button
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  className="relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 text-sm font-medium text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span className="sr-only">Next</span>
                  <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                  </svg>
                </button>
              </nav>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

