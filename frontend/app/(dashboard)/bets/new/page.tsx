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
  }, []);

  const fetchReferenceItems = async () => {
    try {
      const [teamsRes, leaguesRes, betTypesRes, categoriesRes, responsiblesRes] = await Promise.all([
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=team'),
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=league'),
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=bet_type'),
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=category'),
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=responsible'),
      ]);
      setTeams(teamsRes.data.data);
      setLeagues(leaguesRes.data.data);
      setBetTypes(betTypesRes.data.data);
      setCategories(categoriesRes.data.data);
      setResponsibles(responsiblesRes.data.data);
    } catch (error) {
      console.error('Failed to fetch reference items:', error);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await apiClient.post('/api/bets', formData);
      router.push('/bets');
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to create bet');
    } finally {
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
    const newLegs = [...formData.legs];
    let decimal: number;

    if (format === 'decimal') {
      decimal = parseFloat(value);
      if (!isNaN(decimal) && isValidDecimal(decimal)) {
        newLegs[index].odd = decimal;
      }
    } else {
      const cleanValue = value.replace('+', '');
      const american = parseFloat(cleanValue);
      if (!isNaN(american) && isValidAmerican(american)) {
        const converted = americanToDecimal(american);
        if (converted) {
          decimal = converted;
          newLegs[index].odd = decimal;
        }
      }
    }

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
            value={formData.date.split('T')[0] + 'T' + formData.date.split('T')[1]?.slice(0, 5)}
            onChange={(e) => setFormData({ ...formData, date: new Date(e.target.value).toISOString() })}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Stake *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={formData.stake}
            onChange={(e) => setFormData({ ...formData, stake: parseFloat(e.target.value) || 0 })}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Main Bet Odds (optional - auto-calculated from legs)</label>
          <div className="grid grid-cols-2 gap-4 mt-1">
            <div>
              <label className="block text-xs text-gray-500 mb-1">Decimal</label>
              <input
                type="number"
                step="0.01"
                min="1"
                value={mainBetDecimalOdds}
                onChange={(e) => updateMainBetDecimalOdds(e.target.value)}
                placeholder="2.50"
                className="block w-full border border-gray-300 rounded-md px-3 py-2"
              />
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">American</label>
              <input
                type="text"
                value={mainBetAmericanOdds}
                onChange={(e) => updateMainBetAmericanOdds(e.target.value)}
                placeholder="+150 or -200"
                className="block w-full border border-gray-300 rounded-md px-3 py-2"
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
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
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
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <SearchableSelect
                      options={teams}
                      value={leg.home_team_id || ''}
                      onChange={(value) => {
                        const newLegs = [...formData.legs];
                        newLegs[index].home_team_id = value || undefined;
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
                        const newLegs = [...formData.legs];
                        newLegs[index].away_team_id = value || undefined;
                        setFormData({ ...formData, legs: newLegs });
                      }}
                      placeholder="Search away team..."
                      label="Away Team"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <SearchableSelect
                      options={leagues}
                      value={leg.league_id || ''}
                      onChange={(value) => {
                        const newLegs = [...formData.legs];
                        newLegs[index].league_id = value || undefined;
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
                        const newLegs = [...formData.legs];
                        newLegs[index].bet_type_id = value || undefined;
                        setFormData({ ...formData, legs: newLegs });
                      }}
                      placeholder="Search bet type..."
                      label="Bet Type"
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <SearchableSelect
                      options={categories}
                      value={leg.category_id || ''}
                      onChange={(value) => {
                        const newLegs = [...formData.legs];
                        newLegs[index].category_id = value || undefined;
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
                        const newLegs = [...formData.legs];
                        newLegs[index].responsible_id = value || undefined;
                        setFormData({ ...formData, legs: newLegs });
                      }}
                      placeholder="Search responsible..."
                      label="Responsible"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Odds *</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Decimal</label>
                      <input
                        type="number"
                        step="0.01"
                        min="1"
                        value={leg.odd.toFixed(2)}
                        onChange={(e) => updateLegOdds(index, e.target.value, 'decimal')}
                        placeholder="2.50"
                        className="block w-full border border-gray-300 rounded-md px-3 py-2"
                        required
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">American</label>
                      <input
                        type="text"
                        value={decimalToAmerican(leg.odd) ? formatAmericanOdds(decimalToAmerican(leg.odd)!) : ''}
                        onChange={(e) => updateLegOdds(index, e.target.value, 'american')}
                        placeholder="+150 or -200"
                        className="block w-full border border-gray-300 rounded-md px-3 py-2"
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
                      const newLegs = [...formData.legs];
                      newLegs[index].notes = e.target.value || undefined;
                      setFormData({ ...formData, legs: newLegs });
                    }}
                    rows={2}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
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
        <div className="flex justify-end space-x-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="px-4 py-2 border border-transparent rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700 disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Bet'}
          </button>
        </div>
      </form>
    </div>
  );
}

