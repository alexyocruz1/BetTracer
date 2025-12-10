'use client';

import { MainBet, ReferenceItem } from '@/types';
import { useEffect, useState, useRef } from 'react';
import { apiClient } from '@/lib/api/client';

interface HighlightStatsImageProps {
  bet: MainBet;
  onReady?: () => void;
  tiktokSafe?: boolean; // When true, removes betting-specific content for TikTok compliance
}

interface BetSpecificStats {
  leaguesStats?: Array<{ league_name: string; win_rate: number; bet_count: number; total_profit: number }>;
  teamsStats?: Array<{ team_name: string; win_rate: number; total_legs: number; total_profit: number }>;
  betTypesStats?: Array<{ bet_type_name: string; win_rate: number; bet_count: number; total_profit: number }>;
  categoriesStats?: Array<{ category_name: string; win_rate: number; bet_count: number; total_profit: number }>;
  dayOfWeekStats?: { day: string; total_bets: number; win_rate: number; total_profit: number };
  weekendStats?: { total_bets: number; win_rate: number; total_profit: number };
  legCountStats?: { win_rate: number; bet_count: number; total_profit: number };
  stakeRangeStats?: { win_rate: number; bet_count: number; total_profit: number };
  oddsRangeStats?: { range: string; win_rate: number; total_bets: number; total_profit: number };
}

export default function HighlightStatsImage({ bet, onReady, tiktokSafe = false }: HighlightStatsImageProps) {
  const [referenceItems, setReferenceItems] = useState<Map<string, ReferenceItem>>(new Map());
  const [stats, setStats] = useState<BetSpecificStats | null>(null);
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch reference items and analytics in parallel
        const [
          referenceItemsRes,
          leaguesRes,
          teamsRes,
          betTypesRes,
          categoriesRes,
          byLegsRes,
          stakeAnalysisRes,
          oddsAnalysisRes,
          temporalRes
        ] = await Promise.all([
          apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?limit=1000'),
          apiClient.get('/api/analytics/by-league'),
          apiClient.get('/api/analytics/team-performance'),
          apiClient.get('/api/analytics/by-bet-type'),
          apiClient.get('/api/analytics/by-category'),
          apiClient.get('/api/analytics/by-legs'),
          apiClient.get('/api/analytics/stake-analysis'),
          apiClient.get('/api/analytics/odds-analysis').catch(() => ({ data: { data: null } })),
          apiClient.get('/api/analytics/temporal').catch(() => ({ data: { data: null } }))
        ]);

        // Build reference items map
        const itemsMap = new Map<string, ReferenceItem>();
        referenceItemsRes.data.data.forEach(item => {
          itemsMap.set(item.id, item);
        });
        setReferenceItems(itemsMap);

        // Extract bet-specific attributes
        const legs = bet.legs || [];
        const uniqueLeagueIds = Array.from(new Set(legs.map(leg => leg.league_id).filter(Boolean)));
        const uniqueTeamIds = Array.from(new Set([
          ...legs.map(leg => leg.home_team_id).filter(Boolean),
          ...legs.map(leg => leg.away_team_id).filter(Boolean)
        ]));
        const uniqueBetTypeIds = Array.from(new Set(legs.map(leg => leg.bet_type_id).filter(Boolean)));
        const uniqueCategoryIds = Array.from(new Set(legs.map(leg => leg.category_id).filter(Boolean)));
        const numLegs = legs.length;
        const stake = bet.stake || 0;
        const odds = bet.odds || 0;
        const betDate = new Date(bet.date);
        const dayOfWeek = betDate.getDay();
        const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
        const dayName = dayNames[dayOfWeek];
        const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

        // Filter leagues stats to only include leagues used in this bet
        const leaguesStats = (leaguesRes.data.data || [])
          .filter((league: any) => uniqueLeagueIds.includes(league.league_id))
          .map((league: any) => ({
            league_name: league.league_name || 'Unknown',
            win_rate: league.win_rate || 0,
            bet_count: league.bet_count || 0,
            total_profit: league.total_profit || 0
          }))
          .filter((league: any) => league.win_rate > 0);

        // Filter teams stats to only include teams used in this bet
        const teamsStats = (teamsRes.data.data || [])
          .filter((team: any) => uniqueTeamIds.includes(team.team_id))
          .map((team: any) => ({
            team_name: team.team_name || 'Unknown',
            win_rate: team.total?.win_rate || 0,
            total_legs: team.total?.total_legs || 0,
            total_profit: team.total?.total_profit || 0
          }))
          .filter((team: any) => team.win_rate > 0 && team.total_legs > 0)
          .sort((a: any, b: any) => b.total_legs - a.total_legs); // Sort by number of legs (most bets first)

        // Filter bet types stats
        const betTypesStats = (betTypesRes.data.data || [])
          .filter((bt: any) => uniqueBetTypeIds.includes(bt.bet_type_id))
          .map((bt: any) => ({
            bet_type_name: bt.bet_type_name || 'Unknown',
            win_rate: bt.win_rate || 0,
            bet_count: bt.bet_count || 0,
            total_profit: bt.total_profit || 0
          }))
          .filter((bt: any) => bt.win_rate > 0);

        // Filter categories stats
        const categoriesStats = (categoriesRes.data.data || [])
          .filter((cat: any) => uniqueCategoryIds.includes(cat.category_id))
          .map((cat: any) => ({
            category_name: cat.category_name || 'Unknown',
            win_rate: cat.win_rate || 0,
            bet_count: cat.bet_count || 0,
            total_profit: cat.total_profit || 0
          }))
          .filter((cat: any) => cat.win_rate > 0);

        // Find leg count stats for this bet's number of legs
        const legCountStats = (byLegsRes.data.data || []).find((leg: any) => leg.num_legs === numLegs);
        
        // Find stake range stats
        const stakeRanges = stakeAnalysisRes.data.data || [];
        let stakeRangeStats = null;
        for (const range of stakeRanges) {
          const [min, max] = range.stake_range?.split('-').map(Number) || [];
          if (stake >= (min || 0) && stake <= (max || Infinity)) {
            stakeRangeStats = range;
            break;
          }
        }

        // Find odds range stats
        const oddsRanges = oddsAnalysisRes.data.data || [];
        let oddsRangeStats = null;
        if (odds > 0) {
          for (const range of oddsRanges) {
            if (odds >= range.min_odds && odds <= range.max_odds) {
              oddsRangeStats = range;
              break;
            }
          }
        }

        // Get day of week stats
        const temporal = temporalRes.data.data;
        const dayOfWeekStats = temporal?.by_day_of_week?.find((day: any) => day.day_number === dayOfWeek);
        const weekendStats = isWeekend ? temporal?.weekend_vs_weekday?.weekend : temporal?.weekend_vs_weekday?.weekday;

        setStats({
          leaguesStats,
          teamsStats,
          betTypesStats,
          categoriesStats,
          dayOfWeekStats: dayOfWeekStats ? {
            day: dayName,
            total_bets: dayOfWeekStats.total_bets || 0,
            win_rate: dayOfWeekStats.win_rate || 0,
            total_profit: dayOfWeekStats.total_profit || 0
          } : undefined,
          weekendStats: weekendStats ? weekendStats : undefined,
          legCountStats: legCountStats ? legCountStats : undefined,
          stakeRangeStats: stakeRangeStats ? stakeRangeStats : undefined,
          oddsRangeStats: oddsRangeStats ? oddsRangeStats : undefined
        });

        setLoading(false);
        if (onReady) {
          setTimeout(onReady, 100);
        }
      } catch (error) {
        console.error('Failed to fetch stats:', error);
        setLoading(false);
        if (onReady) {
          setTimeout(onReady, 100);
        }
      }
    };

    fetchData();
  }, [bet, onReady]);

  const formatPercentage = (value: number) => {
    if (typeof value !== 'number' || isNaN(value) || value < 0 || value > 1) {
      return '0.0%';
    }
    return `${(value * 100).toFixed(1)}%`;
  };

  const formatCurrency = (value: number) => `$${value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  if (loading || !stats) {
    return (
      <div
        ref={containerRef}
        className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white flex items-center justify-center"
        style={{
          width: '1080px',
          height: '1920px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        <div className="text-6xl text-white">Loading Statistics...</div>
      </div>
    );
  }

  // Collect all valid stats
  const validStats: Array<{ type: string; element: JSX.Element }> = [];

  // 1. League Performance (for leagues used in this bet) - show up to 3 in TikTok safe mode
  const maxLeagues = tiktokSafe ? 3 : 2;
  stats.leaguesStats?.slice(0, maxLeagues).forEach((league, index) => {
    validStats.push({
      type: `league-${index}`,
      element: (
        <div key={`league-${index}`} className="rounded-3xl p-8 border-2" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.15)'
        }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-white mb-2">
                {tiktokSafe ? '🏆 ' : ''}{league.league_name} {tiktokSafe ? 'Performance' : 'Analysis'}
              </div>
              <div className="text-xl text-gray-300">
                {tiktokSafe ? 'Success Rate' : 'Win Rate'}: {formatPercentage(league.win_rate)}
              </div>
              {!tiktokSafe && (
                <div className="text-lg text-gray-400">{league.bet_count} bets</div>
              )}
              {tiktokSafe && (
                <div className="text-lg text-gray-400 mt-2">📈 League statistics & insights</div>
              )}
            </div>
            <div className="text-6xl font-bold" style={{ color: league.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
              {formatPercentage(league.win_rate)}
            </div>
          </div>
        </div>
      )
    });
  });

  // 2. Team Performance (for teams used in this bet) - show up to 3 in TikTok safe mode
  const maxTeams = tiktokSafe ? 3 : 2;
  stats.teamsStats?.slice(0, maxTeams).forEach((team, index) => {
    validStats.push({
      type: `team-${index}`,
      element: (
        <div key={`team-${index}`} className="rounded-3xl p-8 border-2" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.15)'
        }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-white mb-2">
                {tiktokSafe ? '⚽ ' : ''}{team.team_name} {tiktokSafe ? 'Form' : 'Analysis'}
              </div>
              <div className="text-xl text-gray-300">
                {tiktokSafe ? 'Success Rate' : 'Win Rate'}: {formatPercentage(team.win_rate)}
              </div>
              {!tiktokSafe && (
                <div className="text-lg text-gray-400">{team.total_legs} matches</div>
              )}
              {tiktokSafe && (
                <div className="text-lg text-gray-400 mt-2">📊 Team performance analysis</div>
              )}
            </div>
            <div className="text-6xl font-bold" style={{ color: team.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
              {formatPercentage(team.win_rate)}
            </div>
          </div>
        </div>
      )
    });
  });

  // 3. Bet Type Performance - Hidden in TikTok safe mode
  if (!tiktokSafe) {
    stats.betTypesStats?.slice(0, 2).forEach((betType, index) => {
      validStats.push({
      type: `betType-${index}`,
      element: (
        <div key={`betType-${index}`} className="rounded-3xl p-8 border-2" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.15)'
        }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-white mb-2">{betType.bet_type_name} Performance</div>
              <div className="text-xl text-gray-300">Win Rate: {formatPercentage(betType.win_rate)}</div>
              <div className="text-lg text-gray-400">{betType.bet_count} bets</div>
            </div>
            <div className="text-6xl font-bold" style={{ color: betType.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
              {formatPercentage(betType.win_rate)}
            </div>
          </div>
        </div>
      )
    });
  });

  // 4. Category Performance
  stats.categoriesStats?.slice(0, 1).forEach((category, index) => {
    validStats.push({
      type: `category-${index}`,
      element: (
        <div key={`category-${index}`} className="rounded-3xl p-8 border-2" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.15)'
        }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-white mb-2">{category.category_name} Performance</div>
              <div className="text-xl text-gray-300">Win Rate: {formatPercentage(category.win_rate)}</div>
              <div className="text-lg text-gray-400">{category.bet_count} bets</div>
            </div>
            <div className="text-6xl font-bold" style={{ color: category.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
              {formatPercentage(category.win_rate)}
            </div>
          </div>
        </div>
      )
    });
    });
  }

  // 5. Day of Week Performance - Reframed for TikTok safe mode
  if (stats.dayOfWeekStats) {
    if (tiktokSafe) {
      validStats.push({
        type: 'dayOfWeek',
        element: (
          <div key="dayOfWeek" className="rounded-3xl p-8 border-2" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.15)'
          }}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-3xl font-bold text-white mb-2">
                  📅 {stats.dayOfWeekStats.day} Performance
                </div>
                <div className="text-xl text-gray-300">
                  Success Rate: {formatPercentage(stats.dayOfWeekStats.win_rate)}
                </div>
                <div className="text-lg text-gray-400 mt-2">
                  📊 Best day for match analysis
                </div>
              </div>
              <div className="text-6xl font-bold" style={{ color: stats.dayOfWeekStats.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
                {formatPercentage(stats.dayOfWeekStats.win_rate)}
              </div>
            </div>
          </div>
        )
      });
    } else {
      validStats.push({
        type: 'dayOfWeek',
        element: (
          <div key="dayOfWeek" className="rounded-3xl p-8 border-2" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.15)'
          }}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-3xl font-bold text-white mb-2">{stats.dayOfWeekStats.day} Performance</div>
                <div className="text-xl text-gray-300">Win Rate: {formatPercentage(stats.dayOfWeekStats.win_rate)}</div>
                <div className="text-lg text-gray-400">{stats.dayOfWeekStats.total_bets} bets</div>
              </div>
              <div className="text-6xl font-bold" style={{ color: stats.dayOfWeekStats.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
                {formatPercentage(stats.dayOfWeekStats.win_rate)}
              </div>
            </div>
          </div>
        )
      });
    }
  }

  // 6. Weekend/Weekday Performance - Reframed for TikTok safe mode
  if (stats.weekendStats) {
    if (tiktokSafe) {
      const isWeekend = bet && (new Date(bet.date).getDay() === 0 || new Date(bet.date).getDay() === 6);
      validStats.push({
        type: 'weekend',
        element: (
          <div key="weekend" className="rounded-3xl p-8 border-2" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.15)'
          }}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-3xl font-bold text-white mb-2">
                  🎯 {isWeekend ? 'Weekend' : 'Weekday'} Performance
                </div>
                <div className="text-xl text-gray-300">
                  Success Rate: {formatPercentage(stats.weekendStats.win_rate)}
                </div>
                <div className="text-lg text-gray-400 mt-2">
                  📈 {isWeekend ? 'Weekend' : 'Weekday'} match insights
                </div>
              </div>
              <div className="text-6xl font-bold" style={{ color: stats.weekendStats.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
                {formatPercentage(stats.weekendStats.win_rate)}
              </div>
            </div>
          </div>
        )
      });
    } else {
      validStats.push({
        type: 'weekend',
        element: (
          <div key="weekend" className="rounded-3xl p-8 border-2" style={{ 
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderColor: 'rgba(255, 255, 255, 0.15)'
          }}>
            <div className="flex justify-between items-center">
              <div>
                <div className="text-3xl font-bold text-white mb-2">
                  {(bet && (new Date(bet.date).getDay() === 0 || new Date(bet.date).getDay() === 6)) ? 'Weekend' : 'Weekday'} Performance
                </div>
                <div className="text-xl text-gray-300">Win Rate: {formatPercentage(stats.weekendStats.win_rate)}</div>
                <div className="text-lg text-gray-400">{stats.weekendStats.total_bets} bets</div>
              </div>
              <div className="text-6xl font-bold" style={{ color: stats.weekendStats.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
                {formatPercentage(stats.weekendStats.win_rate)}
              </div>
            </div>
          </div>
        )
      });
    }
  }

  // 7. Leg Count Performance - Hidden in TikTok safe mode
  if (!tiktokSafe && stats.legCountStats) {
    validStats.push({
      type: 'legCount',
      element: (
        <div key="legCount" className="rounded-3xl p-8 border-2" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.15)'
        }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-white mb-2">{bet?.legs?.length || 0}-Leg Performance</div>
              <div className="text-xl text-gray-300">Win Rate: {formatPercentage(stats.legCountStats.win_rate)}</div>
              <div className="text-lg text-gray-400">{stats.legCountStats.bet_count} bets</div>
            </div>
            <div className="text-6xl font-bold" style={{ color: stats.legCountStats.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
              {formatPercentage(stats.legCountStats.win_rate)}
            </div>
          </div>
        </div>
      )
    });
  }

  // 8. Stake Range Performance - Hidden in TikTok safe mode
  if (!tiktokSafe && stats.stakeRangeStats) {
    validStats.push({
      type: 'stakeRange',
      element: (
        <div key="stakeRange" className="rounded-3xl p-8 border-2" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.15)'
        }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-white mb-2">Stake Range Performance</div>
              <div className="text-xl text-gray-300">Win Rate: {formatPercentage(stats.stakeRangeStats.win_rate)}</div>
              <div className="text-lg text-gray-400">{stats.stakeRangeStats.bet_count} bets</div>
            </div>
            <div className="text-6xl font-bold" style={{ color: stats.stakeRangeStats.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
              {formatPercentage(stats.stakeRangeStats.win_rate)}
            </div>
          </div>
        </div>
      )
    });
  }

  // 9. Odds Range Performance - Hidden in TikTok safe mode
  if (!tiktokSafe && stats.oddsRangeStats) {
    validStats.push({
      type: 'oddsRange',
      element: (
        <div key="oddsRange" className="rounded-3xl p-8 border-2" style={{ 
          backgroundColor: 'rgba(255, 255, 255, 0.05)',
          borderColor: 'rgba(255, 255, 255, 0.15)'
        }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-3xl font-bold text-white mb-2">Odds Range Performance</div>
              <div className="text-xl text-gray-300">{stats.oddsRangeStats.range}x • Win Rate: {formatPercentage(stats.oddsRangeStats.win_rate)}</div>
              <div className="text-lg text-gray-400">{stats.oddsRangeStats.total_bets} bets</div>
            </div>
            <div className="text-6xl font-bold" style={{ color: stats.oddsRangeStats.win_rate >= 0.5 ? '#10b981' : '#ef4444' }}>
              {formatPercentage(stats.oddsRangeStats.win_rate)}
            </div>
          </div>
        </div>
      )
    });
  }

  // Show up to 7 valid stats (more in TikTok safe mode to fill the image)
  const maxStats = tiktokSafe ? 7 : 7;
  const statsToShow = validStats.slice(0, maxStats).map(stat => stat.element);

  // Calculate optimal spacing based on number of stats and TikTok safe mode
  const getOptimalStatsLayout = () => {
    const statsCount = statsToShow.length;
    // For TikTok, always use exactly 1920px height
    // Adjust spacing based on content
    if (tiktokSafe) {
      // TikTok Safe mode - optimize for 1920px
      if (statsCount <= 4) {
        return {
          height: '1920px',
          padding: '60px 40px',
          gap: '40px',
          headerMarginBottom: '40px',
          footerMarginTop: '40px'
        };
      } else if (statsCount <= 6) {
        return {
          height: '1920px',
          padding: '50px 40px',
          gap: '32px',
          headerMarginBottom: '32px',
          footerMarginTop: '32px'
        };
      } else {
        return {
          height: '1920px',
          padding: '40px 40px',
          gap: '24px',
          headerMarginBottom: '24px',
          footerMarginTop: '24px'
        };
      }
    } else {
      // Full mode - also optimized for TikTok 1920px height
      if (statsCount <= 4) {
        return {
          height: '1920px',
          padding: '60px 40px',
          gap: '40px',
          headerMarginBottom: '40px',
          footerMarginTop: '40px'
        };
      } else if (statsCount <= 6) {
        return {
          height: '1920px',
          padding: '50px 40px',
          gap: '32px',
          headerMarginBottom: '32px',
          footerMarginTop: '32px'
        };
      } else {
        return {
          height: '1920px', // Force 1920px for TikTok compliance
          padding: '40px 40px',
          gap: '24px',
          headerMarginBottom: '24px',
          footerMarginTop: '24px'
        };
      }
    }
  };

  const statsLayout = getOptimalStatsLayout();

  return (
    <div
      ref={containerRef}
      className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white image-generation-container"
      style={{
        width: '1080px',
        height: statsLayout.height,
        padding: statsLayout.padding,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden', // Changed from 'visible' to 'hidden' to ensure exact height
        fontSize: '16px',
        lineHeight: '1.5',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
      }}
    >
      {/* Header */}
      <div className="text-center" style={{ marginBottom: statsLayout.headerMarginBottom }}>
        <div className="text-7xl text-white font-bold mb-4">
          {tiktokSafe ? '⚽ Sports Analysis' : 'Bet Stats'}
        </div>
        <div className="text-4xl text-gray-300">
          {tiktokSafe ? '📊 Team & League Performance' : 'Performance Statistics'}
        </div>
      </div>

      {/* Stats Grid */}
      <div style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        gap: statsLayout.gap, 
        flex: '1', 
        marginBottom: statsLayout.footerMarginTop,
        overflow: 'hidden' // Ensure content doesn't overflow
      }}>
        {statsToShow.length > 0 ? statsToShow : (
          <div className="text-center text-3xl text-gray-400 py-20">
            No statistics available for this bet
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ 
        marginTop: 'auto', 
        paddingTop: '24px', 
        borderTop: '1px solid rgba(255, 255, 255, 0.15)',
        flexShrink: 0 // Prevent footer from shrinking
      }}>
        <div style={{ textAlign: 'center' }}>
          {tiktokSafe ? (
            <>
              <div className="text-3xl text-gray-400 font-semibold mb-3">Sports Analysis</div>
              <div 
                className="text-5xl font-bold"
                style={{
                  color: '#60a5fa',
                  textShadow: '0 2px 8px rgba(96, 165, 250, 0.3)',
                }}
              >
                Match Insights
              </div>
            </>
          ) : (
            <>
              <div className="text-3xl text-gray-400 font-semibold mb-3">Generated by</div>
              <div 
                className="text-5xl font-bold"
                style={{
                  color: '#60a5fa',
                  textShadow: '0 2px 8px rgba(96, 165, 250, 0.3)',
                }}
              >
                BetTracer
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
