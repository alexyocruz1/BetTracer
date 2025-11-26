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
        minHeight: '1920px',
        padding: '80px 60px',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        boxSizing: 'border-box',
        overflow: 'visible',
        fontSize: '16px', // Fixed base font size
        lineHeight: '1.5', // Fixed line height
      }}
    >
      {/* Header */}
      <div className="text-center mb-14">
        <div className="mb-6">
          <div className="text-6xl text-white font-bold mb-2">{formatDate(bet.date)}</div>
          {bet.id && (
            <div className="text-xl text-gray-400 font-mono">ID: {bet.id.slice(0, 8).toUpperCase()}</div>
          )}
        </div>
        {bet.state && (
          <div 
            className="inline-flex items-center gap-3 px-8 py-3 rounded-full text-3xl font-bold"
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
            <div className="text-3xl font-bold mb-4 text-gray-200">Total Odds</div>
            <div className="text-7xl font-black" style={{ color: '#fbbf24' }}>
              {bet.odds?.toFixed(2)}x
            </div>
          </div>
          <div className="flex-1 text-center" style={{ minWidth: '200px' }}>
            <div className="text-3xl font-bold mb-4 text-gray-200">Stake</div>
            <div className="text-7xl font-bold">${bet.stake.toFixed(2)}</div>
          </div>
          <div className="flex-1 text-right" style={{ minWidth: '200px' }}>
            <div className="text-3xl font-bold mb-4 text-gray-200">Legs</div>
            <div className="text-7xl font-bold">{bet.legs?.length || 0}</div>
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
      <div className="space-y-8">
        {bet.legs?.map((leg, index) => (
          <div
            key={leg.id}
            className="rounded-2xl p-10 border-2 relative"
            style={{
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
                  <div className="text-5xl mb-4 font-bold">
                    <span className="text-white">{getReferenceName(leg.home_team_id)}</span>
                    {leg.home_team_id && leg.away_team_id && (
                      <span className="mx-6 text-gray-300 font-semibold text-4xl">vs</span>
                    )}
                    <span className="text-white">{getReferenceName(leg.away_team_id)}</span>
                  </div>
                )}

                {/* League */}
                {leg.league_id && (
                  <div className="text-3xl text-gray-300 mb-4 font-semibold">
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
                <div className="text-2xl text-gray-300 mb-3 font-semibold">Odds</div>
                <div 
                  className="text-6xl font-black"
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
      <div className="mt-20 pt-12 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.15)' }}>
        <div className="text-center">
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
        </div>
      </div>
    </div>
  );
}


