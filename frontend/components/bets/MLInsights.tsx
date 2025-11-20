import React from 'react';
import { MLPredictionResponse } from '@/types';

export interface LegSummary {
  id?: string;
  label?: string;
  odd: number;
}

interface MLInsightsProps {
  legs: LegSummary[];
  stake?: number;
  prediction: MLPredictionResponse | null;
  loading: boolean;
  error: string | null;
  onRetry?: () => void;
  lastUpdated?: Date | null;
  title?: string;
}

const formatPercent = (value?: number | null) =>
  typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : '--';

const formatCurrency = (value?: number | null) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return '--';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2,
  }).format(value);
};

export function MLInsights({
  legs,
  stake,
  prediction,
  loading,
  error,
  onRetry,
  lastUpdated,
  title = 'ML Insights',
}: MLInsightsProps) {
  const hasLegs = legs.length > 0;

  return (
    <section className="rounded-xl border border-gray-200 bg-white/70 px-4 py-5 shadow-sm sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900">{title}</p>
          <p className="text-xs text-gray-500">
            Real-time predictions for this bet using your ML model
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            className="rounded-md border border-gray-300 bg-white px-3 py-1 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 disabled:opacity-50"
            onClick={onRetry}
            disabled={!hasLegs || loading}
          >
            Refresh
          </button>
        )}
      </div>

      {!hasLegs && (
        <p className="mt-4 text-sm text-amber-600">
          Add at least one leg to see ML predictions.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}

      {loading && (
        <p className="mt-4 text-sm text-gray-500">Generating predictions…</p>
      )}

      {!loading && !error && prediction && (
        <>
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Combined Probability
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {formatPercent(prediction.combined_probability)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Confidence
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {formatPercent(prediction.confidence)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Expected Value
              </p>
              <p className={`mt-1 text-2xl font-semibold ${
                (prediction.expected_value ?? 0) >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                {formatCurrency(prediction.expected_value)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500">
                Suggested Stake
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-900">
                {formatCurrency(prediction.suggested_stake)}
              </p>
              {stake && (
                <p className="text-xs text-gray-500">
                  Current stake: {formatCurrency(stake)}
                </p>
              )}
            </div>
          </div>

          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Leg Insights
            </p>
            <div className="mt-2 overflow-hidden rounded-lg border border-gray-200">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Leg
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Odds
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500">
                      Win Probability
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {legs.map((leg, index) => {
                    const probability =
                      prediction.per_leg_probabilities?.[index];
                    return (
                      <tr key={leg.id || `leg-${index}`}>
                        <td className="px-4 py-2 text-gray-900">
                          {leg.label || `Leg ${index + 1}`}
                        </td>
                        <td className="px-4 py-2 text-gray-700">
                          {leg.odd.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-gray-900">
                          {probability != null
                            ? formatPercent(probability)
                            : 'N/A'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {lastUpdated && (
            <p className="mt-4 text-xs text-gray-500">
              Updated {lastUpdated.toLocaleString()}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default MLInsights;

