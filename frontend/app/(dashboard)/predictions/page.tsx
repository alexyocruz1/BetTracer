'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import { ReferenceItem } from '@/types';
import Link from 'next/link';

interface Recommendation {
  responsible_id: string | null;
  responsible_name: string;
  league_id: string;
  league_name: string;
  bet_type_id: string;
  bet_type_name: string;
  category_id: string;
  category_name: string;
  recommended_leg_count: number;
  recommended_day: string | null;
  confidence_score: number;
  reasoning: string[];
}

export default function PredictionsPage() {
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [referenceItems, setReferenceItems] = useState<Map<string, ReferenceItem>>(new Map());

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch reference items and recommendations in parallel
        const [referenceItemsRes, recommendationsRes] = await Promise.all([
          apiClient.get<{ data: ReferenceItem[] }>('/api/reference-items?limit=1000').catch(() => ({ data: { data: [] } })),
          apiClient.get<{ data: Recommendation[]; meta: any }>('/api/ml/recommendations'),
        ]);

        // Build reference items map
        const itemsMap = new Map<string, ReferenceItem>();
        referenceItemsRes.data.data.forEach(item => {
          itemsMap.set(item.id, item);
        });
        setReferenceItems(itemsMap);

        // Set recommendations
        setRecommendations(recommendationsRes.data.data || []);
      } catch (err: any) {
        console.error('Failed to fetch recommendations:', err);
        setError(err?.response?.data?.error?.message || err?.message || 'Failed to load recommendations');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const getDayName = (day: string | null): string => {
    if (!day) return 'Any day';
    const dayMap: Record<string, string> = {
      '0': 'Sunday',
      '1': 'Monday',
      '2': 'Tuesday',
      '3': 'Wednesday',
      '4': 'Thursday',
      '5': 'Friday',
      '6': 'Saturday',
    };
    return dayMap[day] || day;
  };

  const getConfidenceColor = (score: number): string => {
    if (score >= 0.7) return 'text-green-600 dark:text-green-400';
    if (score >= 0.6) return 'text-yellow-600 dark:text-yellow-400';
    return 'text-orange-600 dark:text-orange-400';
  };

  const getConfidenceBadge = (score: number): string => {
    if (score >= 0.7) return 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300';
    if (score >= 0.6) return 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300';
    return 'bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300';
  };

  if (loading) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="text-center py-12">
          <div className="inline-block animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400">Loading recommendations...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-6 sm:px-0">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6 text-center">
          <svg className="mx-auto h-12 w-12 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-red-900 dark:text-red-300">Error loading recommendations</h3>
          <p className="mt-2 text-sm text-red-700 dark:text-red-400">{error}</p>
          <button
            onClick={() => window.location.reload()}
            className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-red-600 hover:bg-red-700 min-h-[44px]"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  // Group recommendations by responsible
  const groupedByResponsible = recommendations.reduce((acc, rec) => {
    const key = rec.responsible_id || 'general';
    if (!acc[key]) {
      acc[key] = {
        responsible_id: rec.responsible_id,
        responsible_name: rec.responsible_name,
        recommendations: [],
      };
    }
    acc[key].recommendations.push(rec);
    return acc;
  }, {} as Record<string, { responsible_id: string | null; responsible_name: string; recommendations: Recommendation[] }>);

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 dark:text-gray-100">Bet Predictions</h1>
        <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
          AI-powered recommendations based on your betting history and performance analytics
        </p>
      </div>

      {recommendations.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border-2 border-dashed border-gray-200 dark:border-gray-700 text-center py-12">
          <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
          <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-100">No recommendations available</h3>
          <p className="mt-1 text-sm text-gray-500 dark:text-gray-400">
            We need more betting data to generate personalized recommendations.
          </p>
          <div className="mt-6">
            <Link
              href="/bets/new"
              className="inline-flex items-center px-4 py-2 border border-transparent shadow-sm text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 min-h-[44px]"
            >
              Create Your First Bet
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.values(groupedByResponsible).map((group, groupIndex) => (
            <div key={groupIndex} className="bg-white dark:bg-gray-800 shadow rounded-lg p-6">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                    {group.responsible_name === 'General' ? 'General Recommendations' : `Recommendations for ${group.responsible_name}`}
                  </h2>
                  <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                    {group.recommendations.length} recommendation{group.recommendations.length > 1 ? 's' : ''} based on historical performance
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {group.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="border border-gray-200 dark:border-gray-700 rounded-lg p-4 hover:shadow-md transition-shadow"
                  >
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getConfidenceBadge(rec.confidence_score)}`}>
                            {(rec.confidence_score * 100).toFixed(0)}% Confidence
                          </span>
                        </div>
                        <h3 className="text-sm font-medium text-gray-900 dark:text-gray-100 mb-1">
                          {rec.league_name}
                        </h3>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {rec.bet_type_name} • {rec.category_name}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-2 mb-4">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-gray-500 dark:text-gray-400">Recommended Legs:</span>
                        <span className="font-medium text-gray-900 dark:text-gray-100">{rec.recommended_leg_count}</span>
                      </div>
                      {rec.recommended_day && (
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-gray-500 dark:text-gray-400">Best Day:</span>
                          <span className="font-medium text-gray-900 dark:text-gray-100">{getDayName(rec.recommended_day)}</span>
                        </div>
                      )}
                    </div>

                    <div className="border-t border-gray-200 dark:border-gray-700 pt-3">
                      <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">Why this recommendation:</p>
                      <ul className="space-y-1">
                        {rec.reasoning.slice(0, 3).map((reason, reasonIndex) => (
                          <li key={reasonIndex} className="text-xs text-gray-600 dark:text-gray-400 flex items-start">
                            <span className="text-primary-600 dark:text-primary-400 mr-1">•</span>
                            <span>{reason}</span>
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-200 dark:border-gray-700">
                      <Link
                        href={`/bets/new?league=${rec.league_id}&betType=${rec.bet_type_id}&category=${rec.category_id}&responsible=${rec.responsible_id || ''}&legs=${rec.recommended_leg_count}`}
                        className="block w-full text-center px-3 py-2 text-xs font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 dark:bg-primary-500 dark:hover:bg-primary-600 min-h-[36px] flex items-center justify-center"
                      >
                        Use This Recommendation
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
        <div className="flex items-start">
          <svg className="h-5 w-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="ml-3">
            <h3 className="text-sm font-medium text-blue-900 dark:text-blue-300">How recommendations work</h3>
            <p className="mt-1 text-sm text-blue-700 dark:text-blue-400">
              Our AI analyzes your betting history to identify patterns in leagues, bet types, categories, responsible persons, and timing. 
              Recommendations are based on your highest-performing combinations with at least 3 historical bets and a win rate above 50%.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

