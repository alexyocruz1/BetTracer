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
    return <div className="text-center py-12">No data available</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-sm text-gray-600">
          Quick overview of your betting performance. For detailed analytics and breakdowns, visit the Analytics page.
        </p>
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

      <div className="mt-6">
        <Link
          href="/bets/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
        >
          Create New Bet
        </Link>
      </div>
    </div>
  );
}

