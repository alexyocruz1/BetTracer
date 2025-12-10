'use client';

import { MainBet, ReferenceItem } from '@/types';
import { useEffect, useState, useRef } from 'react';
import { apiClient } from '@/lib/api/client';

interface BetslipImageProps {
  bet: MainBet;
  onReady?: () => void;
  tiktokSafe?: boolean; // When true, removes betting-specific content for TikTok compliance
}

export default function BetslipImage({ bet, onReady, tiktokSafe = false }: BetslipImageProps) {
  const [referenceItems, setReferenceItems] = useState<Map<string, ReferenceItem>>(new Map());
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchReferenceItems = async () => {
      try {
        // Fetch all reference items (no limit)
        const { data } = await apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?limit=1000');
        const itemsMap = new Map<string, ReferenceItem>();
        data.data.forEach(item => {
          itemsMap.set(item.id, item);
        });
        setReferenceItems(itemsMap);
        if (onReady) {
          // Small delay to ensure rendering is complete
          setTimeout(onReady, 100);
        }
      } catch (error) {
        console.error('Failed to fetch reference items:', error);
        if (onReady) {
          setTimeout(onReady, 100);
        }
      }
    };

    fetchReferenceItems();
  }, [onReady]);

  const getReferenceName = (id?: string): string => {
    if (!id) return 'N/A';
    return referenceItems.get(id)?.name || 'N/A';
  };

  // Generate contextual match analysis based on bet type and category
  const generateMatchAnalysis = (leg: any): string => {
    const betTypeName = getReferenceName(leg.bet_type_id);
    const categoryName = getReferenceName(leg.category_id);
    const homeTeam = getReferenceName(leg.home_team_id);
    const awayTeam = getReferenceName(leg.away_team_id);
    const league = getReferenceName(leg.league_id);

    // Team Win category - Reframed as match commentary
    if (categoryName === 'Team Win') {
      if (betTypeName.includes(' or Draw') || betTypeName.includes('Or Draw')) {
        const teamName = betTypeName.replace(/ or Draw/gi, '').replace(/Or Draw/gi, '').trim();
        return `${teamName} to win or draw. ${teamName} looks strong and should avoid defeat${homeTeam && awayTeam ? ` against ${betTypeName.includes(homeTeam) ? awayTeam : homeTeam}` : ''}. ${teamName} has been in good form and could secure at least a point.`;
      } else if (betTypeName.includes(' or ') && !betTypeName.includes('Draw')) {
        // Handle cases like "Fulham Or Crystal Palace"
        return `This match could go either way. Both ${betTypeName.split(' Or ')[0]} and ${betTypeName.split(' Or ')[1]} have chances in what should be a competitive fixture.`;
      } else {
        // Direct team win (e.g., "Arsenal", "Manchester City")
        return `${betTypeName} to win. ${betTypeName} looks the stronger side and has been performing well${homeTeam && awayTeam ? ` against ${betTypeName === homeTeam ? awayTeam : homeTeam}` : ''}. ${betTypeName} could come out on top in this match.`;
      }
    }

    // Match Goals category - Reframed as match commentary
    if (categoryName === 'Match Goals') {
      if (betTypeName.includes('Over')) {
        const goals = betTypeName.match(/Over ([\d.]+) Goals?/)?.[1] || '2.5';
        if (goals === '2.5') {
          // More than 2 goals = at least 3 goals
          return `We expect more than 2 goals in this match. Both ${homeTeam || 'teams'} and ${awayTeam || 'their opponents'} have attacking quality. Possible scorelines: 2-1, 1-2, or 3-0.`;
        } else if (goals === '1.5') {
          // More than 1 goal = at least 2 goals
          return `We expect more than 1 goal in this match. Both sides have shown they can find the net. Possible scorelines: 2-0, 1-1, or 0-2.`;
        } else if (goals === '3.5') {
          // More than 3 goals = at least 4 goals
          return `We expect more than 3 goals in this match. High-scoring affair on the cards with both teams having strong attacking records. Possible scorelines: 3-1, 2-2, or 4-0.`;
        } else {
          const minGoals = Math.ceil(parseFloat(goals));
          return `We expect more than ${goals} goals in this match. Both teams have been scoring regularly and this should produce plenty of attacking action.`;
        }
      } else if (betTypeName.includes('Under')) {
        const goals = betTypeName.match(/Under ([\d.]+) Goals?/)?.[1] || '3.5';
        if (goals === '3.5') {
          // Fewer than 3 goals = maximum 2 goals
          return `We expect fewer than 3 goals in this match. Tight defensive battle looks likely with both teams being solid at the back. Possible scorelines: 1-0, 1-1, or 2-0.`;
        } else if (goals === '2.5') {
          // Fewer than 2 goals = maximum 1 goal
          return `We expect fewer than 2 goals in this match. Low-scoring match on the cards with defensive strength from both sides. Possible scorelines: 1-0, 0-0, or 0-1.`;
        } else {
          const maxGoals = Math.floor(parseFloat(goals));
          return `We expect fewer than ${goals} goals in this match. A more cautious, defensive approach expected from both teams.`;
        }
      } else if (betTypeName.includes('Goals')) {
        const goals = betTypeName.match(/([\d.]+) Goals?/)?.[1];
        if (goals) {
          return `This match could see around ${goals} goals based on both teams' recent form.`;
        }
      }
    }

    // Match Corners category - Reframed as match commentary
    if (categoryName === 'Match Corners') {
      if (betTypeName.includes('Over')) {
        const corners = betTypeName.match(/Over ([\d.]+) Corners?/)?.[1] || '7.5';
        if (corners === '7.5') {
          return `Both teams like to attack down the wings, which should create plenty of corner opportunities. Possible corner counts: 8, 9, or 10 corners.`;
        } else {
          return `Wide attacking play from both teams should result in a high corner count in this match.`;
        }
      } else if (betTypeName.includes('Under')) {
        const corners = betTypeName.match(/Under ([\d.]+) Corners?/)?.[1] || '10.5';
        if (corners === '10.5') {
          return `Both teams tend to play more directly through the middle, which could limit corner opportunities. Possible corner counts: 8, 9, or 10 corners.`;
        } else if (corners === '12.5') {
          return `Moderate corner count looks likely. Both teams have balanced attacking styles. Possible corner counts: 9, 10, or 11 corners.`;
        } else if (corners === '7.5') {
          return `More central attacking play expected, which should keep corners lower. Possible corner counts: 5, 6, or 7 corners.`;
        } else {
          return `More direct attacking patterns from both teams could result in fewer corner opportunities.`;
        }
      }
    }

    // Match Cards category
    if (categoryName === 'Match Cards') {
      if (betTypeName.includes('Over')) {
        const cards = betTypeName.match(/Over ([\d.]+) Cards?/)?.[1] || '2.5';
        if (cards === '2.5') {
          return `Over 2.5 cards expected. Physical match anticipated with multiple bookings likely.`;
        } else if (cards === '3.5') {
          return `Over 3.5 cards expected. Competitive fixture with several card-worthy challenges expected.`;
        } else {
          return `Over ${cards} cards expected. High card count anticipated in this intense match.`;
        }
      } else if (betTypeName.includes('Under')) {
        const cards = betTypeName.match(/Under ([\d.]+) Cards?/)?.[1] || '5.5';
        return `Under ${cards} cards expected. More controlled, less physical match anticipated.`;
      }
    }

    // Team Goals category - Reframed as match commentary
    if (categoryName === 'Team Goals') {
      if (betTypeName.includes('Over')) {
        const goals = betTypeName.match(/Over ([\d.]+) Goals?/)?.[1] || '0.5';
        const teamName = betTypeName.split(':')[0]?.trim() || 'Team';
        if (goals === '0.5') {
          return `${teamName} has been scoring regularly and looks likely to find the net. ${teamName} has good attacking quality.`;
        } else if (goals === '1.5') {
          return `${teamName} has been in strong scoring form and could find the net multiple times. Their attacking play has been impressive.`;
        } else {
          return `${teamName} has been prolific in front of goal and could score multiple times. Strong attacking display on the cards.`;
        }
      }
    }

    // Team Cards category
    if (categoryName === 'Team Cards') {
      if (betTypeName.includes('Over')) {
        const cards = betTypeName.match(/Over ([\d.]+) Cards?/)?.[1] || '1.5';
        const teamName = betTypeName.split(':')[0]?.trim() || 'Team';
        return `${teamName} to receive over ${cards} cards. Physical approach expected from ${teamName}.`;
      }
    }

    // Both Teams To Score category - Reframed as match commentary
    if (categoryName === 'Both Teams To Score' || betTypeName === 'Both Teams To Score') {
      return `Both ${homeTeam || 'teams'} and ${awayTeam || 'their opponents'} have been scoring regularly. This looks like an open match with goals from both sides.`;
    }

    // Player Goals category - Reframed as match commentary
    if (categoryName === 'Player Goals') {
      if (betTypeName.includes('Goal or Assist')) {
        const playerName = betTypeName.split(':')[0]?.trim();
        return `${playerName} has been in excellent form and is a key attacking threat. ${playerName} is likely to be involved in the goals.`;
      }
    }

    // Player Shots category - Reframed as match commentary
    if (categoryName === 'Player Shots') {
      if (betTypeName.includes('Shots On Target')) {
        const shots = betTypeName.match(/(\d+)\+ Shots On Target/)?.[1] || '2';
        const playerName = betTypeName.split(':')[0]?.trim();
        return `${playerName} has been getting into good positions and creating chances. ${playerName} is a key attacking outlet.`;
      }
    }

    // Team Shots category - Reframed as match commentary
    if (categoryName === 'Team Shots') {
      if (betTypeName.includes('Shots On Target')) {
        const shots = betTypeName.match(/(\d+)\+ Shots On Target/)?.[1] || '3';
        const teamName = betTypeName.split(':')[0]?.trim();
        return `${teamName} has been creating plenty of chances and getting shots on target. Their attacking play should create multiple scoring opportunities.`;
      }
    }

    // Team Qualify category
    if (categoryName === 'Team Qualify') {
      return `${betTypeName} to qualify. ${betTypeName} has a strong chance to advance in this competition.`;
    }

    // Double Opportunity category
    if (categoryName === 'Double Opportunity') {
      if (betTypeName.includes(' or Draw')) {
        const teamName = betTypeName.replace(' or Draw', '').trim();
        return `${teamName} to win or draw. ${teamName} should avoid defeat in this fixture.`;
      } else if (betTypeName.includes(' or ')) {
        return `${betTypeName} expected. Multiple favorable outcomes possible in this match.`;
      }
    }

    // Default analysis - Try to infer from bet type name if it's a team
    if (homeTeam && awayTeam) {
      // Check if bet type name matches one of the teams
      if (betTypeName && (betTypeName === homeTeam || betTypeName === awayTeam)) {
        return `${betTypeName} to win. ${betTypeName} looks the stronger side in this ${league || 'league'} fixture and has been in good form${betTypeName === homeTeam ? ` against ${awayTeam}` : ` against ${homeTeam}`}. ${betTypeName} could come out on top.`;
      } else if (betTypeName && (betTypeName.includes(' or Draw') || betTypeName.includes('Or Draw'))) {
        // Check for "or Draw" in bet type name
        const teamName = betTypeName.replace(/ or Draw/gi, '').replace(/Or Draw/gi, '').trim();
        const opponent = teamName === homeTeam ? awayTeam : (teamName === awayTeam ? homeTeam : 'their opponent');
        return `${teamName} to win or draw. ${teamName} looks strong and should avoid defeat against ${opponent} in this ${league || 'league'} fixture.`;
      } else if (betTypeName && (betTypeName.includes(homeTeam) || betTypeName.includes(awayTeam))) {
        // Partial match
        const mentionedTeam = betTypeName.includes(homeTeam) ? homeTeam : awayTeam;
        const opponent = mentionedTeam === homeTeam ? awayTeam : homeTeam;
        return `${mentionedTeam} to win. ${mentionedTeam} looks to have the edge against ${opponent} in this ${league || 'league'} fixture.`;
      }
      return `${homeTeam} vs ${awayTeam} in ${league || 'this league'}. Key fixture with interesting tactical battle expected. Both teams have quality and this should be competitive.`;
    }

    return `Important match to watch. This fixture presents an interesting tactical battle worth analyzing.`;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate optimal layout based on number of legs
  const getOptimalBetslipLayout = (legCount: number) => {
    // TikTok optimal size: 1080x1920px (9:16 aspect ratio)
    // We need to fit everything within 1920px height
    // When tiktokSafe is true, ALWAYS use 1920px height for TikTok compliance
    
    // If TikTok Safe mode, always use 1920px and optimize spacing
    if (tiktokSafe) {
      if (legCount <= 3) {
        return {
          height: '1920px', // Standard TikTok
          legPadding: '40px',
          legSpacing: '32px',
          fontSize: 'large',
          headerHeight: 200, // Reduced for TikTok safe
          summaryHeight: 180, // Reduced for TikTok safe
          footerHeight: 120,
          paddingTop: 60,
          paddingBottom: 50
        };
      } else if (legCount === 4) {
        return {
          height: '1920px', // Standard TikTok - must fit!
          legPadding: '28px',
          legSpacing: '20px',
          fontSize: 'medium',
          headerHeight: 180, // Reduced for TikTok safe
          summaryHeight: 160, // Reduced for TikTok safe
          footerHeight: 100,
          paddingTop: 50,
          paddingBottom: 40
        };
      } else if (legCount <= 6) {
        return {
          height: '1920px', // Force 1920px for TikTok
          legPadding: '20px',
          legSpacing: '12px',
          fontSize: 'small',
          headerHeight: 160,
          summaryHeight: 140,
          footerHeight: 80,
          paddingTop: 40,
          paddingBottom: 30
        };
      } else {
        return {
          height: '1920px', // Force 1920px for TikTok
          legPadding: '16px',
          legSpacing: '8px',
          fontSize: 'small',
          headerHeight: 140,
          summaryHeight: 120,
          footerHeight: 60,
          paddingTop: 30,
          paddingBottom: 20
        };
      }
    }
    
    // Full mode - also optimized for TikTok 1920px height
    // Need to be more compact than TikTok safe mode due to additional betting info
    if (legCount <= 3) {
      // Few legs - compact spacing to fit footer
      return {
        height: '1920px', // Standard TikTok
        legPadding: '36px', // Slightly reduced
        legSpacing: '28px', // Slightly reduced
        fontSize: 'large',
        headerHeight: 220, // Reduced to make room for footer
        summaryHeight: 200, // Reduced to make room for footer
        footerHeight: 120,
        paddingTop: 50,
        paddingBottom: 50 // Ensure footer space
      };
    } else if (legCount === 4) {
      // 4 legs - optimized to fit TikTok's 1920px height
      // More compact spacing while maintaining readability
      return {
        height: '1920px', // Standard TikTok - must fit!
        legPadding: '24px', // More compact
        legSpacing: '16px', // More compact
        fontSize: 'medium',
        headerHeight: 200, // Reduced to make room for footer
        summaryHeight: 160, // Reduced to make room for footer
        footerHeight: 100,
        paddingTop: 50,
        paddingBottom: 40 // Ensure footer space
      };
    } else if (legCount <= 6) {
      // 5-6 legs - compact to fit 1920px
      return {
        height: '1920px', // Force 1920px for TikTok compliance
        legPadding: '20px', // More compact
        legSpacing: '12px', // Tighter spacing
        fontSize: 'medium',
        headerHeight: 180, // Reduced to make room for footer
        summaryHeight: 140, // Reduced to make room for footer
        footerHeight: 80,
        paddingTop: 40,
        paddingBottom: 30 // Ensure footer space
      };
    } else {
      // Many legs - very compact spacing to fit 1920px
      return {
        height: '1920px', // Force 1920px for TikTok compliance
        legPadding: '16px', // Very compact
        legSpacing: '8px', // Very tight spacing
        fontSize: 'small',
        headerHeight: 160, // Reduced to make room for footer
        summaryHeight: 120, // Reduced to make room for footer
        footerHeight: 60,
        paddingTop: 30,
        paddingBottom: 20 // Ensure footer space
      };
    }
  };

  const legCount = bet.legs?.length || 0;
  const layout = getOptimalBetslipLayout(legCount);

  // Dynamic font sizes based on leg count
  const getFontSizes = () => {
    if (legCount <= 3) {
      return {
        headerDate: 'text-6xl',
        headerID: 'text-xl',
        status: 'text-3xl',
        statLabel: 'text-3xl',
        statValue: 'text-7xl',
        legTitle: 'text-2xl',
        legDetails: 'text-lg',
        legOdds: 'text-4xl'
      };
    } else if (legCount <= 6) {
      return {
        headerDate: 'text-5xl',
        headerID: 'text-lg',
        status: 'text-2xl',
        statLabel: 'text-2xl',
        statValue: 'text-6xl',
        legTitle: 'text-xl',
        legDetails: 'text-base',
        legOdds: 'text-3xl'
      };
    } else {
      return {
        headerDate: 'text-4xl',
        headerID: 'text-base',
        status: 'text-xl',
        statLabel: 'text-xl',
        statValue: 'text-5xl',
        legTitle: 'text-lg',
        legDetails: 'text-sm',
        legOdds: 'text-2xl'
      };
    }
  };

  const fonts = getFontSizes();

  // Debug logging
  if (typeof window !== 'undefined' && process.env.NODE_ENV === 'development') {
    const estimatedContentHeight = legCount * 120 + (legCount - 1) * parseInt(layout.legSpacing) + 200 + 150 + 100 + 120;
    console.log(`Betslip Layout: ${legCount} legs → ${layout.height} height`);
    console.log(`Estimated content height: ${estimatedContentHeight}px`);
    console.log(`Layout spacing: ${layout.legSpacing}, padding: ${layout.legPadding}`);
  }

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
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

  return (
    <div
      ref={containerRef}
      className="bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900 text-white image-generation-container"
      style={{
        width: '1080px',
        height: layout.height, // Dynamic height based on leg count
        padding: `${layout.paddingTop || 60}px 40px ${layout.paddingBottom || 60}px 40px`, // Dynamic padding based on layout
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden', // Keep hidden but ensure height is sufficient
        fontSize: '16px',
        lineHeight: '1.5',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start', // Natural flow
      }}
    >
      {/* Header */}
      <div className="text-center" style={{ marginBottom: legCount === 4 ? '24px' : '40px' }}>
        <div className="mb-6">
          <div className={`${fonts.headerDate} text-white font-bold mb-2`}>
            {tiktokSafe ? '⚽ Today\'s Matches' : formatDate(bet.date)}
          </div>
          {!tiktokSafe && bet.id && (
            <div className={`${fonts.headerID} text-gray-400 font-mono`}>ID: {bet.id.slice(0, 8).toUpperCase()}</div>
          )}
          {tiktokSafe && (
            <div className={`${fonts.headerID} text-gray-300 font-semibold`} style={{ fontSize: legCount === 4 ? '18px' : '20px' }}>
              📊 Sports Analysis & Match Predictions
            </div>
          )}
        </div>
        {!tiktokSafe && bet.state && (
          <div 
            className={`inline-flex items-center gap-3 px-6 py-2 rounded-full ${fonts.status} font-bold`}
            style={{
              backgroundColor: `${getStateColor(bet.state)}20`,
              color: getStateColor(bet.state),
              border: `3px solid ${getStateColor(bet.state)}`,
              boxShadow: `0 4px 12px ${getStateColor(bet.state)}40`,
            }}
          >
            <span>{getStateEmoji(bet.state)}</span>
            <span>{bet.state.toUpperCase()}</span>
          </div>
        )}
        {tiktokSafe && (
          <div 
            className="inline-flex items-center gap-3 px-6 py-2 rounded-full text-xl font-bold"
            style={{
              backgroundColor: 'rgba(96, 165, 250, 0.2)',
              color: '#60a5fa',
              border: '3px solid rgba(96, 165, 250, 0.4)',
              boxShadow: '0 4px 12px rgba(96, 165, 250, 0.3)',
            }}
          >
            <span>⚽</span>
            <span>Match Insights</span>
          </div>
        )}
      </div>

      {/* Main Bet Info */}
      <div 
        className="rounded-3xl border-2"
        style={{
          padding: legCount === 4 ? '28px' : (legCount <= 6 ? '36px' : '32px'),
          marginBottom: legCount === 4 ? '20px' : (legCount <= 6 ? '32px' : '24px'),
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {!tiktokSafe && (
          <>
            <div className="flex justify-between items-start" style={{ gap: legCount === 4 ? '32px' : (legCount <= 6 ? '48px' : '40px'), marginBottom: legCount === 4 ? '16px' : (legCount <= 6 ? '28px' : '20px') }}>
              <div className="flex-1" style={{ minWidth: '200px' }}>
                <div className={`${fonts.statLabel} font-bold text-gray-200`} style={{ marginBottom: legCount === 4 ? '10px' : (legCount <= 6 ? '12px' : '10px') }}>Total Odds</div>
                <div className={`${fonts.statValue} font-black`} style={{ color: '#fbbf24' }}>
                  {bet.odds?.toFixed(2)}x
                </div>
              </div>
              <div className="flex-1 text-center" style={{ minWidth: '200px' }}>
                <div className={`${fonts.statLabel} font-bold text-gray-200`} style={{ marginBottom: legCount === 4 ? '10px' : (legCount <= 6 ? '12px' : '10px') }}>Stake</div>
                <div className={`${fonts.statValue} font-bold`}>${bet.stake.toFixed(2)}</div>
              </div>
              <div className="flex-1 text-right" style={{ minWidth: '200px' }}>
                <div className={`${fonts.statLabel} font-bold text-gray-200`} style={{ marginBottom: legCount === 4 ? '10px' : (legCount <= 6 ? '12px' : '10px') }}>Matches</div>
                <div className={`${fonts.statValue} font-bold`}>{bet.legs?.length || 0}</div>
              </div>
            </div>
            <div className="border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)', paddingTop: legCount === 4 ? '16px' : (legCount <= 6 ? '24px' : '16px') }}>
              <div className="flex justify-between items-center">
                <div>
                  <div 
                    className="text-gray-300 font-medium"
                    style={{ 
                      fontSize: legCount === 4 ? '20px' : '24px',
                      marginBottom: legCount === 4 ? '8px' : '12px'
                    }}
                  >
                    {bet.profit_loss !== null && bet.profit_loss !== undefined ? 'Profit/Loss' : 'Potential Win'}
                  </div>
                  <div 
                    className="font-bold"
                    style={{ 
                      fontSize: legCount === 4 ? '48px' : '64px',
                      color: bet.profit_loss !== null && bet.profit_loss !== undefined 
                        ? (bet.profit_loss >= 0 ? '#4ade80' : '#f87171')
                        : '#60a5fa'
                    }}
                  >
                    {bet.profit_loss !== null && bet.profit_loss !== undefined 
                      ? `$${bet.profit_loss >= 0 ? '+' : ''}${bet.profit_loss.toFixed(2)}`
                      : `$${(bet.stake * (bet.odds || 1)).toFixed(2)}`
                    }
                  </div>
                </div>
                {bet.profit_loss !== null && bet.profit_loss !== undefined && (
                  <div className="text-right">
                    <div 
                      className="text-gray-300 font-medium"
                      style={{ 
                        fontSize: legCount === 4 ? '20px' : '24px',
                        marginBottom: legCount === 4 ? '8px' : '12px'
                      }}
                    >
                      ROI
                    </div>
                    <div 
                      className="font-bold"
                      style={{ 
                        fontSize: legCount === 4 ? '40px' : '56px',
                        color: bet.profit_loss >= 0 ? '#4ade80' : '#f87171'
                      }}
                    >
                      {((bet.profit_loss / bet.stake) * 100).toFixed(1)}%
                    </div>
                  </div>
                )}
              </div>
            </div>
          </>
        )}
        {tiktokSafe && (
          <div>
            <div className="text-center mb-6">
              <div className={`${fonts.statLabel} font-bold text-gray-200 mb-2`}>Today's Match Analysis</div>
              <div className={`${fonts.statValue} font-bold`} style={{ fontSize: legCount === 4 ? '48px' : '64px', color: '#60a5fa' }}>
                {bet.legs?.length || 0} Matches
              </div>
            </div>
            <div className="border-t border-gray-600 pt-6 mt-6">
              <div className="text-center">
                <div className="text-2xl text-gray-300 font-semibold mb-2">📊 Match Insights</div>
                <div className="text-lg text-gray-400">
                  Detailed analysis of today's key fixtures
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Bet Notes */}
        {bet.notes && (
          <div className="border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)', marginTop: legCount === 4 ? '20px' : '32px', paddingTop: legCount === 4 ? '20px' : '32px' }}>
            <div className="text-xl text-gray-300 font-medium mb-2">Notes</div>
            <div className="text-lg text-gray-200 italic">{bet.notes}</div>
          </div>
        )}
      </div>

      {/* Legs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: layout.legSpacing, flex: '1', marginBottom: legCount === 4 ? '24px' : '40px' }}>
        {bet.legs?.map((leg, index) => (
          <div
            key={leg.id}
            className="rounded-2xl border-2 relative"
            style={{
              padding: layout.legPadding,
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
              boxShadow: '0 4px 16px rgba(0, 0, 0, 0.2)',
            }}
          >
            {/* Leg number badge */}
            <div 
              style={{
                position: 'absolute',
                top: legCount === 4 ? '-15px' : '-20px',
                left: legCount === 4 ? '-15px' : '-20px',
                width: legCount === 4 ? '70px' : '80px',
                height: legCount === 4 ? '70px' : '80px',
                backgroundColor: '#1e293b',
                border: '3px solid #fbbf24',
                borderRadius: '50%',
                color: '#fbbf24',
                fontSize: legCount === 4 ? '28px' : '32px',
                fontWeight: '900',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxSizing: 'border-box',
                zIndex: 10,
                boxShadow: '0 4px 12px rgba(251, 191, 36, 0.4)',
              }}
            >
              {index + 1}
            </div>

            <div className="flex items-start justify-between" style={{ paddingLeft: '20px' }}>
              <div className="flex-1">
                {/* Teams */}
                {(leg.home_team_id || leg.away_team_id) && (
                  <div className={`${fonts.legTitle} mb-4 font-bold`}>
                    <span className="text-white">{getReferenceName(leg.home_team_id)}</span>
                    {leg.home_team_id && leg.away_team_id && (
                      <span className={`mx-6 text-gray-300 font-semibold ${fonts.legDetails}`}>vs</span>
                    )}
                    <span className="text-white">{getReferenceName(leg.away_team_id)}</span>
                  </div>
                )}

                {/* League */}
                {leg.league_id && (
                  <div className={`${fonts.legDetails} text-gray-300 mb-4 font-semibold`}>
                    {getReferenceName(leg.league_id)}
                  </div>
                )}

                {/* TikTok Safe Mode - Match Analysis */}
                {tiktokSafe && (
                  <div style={{ 
                    background: 'rgba(96, 165, 250, 0.15)',
                    border: '2px solid rgba(96, 165, 250, 0.3)',
                    borderRadius: '12px',
                    padding: '16px',
                    marginTop: '16px',
                    marginBottom: '16px'
                  }}>
                    <div className="text-lg font-bold text-white mb-2">🔍 Match Analysis</div>
                    <div className="text-base text-gray-200" style={{ lineHeight: '1.6' }}>
                      {generateMatchAnalysis(leg)}
                    </div>
                  </div>
                )}

                {/* Bet Type and Category - Hidden in TikTok safe mode */}
                {!tiktokSafe && (
                  <div style={{ display: 'flex', gap: '16px', marginBottom: '16px', flexWrap: 'wrap', alignItems: 'center' }}>
                    {leg.bet_type_id && (
                      <div
                        style={{ 
                          background: 'rgba(59, 130, 246, 0.4)',
                          border: '2px solid rgba(59, 130, 246, 0.6)',
                          borderRadius: '9999px',
                          paddingLeft: '20px',
                          paddingRight: '20px',
                          paddingTop: '14px',
                          paddingBottom: '14px',
                          fontSize: '22px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box',
                        }}
                      >
                        {getReferenceName(leg.bet_type_id)}
                      </div>
                    )}
                    {leg.category_id && (
                      <div
                        style={{ 
                          background: 'rgba(168, 85, 247, 0.4)',
                          border: '2px solid rgba(168, 85, 247, 0.6)',
                          borderRadius: '9999px',
                          paddingLeft: '20px',
                          paddingRight: '20px',
                          paddingTop: '14px',
                          paddingBottom: '14px',
                          fontSize: '22px',
                          fontWeight: '700',
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          whiteSpace: 'nowrap',
                          boxSizing: 'border-box',
                        }}
                      >
                        {getReferenceName(leg.category_id)}
                      </div>
                    )}
                  </div>
                )}

                {/* Leg State - Hidden in TikTok safe mode */}
                {!tiktokSafe && leg.result_state && (
                  <div 
                    className="inline-flex items-center gap-2 px-5 py-2 rounded-full text-2xl font-bold mt-3"
                    style={{
                      backgroundColor: `${getStateColor(leg.result_state)}30`,
                      color: getStateColor(leg.result_state),
                      border: `2px solid ${getStateColor(leg.result_state)}60`,
                    }}
                  >
                    <span>{getStateEmoji(leg.result_state)}</span>
                    <span>{leg.result_state.toUpperCase()}</span>
                  </div>
                )}

                {/* Notes */}
                {leg.notes && (
                  <div className={`${tiktokSafe ? 'text-lg' : 'text-xl'} text-gray-300 mt-5 italic border-l-4 pl-4`} style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                    {tiktokSafe ? `💡 Insight: ${leg.notes}` : leg.notes}
                  </div>
                )}
                
                {/* TikTok Safe Mode - Additional insights */}
                {tiktokSafe && leg.league_id && (
                  <div className="text-base text-gray-300 mt-3" style={{ fontStyle: 'italic' }}>
                    📍 {getReferenceName(leg.league_id)} fixture
                  </div>
                )}
              </div>

              {/* Odds - Hidden in TikTok safe mode */}
              {!tiktokSafe && (
                <div className="text-right ml-8 flex-shrink-0">
                  <div className={`${fonts.legDetails} text-gray-300 mb-3 font-semibold`}>Odds</div>
                  <div 
                    className={`${fonts.legOdds} font-black`}
                    style={{ 
                      color: '#fbbf24',
                      textShadow: '0 2px 8px rgba(251, 191, 36, 0.3)',
                    }}
                  >
                    {leg.odd.toFixed(2)}x
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ 
        marginTop: 'auto', 
        paddingTop: legCount === 4 ? '16px' : (legCount <= 6 ? '20px' : '16px'), 
        paddingBottom: '0',
        borderTop: '1px solid rgba(255, 255, 255, 0.15)',
        flexShrink: 0 // Prevent footer from being compressed
      }}>
        <div style={{ textAlign: 'center' }}>
          {tiktokSafe ? (
            <>
              <div className={`${fonts.legDetails} text-gray-400 font-semibold mb-2`} style={{ fontSize: legCount >= 5 ? '16px' : undefined }}>Sports Analysis</div>
              <div 
                className={`${fonts.statLabel} font-bold`}
                style={{
                  color: '#60a5fa',
                  textShadow: '0 2px 8px rgba(96, 165, 250, 0.3)',
                  fontSize: legCount >= 5 ? '24px' : undefined
                }}
              >
                Match Insights
              </div>
            </>
          ) : (
            <>
              <div className={`${fonts.legDetails} text-gray-400 font-semibold mb-2`} style={{ fontSize: legCount >= 5 ? '16px' : undefined }}>Generated by</div>
              <div 
                className={`${fonts.statLabel} font-bold`}
                style={{
                  color: '#60a5fa',
                  textShadow: '0 2px 8px rgba(96, 165, 250, 0.3)',
                  fontSize: legCount >= 5 ? '24px' : undefined
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


