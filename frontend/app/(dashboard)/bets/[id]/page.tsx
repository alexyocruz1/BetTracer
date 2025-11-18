'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { MainBet, ReferenceItem } from '@/types';
import { toPng } from 'html-to-image';
import BetslipImage from '@/components/BetslipImage';

export default function BetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [bet, setBet] = useState<MainBet | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);
  const [updatingLegs, setUpdatingLegs] = useState<Set<string>>(new Set());
  const [generatingBetslip, setGeneratingBetslip] = useState(false);
  const [showBetslipPreview, setShowBetslipPreview] = useState(false);
  const [betslipReady, setBetslipReady] = useState(false);
  const betslipRef = useRef<HTMLDivElement>(null);
  const [referenceItems, setReferenceItems] = useState<Map<string, ReferenceItem>>(new Map());

  const fetchBet = async (id: string) => {
    setLoading(true);
    try {
      const { data } = await apiClient.get<{ data: MainBet }>(`/api/bets/${id}`);
      setBet(data.data);
    } catch (error) {
      console.error('Failed to fetch bet:', error);
      setBet(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let cancelled = false;
    
    const fetchReferenceItems = async () => {
      try {
        // Fetch all reference items (no limit)
        const { data } = await apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?limit=1000');
        const itemsMap = new Map<string, ReferenceItem>();
        data.data.forEach(item => {
          itemsMap.set(item.id, item);
        });
        if (!cancelled) {
          setReferenceItems(itemsMap);
          console.log('Reference items loaded:', itemsMap.size);
        }
      } catch (error) {
        console.error('Failed to fetch reference items:', error);
      }
    };

    if (params.id) {
      const loadBet = async (id: string) => {
        setLoading(true);
        try {
          const [betRes] = await Promise.all([
            apiClient.get<{ data: MainBet }>(`/api/bets/${id}`),
            fetchReferenceItems(),
          ]);
          if (!cancelled) {
            setBet(betRes.data.data);
            // Debug: log leg data
            if (betRes.data.data.legs) {
              console.log('Bet legs:', betRes.data.data.legs.map(leg => ({
                id: leg.id,
                home_team_id: leg.home_team_id,
                away_team_id: leg.away_team_id,
                bet_type_id: leg.bet_type_id,
                league_id: leg.league_id,
              })));
            }
          }
        } catch (error) {
          console.error('Failed to fetch bet:', error);
          if (!cancelled) {
            setBet(null);
          }
        } finally {
          if (!cancelled) {
            setLoading(false);
          }
        }
      };
      
      loadBet(params.id as string);
    }
    
    return () => {
      cancelled = true;
    };
  }, [params.id]);

  const getReferenceName = (id?: string): string => {
    if (!id) return '';
    const item = referenceItems.get(id);
    if (!item) {
      console.warn('Reference item not found for ID:', id, 'Map size:', referenceItems.size, 'Available IDs:', Array.from(referenceItems.keys()).slice(0, 5));
      return '';
    }
    return item.name;
  };

  const updateState = async (state: 'won' | 'lost' | 'void') => {
    if (!bet || updating) return; // Prevent double-clicks and concurrent updates

    setUpdating(true);
    try {
      const { data } = await apiClient.patch<{ data: MainBet }>(`/api/bets/${bet.id}/state`, { state });
      // Update the bet state immediately with the response
      if (data.data) {
        setBet(data.data);
      } else {
        // Fallback: refetch if response doesn't include updated bet
        await fetchBet(bet.id);
      }
    } catch (error: any) {
      console.error('Failed to update bet state:', error);
      alert(error.response?.data?.error?.message || 'Failed to update bet state');
      // Refetch on error to ensure UI is in sync
      await fetchBet(bet.id);
    } finally {
      setUpdating(false);
    }
  };

  const updateLegState = async (legId: string, resultState: 'won' | 'lost' | 'void') => {
    if (updatingLegs.has(legId)) return; // Prevent double-clicks

    setUpdatingLegs(prev => new Set(prev).add(legId));
    try {
      const { data } = await apiClient.patch<{ data: any }>(`/api/legs/${legId}/state`, { result_state: resultState });
      
      // Update the leg in the bet state
      if (bet && data.data) {
        setBet({
          ...bet,
          legs: bet.legs?.map(leg => 
            leg.id === legId ? { ...leg, result_state: resultState } : leg
          ) || [],
        });
      } else {
        // Fallback: refetch if response doesn't include updated leg
        await fetchBet(bet!.id);
      }
    } catch (error: any) {
      console.error('Failed to update leg state:', error);
      alert(error.response?.data?.error?.message || 'Failed to update leg state');
      // Refetch on error to ensure UI is in sync
      if (bet) {
        await fetchBet(bet.id);
      }
    } finally {
      setUpdatingLegs(prev => {
        const newSet = new Set(prev);
        newSet.delete(legId);
        return newSet;
      });
    }
  };

  const generateBetslipImage = async () => {
    if (!bet || generatingBetslip) return;

    setGeneratingBetslip(true);
    setBetslipReady(false);
    setShowBetslipPreview(true);
  };

  const handleBetslipReady = () => {
    setBetslipReady(true);
    setGeneratingBetslip(false);
  };

  const downloadBetslip = async () => {
    if (!betslipRef.current || !bet || !betslipReady) {
      if (!betslipReady) {
        alert('Please wait for the betslip to finish loading.');
      }
      return;
    }

    try {
      setGeneratingBetslip(true);
      
      // Use html-to-image which handles CSS better than html2canvas
      const dataUrl = await toPng(betslipRef.current, {
        backgroundColor: null,
        pixelRatio: 2, // 2x scale for high quality (2160px wide, perfect for TikTok)
        width: 1080,
        height: betslipRef.current.scrollHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
      });

      const link = document.createElement('a');
      link.download = `betslip-${bet.id}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();

      setShowBetslipPreview(false);
      setBetslipReady(false);
    } catch (error) {
      console.error('Failed to generate betslip image:', error);
      alert('Failed to generate betslip image. Please try again.');
    } finally {
      setGeneratingBetslip(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!bet) {
    return <div className="text-center py-12">Bet not found</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Betslip Preview Modal */}
      {showBetslipPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-4 overflow-hidden">
          <div className="bg-white rounded-lg w-full max-w-[1200px] max-h-[90vh] flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-4 flex justify-between items-center z-10 flex-shrink-0">
              <h2 className="text-xl font-bold text-gray-900">Betslip Preview</h2>
              <div className="flex gap-2">
                <button
                  onClick={downloadBetslip}
                  disabled={generatingBetslip || !betslipReady}
                  className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50"
                >
                  {generatingBetslip ? 'Generating...' : !betslipReady ? 'Loading...' : 'Download Image'}
                </button>
                <button
                  onClick={() => {
                    setShowBetslipPreview(false);
                    setGeneratingBetslip(false);
                  }}
                  className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="p-4 overflow-auto flex-1" style={{ overflowX: 'hidden' }}>
              <div ref={betslipRef} className="flex justify-center">
                <BetslipImage bet={bet} onReady={handleBetslipReady} />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Generate Betslip Button */}
      <div className="mb-6">
        <button
          onClick={generateBetslipImage}
          disabled={generatingBetslip}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50"
        >
          {generatingBetslip ? 'Generating...' : '📸 Generate Betslip for TikTok'}
        </button>
      </div>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-primary-600 hover:text-primary-800 mb-4"
        >
          ← Back to Bets
        </button>
        <h1 className="text-3xl font-bold text-gray-900">Bet Details</h1>
      </div>

      <div className="bg-white shadow rounded-lg p-6 mb-6">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Stake</label>
            <div className="text-lg font-semibold">${bet.stake}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Odds</label>
            <div className="text-lg font-semibold">{bet.odds?.toFixed(2)}x</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">State</label>
            <div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                bet.state === 'won' ? 'bg-green-100 text-green-800' :
                bet.state === 'lost' ? 'bg-red-100 text-red-800' :
                bet.state === 'void' ? 'bg-gray-100 text-gray-800' :
                'bg-yellow-100 text-yellow-800'
              }`}>
                {bet.state}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Profit/Loss</label>
            <div className={`text-lg font-semibold ${
              bet.profit_loss === null || bet.profit_loss === undefined
                ? 'text-gray-500'
                : bet.profit_loss >= 0
                ? 'text-green-600'
                : 'text-red-600'
            }`}>
              {bet.profit_loss !== null && bet.profit_loss !== undefined
                ? `$${bet.profit_loss.toFixed(2)}`
                : 'Pending'}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Date</label>
            <div className="text-lg">{new Date(bet.date).toLocaleString()}</div>
          </div>
          {bet.notes && (
            <div>
              <label className="text-sm font-medium text-gray-500">Notes</label>
              <div className="text-lg">{bet.notes}</div>
            </div>
          )}
        </div>

        {bet.state === 'pending' && (
          <div className="mt-6 flex space-x-4">
            <button
              onClick={() => updateState('won')}
              disabled={updating}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50"
            >
              Mark as Won
            </button>
            <button
              onClick={() => updateState('lost')}
              disabled={updating}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50"
            >
              Mark as Lost
            </button>
            <button
              onClick={() => updateState('void')}
              disabled={updating}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50"
            >
              Mark as Void
            </button>
          </div>
        )}
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Legs</h2>
        <div className="space-y-4">
          {bet.legs?.map((leg, index) => (
            <div key={leg.id} className="border border-gray-200 rounded-md p-4">
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <h3 className="font-medium text-lg">Leg {index + 1}</h3>
                  
                  {/* Teams */}
                  {(leg.home_team_id || leg.away_team_id) && (
                    <div className="text-base font-semibold text-gray-900 mt-2">
                      {(() => {
                        const homeName = leg.home_team_id ? getReferenceName(leg.home_team_id) : '';
                        const awayName = leg.away_team_id ? getReferenceName(leg.away_team_id) : '';
                        
                        if (homeName || awayName) {
                          return (
                            <>
                              {homeName && <span>{homeName}</span>}
                              {homeName && awayName && <span className="mx-2 text-gray-500">vs</span>}
                              {awayName && <span>{awayName}</span>}
                            </>
                          );
                        }
                        // Show IDs for debugging if names not found
                        return (
                          <span className="text-gray-400 italic">
                            {leg.home_team_id && `Home: ${leg.home_team_id.substring(0, 8)}...`}
                            {leg.home_team_id && leg.away_team_id && ' / '}
                            {leg.away_team_id && `Away: ${leg.away_team_id.substring(0, 8)}...`}
                            {!leg.home_team_id && !leg.away_team_id && 'No team IDs'}
                          </span>
                        );
                      })()}
                    </div>
                  )}

                  {/* League */}
                  {leg.league_id && getReferenceName(leg.league_id) && (
                    <div className="text-sm text-gray-600 mt-1">
                      {getReferenceName(leg.league_id)}
                    </div>
                  )}

                  {/* Bet Type and Category */}
                  {(leg.bet_type_id || leg.category_id) && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {leg.bet_type_id && (
                        getReferenceName(leg.bet_type_id) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                            {getReferenceName(leg.bet_type_id)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Bet Type: {leg.bet_type_id.substring(0, 8)}...
                          </span>
                        )
                      )}
                      {leg.category_id && (
                        getReferenceName(leg.category_id) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                            {getReferenceName(leg.category_id)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Category: {leg.category_id.substring(0, 8)}...
                          </span>
                        )
                      )}
                    </div>
                  )}

                  <div className="text-sm text-gray-500 mt-2">Odds: {leg.odd.toFixed(2)}x</div>
                  {leg.notes && (
                    <div className="text-sm text-gray-600 mt-2">{leg.notes}</div>
                  )}
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  leg.result_state === 'won' ? 'bg-green-100 text-green-800' :
                  leg.result_state === 'lost' ? 'bg-red-100 text-red-800' :
                  leg.result_state === 'void' ? 'bg-gray-100 text-gray-800' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {leg.result_state}
                </span>
              </div>
              
              {/* Leg state controls */}
              <div className="mt-3 flex space-x-2">
                <button
                  onClick={() => updateLegState(leg.id, 'won')}
                  disabled={updatingLegs.has(leg.id) || leg.result_state === 'won'}
                  className="px-3 py-1 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingLegs.has(leg.id) ? 'Updating...' : 'Mark Won'}
                </button>
                <button
                  onClick={() => updateLegState(leg.id, 'lost')}
                  disabled={updatingLegs.has(leg.id) || leg.result_state === 'lost'}
                  className="px-3 py-1 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingLegs.has(leg.id) ? 'Updating...' : 'Mark Lost'}
                </button>
                <button
                  onClick={() => updateLegState(leg.id, 'void')}
                  disabled={updatingLegs.has(leg.id) || leg.result_state === 'void'}
                  className="px-3 py-1 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {updatingLegs.has(leg.id) ? 'Updating...' : 'Mark Void'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

