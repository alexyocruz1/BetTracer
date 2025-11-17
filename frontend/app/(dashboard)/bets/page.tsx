'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { MainBet } from '@/types';
import Link from 'next/link';

export default function BetsPage() {
  const [bets, setBets] = useState<MainBet[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let requestCompleted = false;

    // Safety timeout to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      if (!requestCompleted && !cancelled) {
        requestCompleted = true;
        console.error('[Bets] Request timeout - forcing completion');
        setBets([]);
        setLoading(false);
      }
    }, 20000); // 20 second safety timeout
    
    const fetchBets = async () => {
      try {
        const { data } = await apiClient.get<{ data: MainBet[] }>('/api/bets');
        if (requestCompleted || cancelled) return;
        
        requestCompleted = true;
        clearTimeout(timeoutId);
        setBets(data.data);
      } catch (error) {
        if (requestCompleted || cancelled) return;
        
        requestCompleted = true;
        clearTimeout(timeoutId);
        console.error('Failed to fetch bets:', error);
        setBets([]);
      } finally {
        if (!requestCompleted && !cancelled) {
          clearTimeout(timeoutId);
          setLoading(false);
        }
      }
    };
    
    fetchBets();
    
    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, []);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6 flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bets</h1>
          <p className="mt-2 text-sm text-gray-600">View and manage your bets</p>
        </div>
        <Link
          href="/bets/new"
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-primary-600 hover:bg-primary-700"
        >
          New Bet
        </Link>
      </div>

      <div className="bg-white shadow overflow-hidden sm:rounded-md">
        <ul className="divide-y divide-gray-200">
          {bets.map((bet) => (
            <li key={bet.id}>
              <Link href={`/bets/${bet.id}`} className="block hover:bg-gray-50">
                <div className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="text-sm font-medium text-gray-900">
                        ${bet.stake} @ {bet.odds?.toFixed(2)}x
                      </div>
                      <span className={`ml-3 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        bet.state === 'won' ? 'bg-green-100 text-green-800' :
                        bet.state === 'lost' ? 'bg-red-100 text-red-800' :
                        bet.state === 'void' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {bet.state}
                      </span>
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(bet.date).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="mt-2 text-sm text-gray-500">
                    Profit/Loss:{' '}
                    {bet.profit_loss !== null && bet.profit_loss !== undefined ? (
                      <span className={bet.profit_loss >= 0 ? 'text-green-600' : 'text-red-600'}>
                        ${bet.profit_loss.toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-gray-400">Pending</span>
                    )}
                  </div>
                </div>
              </Link>
            </li>
          ))}
        </ul>
        {bets.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            No bets found. <Link href="/bets/new" className="text-primary-600 hover:text-primary-500">Create your first bet</Link>
          </div>
        )}
      </div>
    </div>
  );
}

