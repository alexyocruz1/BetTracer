'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { ReferenceItem, CreateBetRequest } from '@/types';

export default function NewBetPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [leagues, setLeagues] = useState<ReferenceItem[]>([]);
  const [betTypes, setBetTypes] = useState<ReferenceItem[]>([]);
  const [formData, setFormData] = useState<CreateBetRequest>({
    date: new Date().toISOString(),
    stake: 0,
    state: 'pending',
    legs: [{ odd: 1, result_state: 'pending' }],
  });

  useEffect(() => {
    fetchReferenceItems();
  }, []);

  const fetchReferenceItems = async () => {
    try {
      const [leaguesRes, betTypesRes] = await Promise.all([
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=league'),
        apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?kind=bet_type'),
      ]);
      setLeagues(leaguesRes.data.data);
      setBetTypes(betTypesRes.data.data);
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
          <label className="block text-sm font-medium text-gray-700">Stake</label>
          <input
            type="number"
            step="0.01"
            value={formData.stake}
            onChange={(e) => setFormData({ ...formData, stake: parseFloat(e.target.value) })}
            className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
            required
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
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">League</label>
                  <select
                    value={leg.league_id || ''}
                    onChange={(e) => {
                      const newLegs = [...formData.legs];
                      newLegs[index].league_id = e.target.value;
                      setFormData({ ...formData, legs: newLegs });
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select league</option>
                    {leagues.map((league) => (
                      <option key={league.id} value={league.id}>
                        {league.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Bet Type</label>
                  <select
                    value={leg.bet_type_id || ''}
                    onChange={(e) => {
                      const newLegs = [...formData.legs];
                      newLegs[index].bet_type_id = e.target.value;
                      setFormData({ ...formData, legs: newLegs });
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                  >
                    <option value="">Select bet type</option>
                    {betTypes.map((betType) => (
                      <option key={betType.id} value={betType.id}>
                        {betType.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700">Odds</label>
                  <input
                    type="number"
                    step="0.01"
                    value={leg.odd}
                    onChange={(e) => {
                      const newLegs = [...formData.legs];
                      newLegs[index].odd = parseFloat(e.target.value);
                      setFormData({ ...formData, legs: newLegs });
                    }}
                    className="mt-1 block w-full border border-gray-300 rounded-md px-3 py-2"
                    required
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

