'use client';

import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ReferenceItem, CreateBetRequest, CreateLegRequest, MainBet, MLPredictRequest } from '@/types';
import {
  decimalToAmerican,
  americanToDecimal,
  formatAmericanOdds,
  isValidDecimal,
  isValidAmerican,
} from '@/lib/utils/odds';
import SearchableSelect from '@/components/SearchableSelect';
import { useMLPrediction } from '@/hooks/useMLPrediction';
import MLInsights, { LegSummary } from '@/components/bets/MLInsights';

export default function NewBetPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(false);
  const [teams, setTeams] = useState<ReferenceItem[]>([]);
  const [leagues, setLeagues] = useState<ReferenceItem[]>([]);
  const [betTypes, setBetTypes] = useState<ReferenceItem[]>([]);
  const [categories, setCategories] = useState<ReferenceItem[]>([]);
  const [responsibles, setResponsibles] = useState<ReferenceItem[]>([]);
  const [formData, setFormData] = useState<CreateBetRequest>({
    date: new Date().toISOString(),
    stake: 0,
    odds: undefined,
    state: 'pending',
    legs: [{ odd: 1, result_state: 'pending' }],
  });
  const {
    predict: runDraftPrediction,
    prediction: draftPrediction,
    loading: draftPredictionLoading,
    error: draftPredictionError,
    lastUpdated: draftPredictionUpdated,
    reset: resetDraftPrediction,
  } = useMLPrediction();
  
  // Local state for odds display (decimal/American)
  const [mainBetDecimalOdds, setMainBetDecimalOdds] = useState<string>('');
  const [mainBetAmericanOdds, setMainBetAmericanOdds] = useState<string>('');
  // Local state for leg odds display so they can be edited freely like the main bet odds
  const [legDecimalOdds, setLegDecimalOdds] = useState<string[]>(
    () => ([
      // Initialize from the initial formData legs
      ...formData.legs.map((leg) => leg.odd ? leg.odd.toFixed(2) : ''),
    ])
  );
  const [legAmericanOdds, setLegAmericanOdds] = useState<string[]>(
    () => ([
      ...formData.legs.map((leg) => {
        const american = decimalToAmerican(leg.odd);
        return american ? formatAmericanOdds(american) : '';
      }),
    ])
  );
  // Local state for stake input to preserve decimal point while typing
  const [stakeInput, setStakeInput] = useState<string>('');

  useEffect(() => {
    fetchReferenceItems();
    // Note: Removed auto-refetch on visibility change to prevent unwanted refreshes when switching tabs
    // Reference items are fetched once on mount
  }, []);

  // Handle query parameters (recommendations, copy from existing bet, etc.)
  useEffect(() => {
    const copyFrom = searchParams.get('copyFrom');

    // Handle "copy bet" flow - prefill legs with home/away teams from an existing bet
    if (copyFrom) {
      const initializeFromCopiedBet = async () => {
        try {
          const response = await apiClient.get<{ data: MainBet }>(`/api/bets/${copyFrom}`);
          const originalBet = response.data.data;

          if (originalBet?.legs && originalBet.legs.length > 0) {
            const newLegs: CreateLegRequest[] = originalBet.legs.map((leg) => ({
              home_team_id: leg.home_team_id,
              away_team_id: leg.away_team_id,
              odd: 1,
              result_state: 'pending',
            }));

            setFormData((prev) => ({
              ...prev,
              // Keep current date default; start with fresh stake/odds
              stake: 0,
              odds: undefined,
              state: 'pending',
              legs: newLegs,
            }));

            // Reset stake input and leg odds displays for the new bet
            setStakeInput('');
            setLegDecimalOdds(newLegs.map(() => '1.00'));
            setLegAmericanOdds(
              newLegs.map(() => {
                const american = decimalToAmerican(1);
                return american ? formatAmericanOdds(american) : '';
              })
            );
          } else {
            console.warn('Copied bet has no legs to initialize from:', copyFrom);
          }

          // Clear the copyFrom query param after applying
          const newSearchParams = new URLSearchParams(searchParams.toString());
          newSearchParams.delete('copyFrom');
          router.replace(`/bets/new?${newSearchParams.toString()}`);
        } catch (error) {
          console.error('Failed to initialize new bet from copied bet:', error);
        }
      };

      void initializeFromCopiedBet();
      return;
    }

    // Handle recommendation-based query params
    const leagueId = searchParams.get('league');
    const betTypeId = searchParams.get('betType');
    const categoryId = searchParams.get('category');
    const responsibleId = searchParams.get('responsible');
    const legsParam = searchParams.get('legs');

    if (leagueId || betTypeId || categoryId || responsibleId || legsParam) {
      // Wait for reference items to load
      if (leagues.length > 0 && betTypes.length > 0 && categories.length > 0) {
        const legCount = legsParam ? parseInt(legsParam, 10) : 1;
        const newLegs = Array.from({ length: legCount }, (_, index) => {
          const existingLeg = formData.legs[index] || { odd: 1, result_state: 'pending' };
          return {
            ...existingLeg,
            league_id: leagueId || existingLeg.league_id,
            bet_type_id: betTypeId || existingLeg.bet_type_id,
            category_id: categoryId || existingLeg.category_id,
            responsible_id: responsibleId || existingLeg.responsible_id,
          };
        });

        setFormData(prev => ({
          ...prev,
          legs: newLegs,
        }));

        // Update leg odds arrays
        setLegDecimalOdds(newLegs.map(leg => leg.odd ? leg.odd.toFixed(2) : ''));
        setLegAmericanOdds(newLegs.map(leg => {
          const american = decimalToAmerican(leg.odd);
          return american ? formatAmericanOdds(american) : '';
        }));

        // Clear query params after applying
        const newSearchParams = new URLSearchParams(searchParams.toString());
        newSearchParams.delete('league');
        newSearchParams.delete('betType');
        newSearchParams.delete('category');
        newSearchParams.delete('responsible');
        newSearchParams.delete('legs');
        router.replace(`/bets/new?${newSearchParams.toString()}`);
      }
    }
  }, [searchParams, leagues.length, betTypes.length, categories.length, responsibles.length]);

  const fetchReferenceItems = async () => {
    try {
      // Fetch all items with a high limit to ensure we get everything
      // The API supports up to 10000 items per request
      const [teamsRes, leaguesRes, betTypesRes, categoriesRes, responsiblesRes] = await Promise.all([
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=team&limit=1000'),
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=league&limit=1000'),
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=bet_type&limit=1000'),
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=category&limit=1000'),
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=responsible&limit=1000'),
      ]);
      setTeams(teamsRes.data.data || []);
      setLeagues(leaguesRes.data.data || []);
      setBetTypes(betTypesRes.data.data || []);
      setCategories(categoriesRes.data.data || []);
      setResponsibles(responsiblesRes.data.data || []);
      
      console.log('Reference items loaded:', {
        teams: teamsRes.data.data?.length || 0,
        leagues: leaguesRes.data.data?.length || 0,
        betTypes: betTypesRes.data.data?.length || 0,
        categories: categoriesRes.data.data?.length || 0,
        responsibles: responsiblesRes.data.data?.length || 0,
      });
    } catch (error) {
      console.error('Failed to fetch reference items:', error);
    }
  };

  const getReferenceLabel = (items: ReferenceItem[], id?: string) =>
    id ? items.find((item) => item.id === id)?.name || '' : '';

  const legSummaries: LegSummary[] = formData.legs.map((leg, index) => {
    const parts = [
      getReferenceLabel(betTypes, leg.bet_type_id),
      getReferenceLabel(leagues, leg.league_id),
      getReferenceLabel(responsibles, leg.responsible_id),
    ].filter(Boolean);
    return {
      id: `draft-${index}`,
      odd: leg.odd,
      label: parts.length ? parts.join(' • ') : `Leg ${index + 1}`,
    };
  });

  const buildPredictionPayload = (): MLPredictRequest | null => {
    if (!formData.legs.length) {
      return null;
    }

    const legs = formData.legs
      .filter((leg) => leg.odd > 0)
      .map(({ odd, league_id, bet_type_id, category_id, responsible_id }) => ({
        odd,
        league_id,
        bet_type_id,
        category_id,
        responsible_id,
      }));

    if (!legs.length) {
      return null;
    }

    return {
      legs,
      stake: formData.stake,
    };
  };

  const handleRunPrediction = async () => {
    const payload = buildPredictionPayload();
    if (!payload) {
      alert('Add legs with valid odds to generate a prediction.');
      return;
    }

    await runDraftPrediction(payload);
  };

  useEffect(() => {
    if (!formData.legs.length) {
      resetDraftPrediction();
    }
  }, [formData.legs.length, resetDraftPrediction]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return; // Prevent double-submission
    
    setLoading(true);

    try {
      // Clean up formData before sending - remove undefined/empty values and ensure proper structure
      const cleanedFormData = {
        date: formData.date,
        stake: formData.stake,
        state: formData.state || 'pending',
        ...(formData.notes && { notes: formData.notes }),
        ...(formData.odds && { odds: formData.odds }),
        legs: formData.legs.map(leg => {
          const cleanedLeg: any = {
            odd: leg.odd,
            result_state: leg.result_state || 'pending',
          };
          
          // Only include UUID fields if they have a value (not empty string)
          if (leg.home_team_id) cleanedLeg.home_team_id = leg.home_team_id;
          if (leg.away_team_id) cleanedLeg.away_team_id = leg.away_team_id;
          if (leg.league_id) cleanedLeg.league_id = leg.league_id;
          if (leg.bet_type_id) cleanedLeg.bet_type_id = leg.bet_type_id;
          if (leg.category_id) cleanedLeg.category_id = leg.category_id;
          if (leg.responsible_id) cleanedLeg.responsible_id = leg.responsible_id;
          if (leg.notes) cleanedLeg.notes = leg.notes;
          
          return cleanedLeg;
        }),
      };

      const response = await apiClient.post('/api/bets', cleanedFormData);
      
      // Reset loading before navigation (in case navigation fails)
      setLoading(false);
      router.push('/bets');
    } catch (error: any) {
      console.error('Failed to create bet:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });
      alert(error.response?.data?.error?.message || error.message || 'Failed to create bet');
    } finally {
      // Ensure loading is always reset, even if navigation fails
      setLoading(false);
    }
  };

  // Calculate main bet odds from legs (only if not manually set)
  useEffect(() => {
    if (formData.legs.length > 0) {
      const combinedOdds = formData.legs.reduce((acc, leg) => acc * leg.odd, 1);
      // Only auto-calculate if odds haven't been manually set
      if (!formData.odds || Math.abs(formData.odds - combinedOdds) < 0.01) {
        setFormData((prev) => ({ ...prev, odds: combinedOdds }));
        setMainBetDecimalOdds(combinedOdds.toFixed(2));
        const american = decimalToAmerican(combinedOdds);
        setMainBetAmericanOdds(american ? formatAmericanOdds(american) : '');
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.legs.map((leg) => leg.odd).join(',')]);

  const updateMainBetDecimalOdds = (value: string) => {
    setMainBetDecimalOdds(value);
    const decimal = parseFloat(value);
    if (!isNaN(decimal) && isValidDecimal(decimal)) {
      setFormData({ ...formData, odds: decimal });
      const american = decimalToAmerican(decimal);
      setMainBetAmericanOdds(american ? formatAmericanOdds(american) : '');
    }
  };

  const updateMainBetAmericanOdds = (value: string) => {
    setMainBetAmericanOdds(value);
    // Remove + sign if present
    const cleanValue = value.replace('+', '');
    const american = parseFloat(cleanValue);
    if (!isNaN(american) && isValidAmerican(american)) {
      const decimal = americanToDecimal(american);
      if (decimal) {
        setFormData({ ...formData, odds: decimal });
        setMainBetDecimalOdds(decimal.toFixed(2));
      }
    }
  };

  const updateLegOdds = (index: number, value: string, format: 'decimal' | 'american') => {
    if (format === 'decimal') {
      // Always update the visible input so the user can type freely
      setLegDecimalOdds((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });

      const decimal = parseFloat(value);
      if (!isNaN(decimal) && isValidDecimal(decimal)) {
        // Update the underlying numeric odds only when the value is valid
        const newLegs = formData.legs.map((leg, i) =>
          i === index ? { ...leg, odd: decimal } : { ...leg }
        );
        setFormData({ ...formData, legs: newLegs });

        const american = decimalToAmerican(decimal);
        setLegAmericanOdds((prev) => {
          const next = [...prev];
          next[index] = american ? formatAmericanOdds(american) : '';
          return next;
        });
      }
    } else {
      // American format
      setLegAmericanOdds((prev) => {
        const next = [...prev];
        next[index] = value;
        return next;
      });

      const cleanValue = value.replace('+', '');
      const american = parseFloat(cleanValue);
      if (!isNaN(american) && isValidAmerican(american)) {
        const decimal = americanToDecimal(american);
        if (decimal) {
          const newLegs = formData.legs.map((leg, i) =>
            i === index ? { ...leg, odd: decimal } : { ...leg }
          );
          setFormData({ ...formData, legs: newLegs });

          setLegDecimalOdds((prev) => {
            const next = [...prev];
            next[index] = decimal.toFixed(2);
            return next;
          });
        }
      }
    }
  };

  const addLeg = () => {
    setFormData((prev) => ({
      ...prev,
      legs: [...prev.legs, { odd: 1, result_state: 'pending' }],
    }));
    // Keep local leg odds display in sync
    setLegDecimalOdds((prev) => [...prev, '1.00']);
    setLegAmericanOdds((prev) => {
      const american = decimalToAmerican(1);
      return [...prev, american ? formatAmericanOdds(american) : ''];
    });
  };

  const removeLeg = (index: number) => {
    setFormData({
      ...formData,
      legs: formData.legs.filter((_, i) => i !== index),
    });
    setLegDecimalOdds((prev) => prev.filter((_, i) => i !== index));
    setLegAmericanOdds((prev) => prev.filter((_, i) => i !== index));
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-6">New Bet</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label htmlFor="bet-date" className="block text-sm font-medium text-gray-700">Date</label>
          <input
            id="bet-date"
            type="datetime-local"
            value={(() => {
              // Convert ISO string to local datetime-local format
              const date = new Date(formData.date);
              const year = date.getFullYear();
              const month = String(date.getMonth() + 1).padStart(2, '0');
              const day = String(date.getDate()).padStart(2, '0');
              const hours = String(date.getHours()).padStart(2, '0');
              const minutes = String(date.getMinutes()).padStart(2, '0');
              return `${year}-${month}-${day}T${hours}:${minutes}`;
            })()}
            onChange={(e) => {
              // Convert datetime-local value to ISO string
              // datetime-local gives us local time, we need to preserve it
              const localDateString = e.target.value; // Format: YYYY-MM-DDTHH:mm
              if (localDateString) {
                // Parse the local date string
                const [datePart, timePart] = localDateString.split('T');
                const [year, month, day] = datePart.split('-').map(Number);
                const [hours, minutes] = timePart.split(':').map(Number);
                
                // Create date in local timezone (this avoids timezone conversion issues)
                const localDate = new Date(year, month - 1, day, hours, minutes);
                // Convert to ISO string
                setFormData({ ...formData, date: localDate.toISOString() });
              }
            }}
            placeholder="Select date and time"
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm min-h-[44px]"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Stake *</label>
          <input
            type="text"
            inputMode="decimal"
            pattern="[0-9]*\.?[0-9]*"
            value={stakeInput}
            onChange={(e) => {
              const value = e.target.value;
              // Allow empty string or valid decimal numbers (including trailing decimal point)
              if (value === '' || /^\d*\.?\d*$/.test(value)) {
                setStakeInput(value);
                // Update formData with parsed number, but allow 0 if empty or just a decimal point
                const numValue = value === '' || value === '.' ? 0 : parseFloat(value);
                if (!isNaN(numValue)) {
                  setFormData({ ...formData, stake: numValue });
                }
              }
            }}
            onBlur={() => {
              // On blur, clean up the display if it's just a decimal point or empty
              if (stakeInput === '' || stakeInput === '.') {
                setStakeInput('0');
                setFormData({ ...formData, stake: 0 });
              } else {
                // Format to remove trailing decimal point if no digits after it
                const numValue = parseFloat(stakeInput);
                if (!isNaN(numValue)) {
                  setStakeInput(numValue.toString());
                }
              }
            }}
            placeholder="10.00"
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900 min-h-[44px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Main Bet Odds (optional - auto-calculated from legs)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Decimal</label>
              <input
                type="text"
                inputMode="decimal"
                pattern="[0-9]*\.?[0-9]*"
                value={mainBetDecimalOdds}
                onChange={(e) => updateMainBetDecimalOdds(e.target.value)}
                placeholder="2.50"
                className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900 min-h-[44px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">American</label>
              <input
                type="text"
                inputMode="numeric"
                value={mainBetAmericanOdds}
                onChange={(e) => updateMainBetAmericanOdds(e.target.value)}
                placeholder="+150 or -200"
                className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900"
              />
            </div>
          </div>
          <p className="mt-1 text-xs text-gray-500">
            If not specified, will be calculated from leg odds
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Notes (optional)</label>
          <textarea
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value || undefined })}
            rows={3}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm min-h-[44px]"
            placeholder="Add any notes about this bet..."
          />
        </div>
        <div>
          <MLInsights
            title="Draft ML Prediction"
            legs={legSummaries}
            stake={formData.stake}
            prediction={draftPrediction}
            loading={draftPredictionLoading}
            error={draftPredictionError}
            onRetry={handleRunPrediction}
            lastUpdated={draftPredictionUpdated}
          />
          <p className="mt-2 text-xs text-gray-500">
            Predictions update when you press Refresh. Add stake and legs to get tailored insights.
          </p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Legs</label>
          {formData.legs.map((leg, index) => (
            <div key={index} className="mt-4 p-4 border border-gray-300 rounded-md">
              <div className="flex justify-between mb-2">
                <h3 className="font-medium">Leg {index + 1}</h3>
                {formData.legs.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLeg(index)}
                    className="text-red-600 hover:text-red-800 min-h-[44px] px-2"
                  >
                    Remove
                  </button>
                )}
              </div>
              <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <SearchableSelect
                      options={teams}
                      value={leg.home_team_id || ''}
                      onChange={(value) => {
                        const newLegs = formData.legs.map((l, i) => 
                          i === index ? { ...l, home_team_id: value || undefined } : { ...l }
                        );
                        setFormData({ ...formData, legs: newLegs });
                      }}
                      placeholder="Search home team..."
                      label="Home Team"
                    />
                  </div>
                  <div>
                    <SearchableSelect
                      options={teams}
                      value={leg.away_team_id || ''}
                      onChange={(value) => {
                        const newLegs = formData.legs.map((l, i) => 
                          i === index ? { ...l, away_team_id: value || undefined } : { ...l }
                        );
                        setFormData({ ...formData, legs: newLegs });
                      }}
                      placeholder="Search away team..."
                      label="Away Team"
                    />
                  </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <SearchableSelect
                      options={leagues}
                    value={leg.league_id || ''}
                      onChange={(value) => {
                        const newLegs = formData.legs.map((l, i) => 
                          i === index ? { ...l, league_id: value || undefined } : { ...l }
                        );
                        setFormData({ ...formData, legs: newLegs });
                      }}
                      placeholder="Search league..."
                      label="League"
                    />
                  </div>
                  <div>
                    <SearchableSelect
                      options={betTypes}
                      value={leg.bet_type_id || ''}
                      onChange={(value) => {
                        const newLegs = formData.legs.map((l, i) => 
                          i === index ? { ...l, bet_type_id: value || undefined } : { ...l }
                        );
                      setFormData({ ...formData, legs: newLegs });
                    }}
                      placeholder="Search bet type..."
                      label="Bet Type"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <SearchableSelect
                      options={categories}
                      value={leg.category_id || ''}
                      onChange={(value) => {
                        const newLegs = formData.legs.map((l, i) => 
                          i === index ? { ...l, category_id: value || undefined } : { ...l }
                        );
                        setFormData({ ...formData, legs: newLegs });
                      }}
                      placeholder="Search category..."
                      label="Category"
                    />
                </div>
                <div>
                    <SearchableSelect
                      options={responsibles}
                      value={leg.responsible_id || ''}
                      onChange={(value) => {
                        const newLegs = formData.legs.map((l, i) => 
                          i === index ? { ...l, responsible_id: value || undefined } : { ...l }
                        );
                      setFormData({ ...formData, legs: newLegs });
                    }}
                      placeholder="Search responsible..."
                      label="Responsible"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Odds *</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Decimal</label>
                  <input
                    type="text"
                        inputMode="decimal"
                        pattern="[0-9]*\.?[0-9]*"
                        value={legDecimalOdds[index] ?? ''}
                        onChange={(e) => updateLegOdds(index, e.target.value, 'decimal')}
                        placeholder="2.50"
                        className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900 min-h-[44px] [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">American</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={legAmericanOdds[index] ?? ''}
                        onChange={(e) => updateLegOdds(index, e.target.value, 'american')}
                        placeholder="+150 or -200"
                        className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900 min-h-[44px]"
                      />
                    </div>
                  </div>
                  <p className="mt-1 text-xs text-gray-500">
                    Enter either decimal or American odds - the other will calculate automatically
                  </p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Leg Notes (optional)</label>
                    <textarea
                      value={leg.notes || ''}
                    onChange={(e) => {
                        const newLegs = formData.legs.map((l, i) => 
                          i === index ? { ...l, notes: e.target.value || undefined } : { ...l }
                        );
                      setFormData({ ...formData, legs: newLegs });
                    }}
                    rows={2}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm min-h-[44px]"
                    placeholder="Add notes about this leg..."
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addLeg}
            className="mt-4 text-primary-600 hover:text-primary-800 min-h-[44px] px-2 flex items-center"
          >
            + Add Leg
          </button>
        </div>
        <div className="flex flex-col sm:flex-row justify-end gap-3 sm:space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="w-full sm:w-auto px-4 py-3 border border-gray-300 rounded-md text-base sm:text-sm font-medium text-gray-700 hover:bg-gray-50 min-h-[44px]"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="w-full sm:w-auto px-4 py-3 border border-transparent rounded-md shadow-sm text-base sm:text-sm font-medium text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50 min-h-[44px]"
          >
            {loading ? 'Creating...' : 'Create Bet'}
          </button>
        </div>
      </form>
    </div>
  );
}

