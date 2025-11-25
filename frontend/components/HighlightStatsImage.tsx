'use client';

import { MainBet, AnalyticsSummary } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface HighlightStatsImageProps {
  bet: MainBet;
  onReady?: () => void;
}

export default function HighlightStatsImage({ bet, onReady }: HighlightStatsImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [analytics, setAnalytics] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const { data } = await apiClient.get<{ data: AnalyticsSummary }>('/api/analytics/summary');
        setAnalytics(data.data);
      } catch (error) {
        console.error('Failed to fetch analytics:', error);
      } finally {
        setLoading(false);
        if (onReady) {
          // Small delay to ensure rendering is complete
          setTimeout(onReady, 100);
        }
      }
    };

    fetchAnalytics();
  }, [onReady]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const getStateColor = (state: string) => {
    switch (state) {
      case 'won': return '#4ade80';
      case 'lost': return '#f87171';
      case 'void': return '#94a3b8';
      default: return '#fbbf24';
    }
  };

  const getStateEmoji = (state: string) => {
    switch (state) {
      case 'won': return '✅';
      case 'lost': return '❌';
      case 'void': return '⚪';
      default: return '⏳';
    }
  };

  if (loading || !analytics) {
    return (
      <div
        ref={containerRef}
        className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center"
        style={{
          width: '1080px',
          minHeight: '1920px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div className="text-6xl text-white">Loading Statistics...</div>
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white"
      style={{
        width: '1080px',
        minHeight: '1920px',
        padding: '80px 60px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        overflow: 'visible',
      }}
    >
      {/* Header */}
      <div className="text-center mb-20">
        <div className="mb-8">
          <div className="text-7xl text-white font-bold mb-3">My Betting Stats</div>
          <div className="text-3xl text-gray-300">Overall Performance</div>
        </div>
      </div>

      {/* Main Statistics Grid */}
      <div className="grid grid-cols-2 gap-8 mb-14">
        {/* Total Profit */}
        <div 
          className="rounded-3xl p-12 border-2 text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div className="text-4xl font-bold mb-6 text-gray-300">Total Profit</div>
          <div 
            className="text-8xl font-black mb-4"
            style={{ 
              color: analytics.total_profit >= 0 ? '#4ade80' : '#f87171'
            }}
          >
            ${analytics.total_profit >= 0 ? '+' : ''}{analytics.total_profit.toFixed(2)}
          </div>
          <div className="text-2xl text-gray-400">
            ${analytics.total_stake.toFixed(2)} staked
          </div>
        </div>

        {/* Win Rate */}
        <div 
          className="rounded-3xl p-12 border-2 text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div className="text-4xl font-bold mb-6 text-gray-300">Win Rate</div>
          <div className="text-8xl font-black mb-4" style={{ color: '#60a5fa' }}>
            {(analytics.win_rate * 100).toFixed(1)}%
          </div>
          <div className="text-2xl text-gray-400">
            {analytics.won_bets}W / {analytics.lost_bets}L
            {analytics.pending_bets > 0 && ` / ${analytics.pending_bets}P`}
          </div>
        </div>

        {/* ROI */}
        <div 
          className="rounded-3xl p-12 border-2 text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div className="text-4xl font-bold mb-6 text-gray-300">ROI</div>
          <div 
            className="text-8xl font-black mb-4"
            style={{ 
              color: analytics.roi >= 0 ? '#4ade80' : '#f87171'
            }}
          >
            {analytics.roi >= 0 ? '+' : ''}{(analytics.roi * 100).toFixed(1)}%
          </div>
          <div className="text-2xl text-gray-400">Return on Investment</div>
        </div>

        {/* Total Bets */}
        <div 
          className="rounded-3xl p-12 border-2 text-center"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div className="text-4xl font-bold mb-6 text-gray-300">Total Bets</div>
          <div className="text-8xl font-black mb-4 text-white">
            {analytics.total_bets}
          </div>
          <div className="text-2xl text-gray-400">Bets Placed</div>
        </div>
      </div>

      {/* Performance Summary */}
      <div 
        className="rounded-3xl p-12 mb-14 border-2"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div className="text-center">
          <div className="text-5xl font-bold text-gray-300 mb-8">Performance Summary</div>
          
          {/* Key metrics in a row */}
          <div className="grid grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-3xl text-gray-400 mb-3">Average Stake</div>
              <div className="text-5xl font-bold text-white">
                ${analytics.total_bets > 0 ? (analytics.total_stake / analytics.total_bets).toFixed(2) : '0.00'}
              </div>
            </div>
            
            <div className="text-center">
              <div className="text-3xl text-gray-400 mb-3">Profit per Bet</div>
              <div 
                className="text-5xl font-bold"
                style={{ 
                  color: analytics.total_profit >= 0 ? '#4ade80' : '#f87171'
                }}
              >
                ${analytics.total_bets > 0 ? (analytics.total_profit / analytics.total_bets).toFixed(2) : '0.00'}
              </div>
            </div>

            <div className="text-center">
              <div className="text-3xl text-gray-400 mb-3">Success Rate</div>
              <div className="text-5xl font-bold" style={{ color: '#fbbf24' }}>
                {analytics.total_bets > 0 ? ((analytics.won_bets / (analytics.won_bets + analytics.lost_bets)) * 100).toFixed(1) : '0.0'}%
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-20 pt-12 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.15)' }}>
        <div className="text-center">
          <div className="text-4xl text-gray-400 font-semibold mb-4">Generated by</div>
          <div 
            className="text-6xl font-bold"
            style={{
              color: '#60a5fa',
              textShadow: '0 2px 8px rgba(96, 165, 250, 0.3)',
            }}
          >
            BetTracer
          </div>
        </div>
      </div>
    </div>
  );
}

