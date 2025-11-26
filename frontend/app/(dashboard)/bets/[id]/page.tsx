'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { MainBet, ReferenceItem, MLPredictRequest } from '@/types';
import { toPng } from 'html-to-image';
import BetslipImage from '@/components/BetslipImage';
import HighlightStatsImage from '@/components/HighlightStatsImage';
import { useMLPrediction } from '@/hooks/useMLPrediction';
import MLInsights, { LegSummary } from '@/components/bets/MLInsights';

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
  const [generatingStats, setGeneratingStats] = useState(false);
  const [showStatsPreview, setShowStatsPreview] = useState(false);
  const [statsReady, setStatsReady] = useState(false);
  const statsRef = useRef<HTMLDivElement>(null);
  const [previewScale, setPreviewScale] = useState(1);
  const [fitToScreen, setFitToScreen] = useState(false);
  const [referenceItems, setReferenceItems] = useState<Map<string, ReferenceItem>>(new Map());
  const {
    predict: runMLPrediction,
    prediction: mlPrediction,
    loading: mlLoading,
    error: mlError,
    lastUpdated: mlLastUpdated,
    reset: resetMLPrediction,
  } = useMLPrediction();

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

  // Calculate effective odds excluding voided legs
  const calculateEffectiveOdds = (): { effectiveOdds: number; hasVoidedLegs: boolean; voidedCount: number } => {
    if (!bet || !bet.legs || bet.legs.length === 0) {
      return { effectiveOdds: bet?.odds || 0, hasVoidedLegs: false, voidedCount: 0 };
    }

    const nonVoidedLegs = bet.legs.filter(leg => leg.result_state !== 'void');
    const voidedCount = bet.legs.length - nonVoidedLegs.length;
    const hasVoidedLegs = voidedCount > 0;

    if (nonVoidedLegs.length === 0) {
      // All legs are voided
      return { effectiveOdds: 0, hasVoidedLegs: true, voidedCount };
    }

    const effectiveOdds = nonVoidedLegs.reduce((acc, leg) => acc * leg.odd, 1);
    return { effectiveOdds, hasVoidedLegs, voidedCount };
  };

  const mlLegSummaries: LegSummary[] = bet?.legs
    ? bet.legs.map((leg, index) => {
        const parts = [
          getReferenceName(leg.bet_type_id),
          getReferenceName(leg.league_id),
          getReferenceName(leg.responsible_id),
        ].filter(Boolean);
        return {
          id: leg.id,
          odd: leg.odd,
          label: parts.length ? parts.join(' • ') : `Leg ${index + 1}`,
        };
      })
    : [];

  const triggerPrediction = async (targetBet?: MainBet | null) => {
    const currentBet = targetBet ?? bet;
    if (!currentBet || !currentBet.legs || currentBet.legs.length === 0) {
      resetMLPrediction();
      return;
    }

    const payload: MLPredictRequest = {
      legs: currentBet.legs
        .filter((leg) => leg.odd > 0 && leg.result_state !== 'void')
        .map(
          ({ odd, league_id, bet_type_id, category_id, responsible_id }) => ({
            odd,
            league_id,
            bet_type_id,
            category_id,
            responsible_id,
          })
        ),
      stake: currentBet.stake,
      user_id: currentBet.user_id,
    };

    if (payload.legs.length === 0) {
      resetMLPrediction();
      return;
    }

    await runMLPrediction(payload);
  };

  // Debounced prediction trigger - only call if bet data actually changed
  useEffect(() => {
    if (!bet || !bet.legs || bet.legs.length === 0) {
      resetMLPrediction();
      return;
    }

    // Only trigger if we don't have a recent prediction for this exact bet
    const betHash = `${bet.id}-${bet.stake}-${bet.legs.map(l => `${l.id}:${l.odd}`).join('|')}`;
    const lastPredictionHash = sessionStorage.getItem(`ml-prediction-${bet.id}`);
    
    // If bet hasn't changed, don't re-fetch (cache will handle it)
    if (lastPredictionHash === betHash && mlPrediction) {
      return;
    }

    // Debounce the prediction call
    const timeoutId = setTimeout(() => {
      triggerPrediction(bet);
      sessionStorage.setItem(`ml-prediction-${bet.id}`, betHash);
    }, 500); // 500ms debounce

    return () => clearTimeout(timeoutId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    bet?.id,
    bet?.stake,
    bet?.legs?.map((leg) => `${leg.id}:${leg.odd}`).join('|'),
  ]);

  // Calculate preview scale based on window size and fit mode
  useEffect(() => {
    const calculateScale = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      
      if (fitToScreen) {
        // Calculate scale to fit entire image in viewport
        const availableHeight = height - 200; // Account for header and padding
        const availableWidth = width - 32; // Account for padding
        const scaleByHeight = availableHeight / 1920;
        const scaleByWidth = availableWidth / 1080;
        return Math.min(scaleByHeight, scaleByWidth, 0.8); // Max 80% to ensure some margin
      } else {
        // Default comfortable viewing scales (larger for better readability)
        if (width < 640) return 0.4; // Mobile - increased from 0.25
        if (width < 1024) return 0.7; // Tablet - increased from 0.4
        return 0.9; // Desktop - increased from 0.6
      }
    };

    const updateScale = () => {
      setPreviewScale(calculateScale());
    };

    updateScale();
    window.addEventListener('resize', updateScale);
    return () => window.removeEventListener('resize', updateScale);
  }, [fitToScreen]);

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
      
      // Add delay to ensure all fonts and styles are loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use html-to-image which handles CSS better than html2canvas
      const dataUrl = await toPng(betslipRef.current, {
        pixelRatio: 2, // 2x scale for high quality (2160px wide, perfect for TikTok)
        width: 1080,
        height: betslipRef.current.scrollHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
        // Force consistent rendering across devices
        cacheBust: true,
        skipAutoScale: true,
        canvasWidth: 2160, // Fixed canvas size
        canvasHeight: betslipRef.current.scrollHeight * 2,
        // Ensure consistent font loading
        skipFonts: false,
        // Add quality settings
        quality: 1.0,
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

  const generateStatsImage = async () => {
    if (!bet || generatingStats) return;

    setGeneratingStats(true);
    setStatsReady(false);
    setShowStatsPreview(true);
  };

  const handleStatsReady = () => {
    setStatsReady(true);
    setGeneratingStats(false);
  };

  const downloadStats = async () => {
    if (!statsRef.current || !bet || !statsReady) {
      if (!statsReady) {
        alert('Please wait for the statistics image to finish loading.');
      }
      return;
    }

    try {
      setGeneratingStats(true);
      
      // Add delay to ensure all fonts and styles are loaded
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Use html-to-image which handles CSS better than html2canvas
      const dataUrl = await toPng(statsRef.current, {
        pixelRatio: 2, // 2x scale for high quality (2160px wide, perfect for TikTok)
        width: 1080,
        height: statsRef.current.scrollHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
          // Force desktop-like rendering
          zoom: '1',
          minWidth: '1080px',
          maxWidth: '1080px',
        },
        // Force consistent rendering across devices
        cacheBust: true,
        skipAutoScale: true,
        canvasWidth: 2160, // Fixed canvas size
        canvasHeight: statsRef.current.scrollHeight * 2,
        // Ensure consistent font loading
        skipFonts: false,
        // Add quality settings
        quality: 1.0,
        // Force specific viewport for rendering
        filter: (node) => {
          // Ensure all elements render at desktop scale
          if (node.style) {
            node.style.zoom = '1';
            node.style.transform = node.style.transform || 'scale(1)';
          }
          return true;
        },
      });

      const link = document.createElement('a');
      link.download = `stats-${bet.id}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();

      setShowStatsPreview(false);
      setStatsReady(false);
    } catch (error) {
      console.error('Failed to generate statistics image:', error);
      alert('Failed to generate statistics image. Please try again.');
    } finally {
      setGeneratingStats(false);
    }
  };

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  if (!bet) {
    return <div className="text-center py-12">Bet not found</div>;
  }

  const { effectiveOdds, hasVoidedLegs, voidedCount } = calculateEffectiveOdds();

  return (
    <div className="px-4 py-6 sm:px-0">
      {/* Betslip Preview Modal */}
      {showBetslipPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-white rounded-lg w-full h-full sm:max-w-[90vw] sm:max-h-[90vh] sm:h-auto flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 flex flex-col gap-3 z-10 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Betslip Preview</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={downloadBetslip}
                    disabled={generatingBetslip || !betslipReady}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 min-h-[44px] text-sm sm:text-base"
                  >
                    {generatingBetslip ? 'Generating...' : !betslipReady ? 'Loading...' : 'Download Image'}
                  </button>
                  <button
                    onClick={() => {
                      setShowBetslipPreview(false);
                      setGeneratingBetslip(false);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 min-h-[44px] text-sm sm:text-base"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFitToScreen(!fitToScreen)}
                  className={`px-3 py-1 rounded-md text-sm font-medium min-h-[36px] transition-colors ${
                    fitToScreen 
                      ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                      : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {fitToScreen ? '📐 Fit to Screen: ON' : '🔍 Fit to Screen: OFF'}
                </button>
                <span className="text-xs text-gray-500">
                  {fitToScreen ? 'Full image visible' : 'Scroll to see full image'}
                </span>
              </div>
            </div>
            <div className="flex-1 overflow-auto p-2 sm:p-4">
              <div 
                className={fitToScreen ? "flex justify-center items-start min-h-full" : ""}
                style={{
                  minWidth: fitToScreen ? 'auto' : `${1080 * previewScale}px`,
                  width: '100%',
                }}
              >
                <div 
                  ref={betslipRef} 
                  style={{
                    // Scale down for preview while keeping generation quality
                    transform: `scale(${previewScale})`,
                    transformOrigin: fitToScreen ? 'top center' : 'top left',
                    marginBottom: `${-1920 * (1 - previewScale)}px`,
                    transition: 'transform 0.3s ease, margin-bottom 0.3s ease',
                    // Conditional centering
                    display: fitToScreen ? 'flex' : 'block',
                    justifyContent: fitToScreen ? 'center' : 'flex-start',
                    width: fitToScreen ? 'fit-content' : '1080px',
                  }}
                >
                  <BetslipImage bet={bet} onReady={handleBetslipReady} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Preview Modal */}
      {showStatsPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-white rounded-lg w-full h-full sm:max-w-[90vw] sm:max-h-[90vh] sm:h-auto flex flex-col">
            <div className="sticky top-0 bg-white border-b border-gray-200 p-3 sm:p-4 flex flex-col gap-3 z-10 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900">Statistics Preview</h2>
                <div className="flex flex-col sm:flex-row gap-2">
                  <button
                    onClick={downloadStats}
                    disabled={generatingStats || !statsReady}
                    className="px-4 py-2 bg-primary-600 text-white rounded-md hover:bg-primary-700 disabled:opacity-50 min-h-[44px] text-sm sm:text-base"
                  >
                    {generatingStats ? 'Generating...' : !statsReady ? 'Loading...' : 'Download Image'}
                  </button>
                  <button
                    onClick={() => {
                      setShowStatsPreview(false);
                      setGeneratingStats(false);
                    }}
                    className="px-4 py-2 bg-gray-300 text-gray-700 rounded-md hover:bg-gray-400 min-h-[44px] text-sm sm:text-base"
                  >
                    Close
                  </button>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setFitToScreen(!fitToScreen)}
                  className={`px-3 py-1 rounded-md text-sm font-medium min-h-[36px] transition-colors ${
                    fitToScreen 
                      ? 'bg-primary-100 text-primary-700 border border-primary-300' 
                      : 'bg-gray-100 text-gray-700 border border-gray-300 hover:bg-gray-200'
                  }`}
                >
                  {fitToScreen ? '📐 Fit to Screen: ON' : '🔍 Fit to Screen: OFF'}
                </button>
                <span className="text-xs text-gray-500">
                  {fitToScreen ? 'Full image visible' : 'Scroll to see full image'}
                </span>
              </div>
            </div>
              <div className="flex-1 overflow-auto p-2 sm:p-4">
                <div 
                  className={fitToScreen ? "flex justify-center items-start min-h-full" : ""}
                  style={{
                    minWidth: fitToScreen ? 'auto' : `${1080 * previewScale}px`,
                    width: '100%',
                  }}
                >
                  <div 
                    ref={statsRef} 
                    style={{
                      // Force desktop-like rendering context for generation
                      width: '1080px',
                      minWidth: '1080px',
                      transform: 'scale(1)',
                      transformOrigin: 'top center',
                      zoom: '1',
                      // Conditional centering
                      display: fitToScreen ? 'flex' : 'block',
                      justifyContent: fitToScreen ? 'center' : 'flex-start',
                    }}
                  >
                    <div
                      style={{
                        // Scale down for preview while keeping generation quality
                        transform: `scale(${previewScale})`,
                        transformOrigin: fitToScreen ? 'top center' : 'top left',
                        marginBottom: `${-1920 * (1 - previewScale)}px`,
                        transition: 'transform 0.3s ease, margin-bottom 0.3s ease',
                        // Conditional sizing
                        width: fitToScreen ? 'fit-content' : '1080px',
                      }}
                    >
                      <HighlightStatsImage bet={bet} onReady={handleStatsReady} />
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* Generate Buttons */}
      <div className="mb-6 flex flex-col sm:flex-row gap-4">
        <button
          onClick={generateBetslipImage}
          disabled={generatingBetslip}
          className="inline-flex items-center justify-center px-4 sm:px-6 py-3 border border-transparent text-sm sm:text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 min-h-[44px]"
        >
          {generatingBetslip ? 'Generating...' : '📸 Generate Betslip for TikTok'}
        </button>
        <button
          onClick={generateStatsImage}
          disabled={generatingStats}
          className="inline-flex items-center justify-center px-4 sm:px-6 py-3 border border-transparent text-sm sm:text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 disabled:opacity-50 min-h-[44px]"
        >
          {generatingStats ? 'Generating...' : '📊 Generate Statistics for TikTok'}
        </button>
      </div>
      <div className="mb-6">
        <button
          onClick={() => router.back()}
          className="text-primary-600 hover:text-primary-800 mb-4 min-h-[44px] flex items-center"
        >
          ← Back to Bets
        </button>
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Bet Details</h1>
      </div>

      <div className="bg-white shadow rounded-lg p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500">Stake</label>
            <div className="text-lg font-semibold">${bet.stake}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500">Odds</label>
            <div className="text-lg font-semibold">
              {hasVoidedLegs ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="line-through text-gray-400">{bet.odds?.toFixed(2)}x</span>
                    <span className="text-primary-600 font-bold">{effectiveOdds.toFixed(2)}x</span>
                    <span className="text-xs text-gray-500">(Effective)</span>
                  </div>
                  <div className="text-xs text-amber-600 font-medium">
                    {voidedCount} leg{voidedCount > 1 ? 's' : ''} voided
                  </div>
                </div>
              ) : (
                <span>{bet.odds?.toFixed(2)}x</span>
              )}
            </div>
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
                : hasVoidedLegs && bet.state === 'pending' ? (
                  <div className="space-y-1">
                    <div className="text-gray-400">Pending</div>
                    <div className="text-xs text-gray-500">
                      Effective payout: ${(bet.stake * effectiveOdds).toFixed(2)}
                    </div>
                  </div>
                ) : 'Pending'}
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
          <div className="mt-6 flex flex-col sm:flex-row gap-4">
            <button
              onClick={() => updateState('won')}
              disabled={updating}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 min-h-[44px] flex items-center justify-center"
            >
              Mark as Won
            </button>
            <button
              onClick={() => updateState('lost')}
              disabled={updating}
              className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 min-h-[44px] flex items-center justify-center"
            >
              Mark as Lost
            </button>
            <button
              onClick={() => updateState('void')}
              disabled={updating}
              className="px-4 py-2 bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 min-h-[44px] flex items-center justify-center"
            >
              Mark as Void
            </button>
          </div>
        )}
      </div>

      <div className="mb-6">
        <MLInsights
          legs={mlLegSummaries}
          stake={bet?.stake}
          prediction={mlPrediction}
          loading={mlLoading}
          error={mlError}
          onRetry={() => triggerPrediction(bet)}
          lastUpdated={mlLastUpdated}
        />
      </div>

      <div className="bg-white shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Legs</h2>
        {hasVoidedLegs && (
          <div className="mb-4 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-amber-900 mb-1">
                  {voidedCount} Leg{voidedCount > 1 ? 's' : ''} Voided
                </h4>
                <p className="text-sm text-amber-700">
                  This bet has {voidedCount} voided leg{voidedCount > 1 ? 's' : ''}. Effective odds have been recalculated to exclude voided legs.
                </p>
                <div className="mt-2 text-sm text-amber-800">
                  <span className="font-medium">Original odds:</span> {bet.odds?.toFixed(2)}x → <span className="font-medium">Effective odds:</span> {effectiveOdds.toFixed(2)}x
                </div>
              </div>
            </div>
          </div>
        )}
        <div className="space-y-4">
          {bet.legs?.map((leg, index) => (
            <div 
              key={leg.id} 
              className={`border rounded-md p-4 ${
                leg.result_state === 'void' 
                  ? 'bg-gray-50 border-gray-300 opacity-75' 
                  : 'border-gray-200'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-lg">Leg {index + 1}</h3>
                    {leg.result_state === 'void' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 text-gray-700 border border-gray-300">
                        ⚠️ VOID
                      </span>
                    )}
                  </div>
                  
                  {/* Teams */}
                  {(leg.home_team_id || leg.away_team_id) && (
                    <div className={`text-base font-semibold mt-2 ${
                      leg.result_state === 'void' ? 'text-gray-400' : 'text-gray-900'
                    }`}>
                      {(() => {
                        const homeName = leg.home_team_id ? getReferenceName(leg.home_team_id) : '';
                        const awayName = leg.away_team_id ? getReferenceName(leg.away_team_id) : '';
                        
                        if (homeName || awayName) {
                          return (
                            <>
                              {homeName && <span>{homeName}</span>}
                              {homeName && awayName && <span className={`mx-2 ${leg.result_state === 'void' ? 'text-gray-400' : 'text-gray-500'}`}>vs</span>}
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
                    <div className={`text-sm mt-1 ${
                      leg.result_state === 'void' ? 'text-gray-400' : 'text-gray-600'
                    }`}>
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

                  {/* Responsible */}
                  {leg.responsible_id && getReferenceName(leg.responsible_id) && (
                    <div className="mt-2">
                      <span className="text-sm text-gray-500">Responsible: </span>
                      <span className="text-sm font-medium text-gray-700">
                        {getReferenceName(leg.responsible_id)}
                      </span>
                    </div>
                  )}

                  <div className="text-sm mt-2">
                    <span className={leg.result_state === 'void' ? 'text-gray-400 line-through' : 'text-gray-500'}>
                      Odds: {leg.odd.toFixed(2)}x
                    </span>
                    {leg.result_state === 'void' && (
                      <span className="ml-2 text-xs text-gray-500 italic">(excluded from calculation)</span>
                    )}
                  </div>
                  {leg.notes && (
                    <div className={`text-sm mt-2 ${leg.result_state === 'void' ? 'text-gray-400' : 'text-gray-600'}`}>{leg.notes}</div>
                  )}
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  leg.result_state === 'won' ? 'bg-green-100 text-green-800' :
                  leg.result_state === 'lost' ? 'bg-red-100 text-red-800' :
                  leg.result_state === 'void' ? 'bg-gray-200 text-gray-700 border border-gray-300' :
                  'bg-yellow-100 text-yellow-800'
                }`}>
                  {leg.result_state === 'void' ? 'VOID' : leg.result_state}
                </span>
              </div>
              
              {/* Leg state controls */}
              <div className="mt-3 flex flex-col sm:flex-row gap-2">
                <button
                  onClick={() => updateLegState(leg.id, 'won')}
                  disabled={updatingLegs.has(leg.id) || leg.result_state === 'won'}
                  className="px-3 py-2 text-xs bg-green-600 text-white rounded-md hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] flex items-center justify-center"
                >
                  {updatingLegs.has(leg.id) ? 'Updating...' : 'Mark Won'}
                </button>
                <button
                  onClick={() => updateLegState(leg.id, 'lost')}
                  disabled={updatingLegs.has(leg.id) || leg.result_state === 'lost'}
                  className="px-3 py-2 text-xs bg-red-600 text-white rounded-md hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] flex items-center justify-center"
                >
                  {updatingLegs.has(leg.id) ? 'Updating...' : 'Mark Lost'}
                </button>
                <button
                  onClick={() => updateLegState(leg.id, 'void')}
                  disabled={updatingLegs.has(leg.id) || leg.result_state === 'void'}
                  className="px-3 py-2 text-xs bg-gray-600 text-white rounded-md hover:bg-gray-700 disabled:opacity-50 disabled:cursor-not-allowed min-h-[36px] flex items-center justify-center"
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

