'use client';

import { MainBet, AnalyticsByLeague, AnalyticsByBetType, AnalyticsByCategory, AnalyticsByLegs, OddsAnalysis, TeamPerformance, StreakAnalysis, ReferenceItem } from '@/types';
import { useEffect, useRef, useState } from 'react';
import { apiClient } from '@/lib/api/client';

interface HighlightStatsImageProps {
  bet: MainBet;
  onReady?: () => void;
}

interface BetSpecificStats {
  league?: AnalyticsByLeague;
  betType?: AnalyticsByBetType;
  category?: AnalyticsByCategory;
  legCount?: AnalyticsByLegs;
  stakeRange?: OddsAnalysis;
  teamPerformance?: TeamPerformance[];
  streakAnalysis?: StreakAnalysis;
  referenceItems: Map<string, ReferenceItem>;
}

export default function HighlightStatsImage({ bet, onReady }: HighlightStatsImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [stats, setStats] = useState<BetSpecificStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBetSpecificAnalytics = async () => {
      try {
        // Get unique IDs from bet legs
        const leagueIds = new Set<string>();
        const betTypeIds = new Set<string>();
        const categoryIds = new Set<string>();
        const responsibleIds = new Set<string>();

        const teamIds = new Set<string>();
        
        bet.legs?.forEach(leg => {
          if (leg.league_id) leagueIds.add(leg.league_id);
          if (leg.bet_type_id) betTypeIds.add(leg.bet_type_id);
          if (leg.category_id) categoryIds.add(leg.category_id);
          if (leg.home_team_id) teamIds.add(leg.home_team_id);
          if (leg.away_team_id) teamIds.add(leg.away_team_id);
        });

        // Calculate current bet characteristics
        const currentLegCount = bet.legs?.length || 0;
        const currentStake = bet.stake;

        // Fetch analytics for each category
        const [leagueData, betTypeData, categoryData, legData, oddsData, teamData, streakData, referenceData] = await Promise.all([
          apiClient.get<{ data: AnalyticsByLeague[] }>('/api/analytics/by-league'),
          apiClient.get<{ data: AnalyticsByBetType[] }>('/api/analytics/by-bet-type'),
          apiClient.get<{ data: AnalyticsByCategory[] }>('/api/analytics/by-category'),
          apiClient.get<{ data: AnalyticsByLegs[] }>('/api/analytics/by-legs'),
          apiClient.get<{ data: OddsAnalysis[] }>('/api/analytics/odds-analysis'),
          apiClient.get<{ data: TeamPerformance[] }>('/api/analytics/team-performance'),
          apiClient.get<{ data: StreakAnalysis }>('/api/analytics/streak-analysis'),
          apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?limit=1000'),
        ]);

        // Create reference items map
        const referenceItems = new Map<string, ReferenceItem>();
        referenceData.data.data.forEach(item => {
          referenceItems.set(item.id, item);
        });

        // Find matching analytics for this bet's characteristics
        const league = leagueData.data.data.find(l => leagueIds.has(l.league_id));
        const betType = betTypeData.data.data.find(bt => betTypeIds.has(bt.bet_type_id));
        const category = categoryData.data.data.find(c => categoryIds.has(c.category_id));
        
        // Find leg count analytics for current bet's leg count
        const legCount = legData.data.data.find(l => l.num_legs === currentLegCount);
        
        // Find stake range analytics for current bet's stake
        const stakeRange = oddsData.data.data.find(o => {
          // Find the range that contains the current stake
          const [min, max] = o.range.includes('+') 
            ? [parseFloat(o.range.replace('+', '')), Infinity]
            : o.range.split('-').map(parseFloat);
          return currentStake >= min && (max === Infinity || currentStake <= max);
        });

        // Find team performance for teams in this bet
        const teamPerformance = teamData.data.data.filter(t => teamIds.has(t.team_id));
        
        // Get streak analysis
        const streakAnalysis = streakData.data.data;

        setStats({
          league,
          betType,
          category,
          legCount,
          stakeRange,
          teamPerformance,
          streakAnalysis,
          referenceItems,
        });
      } catch (error) {
        console.error('Failed to fetch bet-specific analytics:', error);
      } finally {
        setLoading(false);
        if (onReady) {
          setTimeout(onReady, 100);
        }
      }
    };

    fetchBetSpecificAnalytics();
  }, [bet, onReady]);

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

  const getReferenceName = (id?: string): string => {
    if (!id || !stats) return 'Unknown';
    return stats.referenceItems.get(id)?.name || 'Unknown';
  };

  if (loading || !stats) {
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
          <div className="text-7xl text-white font-bold mb-3">Stats</div>
          <div className="text-3xl text-gray-300">Performance Breakdown</div>
        </div>
      </div>

      {/* Specific Statistics Grid */}
      <div className="space-y-8 mb-14">
        {/* League Stats */}
        {stats.league && stats.league.win_rate > 0 && (
          <div 
            className="rounded-3xl p-12 border-2"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-300 mb-2">League Performance</div>
              <div className="text-2xl text-gray-400">{getReferenceName(stats.league.league_id)}</div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Win Rate</div>
                <div className="text-6xl font-bold" style={{ color: '#60a5fa' }}>
                  {(stats.league.win_rate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Total Bets</div>
                <div className="text-6xl font-bold text-white">
                  {stats.league.bet_count}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bet Type Stats */}
        {stats.betType && stats.betType.win_rate > 0 && (
          <div 
            className="rounded-3xl p-12 border-2"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-300 mb-2">Bet Type Performance</div>
              <div className="text-2xl text-gray-400">{getReferenceName(stats.betType.bet_type_id)}</div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Win Rate</div>
                <div className="text-6xl font-bold" style={{ color: '#60a5fa' }}>
                  {(stats.betType.win_rate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Total Bets</div>
                <div className="text-6xl font-bold text-white">
                  {stats.betType.bet_count}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Category Stats */}
        {stats.category && stats.category.win_rate > 0 && (
          <div 
            className="rounded-3xl p-12 border-2"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-300 mb-2">Category Performance</div>
              <div className="text-2xl text-gray-400">{getReferenceName(stats.category.category_id)}</div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Win Rate</div>
                <div className="text-6xl font-bold" style={{ color: '#60a5fa' }}>
                  {(stats.category.win_rate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Total Bets</div>
                <div className="text-6xl font-bold text-white">
                  {stats.category.bet_count}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Team Performance Stats */}
        {stats.teamPerformance && stats.teamPerformance.length > 0 && (
          <div 
            className="rounded-3xl p-12 border-2"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-300 mb-2">Team Performance</div>
              <div className="text-2xl text-gray-400">{getReferenceName(stats.teamPerformance[0].team_id)}</div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Win Rate</div>
                <div className="text-6xl font-bold" style={{ color: '#60a5fa' }}>
                  {(stats.teamPerformance[0].total.win_rate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Total Legs</div>
                <div className="text-6xl font-bold text-white">
                  {stats.teamPerformance[0].total.total_legs}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Streak Analysis */}
        {stats.streakAnalysis && (() => {
          // Calculate recent performance (wins vs losses in recent bets)
          const recentBets = stats.streakAnalysis.recent_bets || [];
          const recentWins = recentBets.filter(bet => bet.state === 'won').length;
          const recentLosses = recentBets.filter(bet => bet.state === 'lost').length;
          const hasMoreWinsThanLosses = recentWins >= recentLosses;
          
          // Only show if current streak is winning OR recent performance is positive
          const shouldShowStreak = stats.streakAnalysis.current_streak.type === 'win' || hasMoreWinsThanLosses;
          
          return shouldShowStreak ? (
            <div 
              className="rounded-3xl p-12 border-2"
              style={{
                background: 'rgba(255, 255, 255, 0.1)',
                backdropFilter: 'blur(10px)',
                borderColor: 'rgba(255, 255, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
              }}
            >
              <div className="text-center mb-8">
                <div className="text-4xl font-bold text-gray-300 mb-2">Current Streak</div>
                <div className="text-2xl text-gray-400">
                  {stats.streakAnalysis.current_streak.type === 'win' ? '🔥 Winning' : '❄️ Losing'} Streak
                </div>
              </div>
              <div className="grid grid-cols-2 gap-8">
                <div className="text-center">
                  <div className="text-3xl text-gray-400 mb-2">Current</div>
                  <div 
                    className="text-6xl font-bold"
                    style={{ 
                      color: stats.streakAnalysis.current_streak.type === 'win' ? '#4ade80' : '#f87171'
                    }}
                  >
                    {stats.streakAnalysis.current_streak.length}
                  </div>
                </div>
                <div className="text-center">
                  <div className="text-3xl text-gray-400 mb-2">Best Win Streak</div>
                  <div className="text-6xl font-bold" style={{ color: '#fbbf24' }}>
                    {stats.streakAnalysis.longest_win_streak.length}
                  </div>
                </div>
              </div>
            </div>
          ) : null;
        })()}

        {/* Leg Count Stats */}
        {stats.legCount && stats.legCount.win_rate > 0 && (
          <div 
            className="rounded-3xl p-12 border-2"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-300 mb-2">Leg Count Performance</div>
              <div className="text-2xl text-gray-400">{stats.legCount.num_legs} Leg Bets</div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Win Rate</div>
                <div className="text-6xl font-bold" style={{ color: '#60a5fa' }}>
                  {(stats.legCount.win_rate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Total Bets</div>
                <div className="text-6xl font-bold text-white">
                  {stats.legCount.bet_count}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Stake Range Stats */}
        {stats.stakeRange && stats.stakeRange.win_rate > 0 && (
          <div 
            className="rounded-3xl p-12 border-2"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="text-center mb-8">
              <div className="text-4xl font-bold text-gray-300 mb-2">Stake Range Performance</div>
              <div className="text-2xl text-gray-400">${stats.stakeRange.range} Stakes</div>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Win Rate</div>
                <div className="text-6xl font-bold" style={{ color: '#60a5fa' }}>
                  {(stats.stakeRange.win_rate * 100).toFixed(1)}%
                </div>
              </div>
              <div className="text-center">
                <div className="text-3xl text-gray-400 mb-2">Total Bets</div>
                <div className="text-6xl font-bold text-white">
                  {stats.stakeRange.total_bets}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Summary Message */}
      {(() => {
        // Check if streak should be shown
        const shouldShowStreak = stats.streakAnalysis && (
          stats.streakAnalysis.current_streak.type === 'win' || 
          (stats.streakAnalysis.recent_bets || []).filter(bet => bet.state === 'won').length >= 
          (stats.streakAnalysis.recent_bets || []).filter(bet => bet.state === 'lost').length
        );
        
        // Check if we have any stats to show
        const hasAnyStats = (
          (stats.league && stats.league.win_rate > 0) ||
          (stats.betType && stats.betType.win_rate > 0) ||
          (stats.category && stats.category.win_rate > 0) ||
          (stats.legCount && stats.legCount.win_rate > 0) ||
          (stats.stakeRange && stats.stakeRange.win_rate > 0) ||
          (stats.teamPerformance && stats.teamPerformance.length > 0) ||
          shouldShowStreak
        );
        
        return !hasAnyStats ? (
          <div 
            className="rounded-3xl p-12 mb-14 border-2 text-center"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
            }}
          >
            <div className="text-4xl font-bold text-gray-300 mb-4">No Stats Available</div>
            <div className="text-2xl text-gray-400">
              Not enough data for performance metrics
            </div>
          </div>
        ) : null;
      })()}

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

