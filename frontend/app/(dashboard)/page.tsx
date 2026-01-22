'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { AnalyticsSummary, MainBet, StreakAnalysis, BestWorstPerformers, TimeSeriesData } from '@/types';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useTheme } from '@/contexts/theme-context';
import { InlineLoading, SummaryCardsSkeleton, CardSkeleton } from '@/components/ui/LoadingSkeleton';

export default function DashboardPage() {
  const { theme } = useTheme();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [recentBets, setRecentBets] = useState<MainBet[]>([]);
  const [streakAnalysis, setStreakAnalysis] = useState<StreakAnalysis | null>(null);
  const [bestWorst, setBestWorst] = useState<BestWorstPerformers | null>(null);
  const [timeSeries, setTimeSeries] = useState<(TimeSeriesData & { cumulative_profit: number })[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let requestCompleted = false;
    let retryCount = 0;
    const MAX_RETRIES = 2;

    const fetchWithRetry = async () => {
      if (cancelled) return;
      
      try {
        // Fetch all dashboard data in parallel
        // Calculate date 30 days ago
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const startDate = thirtyDaysAgo.toISOString().split('T')[0];

        // Add cache-busting timestamp for critical requests
        const cacheBuster = `?t=${Date.now()}`;
        const summaryUrl = `/api/analytics/summary${cacheBuster}`;
        const betsUrl = `/api/bets?limit=5&offset=0&t=${Date.now()}`;
        const streakUrl = `/api/analytics/streak-analysis${cacheBuster}`;
        const bestWorstUrl = `/api/analytics/best-worst-performers${cacheBuster}`;
        const timeSeriesUrl = `/api/analytics/time-series?granularity=daily&start_date=${startDate}&t=${Date.now()}`;

        const [summaryRes, betsRes, streakRes, bestWorstRes, timeSeriesRes] = await Promise.allSettled([
          apiClient.get<{ data: AnalyticsSummary }>(summaryUrl),
          apiClient.get<{ data: { bets: MainBet[]; total: number; totalPages: number } }>(betsUrl),
          apiClient.get<{ data: StreakAnalysis }>(streakUrl),
          apiClient.get<{ data: BestWorstPerformers }>(bestWorstUrl),
          apiClient.get<{ data: TimeSeriesData[] }>(timeSeriesUrl),
        ]);

        if (requestCompleted || cancelled) return;

        if (summaryRes.status === 'fulfilled') {
          setSummary(summaryRes.value.data.data);
        }
        if (betsRes.status === 'fulfilled') {
          setRecentBets(betsRes.value.data.data.bets || []);
        }
        if (streakRes.status === 'fulfilled') {
          setStreakAnalysis(streakRes.value.data.data);
        }
        if (bestWorstRes.status === 'fulfilled') {
          setBestWorst(bestWorstRes.value.data.data);
        }
        if (timeSeriesRes.status === 'fulfilled') {
          const rawData = timeSeriesRes.value.data.data || [];
          // Calculate cumulative profit for the chart
          let cumulative = 0;
          const chartData = rawData.map((item) => {
            cumulative += item.profit;
            return {
              ...item,
              cumulative_profit: cumulative,
            };
          });
          setTimeSeries(chartData);
        }

        requestCompleted = true;
        setLoading(false);
      } catch (error: any) {
        if (cancelled) return;
        
        // Check if it's a timeout or network error
        const isTimeout = error.message?.includes('timeout') || error.code === 'ECONNABORTED';
        const isNetworkError = !error.response && error.message;
        
        if ((isTimeout || isNetworkError) && retryCount < MAX_RETRIES) {
          retryCount++;
          console.warn(`[Dashboard] Request failed (attempt ${retryCount}/${MAX_RETRIES + 1}), retrying in 3 seconds...`);
          // Wait 3 seconds before retry
          await new Promise(resolve => setTimeout(resolve, 3000));
          return fetchWithRetry();
        }
        
        // All retries exhausted or non-retryable error
        console.error('[Dashboard] Failed to fetch dashboard data after retries:', error);
        setSummary(null);
        setLoading(false);
        requestCompleted = true;
      }
    };

    // Safety timeout to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      if (!requestCompleted && !cancelled) {
        requestCompleted = true;
        console.error('[Dashboard] Request timeout after 90 seconds - backend may be waking up. Please refresh if needed.');
        setSummary(null);
        setLoading(false);
      }
    }, 90000); // Increased to 90 seconds to account for Render sleep time

    fetchWithRetry();
    
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <SummaryCardsSkeleton />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <CardSkeleton />
          <CardSkeleton />
        </div>
        <CardSkeleton />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
            Quick overview of your betting performance. For detailed analytics and breakdowns, visit the Analytics page.
          </p>
        </div>
        <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-12 text-center border border-gray-200 dark:border-gray-700">
          <p className="text-gray-500 dark:text-gray-400 mb-4">No betting data available yet.</p>
          <Link
            href="/bets/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600"
          >
            Create Your First Bet
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              Quick overview of your betting performance. For detailed analytics and breakdowns, visit the Analytics page.
            </p>
          </div>
          <Link
            href="/analytics"
            className="text-sm font-medium text-primary-600 hover:text-primary-500 dark:text-primary-400 dark:hover:text-primary-300 min-h-[44px] flex items-center justify-center sm:justify-start"
          >
            View Analytics →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`text-2xl font-bold ${
                  summary.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${summary.total_profit.toFixed(2)}
                </div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Profit</div>
              {summary.cumulative_profit !== summary.total_profit && (
                <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
                  Cumulative: ${summary.cumulative_profit.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{(summary.win_rate * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Win Rate</div>
              <div className="text-xs text-gray-400 mt-1">
                {summary.won_bets}W / {summary.lost_bets}L
                {summary.pending_bets > 0 && ` / ${summary.pending_bets}P`}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className={`text-2xl font-bold ${
                  summary.roi >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  {(summary.roi * 100).toFixed(1)}%
                </div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">ROI</div>
            </div>
          </div>
        </div>

        <div className="bg-white dark:bg-gray-800 overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl font-bold text-gray-900 dark:text-gray-100">{summary.total_bets}</div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-sm font-medium text-gray-500 dark:text-gray-400">Total Bets</div>
              <div className="text-xs text-gray-400 mt-1">
                ${summary.total_stake.toFixed(2)} staked
              </div>
            </div>
          </div>
        </div>
      </div>

      {summary.pending_bets > 0 && (
        <div className="mt-6 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-yellow-600 dark:text-yellow-400 font-semibold">{summary.pending_bets}</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800 dark:text-yellow-300">
                You have {summary.pending_bets} pending bet{summary.pending_bets > 1 ? 's' : ''}. 
                <Link href="/bets" className="ml-1 font-medium underline hover:text-yellow-900">
                  View all bets
                </Link>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Current Streak */}
      {streakAnalysis && streakAnalysis.current_streak.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Current Streak</h2>
            <Link href="/analytics" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300">
              View Details →
            </Link>
          </div>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4">
            <div className={`px-4 py-3 rounded-lg ${
              streakAnalysis.current_streak.type === 'win' ? 'bg-green-50 dark:bg-green-900/20' : 'bg-red-50 dark:bg-red-900/20'
            }`}>
              <div className={`text-2xl sm:text-3xl font-bold ${
                streakAnalysis.current_streak.type === 'win' ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {streakAnalysis.current_streak.length}
              </div>
              <div className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {streakAnalysis.current_streak.type === 'win' ? 'Wins' : 'Losses'} in a row
              </div>
            </div>
            {streakAnalysis.recent_bets.length > 0 && (
              <div className="flex gap-2 flex-wrap">
                {streakAnalysis.recent_bets.slice(0, 5).map((bet, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 rounded-full text-xs font-medium min-h-[32px] min-w-[32px] flex items-center justify-center ${
                      bet.state === 'won' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                      bet.state === 'lost' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                      'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                    }`}
                  >
                    {bet.state === 'won' ? 'W' : bet.state === 'lost' ? 'L' : bet.state.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Bets */}
      {recentBets.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Recent Bets</h2>
            <Link href="/bets" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300">
              View All →
            </Link>
          </div>
          <div className="space-y-3">
            {recentBets.slice(0, 5).map((bet) => (
              <Link
                key={bet.id}
                href={`/bets/${bet.id}`}
                className="block p-3 border border-gray-200 dark:border-gray-700 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        bet.state === 'won' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                        bet.state === 'lost' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                        bet.state === 'pending' ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300' :
                        'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300'
                      }`}>
                        {bet.state.toUpperCase()}
                      </span>
                      <span className="text-sm text-gray-500 dark:text-gray-400">
                        {new Date(bet.date).toLocaleDateString()}
                      </span>
                    </div>
                    <div className="mt-1 text-sm text-gray-900 dark:text-gray-100">
                      ${bet.stake.toFixed(2)} @ {bet.odds?.toFixed(2) || 'N/A'}
                    </div>
                  </div>
                  {bet.profit_loss !== null && bet.profit_loss !== undefined && (
                    <div className={`text-sm font-semibold ${
                      bet.profit_loss >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                    }`}>
                      {bet.profit_loss >= 0 ? '+' : ''}${bet.profit_loss.toFixed(2)}
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Profit Chart - Full Width */}
      {timeSeries.length > 0 && (
        <div className="mt-6 bg-white dark:bg-gray-800 shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Profit Trend (Last 30 Days)</h2>
            <Link href="/analytics" className="text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 dark:hover:text-primary-300">
              View Details →
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={timeSeries}>
              <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#374151' : '#e5e7eb'} />
              <XAxis 
                dataKey="date" 
                tick={{ fontSize: 12, fill: theme === 'dark' ? '#d1d5db' : '#374151' }}
                tickFormatter={(value) => {
                  const date = new Date(value);
                  return `${date.getMonth() + 1}/${date.getDate()}`;
                }}
              />
              <YAxis 
                tick={{ fontSize: 12, fill: theme === 'dark' ? '#d1d5db' : '#374151' }}
                tickFormatter={(value) => `$${value.toFixed(0)}`}
              />
              <Tooltip 
                formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative Profit']}
                labelFormatter={(label) => new Date(label).toLocaleDateString()}
                contentStyle={{ 
                  backgroundColor: theme === 'dark' ? '#1f2937' : '#fff', 
                  border: `1px solid ${theme === 'dark' ? '#374151' : '#e5e7eb'}`, 
                  borderRadius: '6px',
                  color: theme === 'dark' ? '#f3f4f6' : '#111827'
                }}
              />
              <Line 
                type="monotone" 
                dataKey="cumulative_profit" 
                stroke="#10b981" 
                strokeWidth={2}
                dot={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Top/Bottom Performers */}
      {bestWorst && (
        <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
          {bestWorst.best_leagues.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-md font-semibold text-green-600 dark:text-green-400 mb-3">Top League</h3>
              <div className="space-y-2">
                {bestWorst.best_leagues.slice(0, 3).map((league, idx) => (
                  <div key={league.league_id} className="flex justify-between items-center p-2 bg-green-50 dark:bg-green-900/20 rounded">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{league.league_name}</span>
                    <span className="text-sm font-bold text-green-600 dark:text-green-400">${league.total_profit.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {bestWorst.worst_leagues.length > 0 && (
            <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <h3 className="text-md font-semibold text-red-600 dark:text-red-400 mb-3">Worst League</h3>
              <div className="space-y-2">
                {bestWorst.worst_leagues.slice(0, 3).map((league, idx) => (
                  <div key={league.league_id} className="flex justify-between items-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                    <span className="text-sm font-medium text-gray-900 dark:text-gray-100">{league.league_name}</span>
                    <span className="text-sm font-bold text-red-600 dark:text-red-400">${league.total_profit.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex flex-col sm:flex-row gap-4">
        <Link
          href="/bets/new"
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 min-h-[44px]"
        >
          Create New Bet
        </Link>
        <Link
          href="/bets"
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px]"
        >
          View All Bets
        </Link>
        <Link
          href="/analytics"
          className="inline-flex items-center justify-center px-4 py-2 border border-gray-300 dark:border-gray-600 text-sm font-medium rounded-md shadow-sm text-gray-700 dark:text-gray-200 bg-white dark:bg-gray-800 hover:bg-gray-50 dark:hover:bg-gray-700 min-h-[44px]"
        >
          View Analytics
        </Link>
      </div>
    </div>
  );
}

