'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { AnalyticsSummary } from '@/types';
import Link from 'next/link';

export default function DashboardPage() {
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    
    const fetchSummary = async () => {
      try {
        const { data } = await apiClient.get<{ data: AnalyticsSummary }>('/api/analytics/summary');
        if (!cancelled) {
          setSummary(data.data);
        }
      } catch (error) {
        console.error('Failed to fetch summary:', error);
        if (!cancelled) {
          setSummary(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };
    
    fetchSummary();
    
    return () => {
      cancelled = true;
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

