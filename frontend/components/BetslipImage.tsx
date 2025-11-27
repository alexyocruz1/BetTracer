'use client';

import { MainBet, ReferenceItem } from '@/types';
import { useEffect, useState, useRef } from 'react';
import { apiClient } from '@/lib/api/client';

interface BetslipImageProps {
  bet: MainBet;
  onReady?: () => void;
}

export default function BetslipImage({ bet, onReady }: BetslipImageProps) {
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

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  // Calculate optimal layout based on number of legs
  const getOptimalBetslipLayout = (legCount: number) => {
    // Estimate space needed per leg (including padding and content) - increased estimates
    const baseLegHeight = 180; // Base height per leg (increased from 120)
    const legSpacing = 32; // Space between legs
    const headerHeight = 250; // Header space (increased)
    const summaryHeight = 200; // Summary section (increased)
    const footerHeight = 150; // Footer space (increased)
    const padding = 120; // Top/bottom padding
    
    // Calculate content height
    const legsContentHeight = legCount * baseLegHeight + (legCount - 1) * legSpacing;
    const totalContentHeight = headerHeight + legsContentHeight + summaryHeight + footerHeight + padding;
    
    // Determine layout based on content needs
    if (legCount <= 3) {
      // Few legs - generous spacing
      return {
        height: '1920px', // Standard TikTok
        legPadding: '40px',
        legSpacing: '32px',
        fontSize: 'large'
      };
    } else if (legCount <= 6) {
      // Medium legs - balanced spacing
      const calculatedHeight = Math.max(1920, Math.min(2400, totalContentHeight));
      return {
        height: `${calculatedHeight}px`,
        legPadding: '32px',
        legSpacing: '24px',
        fontSize: 'medium'
      };
    } else {
      // Many legs - compact spacing
      const calculatedHeight = Math.max(2000, Math.min(2880, totalContentHeight));
      return {
        height: `${calculatedHeight}px`,
        legPadding: '24px',
        legSpacing: '16px',
        fontSize: 'small'
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
        padding: '60px 40px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        overflow: 'hidden',
        fontSize: '16px',
        lineHeight: '1.5',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start', // Natural flow
      }}
    >
      {/* Header */}
      <div className="text-center mb-10">
        <div className="mb-6">
          <div className={`${fonts.headerDate} text-white font-bold mb-2`}>{formatDate(bet.date)}</div>
          {bet.id && (
            <div className={`${fonts.headerID} text-gray-400 font-mono`}>ID: {bet.id.slice(0, 8).toUpperCase()}</div>
          )}
        </div>
        {bet.state && (
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
      </div>

      {/* Main Bet Info */}
      <div 
        className="rounded-3xl p-12 mb-12 border-2"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        <div className="flex justify-between items-start mb-10" style={{ gap: '60px' }}>
          <div className="flex-1" style={{ minWidth: '200px' }}>
            <div className={`${fonts.statLabel} font-bold mb-4 text-gray-200`}>Total Odds</div>
            <div className={`${fonts.statValue} font-black`} style={{ color: '#fbbf24' }}>
              {bet.odds?.toFixed(2)}x
            </div>
          </div>
          <div className="flex-1 text-center" style={{ minWidth: '200px' }}>
            <div className={`${fonts.statLabel} font-bold mb-4 text-gray-200`}>Stake</div>
            <div className={`${fonts.statValue} font-bold`}>${bet.stake.toFixed(2)}</div>
          </div>
          <div className="flex-1 text-right" style={{ minWidth: '200px' }}>
            <div className={`${fonts.statLabel} font-bold mb-4 text-gray-200`}>Legs</div>
            <div className={`${fonts.statValue} font-bold`}>{bet.legs?.length || 0}</div>
          </div>
        </div>
        <div className="pt-8 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
          <div className="flex justify-between items-center">
            <div>
              <div className="text-2xl text-gray-300 mb-3 font-medium">
                {bet.profit_loss !== null && bet.profit_loss !== undefined ? 'Profit/Loss' : 'Potential Win'}
              </div>
              <div 
                className="text-6xl font-bold"
                style={{ 
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
                <div className="text-2xl text-gray-300 mb-3 font-medium">ROI</div>
                <div 
                  className="text-5xl font-bold"
                  style={{ color: bet.profit_loss >= 0 ? '#4ade80' : '#f87171' }}
                >
                  {((bet.profit_loss / bet.stake) * 100).toFixed(1)}%
                </div>
              </div>
            )}
          </div>
        </div>
        {/* Bet Notes */}
        {bet.notes && (
          <div className="mt-8 pt-8 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
            <div className="text-xl text-gray-300 font-medium mb-2">Notes</div>
            <div className="text-lg text-gray-200 italic">{bet.notes}</div>
          </div>
        )}
      </div>

      {/* Legs */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: layout.legSpacing, flex: '1', marginBottom: '40px' }}>
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
                top: '-20px',
                left: '-20px',
                width: '80px',
                height: '80px',
                backgroundColor: '#1e293b',
                border: '3px solid #fbbf24',
                borderRadius: '50%',
                color: '#fbbf24',
                fontSize: '32px',
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

                {/* Bet Type and Category */}
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

                {/* Leg State */}
                {leg.result_state && (
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
                  <div className="text-xl text-gray-300 mt-5 italic border-l-4 pl-4" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                    {leg.notes}
                  </div>
                )}
              </div>

              {/* Odds */}
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
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ marginTop: 'auto', paddingTop: '32px', borderTop: '1px solid rgba(255, 255, 255, 0.15)' }}>
        <div style={{ textAlign: 'center' }}>
          <div className={`${fonts.legDetails} text-gray-400 font-semibold mb-3`}>Generated by</div>
          <div 
            className={`${fonts.statLabel} font-bold`}
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


