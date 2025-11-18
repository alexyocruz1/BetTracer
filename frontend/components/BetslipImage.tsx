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
      <div className="text-center mb-12">
        <div className="mb-4">
          <div className="text-3xl text-gray-300 font-medium">{formatDate(bet.date)}</div>
        </div>
        {bet.state && bet.state !== 'pending' && (
          <div 
            className="inline-flex items-center gap-2 px-6 py-2 rounded-full text-2xl font-bold"
            style={{
              backgroundColor: `${getStateColor(bet.state)}20`,
              color: getStateColor(bet.state),
              border: `2px solid ${getStateColor(bet.state)}`,
            }}
          >
            <span>{getStateEmoji(bet.state)}</span>
            <span>{bet.state.toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Main Bet Info */}
      <div 
        className="rounded-3xl p-12 mb-10 border-2"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
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
      </div>

      {/* Legs */}
      <div className="space-y-6">
        {bet.legs?.map((leg, index) => (
          <div
            key={leg.id}
            className="rounded-2xl p-8 border-2 relative"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            {/* Leg number badge */}
            <div 
              className="absolute -top-4 -left-4 w-16 h-16 rounded-full flex items-center justify-center text-2xl font-black border-2 z-10"
              style={{
                backgroundColor: '#1e293b',
                borderColor: '#fbbf24',
                color: '#fbbf24',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                lineHeight: '1',
              }}
            >
              {index + 1}
            </div>

            <div className="flex items-start justify-between" style={{ paddingLeft: '20px' }}>
              <div className="flex-1">
                {/* Teams */}
                {(leg.home_team_id || leg.away_team_id) && (
                  <div className="text-3xl mb-3 font-bold">
                    <span className="text-white">{getReferenceName(leg.home_team_id)}</span>
                    {leg.home_team_id && leg.away_team_id && (
                      <span className="mx-4 text-gray-400 font-normal">vs</span>
                    )}
                    <span className="text-white">{getReferenceName(leg.away_team_id)}</span>
                  </div>
                )}

                {/* League */}
                {leg.league_id && (
                  <div className="text-xl text-gray-300 mb-3 font-medium">
                    {getReferenceName(leg.league_id)}
                  </div>
                )}

                {/* Bet Type and Category */}
                <div className="flex gap-3 mb-3 flex-wrap">
                  {leg.bet_type_id && (
                    <span 
                      className="px-4 py-1.5 rounded-full text-base font-semibold"
                      style={{ 
                        background: 'rgba(59, 130, 246, 0.4)',
                        border: '1px solid rgba(59, 130, 246, 0.6)',
                      }}
                    >
                      {getReferenceName(leg.bet_type_id)}
                    </span>
                  )}
                  {leg.category_id && (
                    <span 
                      className="px-4 py-1.5 rounded-full text-base font-semibold"
                      style={{ 
                        background: 'rgba(168, 85, 247, 0.4)',
                        border: '1px solid rgba(168, 85, 247, 0.6)',
                      }}
                    >
                      {getReferenceName(leg.category_id)}
                    </span>
                  )}
                </div>

                {/* Leg State */}
                {leg.result_state && leg.result_state !== 'pending' && (
                  <div 
                    className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-lg font-bold mt-2"
                    style={{
                      backgroundColor: `${getStateColor(leg.result_state)}30`,
                      color: getStateColor(leg.result_state),
                    }}
                  >
                    <span>{getStateEmoji(leg.result_state)}</span>
                    <span>{leg.result_state.toUpperCase()}</span>
                  </div>
                )}

                {/* Notes */}
                {leg.notes && (
                  <div className="text-base text-gray-300 mt-4 italic border-l-4 pl-3" style={{ borderColor: 'rgba(255, 255, 255, 0.3)' }}>
                    {leg.notes}
                  </div>
                )}
              </div>

              {/* Odds */}
              <div className="text-right ml-8 flex-shrink-0">
                <div className="text-xl text-gray-300 mb-2 font-medium">Odds</div>
                <div 
                  className="text-6xl font-black"
                  style={{ color: '#fbbf24' }}
                >
                  {leg.odd.toFixed(2)}x
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div className="mt-12 pt-8 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.1)' }}>
        <div className="text-center">
          <div className="text-lg text-gray-400 font-medium mb-1">Generated by</div>
          <div 
            className="text-2xl font-bold"
            style={{
              color: '#60a5fa',
            }}
          >
            BetTracer
          </div>
        </div>
      </div>
    </div>
  );
}

