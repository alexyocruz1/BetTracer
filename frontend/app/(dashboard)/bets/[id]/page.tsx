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
import { supabase } from '@/lib/supabase/client';
import { InlineLoading, CardSkeleton } from '@/components/ui/LoadingSkeleton';

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
  const [generatingBetslipVideo, setGeneratingBetslipVideo] = useState(false);
  const [generatingStatsVideo, setGeneratingStatsVideo] = useState(false);
  const [previewScale, setPreviewScale] = useState(1);
  const [fitToScreen, setFitToScreen] = useState(false);
  const [tiktokSafeMode, setTiktokSafeMode] = useState(true); // Default to TikTok safe mode
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
        
        // Get actual image height (try stats first, fallback to betslip, then default)
        let imageHeight = 1920; // Default
        if (statsRef.current?.scrollHeight) {
          imageHeight = statsRef.current.scrollHeight;
        } else if (betslipRef.current?.scrollHeight) {
          imageHeight = betslipRef.current.scrollHeight;
        }
        
        const scaleByHeight = availableHeight / imageHeight;
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
    
    // Recalculate when content changes (stats or betslip ready)
    if (statsReady || betslipReady) {
      setTimeout(updateScale, 100); // Small delay to ensure DOM is updated
    }
    
    return () => window.removeEventListener('resize', updateScale);
  }, [fitToScreen, statsReady, betslipReady]);

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
        height: betslipRef.current.scrollHeight, // Dynamic height based on leg count
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

      // Download with TikTok-optimized filename
      const link = document.createElement('a');
      link.download = `betslip-tiktok-${bet.id}-${new Date().toISOString().split('T')[0]}.png`;
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
      
      // Add delay to ensure all fonts and styles are loaded (same as betslip)
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Find the actual component container (image-generation-container) inside the wrapper
      // Find the actual component container - navigate through wrapper structure
      const wrapper = statsRef.current;
      if (!wrapper) {
        throw new Error('Stats ref is null');
      }
      
      // Find the actual .image-generation-container component
      // It's nested: wrapper div -> inner wrapper div -> HighlightStatsImage component
      const innerWrapper = wrapper.firstElementChild as HTMLElement;
      const componentWrapper = innerWrapper?.firstElementChild as HTMLElement;
      const actualComponent = componentWrapper?.querySelector('.image-generation-container') as HTMLElement || componentWrapper;
      
      if (!actualComponent) {
        throw new Error('Could not find statistics component. Check console for structure details.');
      }
      
      // Save all transform styles to restore later
      const stylesToRestore = {
        wrapper: {
          transform: wrapper.style.transform,
          minWidth: wrapper.style.minWidth,
          width: wrapper.style.width,
          display: wrapper.style.display,
          justifyContent: wrapper.style.justifyContent,
        },
        innerWrapper: innerWrapper ? {
          transform: innerWrapper.style.transform,
          marginBottom: innerWrapper.style.marginBottom,
        } : null,
      };
      
      // Remove all transforms/scales temporarily for accurate measurement
      wrapper.style.transform = 'none';
      wrapper.style.minWidth = '';
      wrapper.style.width = '1080px';
      wrapper.style.display = 'block';
      wrapper.style.justifyContent = 'flex-start';
      
      if (innerWrapper) {
        innerWrapper.style.transform = 'none';
        innerWrapper.style.marginBottom = '0';
      }
      
      // Wait for reflow
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Capture the actual component (exactly like old working version)
      const dataUrl = await toPng(actualComponent, {
        pixelRatio: 2, // 2x scale for high quality (2160px wide, perfect for TikTok)
        width: 1080,
        height: actualComponent.scrollHeight, // Use actual component's scrollHeight
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
        cacheBust: true,
        skipAutoScale: true,
        canvasWidth: 2160, // Fixed canvas size
        canvasHeight: actualComponent.scrollHeight * 2,
        skipFonts: false,
        quality: 1.0,
      });
      
      // Restore all styles
      wrapper.style.transform = stylesToRestore.wrapper.transform;
      wrapper.style.minWidth = stylesToRestore.wrapper.minWidth;
      wrapper.style.width = stylesToRestore.wrapper.width;
      wrapper.style.display = stylesToRestore.wrapper.display;
      wrapper.style.justifyContent = stylesToRestore.wrapper.justifyContent;
      
      if (innerWrapper && stylesToRestore.innerWrapper) {
        innerWrapper.style.transform = stylesToRestore.innerWrapper.transform;
        innerWrapper.style.marginBottom = stylesToRestore.innerWrapper.marginBottom;
      }

      // Download with TikTok-optimized filename
      const link = document.createElement('a');
      link.download = `stats-tiktok-${bet.id}-${new Date().toISOString().split('T')[0]}.png`;
      link.href = dataUrl;
      link.click();

      setShowStatsPreview(false);
      setStatsReady(false);
    } catch (error: any) {
      console.error('Failed to generate statistics image:', error);
      console.error('Error details:', {
        message: error?.message,
        stack: error?.stack,
        wrapper: statsRef.current?.outerHTML?.substring(0, 200),
      });
      alert(`Failed to generate statistics image: ${error?.message || 'Unknown error'}. Please check console for details.`);
    } finally {
      setGeneratingStats(false);
    }
  };

  const generateBetslipVideo = async () => {
    if (!bet || generatingBetslipVideo) return;

    try {
      setGeneratingBetslipVideo(true);

      // First, generate the image
      setBetslipReady(false);
      setShowBetslipPreview(true);
      
      // Wait for image to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!betslipRef.current) {
        throw new Error('Betslip ref not available');
      }

      // Wait a bit more for rendering
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture image
      const dataUrl = await toPng(betslipRef.current, {
        pixelRatio: 2,
        width: 1080,
        height: betslipRef.current.scrollHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
        cacheBust: true,
        skipAutoScale: true,
        canvasWidth: 2160,
        canvasHeight: betslipRef.current.scrollHeight * 2,
        skipFonts: false,
        quality: 1.0,
      });

      // Convert to base64
      const base64Image = dataUrl.split(',')[1] || dataUrl;

      // Call backend to generate video
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/api/bets/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          image_base64: base64Image,
          duration: 10.0,
          fps: 30,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || 'Failed to generate video');
      }

      // Get video blob
      const videoBlob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(videoBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `betslip-video-${bet.id}-${new Date().toISOString().split('T')[0]}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setShowBetslipPreview(false);
      setBetslipReady(false);
    } catch (error: any) {
      console.error('Failed to generate betslip video:', error);
      alert(`Failed to generate betslip video: ${error?.response?.data?.error?.message || error?.message || 'Unknown error'}`);
    } finally {
      setGeneratingBetslipVideo(false);
    }
  };

  const generateStatsVideo = async () => {
    if (!bet || generatingStatsVideo) return;

    try {
      setGeneratingStatsVideo(true);

      // First, generate the image
      setStatsReady(false);
      setShowStatsPreview(true);
      
      // Wait for image to be ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (!statsRef.current) {
        throw new Error('Stats ref not available');
      }

      // Find the actual component
      const wrapper = statsRef.current;
      const innerWrapper = wrapper.firstElementChild as HTMLElement;
      const componentWrapper = innerWrapper?.firstElementChild as HTMLElement;
      const actualComponent = componentWrapper?.querySelector('.image-generation-container') as HTMLElement || componentWrapper;
      
      if (!actualComponent) {
        throw new Error('Could not find statistics component');
      }

      // Wait a bit more for rendering
      await new Promise(resolve => setTimeout(resolve, 500));

      // Capture image
      const dataUrl = await toPng(actualComponent, {
        pixelRatio: 2,
        width: 1080,
        height: actualComponent.scrollHeight,
        style: {
          transform: 'scale(1)',
          transformOrigin: 'top left',
        },
        cacheBust: true,
        skipAutoScale: true,
        canvasWidth: 2160,
        canvasHeight: actualComponent.scrollHeight * 2,
        skipFonts: false,
        quality: 1.0,
      });

      // Convert to base64
      const base64Image = dataUrl.split(',')[1] || dataUrl;

      // Call backend to generate video
      const response = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8080'}/api/bets/generate-video`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${(await supabase.auth.getSession()).data.session?.access_token || ''}`,
        },
        body: JSON.stringify({
          image_base64: base64Image,
          duration: 10.0,
          fps: 30,
        }),
      });

      if (!response.ok) {
        const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
        throw new Error(error.error?.message || 'Failed to generate video');
      }

      // Get video blob
      const videoBlob = await response.blob();

      // Create download link
      const url = window.URL.createObjectURL(videoBlob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `stats-video-${bet.id}-${new Date().toISOString().split('T')[0]}.mp4`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);

      setShowStatsPreview(false);
      setStatsReady(false);
    } catch (error: any) {
      console.error('Failed to generate stats video:', error);
      alert(`Failed to generate stats video: ${error?.response?.data?.error?.message || error?.message || 'Unknown error'}`);
    } finally {
      setGeneratingStatsVideo(false);
    }
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="mb-6">
          <div className="h-9 bg-gray-200 dark:bg-gray-700 rounded w-48 mb-4 animate-pulse"></div>
        </div>
        <CardSkeleton className="mb-6" />
        <CardSkeleton />
      </div>
    );
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
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full h-full sm:max-w-[90vw] sm:max-h-[90vh] sm:h-auto flex flex-col">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex flex-col gap-3 z-10 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">Betslip Preview</h2>
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
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 min-h-[44px] text-sm sm:text-base"
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
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-600' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {fitToScreen ? '📐 Fit to Screen: ON' : '🔍 Fit to Screen: OFF'}
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
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
                    marginBottom: `${-(betslipRef.current?.scrollHeight || 1920) * (1 - previewScale)}px`,
                    transition: 'transform 0.3s ease, margin-bottom 0.3s ease',
                    // Conditional centering
                    display: fitToScreen ? 'flex' : 'block',
                    justifyContent: fitToScreen ? 'center' : 'flex-start',
                    width: fitToScreen ? 'fit-content' : '1080px',
                  }}
                >
                <BetslipImage bet={bet} onReady={handleBetslipReady} tiktokSafe={tiktokSafeMode} />
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Statistics Preview Modal */}
      {showStatsPreview && (
        <div className="fixed inset-0 bg-black bg-opacity-75 z-50 flex items-center justify-center p-2 sm:p-4 overflow-hidden">
          <div className="bg-white dark:bg-gray-800 rounded-lg w-full h-full sm:max-w-[90vw] sm:max-h-[90vh] sm:h-auto flex flex-col">
            <div className="sticky top-0 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 p-3 sm:p-4 flex flex-col gap-3 z-10 flex-shrink-0">
              <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3 sm:gap-0">
                <h2 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">Statistics Preview</h2>
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
                    className="px-4 py-2 bg-gray-300 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-md hover:bg-gray-400 dark:hover:bg-gray-500 min-h-[44px] text-sm sm:text-base"
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
                      ? 'bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 border border-primary-300 dark:border-primary-600' 
                      : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 border border-gray-300 dark:border-gray-600 hover:bg-gray-200 dark:hover:bg-gray-600'
                  }`}
                >
                  {fitToScreen ? '📐 Fit to Screen: ON' : '🔍 Fit to Screen: OFF'}
                </button>
                <span className="text-xs text-gray-500 dark:text-gray-400">
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
                        marginBottom: `${-(statsRef.current?.scrollHeight || 1920) * (1 - previewScale)}px`,
                        transition: 'transform 0.3s ease, margin-bottom 0.3s ease',
                        // Conditional sizing
                        width: fitToScreen ? 'fit-content' : '1080px',
                      }}
                    >
                      <HighlightStatsImage bet={bet} onReady={handleStatsReady} tiktokSafe={tiktokSafeMode} />
                    </div>
                  </div>
                </div>
              </div>
          </div>
        </div>
      )}

      {/* Generate Buttons */}
      <div className="mb-6">
        {/* TikTok Safe Mode Toggle */}
        <div className="mb-4 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div className="flex-1">
              <label
                id="content-mode-label"
                className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1 block"
              >
                Content Mode
              </label>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {tiktokSafeMode 
                  ? 'TikTok Safe Mode: Sports commentary & analysis (no betting content)'
                  : 'Full Mode: Includes all betting information (stakes, odds, profit/loss)'}
            </p>
            </div>
            <div className="ml-4">
              <button
                type="button"
                onClick={() => setTiktokSafeMode(!tiktokSafeMode)}
                className={`relative inline-flex h-8 w-16 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                  tiktokSafeMode ? 'bg-green-600' : 'bg-gray-300'
                }`}
                aria-labelledby="content-mode-label"
                aria-label={tiktokSafeMode ? 'Disable TikTok Safe Mode' : 'Enable TikTok Safe Mode'}
              >
                <span
                  className={`pointer-events-none inline-block h-7 w-7 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    tiktokSafeMode ? 'translate-x-8' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>
          <div className="mt-2 flex items-center gap-2">
            <span className={`text-xs font-medium ${tiktokSafeMode ? 'text-green-600' : 'text-gray-500'}`}>
              {tiktokSafeMode ? '✓ TikTok Safe' : 'Full Details'}
            </span>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 mb-4">
        <button
          onClick={generateBetslipImage}
          disabled={generatingBetslip}
          className="inline-flex items-center justify-center px-4 sm:px-6 py-3 border border-transparent text-sm sm:text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 min-h-[44px]"
        >
            {generatingBetslip ? 'Generating...' : tiktokSafeMode ? '📸 Generate Betslip (TikTok Safe)' : '📸 Generate Betslip'}
        </button>
        <button
          onClick={generateStatsImage}
          disabled={generatingStats}
          className="inline-flex items-center justify-center px-4 sm:px-6 py-3 border border-transparent text-sm sm:text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-pink-600 to-red-600 hover:from-pink-700 hover:to-red-700 disabled:opacity-50 min-h-[44px]"
        >
            {generatingStats ? 'Generating...' : tiktokSafeMode ? '📊 Generate Statistics (TikTok Safe)' : '📊 Generate Statistics'}
        </button>
        </div>
        <div className="flex flex-col sm:flex-row gap-4">
          <button
            onClick={() => generateBetslipVideo()}
            disabled={generatingBetslipVideo || !bet}
            className="inline-flex items-center justify-center px-4 sm:px-6 py-3 border border-transparent text-sm sm:text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 min-h-[44px]"
          >
            {generatingBetslipVideo ? 'Generating Video...' : tiktokSafeMode ? '🎬 Generate Betslip Video (TikTok Safe)' : '🎬 Generate Betslip Video'}
          </button>
          <button
            onClick={() => generateStatsVideo()}
            disabled={generatingStatsVideo || !bet}
            className="inline-flex items-center justify-center px-4 sm:px-6 py-3 border border-transparent text-sm sm:text-base font-medium rounded-md shadow-sm text-white bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700 disabled:opacity-50 min-h-[44px]"
          >
            {generatingStatsVideo ? 'Generating Video...' : tiktokSafeMode ? '🎬 Generate Stats Video (TikTok Safe)' : '🎬 Generate Stats Video'}
          </button>
        </div>
      </div>
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <button
            onClick={() => router.back()}
            className="text-primary-600 hover:text-primary-800 mb-2 sm:mb-4 min-h-[44px] flex items-center"
          >
            ← Back to Bets
          </button>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Bet Details</h1>
        </div>
        <button
          type="button"
          onClick={() => router.push(`/bets/new?copyFrom=${bet.id}`)}
          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 min-h-[44px]"
        >
          Copy Bet
        </button>
      </div>

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-4 sm:p-6 mb-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Stake</label>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">${bet.stake}</div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Odds</label>
            <div className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              {hasVoidedLegs ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="line-through text-gray-400 dark:text-gray-500">{bet.odds?.toFixed(2)}x</span>
                    <span className="text-primary-600 dark:text-primary-400 font-bold">{effectiveOdds.toFixed(2)}x</span>
                    <span className="text-xs text-gray-500 dark:text-gray-400">(Effective)</span>
                  </div>
                  <div className="text-xs text-amber-600 dark:text-amber-400 font-medium">
                    {voidedCount} leg{voidedCount > 1 ? 's' : ''} voided
                  </div>
                </div>
              ) : (
                <span>{bet.odds?.toFixed(2)}x</span>
              )}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">State</label>
            <div>
              <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                bet.state === 'won' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                bet.state === 'lost' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                bet.state === 'void' ? 'bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-300' :
                'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
              }`}>
                {bet.state}
              </span>
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Profit/Loss</label>
            <div className={`text-lg font-semibold ${
              bet.profit_loss === null || bet.profit_loss === undefined
                ? 'text-gray-500 dark:text-gray-400'
                : bet.profit_loss >= 0
                ? 'text-green-600 dark:text-green-400'
                : 'text-red-600 dark:text-red-400'
            }`}>
              {bet.profit_loss !== null && bet.profit_loss !== undefined
                ? `$${bet.profit_loss.toFixed(2)}`
                : hasVoidedLegs && bet.state === 'pending' ? (
                  <div className="space-y-1">
                    <div className="text-gray-400 dark:text-gray-500">Pending</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      Effective payout: ${(bet.stake * effectiveOdds).toFixed(2)}
                    </div>
                  </div>
                ) : 'Pending'}
            </div>
          </div>
          <div>
            <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Date</label>
            <div className="text-lg text-gray-900 dark:text-gray-100">{new Date(bet.date).toLocaleString()}</div>
          </div>
          {bet.notes && (
            <div>
              <label className="text-sm font-medium text-gray-500 dark:text-gray-400">Notes</label>
              <div className="text-lg text-gray-900 dark:text-gray-100">{bet.notes}</div>
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

      <div className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">Legs</h2>
        {hasVoidedLegs && (
          <div className="mb-4 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg">
            <div className="flex items-start gap-2">
              <svg className="w-5 h-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
              </svg>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-amber-900 dark:text-amber-300 mb-1">
                  {voidedCount} Leg{voidedCount > 1 ? 's' : ''} Voided
                </h4>
                <p className="text-sm text-amber-700 dark:text-amber-300">
                  This bet has {voidedCount} voided leg{voidedCount > 1 ? 's' : ''}. Effective odds have been recalculated to exclude voided legs.
                </p>
                <div className="mt-2 text-sm text-amber-800 dark:text-amber-300">
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
                  ? 'bg-gray-50 dark:bg-gray-900 border-gray-300 dark:border-gray-700 opacity-75' 
                  : 'border-gray-200 dark:border-gray-700'
              }`}
            >
              <div className="flex justify-between items-start mb-3">
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium text-lg text-gray-900 dark:text-gray-100">Leg {index + 1}</h3>
                    {leg.result_state === 'void' && (
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600">
                        ⚠️ VOID
                      </span>
                    )}
                  </div>
                  
                  {/* Teams */}
                  {(leg.home_team_id || leg.away_team_id) && (
                    <div className={`text-base font-semibold mt-2 ${
                      leg.result_state === 'void' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-900 dark:text-gray-100'
                    }`}>
                      {(() => {
                        const homeName = leg.home_team_id ? getReferenceName(leg.home_team_id) : '';
                        const awayName = leg.away_team_id ? getReferenceName(leg.away_team_id) : '';
                        
                        if (homeName || awayName) {
                          return (
                            <>
                              {homeName && <span>{homeName}</span>}
                              {homeName && awayName && <span className={`mx-2 ${leg.result_state === 'void' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>vs</span>}
                              {awayName && <span>{awayName}</span>}
                            </>
                          );
                        }
                        // Show IDs for debugging if names not found
                        return (
                          <span className="text-gray-400 dark:text-gray-500 italic">
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
                      leg.result_state === 'void' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'
                    }`}>
                      {getReferenceName(leg.league_id)}
                    </div>
                  )}

                  {/* Bet Type and Category */}
                  {(leg.bet_type_id || leg.category_id) && (
                    <div className="flex gap-2 mt-2 flex-wrap">
                      {leg.bet_type_id && (
                        getReferenceName(leg.bet_type_id) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                            {getReferenceName(leg.bet_type_id)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            Bet Type: {leg.bet_type_id.substring(0, 8)}...
                          </span>
                        )
                      )}
                      {leg.category_id && (
                        getReferenceName(leg.category_id) ? (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300">
                            {getReferenceName(leg.category_id)}
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300">
                            Category: {leg.category_id.substring(0, 8)}...
                          </span>
                        )
                      )}
                    </div>
                  )}

                  {/* Responsible */}
                  {leg.responsible_id && getReferenceName(leg.responsible_id) && (
                    <div className="mt-2">
                      <span className="text-sm text-gray-500 dark:text-gray-400">Responsible: </span>
                      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                        {getReferenceName(leg.responsible_id)}
                      </span>
                    </div>
                  )}

                  <div className="text-sm mt-2">
                    <span className={leg.result_state === 'void' ? 'text-gray-400 dark:text-gray-500 line-through' : 'text-gray-500 dark:text-gray-400'}>
                      Odds: {leg.odd.toFixed(2)}x
                    </span>
                    {leg.result_state === 'void' && (
                      <span className="ml-2 text-xs text-gray-500 dark:text-gray-400 italic">(excluded from calculation)</span>
                    )}
                  </div>
                  {leg.notes && (
                    <div className={`text-sm mt-2 ${leg.result_state === 'void' ? 'text-gray-400 dark:text-gray-500' : 'text-gray-600 dark:text-gray-400'}`}>{leg.notes}</div>
                  )}
                </div>
                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  leg.result_state === 'won' ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300' :
                  leg.result_state === 'lost' ? 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300' :
                  leg.result_state === 'void' ? 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-gray-600' :
                  'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300'
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

