'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api/client';
import { MainBet } from '@/types';

export default function BetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [bet, setBet] = useState<MainBet | null>(null);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    if (params.id) {
      fetchBet(params.id as string);
    }
  }, [params.id]);

  const fetchBet = async (id: string) => {
    try {
      const { data } = await apiClient.get<{ data: MainBet }>(`/api/bets/${id}`);
      setBet(data.data);
    } catch (error) {
      console.error('Failed to fetch bet:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateState = async (state: 'won' | 'lost' | 'void') => {
    if (!bet) return;

    setUpdating(true);
    try {
      await apiClient.patch(`/api/bets/${bet.id}/state`, { state });
      fetchBet(bet.id);
    } catch (error: any) {
      alert(error.response?.data?.error?.message || 'Failed to update bet state');
    } finally {
      setUpdating(false);
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
          {bet.profit_loss !== null && (
            <div>
              <label className="text-sm font-medium text-gray-500">Profit/Loss</label>
              <div className={`text-lg font-semibold ${bet.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                ${bet.profit_loss.toFixed(2)}
              </div>
            </div>
          )}
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
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="font-medium">Leg {index + 1}</h3>
                  <div className="text-sm text-gray-500">Odds: {leg.odd.toFixed(2)}x</div>
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
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

