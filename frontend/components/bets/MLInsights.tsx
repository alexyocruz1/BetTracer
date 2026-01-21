import React from 'react';
import { MLPredictResponse } from '@/types';

export interface LegSummary {
  id?: string;
  label?: string;
  odd: number;
}

interface MLInsightsProps {
  legs: LegSummary[];
  stake?: number;
  prediction: MLPredictResponse | null;
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
    <section className="rounded-xl border border-gray-200 dark:border-gray-700 bg-white/70 dark:bg-gray-800/70 px-4 py-5 shadow-sm sm:px-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-gray-900 dark:text-white">{title}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Real-time predictions for this bet using your ML model
          </p>
        </div>
        {onRetry && (
          <button
            type="button"
            className="rounded-md border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-700 px-3 py-1 text-sm font-medium text-gray-700 dark:text-gray-300 shadow-sm hover:bg-gray-50 dark:hover:bg-gray-600 disabled:opacity-50"
            onClick={onRetry}
            disabled={!hasLegs || loading}
          >
            Refresh
          </button>
        )}
      </div>

      {!hasLegs && (
        <p className="mt-4 text-sm text-amber-600 dark:text-amber-400">
          Add at least one leg to see ML predictions.
        </p>
      )}

      {error && (
        <p className="mt-4 rounded-md bg-red-50 dark:bg-red-900/20 px-3 py-2 text-sm text-red-700 dark:text-red-300">
          {error}
        </p>
      )}

      {loading && (
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-400">Generating predictions…</p>
      )}

      {!loading && !error && prediction && (
        <>
          {/* Recommendation Badge */}
          {prediction.recommendation && (
            <div className={`mt-4 rounded-lg border p-3 ${
              prediction.recommendation === 'strong_value' ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20' :
              prediction.recommendation === 'value' ? 'border-green-300 dark:border-green-500 bg-green-50 dark:bg-green-900/20' :
              prediction.recommendation === 'avoid' ? 'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20' :
              'border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-700/50'
            }`}>
              <div className="flex items-center gap-2">
                <span className={`text-sm font-semibold ${
                  prediction.recommendation === 'strong_value' || prediction.recommendation === 'value' ? 'text-green-800 dark:text-green-300' :
                  prediction.recommendation === 'avoid' ? 'text-red-800 dark:text-red-300' :
                  'text-gray-800 dark:text-gray-200'
                }`}>
                  {prediction.recommendation === 'strong_value' ? '⭐ Strong Value Bet' :
                   prediction.recommendation === 'value' ? '✓ Value Bet' :
                   prediction.recommendation === 'avoid' ? '⚠️ Avoid' :
                   '➡️ Neutral'}
                </span>
              </div>
              {prediction.recommendation_reason && (
                <p className={`mt-1 text-xs ${
                  prediction.recommendation === 'strong_value' || prediction.recommendation === 'value' ? 'text-green-700 dark:text-green-300' :
                  prediction.recommendation === 'avoid' ? 'text-red-700 dark:text-red-300' :
                  'text-gray-700 dark:text-gray-300'
                }`}>
                  {prediction.recommendation_reason}
                </p>
              )}
            </div>
          )}

          {/* Risk Warnings */}
          {prediction.risk_warnings && prediction.risk_warnings.length > 0 && (
            <div className="mt-4 rounded-lg border border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-amber-900/20 p-3">
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-300">⚠️ Risk Warnings</p>
              <ul className="mt-2 list-disc list-inside space-y-1">
                {prediction.risk_warnings.map((warning, idx) => (
                  <li key={idx} className="text-xs text-amber-700 dark:text-amber-300">{warning}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Bankroll Health */}
          {prediction.bankroll_health && (
            <div className={`mt-4 rounded-lg border p-3 ${
              prediction.bankroll_health === 'healthy' ? 'border-green-500 dark:border-green-400 bg-green-50 dark:bg-green-900/20' :
              prediction.bankroll_health === 'caution' ? 'border-amber-500 dark:border-amber-400 bg-amber-50 dark:bg-amber-900/20' :
              'border-red-500 dark:border-red-400 bg-red-50 dark:bg-red-900/20'
            }`}>
              <p className={`text-sm font-semibold ${
                prediction.bankroll_health === 'healthy' ? 'text-green-800 dark:text-green-300' :
                prediction.bankroll_health === 'caution' ? 'text-amber-800 dark:text-amber-300' :
                'text-red-800 dark:text-red-300'
              }`}>
                Bankroll Health: {prediction.bankroll_health === 'healthy' ? '✓ Healthy' :
                                 prediction.bankroll_health === 'caution' ? '⚠️ Caution' :
                                 '🚨 Critical'}
              </p>
              {prediction.bankroll_advice && (
                <p className={`mt-1 text-xs ${
                  prediction.bankroll_health === 'healthy' ? 'text-green-700 dark:text-green-300' :
                  prediction.bankroll_health === 'caution' ? 'text-amber-700 dark:text-amber-300' :
                  'text-red-700 dark:text-red-300'
                }`}>
                  {prediction.bankroll_advice}
                </p>
              )}
            </div>
          )}

          {/* Streak Impact */}
          {prediction.streak_impact && (
            <div className="mt-4 rounded-lg border border-blue-300 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-3">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">
                Current Streak: {prediction.streak_impact.streak_length} {prediction.streak_impact.streak_type === 'win' ? 'Wins' : 'Losses'}
              </p>
              <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">{prediction.streak_impact.message}</p>
            </div>
          )}

          {/* Main Metrics Grid */}
          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Combined Probability
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatPercent(prediction.combined_probability)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Confidence
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatPercent(prediction.confidence)}
              </p>
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Expected Value
              </p>
              <p className={`mt-1 text-2xl font-semibold ${
                (prediction.expected_value ?? 0) >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
              }`}>
                {formatCurrency(prediction.expected_value)}
              </p>
              {prediction.value_detected !== undefined && prediction.value_detected !== null && (
                <p className={`mt-1 text-xs ${
                  prediction.value_detected > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'
                }`}>
                  {prediction.value_detected > 0 ? '+' : ''}{prediction.value_detected.toFixed(1)}% value
                </p>
              )}
            </div>
            <div className="rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 p-4">
              <p className="text-xs uppercase tracking-wide text-gray-500 dark:text-gray-400">
                Suggested Stake
              </p>
              <p className="mt-1 text-2xl font-semibold text-gray-900 dark:text-white">
                {formatCurrency(prediction.suggested_stake)}
              </p>
              {prediction.kelly_stake !== undefined && prediction.kelly_stake !== null && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Kelly: {formatCurrency(prediction.kelly_stake)}
                  {prediction.kelly_percentage !== undefined && prediction.kelly_percentage !== null && (
                    <span> ({prediction.kelly_percentage.toFixed(1)}%)</span>
                  )}
                </p>
              )}
              {stake && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Current stake: {formatCurrency(stake)}
                </p>
              )}
            </div>
          </div>

          {/* Leg Optimization */}
          {prediction.leg_optimization && prediction.leg_optimization.suggestions.length > 0 && (
            <div className="mt-6 rounded-lg border border-purple-300 dark:border-purple-500 bg-purple-50 dark:bg-purple-900/20 p-4">
              <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">💡 Leg Optimization Suggestion</p>
              <p className="mt-1 text-xs text-purple-700 dark:text-purple-300">{prediction.leg_optimization.message}</p>
              <div className="mt-3 space-y-2">
                {prediction.leg_optimization.suggestions.slice(0, 2).map((suggestion, idx) => (
                  <div key={idx} className="rounded border border-purple-200 dark:border-purple-700 bg-white dark:bg-gray-800 p-2">
                    <p className="text-xs font-medium text-purple-800 dark:text-purple-300">
                      Remove Leg {suggestion.remove_leg}: EV improves by {formatCurrency(suggestion.ev_improvement)}
                    </p>
                    <p className="text-xs text-purple-600 dark:text-purple-400">
                      New probability: {formatPercent(suggestion.new_combined_probability)} | New EV: {formatCurrency(suggestion.new_ev)}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parlay Risk Analysis */}
          {prediction.parlay_risk && (
            <div className={`mt-6 rounded-lg border p-4 ${
              prediction.parlay_risk.risk_level === 'high' ? 'border-red-300 dark:border-red-500 bg-red-50 dark:bg-red-900/20' :
              prediction.parlay_risk.risk_level === 'medium' ? 'border-amber-300 dark:border-amber-500 bg-amber-50 dark:bg-amber-900/20' :
              'border-green-300 dark:border-green-500 bg-green-50 dark:bg-green-900/20'
            }`}>
              <p className={`text-sm font-semibold ${
                prediction.parlay_risk.risk_level === 'high' ? 'text-red-800 dark:text-red-300' :
                prediction.parlay_risk.risk_level === 'medium' ? 'text-amber-800 dark:text-amber-300' :
                'text-green-800 dark:text-green-300'
              }`}>
                📊 Parlay Risk Analysis
              </p>
              <p className={`mt-1 text-xs ${
                prediction.parlay_risk.risk_level === 'high' ? 'text-red-700 dark:text-red-300' :
                prediction.parlay_risk.risk_level === 'medium' ? 'text-amber-700 dark:text-amber-300' :
                'text-green-700 dark:text-green-300'
              }`}>
                {prediction.parlay_risk.message}
              </p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-xs">
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Current ({prediction.parlay_risk.current_leg_count} legs)</p>
                  <p className="font-semibold text-gray-900 dark:text-white">{prediction.parlay_risk.current_win_rate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Best ({prediction.parlay_risk.best_leg_count.legs} legs)</p>
                  <p className="font-semibold text-green-600 dark:text-green-400">{prediction.parlay_risk.best_leg_count.win_rate.toFixed(1)}%</p>
                </div>
                <div>
                  <p className="text-gray-600 dark:text-gray-400">Worst ({prediction.parlay_risk.worst_leg_count.legs} legs)</p>
                  <p className="font-semibold text-red-600 dark:text-red-400">{prediction.parlay_risk.worst_leg_count.win_rate.toFixed(1)}%</p>
                </div>
              </div>
            </div>
          )}

          {/* Optimal Timing */}
          {prediction.optimal_timing && (
            <div className="mt-6 rounded-lg border border-blue-300 dark:border-blue-500 bg-blue-50 dark:bg-blue-900/20 p-4">
              <p className="text-sm font-semibold text-blue-800 dark:text-blue-300">⏰ Optimal Timing Insights</p>
              {prediction.optimal_timing.best_day && (
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                  Best day: Day {prediction.optimal_timing.best_day.day} ({prediction.optimal_timing.best_day.win_rate.toFixed(1)}% win rate)
                </p>
              )}
              {prediction.optimal_timing.weekend_advantage && (
                <p className="mt-1 text-xs text-blue-700 dark:text-blue-300">
                  {prediction.optimal_timing.weekend_advantage.message}
                </p>
              )}
            </div>
          )}

          {/* Responsible Insights */}
          {prediction.responsible_insights && (
            <div className="mt-6 rounded-lg border border-indigo-300 dark:border-indigo-500 bg-indigo-50 dark:bg-indigo-900/20 p-4">
              <p className="text-sm font-semibold text-indigo-800 dark:text-indigo-300">👤 Responsible Person Insights</p>
              <p className="mt-1 text-xs text-indigo-700 dark:text-indigo-300">{prediction.responsible_insights.message}</p>
              {prediction.responsible_insights.best_responsible && (
                <p className="mt-2 text-xs font-medium text-indigo-800 dark:text-indigo-300">
                  Best: Leg {prediction.responsible_insights.best_responsible.leg} ({prediction.responsible_insights.best_responsible.win_rate.toFixed(1)}% win rate)
                </p>
              )}
            </div>
          )}

          {/* Leg Insights Table */}
          <div className="mt-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400">
              Leg Insights
            </p>
            <div className="mt-2 overflow-hidden rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700 text-sm">
                <thead className="bg-gray-50 dark:bg-gray-900">
                  <tr>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                      Leg
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                      Odds
                    </th>
                    <th className="px-4 py-2 text-left font-medium text-gray-500 dark:text-gray-400">
                      Win Probability
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-gray-700 bg-white dark:bg-gray-800">
                  {legs.map((leg, index) => {
                    const probability =
                      prediction.per_leg_probabilities?.[index];
                    return (
                      <tr key={leg.id || `leg-${index}`}>
                        <td className="px-4 py-2 text-gray-900 dark:text-white">
                          {leg.label || `Leg ${index + 1}`}
                        </td>
                        <td className="px-4 py-2 text-gray-700 dark:text-gray-300">
                          {leg.odd.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 text-gray-900 dark:text-white">
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
            <p className="mt-4 text-xs text-gray-500 dark:text-gray-400">
              Updated {lastUpdated.toLocaleString()}
            </p>
          )}
        </>
      )}
    </section>
  );
}

export default MLInsights;

