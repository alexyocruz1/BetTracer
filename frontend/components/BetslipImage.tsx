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
      <div className="text-center mb-16">
        <h1 
          className="text-7xl font-extrabold mb-6"
          style={{
            background: 'linear-gradient(135deg, #60a5fa 0%, #a78bfa 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}
        >
          BETSLIP
        </h1>
        <div className="text-3xl text-gray-300 font-medium">{formatDate(bet.date)}</div>
      </div>

      {/* Main Bet Info */}
      <div 
        className="rounded-3xl p-10 mb-10 border-2"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
        }}
      >
        <div className="flex justify-between items-center mb-8">
          <div>
            <div className="text-4xl font-bold mb-3 text-gray-200">Total Odds</div>
            <div className="text-7xl font-black" style={{ color: '#fbbf24' }}>
              {bet.odds?.toFixed(2)}x
            </div>
          </div>
          <div className="text-right">
            <div className="text-3xl text-gray-300 mb-3 font-medium">Stake</div>
            <div className="text-6xl font-bold">${bet.stake.toFixed(2)}</div>
          </div>
        </div>
        <div className="pt-6 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
          <div className="text-2xl text-gray-300 mb-2 font-medium">Potential Win</div>
          <div 
            className="text-5xl font-bold"
            style={{ color: bet.profit_loss !== null && bet.profit_loss !== undefined && bet.profit_loss >= 0 ? '#4ade80' : '#f87171' }}
          >
            ${(bet.stake * (bet.odds || 1)).toFixed(2)}
          </div>
        </div>
      </div>

      {/* Legs */}
      <div className="space-y-8">
        {bet.legs?.map((leg, index) => (
          <div
            key={leg.id}
            className="rounded-2xl p-8 border-2"
            style={{
              background: 'rgba(255, 255, 255, 0.1)',
              backdropFilter: 'blur(10px)',
              borderColor: 'rgba(255, 255, 255, 0.2)',
            }}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <div 
                  className="text-3xl font-bold mb-4"
                  style={{ color: '#fbbf24' }}
                >
                  Leg {index + 1}
                </div>
                
                {/* Teams */}
                {(leg.home_team_id || leg.away_team_id) && (
                  <div className="text-2xl mb-3 font-semibold">
                    <span>{getReferenceName(leg.home_team_id)}</span>
                    {leg.home_team_id && leg.away_team_id && (
                      <span className="mx-3 text-gray-400">vs</span>
                    )}
                    <span>{getReferenceName(leg.away_team_id)}</span>
                  </div>
                )}

                {/* League */}
                {leg.league_id && (
                  <div className="text-xl text-gray-300 mb-4 font-medium">
                    {getReferenceName(leg.league_id)}
                  </div>
                )}

                {/* Bet Type and Category */}
                <div className="flex gap-4 mb-4">
                  {leg.bet_type_id && (
                    <span 
                      className="px-5 py-2 rounded-full text-lg font-medium"
                      style={{ background: 'rgba(59, 130, 246, 0.3)' }}
                    >
                      {getReferenceName(leg.bet_type_id)}
                    </span>
                  )}
                  {leg.category_id && (
                    <span 
                      className="px-5 py-2 rounded-full text-lg font-medium"
                      style={{ background: 'rgba(168, 85, 247, 0.3)' }}
                    >
                      {getReferenceName(leg.category_id)}
                    </span>
                  )}
                </div>

                {/* Notes */}
                {leg.notes && (
                  <div className="text-lg text-gray-300 mt-4 italic">{leg.notes}</div>
                )}
              </div>

              {/* Odds */}
              <div className="text-right ml-8">
                <div className="text-2xl text-gray-300 mb-2 font-medium">Odds</div>
                <div 
                  className="text-5xl font-black"
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
      <div className="mt-16 text-center text-gray-400 text-xl font-medium">
        <div>Generated by BetTracer</div>
      </div>
    </div>
  );
}

