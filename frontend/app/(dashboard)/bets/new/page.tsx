'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ReferenceItem, CreateBetRequest } from '@/types';
import {
  decimalToAmerican,
  americanToDecimal,
  formatAmericanOdds,
  isValidDecimal,
  isValidAmerican,
} from '@/lib/utils/odds';
import SearchableSelect from '@/components/SearchableSelect';

export default function NewBetPage() {
  const router = useRouter();
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
  
  // Local state for odds display (decimal/American)
  const [mainBetDecimalOdds, setMainBetDecimalOdds] = useState<string>('');
  const [mainBetAmericanOdds, setMainBetAmericanOdds] = useState<string>('');

  useEffect(() => {
    fetchReferenceItems();
    
    // Refetch when page becomes visible (in case items were added in another tab)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        fetchReferenceItems();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

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
    const newLegs = formData.legs.map((leg, i) => {
      if (i !== index) {
        // Return unchanged leg (create new object to avoid mutation)
        return { ...leg };
      }
      
      // Update the leg at this index
      let decimal: number | undefined;
      
      if (format === 'decimal') {
        const parsed = parseFloat(value);
        if (!isNaN(parsed) && isValidDecimal(parsed)) {
          decimal = parsed;
        } else {
          // If invalid, keep current value
          return { ...leg };
        }
      } else {
        const cleanValue = value.replace('+', '');
        const american = parseFloat(cleanValue);
        if (!isNaN(american) && isValidAmerican(american)) {
          const converted = americanToDecimal(american);
          if (converted) {
            decimal = converted;
          } else {
            return { ...leg };
          }
        } else {
          return { ...leg };
        }
      }
      
      // Create new leg object with updated odd
      return {
        ...leg,
        odd: decimal,
      };
    });

    setFormData({ ...formData, legs: newLegs });
  };

  const addLeg = () => {
    setFormData({
      ...formData,
      legs: [...formData.legs, { odd: 1, result_state: 'pending' }],
    });
  };

  const removeLeg = (index: number) => {
    setFormData({
      ...formData,
      legs: formData.legs.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="px-4 py-6 sm:px-0">
      <h1 className="text-3xl font-bold text-gray-900 mb-6">New Bet</h1>
      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700">Date</label>
          <input
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
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Stake *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            inputMode="decimal"
            value={formData.stake}
            onChange={(e) => setFormData({ ...formData, stake: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Main Bet Odds (optional - auto-calculated from legs)</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-1">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Decimal</label>
              <input
                type="number"
                step="0.01"
                min="1"
                inputMode="decimal"
                value={mainBetDecimalOdds}
                onChange={(e) => updateMainBetDecimalOdds(e.target.value)}
                placeholder="2.50"
                className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900"
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
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm"
            placeholder="Add any notes about this bet..."
          />
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
                    className="text-red-600 hover:text-red-800"
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
                    type="number"
                    step="0.01"
                        min="1"
                        inputMode="decimal"
                        value={leg.odd.toFixed(2)}
                        onChange={(e) => updateLegOdds(index, e.target.value, 'decimal')}
                        placeholder="2.50"
                        className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">American</label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={decimalToAmerican(leg.odd) ? formatAmericanOdds(decimalToAmerican(leg.odd)!) : ''}
                        onChange={(e) => updateLegOdds(index, e.target.value, 'american')}
                        placeholder="+150 or -200"
                        className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900"
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
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm"
                    placeholder="Add notes about this leg..."
                  />
                </div>
              </div>
            </div>
          ))}
          <button
            type="button"
            onClick={addLeg}
            className="mt-4 text-primary-600 hover:text-primary-800"
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

