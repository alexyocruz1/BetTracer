'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { AnalyticsSummary, MainBet, StreakAnalysis, BestWorstPerformers, TimeSeriesData } from '@/types';
import Link from 'next/link';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [recentBets, setRecentBets] = useState<MainBet[]>([]);
  const [streakAnalysis, setStreakAnalysis] = useState<StreakAnalysis | null>(null);
  const [bestWorst, setBestWorst] = useState<BestWorstPerformers | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let requestCompleted = false;

    // Safety timeout to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      if (!requestCompleted && !cancelled) {
        requestCompleted = true;
        console.error('[Dashboard] Request timeout - forcing completion');
        setSummary(null);
        setLoading(false);
      }
    }, 20000); // 20 second safety timeout

    const fetchDashboardData = async () => {
      try {
        // Fetch all dashboard data in parallel
        const [summaryRes, betsRes, streakRes, bestWorstRes, timeSeriesRes] = await Promise.allSettled([
          apiClient.get<{ data: AnalyticsSummary }>('/api/analytics/summary'),
          apiClient.get<{ data: { bets: MainBet[]; total: number; totalPages: number } }>('/api/bets?limit=5&offset=0'),
          apiClient.get<{ data: StreakAnalysis }>('/api/analytics/streak-analysis'),
          apiClient.get<{ data: BestWorstPerformers }>('/api/analytics/best-worst-performers'),
          apiClient.get<{ data: TimeSeriesData[] }>('/api/analytics/time-series?granularity=daily&start_date=' + new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]),
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
          setTimeSeries(timeSeriesRes.value.data.data || []);
        }

        requestCompleted = true;
        clearTimeout(timeoutId);
        setLoading(false);
      } catch (error) {
        if (requestCompleted || cancelled) return;
        
        requestCompleted = true;
        clearTimeout(timeoutId);
        console.error('Failed to fetch dashboard data:', error);
        setLoading(false);
      } finally {
        // Ensure loading is always set to false, even if timeout already fired
        if (!cancelled && !requestCompleted) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    };
    
    fetchDashboardData();
    
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!summary) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-sm text-gray-600">
            Quick overview of your betting performance. For detailed analytics and breakdowns, visit the Analytics page.
          </p>
        </div>
        <div className="bg-white shadow rounded-lg p-12 text-center">
          <p className="text-gray-500 mb-4">No betting data available yet.</p>
          <Link
            href="/bets/new"
            className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
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
        <div className="flex items-center justify-between">
          <div>
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="mt-2 text-sm text-gray-600">
              Quick overview of your betting performance. For detailed analytics and breakdowns, visit the Analytics page.
            </p>
          </div>
          <Link
            href="/analytics"
            className="text-sm font-medium text-primary-600 hover:text-primary-500"
          >
            View Analytics →
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        <div className="bg-white overflow-hidden shadow rounded-lg">
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
              <div className="text-sm font-medium text-gray-500">Total Profit</div>
              {summary.cumulative_profit !== summary.total_profit && (
                <div className="text-xs text-gray-400 mt-1">
                  Cumulative: ${summary.cumulative_profit.toFixed(2)}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl font-bold text-gray-900">{(summary.win_rate * 100).toFixed(1)}%</div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-sm font-medium text-gray-500">Win Rate</div>
              <div className="text-xs text-gray-400 mt-1">
                {summary.won_bets}W / {summary.lost_bets}L
                {summary.pending_bets > 0 && ` / ${summary.pending_bets}P`}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
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
              <div className="text-sm font-medium text-gray-500">ROI</div>
            </div>
          </div>
        </div>

        <div className="bg-white overflow-hidden shadow rounded-lg">
          <div className="p-5">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <div className="text-2xl font-bold text-gray-900">{summary.total_bets}</div>
              </div>
            </div>
            <div className="mt-2">
              <div className="text-sm font-medium text-gray-500">Total Bets</div>
              <div className="text-xs text-gray-400 mt-1">
                ${summary.total_stake.toFixed(2)} staked
              </div>
            </div>
          </div>
        </div>
      </div>

      {summary.pending_bets > 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-yellow-600 font-semibold">{summary.pending_bets}</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-yellow-800">
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
        <div className="mt-6 bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Current Streak</h2>
            <Link href="/analytics" className="text-sm text-primary-600 hover:text-primary-500">
              View Details →
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <div className={`px-4 py-3 rounded-lg ${
              streakAnalysis.current_streak.type === 'win' ? 'bg-green-50' : 'bg-red-50'
            }`}>
              <div className={`text-3xl font-bold ${
                streakAnalysis.current_streak.type === 'win' ? 'text-green-600' : 'text-red-600'
              }`}>
                {streakAnalysis.current_streak.length}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {streakAnalysis.current_streak.type === 'win' ? 'Wins' : 'Losses'} in a row
              </div>
            </div>
            {streakAnalysis.recent_bets.length > 0 && (
              <div className="flex gap-2">
                {streakAnalysis.recent_bets.slice(0, 5).map((bet, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-2 rounded-full text-xs font-medium ${
                      bet.state === 'won' ? 'bg-green-100 text-green-800' :
                      bet.state === 'lost' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
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

      {/* Recent Activity & Performance */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Bets */}
        {recentBets.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Recent Bets</h2>
              <Link href="/bets" className="text-sm text-primary-600 hover:text-primary-500">
                View All →
              </Link>
            </div>
            <div className="space-y-3">
              {recentBets.slice(0, 5).map((bet) => (
                <Link
                  key={bet.id}
                  href={`/bets/${bet.id}`}
                  className="block p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          bet.state === 'won' ? 'bg-green-100 text-green-800' :
                          bet.state === 'lost' ? 'bg-red-100 text-red-800' :
                          bet.state === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {bet.state.toUpperCase()}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(bet.date).toLocaleDateString()}
                        </span>
                      </div>
                      <div className="mt-1 text-sm text-gray-900">
                        ${bet.stake.toFixed(2)} @ {bet.odds?.toFixed(2) || 'N/A'}
                      </div>
                    </div>
                    {bet.profit_loss !== null && bet.profit_loss !== undefined && (
                      <div className={`text-sm font-semibold ${
                        bet.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'
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

        {/* Profit Chart */}
        {timeSeries.length > 0 && (
          <div className="bg-white shadow rounded-lg p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Profit Trend (Last 30 Days)</h2>
              <Link href="/analytics" className="text-sm text-primary-600 hover:text-primary-500">
                View Details →
              </Link>
            </div>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={timeSeries}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis 
                  dataKey="date" 
                  tick={{ fontSize: 12 }}
                  tickFormatter={(value) => {
                    const date = new Date(value);
                    return `${date.getMonth() + 1}/${date.getDate()}`;
                  }}
                />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip 
                  formatter={(value: number) => [`$${value.toFixed(2)}`, 'Cumulative Profit']}
                  labelFormatter={(label) => new Date(label).toLocaleDateString()}
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
      </div>

      {/* Top/Bottom Performers */}
      {bestWorst && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          {bestWorst.best_leagues.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-md font-semibold text-green-600 mb-3">Top League</h3>
              <div className="space-y-2">
                {bestWorst.best_leagues.slice(0, 3).map((league, idx) => (
                  <div key={league.league_id} className="flex justify-between items-center p-2 bg-green-50 rounded">
                    <span className="text-sm font-medium text-gray-900">{league.league_name}</span>
                    <span className="text-sm font-bold text-green-600">${league.total_profit.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {bestWorst.worst_leagues.length > 0 && (
            <div className="bg-white shadow rounded-lg p-6">
              <h3 className="text-md font-semibold text-red-600 mb-3">Worst League</h3>
              <div className="space-y-2">
                {bestWorst.worst_leagues.slice(0, 3).map((league, idx) => (
                  <div key={league.league_id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                    <span className="text-sm font-medium text-gray-900">{league.league_name}</span>
                    <span className="text-sm font-bold text-red-600">${league.total_profit.toFixed(2)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 flex gap-4">
        <Link
          href="/bets/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
        >
          Create New Bet
        </Link>
        <Link
          href="/bets"
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
        >
          View All Bets
        </Link>
        <Link
          href="/analytics"
          className="inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md shadow-sm text-gray-700 bg-white hover:bg-gray-50"
        >
          View Analytics
        </Link>
      </div>
    </div>
  );
}

