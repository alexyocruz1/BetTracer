'use client';

import { MainBet } from '@/types';
import { useEffect, useRef } from 'react';

interface HighlightStatsImageProps {
  bet: MainBet;
  onReady?: () => void;
}

export default function HighlightStatsImage({ bet, onReady }: HighlightStatsImageProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (onReady) {
      // Small delay to ensure rendering is complete
      setTimeout(onReady, 100);
    }
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

  // Calculate effective odds excluding voided legs
  const calculateEffectiveOdds = (): number => {
    if (!bet.legs || bet.legs.length === 0) {
      return bet.odds || 0;
    }

    const nonVoidedLegs = bet.legs.filter(leg => leg.result_state !== 'void');
    if (nonVoidedLegs.length === 0) {
      return 0;
    }

    return nonVoidedLegs.reduce((acc, leg) => acc * leg.odd, 1);
  };

  const effectiveOdds = calculateEffectiveOdds();
  const displayOdds = effectiveOdds || bet.odds || 0;
  const potentialWin = bet.stake * displayOdds;
  const hasProfitLoss = bet.profit_loss !== null && bet.profit_loss !== undefined;
  const profitLossValue = hasProfitLoss ? bet.profit_loss! : null;
  const roi = profitLossValue !== null ? (profitLossValue / bet.stake) * 100 : null;

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
          <div className="text-7xl text-white font-bold mb-3">{formatDate(bet.date)}</div>
        </div>
        {bet.state && (
          <div 
            className="inline-flex items-center gap-4 px-10 py-4 rounded-full text-4xl font-bold"
            style={{
              backgroundColor: `${getStateColor(bet.state)}20`,
              color: getStateColor(bet.state),
              border: `4px solid ${getStateColor(bet.state)}`,
              boxShadow: `0 6px 20px ${getStateColor(bet.state)}40`,
            }}
          >
            <span className="text-5xl">{getStateEmoji(bet.state)}</span>
            <span>{bet.state.toUpperCase()}</span>
          </div>
        )}
      </div>

      {/* Main Statistics Card */}
      <div 
        className="rounded-3xl p-14 mb-14 border-2"
        style={{
          background: 'rgba(255, 255, 255, 0.1)',
          backdropFilter: 'blur(10px)',
          borderColor: 'rgba(255, 255, 255, 0.2)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
        }}
      >
        {/* Top Row: Odds, Stake, Legs */}
        <div className="grid grid-cols-3 gap-8 mb-12">
          <div className="text-center">
            <div className="text-4xl font-bold mb-5 text-gray-300">Total Odds</div>
            <div className="text-8xl font-black" style={{ color: '#fbbf24' }}>
              {displayOdds.toFixed(2)}x
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold mb-5 text-gray-300">Stake</div>
            <div className="text-8xl font-bold text-white">
              ${bet.stake.toFixed(2)}
            </div>
          </div>
          <div className="text-center">
            <div className="text-4xl font-bold mb-5 text-gray-300">Legs</div>
            <div className="text-8xl font-bold text-white">
              {bet.legs?.length || 0}
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t mb-12" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }} />

        {/* Bottom Row: Profit/Loss or Potential Win */}
        <div className="flex justify-center items-center">
          <div className="text-center">
            <div className="text-4xl text-gray-300 mb-6 font-medium">
              {hasProfitLoss ? 'Profit/Loss' : 'Potential Win'}
            </div>
            <div 
              className="text-9xl font-black mb-6"
              style={{ 
                color: hasProfitLoss && profitLossValue !== null
                  ? (profitLossValue >= 0 ? '#4ade80' : '#f87171')
                  : '#60a5fa'
              }}
            >
              {hasProfitLoss && profitLossValue !== null
                ? `$${profitLossValue >= 0 ? '+' : ''}${profitLossValue.toFixed(2)}`
                : `$${potentialWin.toFixed(2)}`
              }
            </div>
            {hasProfitLoss && roi !== null && profitLossValue !== null && (
              <div 
                className="text-6xl font-bold mt-4"
                style={{ 
                  color: profitLossValue >= 0 ? '#4ade80' : '#f87171'
                }}
              >
                {roi >= 0 ? '+' : ''}{roi.toFixed(1)}% ROI
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Leg Statistics Summary */}
      {bet.legs && bet.legs.length > 0 && (
        <div 
          className="rounded-3xl p-12 mb-14 border-2"
          style={{
            background: 'rgba(255, 255, 255, 0.1)',
            backdropFilter: 'blur(10px)',
            borderColor: 'rgba(255, 255, 255, 0.2)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          }}
        >
          <div className="text-center mb-10">
            <div className="text-5xl font-bold text-gray-300 mb-8">Leg Statistics</div>
            
            {/* Leg states breakdown */}
            <div className="grid grid-cols-4 gap-6">
              {['pending', 'won', 'lost', 'void'].map((state) => {
                const count = bet.legs!.filter(leg => leg.result_state === state).length;
                if (count === 0) return null;
                
                return (
                  <div 
                    key={state}
                    className="rounded-2xl p-6 border-2"
                    style={{
                      background: 'rgba(255, 255, 255, 0.05)',
                      borderColor: `${getStateColor(state)}60`,
                    }}
                  >
                    <div className="text-4xl mb-3">{getStateEmoji(state)}</div>
                    <div 
                      className="text-5xl font-bold mb-2"
                      style={{ color: getStateColor(state) }}
                    >
                      {count}
                    </div>
                    <div className="text-2xl text-gray-300 font-semibold">
                      {state.toUpperCase()}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Average odds per leg */}
            {(() => {
              const nonVoidedLegs = bet.legs.filter(leg => leg.result_state !== 'void');
              const avgOdds = nonVoidedLegs.length > 0
                ? nonVoidedLegs.reduce((sum, leg) => sum + leg.odd, 0) / nonVoidedLegs.length
                : 0;
              
              return avgOdds > 0 ? (
                <div className="mt-12 pt-8 border-t" style={{ borderColor: 'rgba(255, 255, 255, 0.2)' }}>
                  <div className="text-3xl text-gray-300 mb-4">Average Odds per Leg</div>
                  <div className="text-6xl font-black" style={{ color: '#fbbf24' }}>
                    {avgOdds.toFixed(2)}x
                  </div>
                </div>
              ) : null;
            })()}
          </div>
        </div>
      )}

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

