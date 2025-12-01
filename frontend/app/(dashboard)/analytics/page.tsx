'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { AnalyticsSummary, AnalyticsByLeague, AnalyticsByResponsible, AnalyticsByBetType, AnalyticsByCategory, TimeSeriesData, LegAnalytics, OddsAnalysis, TeamPerformance, BestWorstPerformers, StreakAnalysis, ResponsibleDetailedAnalytics, AnalyticsByLegs, TemporalAnalytics, StakeAnalysis, CombinationAnalytics, RiskMetrics, PeriodComparison, EVAnalysis, RecoveryAnalysis, BankrollAnalysis, FrequencyAnalysis } from '@/types';
import { useTheme } from '@/contexts/theme-context';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import MLScenarioSimulator from '@/components/analytics/MLScenarioSimulator';

export default function AnalyticsPage() {
  const { theme } = useTheme();
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [byLeague, setByLeague] = useState<AnalyticsByLeague[]>([]);
  const [byResponsible, setByResponsible] = useState<AnalyticsByResponsible[]>([]);
  const [responsibleDetailed, setResponsibleDetailed] = useState<ResponsibleDetailedAnalytics[]>([]);
  const [byBetType, setByBetType] = useState<AnalyticsByBetType[]>([]);
  const [byCategory, setByCategory] = useState<AnalyticsByCategory[]>([]);
  const [legAnalytics, setLegAnalytics] = useState<LegAnalytics | null>(null);
  const [oddsAnalysis, setOddsAnalysis] = useState<OddsAnalysis[]>([]);
  const [teamPerformance, setTeamPerformance] = useState<TeamPerformance[]>([]);
  const [bestWorstPerformers, setBestWorstPerformers] = useState<BestWorstPerformers | null>(null);
  const [streakAnalysis, setStreakAnalysis] = useState<StreakAnalysis | null>(null);
  const [timeSeries, setTimeSeries] = useState<TimeSeriesData[]>([]);
  const [byLegs, setByLegs] = useState<AnalyticsByLegs[]>([]);
  const [temporal, setTemporal] = useState<TemporalAnalytics | null>(null);
  const [stakeAnalysis, setStakeAnalysis] = useState<StakeAnalysis[]>([]);
  const [combinations, setCombinations] = useState<CombinationAnalytics | null>(null);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics | null>(null);
  const [periodComparison, setPeriodComparison] = useState<PeriodComparison | null>(null);
  const [evAnalysis, setEvAnalysis] = useState<EVAnalysis | null>(null);
  const [recovery, setRecovery] = useState<RecoveryAnalysis | null>(null);
  const [bankroll, setBankroll] = useState<BankrollAnalysis | null>(null);
  const [frequency, setFrequency] = useState<FrequencyAnalysis | null>(null);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [granularity, setGranularity] = useState<'daily' | 'weekly' | 'monthly' | 'all-time'>('all-time');

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    let cancelled = false;
    let requestCompleted = false;

    // Safety timeout to prevent infinite hanging
    const timeoutId = setTimeout(() => {
      if (!requestCompleted && !cancelled) {
        requestCompleted = true;
        console.error('[Analytics] Request timeout - forcing completion');
        setSummary(null);
        setByLeague([]);
        setByResponsible([]);
        setResponsibleDetailed([]);
        setByBetType([]);
        setByCategory([]);
        setLegAnalytics(null);
        setOddsAnalysis([]);
        setTeamPerformance([]);
        setBestWorstPerformers(null);
        setStreakAnalysis(null);
        setTimeSeries([]);
        setByLegs([]);
        setTemporal(null);
        setStakeAnalysis([]);
        setCombinations(null);
        setRiskMetrics(null);
        setPeriodComparison(null);
        setEvAnalysis(null);
        setRecovery(null);
        setBankroll(null);
        setFrequency(null);
        setLoading(false);
      }
    }, 30000); // 30 second timeout (analytics has many requests)
    
    try {
      const params = new URLSearchParams();
      if (startDate && startDate.trim()) params.append('start_date', startDate);
      if (endDate && endDate.trim()) params.append('end_date', endDate);
      const queryString = params.toString() ? `?${params.toString()}` : '';

      const requests = [
        { name: 'summary', promise: apiClient.get<{ data: AnalyticsSummary }>(`/api/analytics/summary${queryString}`) },
        { name: 'byLeague', promise: apiClient.get<{ data: AnalyticsByLeague[] }>(`/api/analytics/by-league${queryString}`) },
        { name: 'byResponsible', promise: apiClient.get<{ data: AnalyticsByResponsible[] }>(`/api/analytics/by-responsible${queryString}`) },
        { name: 'responsibleDetailed', promise: apiClient.get<{ data: ResponsibleDetailedAnalytics[] }>(`/api/analytics/responsible-detailed${queryString}`) },
        { name: 'byBetType', promise: apiClient.get<{ data: AnalyticsByBetType[] }>(`/api/analytics/by-bet-type${queryString}`) },
        { name: 'byCategory', promise: apiClient.get<{ data: AnalyticsByCategory[] }>(`/api/analytics/by-category${queryString}`) },
        { name: 'legAnalytics', promise: apiClient.get<{ data: LegAnalytics }>(`/api/analytics/leg-analytics${queryString}`) },
        { name: 'oddsAnalysis', promise: apiClient.get<{ data: OddsAnalysis[] }>(`/api/analytics/odds-analysis${queryString}`) },
        { name: 'teamPerformance', promise: apiClient.get<{ data: TeamPerformance[] }>(`/api/analytics/team-performance${queryString}`) },
        { name: 'bestWorst', promise: apiClient.get<{ data: BestWorstPerformers }>(`/api/analytics/best-worst-performers${queryString}`) },
        { name: 'streak', promise: apiClient.get<{ data: StreakAnalysis }>(`/api/analytics/streak-analysis${queryString}`) },
        { name: 'timeSeries', promise: apiClient.get<{ data: TimeSeriesData[] }>(`/api/analytics/time-series?granularity=${granularity}${queryString ? '&' + queryString.replace('?', '') : ''}`) },
        { name: 'byLegs', promise: apiClient.get<{ data: AnalyticsByLegs[] }>(`/api/analytics/by-legs${queryString}`) },
        { name: 'temporal', promise: apiClient.get<{ data: TemporalAnalytics }>(`/api/analytics/temporal${queryString}`) },
        { name: 'stakeAnalysis', promise: apiClient.get<{ data: StakeAnalysis[] }>(`/api/analytics/stake-analysis${queryString}`) },
        { name: 'combinations', promise: apiClient.get<{ data: CombinationAnalytics }>(`/api/analytics/combinations${queryString}`) },
        { name: 'riskMetrics', promise: apiClient.get<{ data: RiskMetrics }>(`/api/analytics/risk-metrics${queryString}`) },
        { name: 'periodComparison', promise: apiClient.get<{ data: PeriodComparison }>(`/api/analytics/period-comparison${queryString}`) },
        { name: 'evAnalysis', promise: apiClient.get<{ data: EVAnalysis }>(`/api/analytics/ev-analysis${queryString}`) },
        { name: 'recovery', promise: apiClient.get<{ data: RecoveryAnalysis }>(`/api/analytics/recovery${queryString}`) },
        { name: 'bankroll', promise: apiClient.get<{ data: BankrollAnalysis }>(`/api/analytics/bankroll${queryString}`) },
        { name: 'frequency', promise: apiClient.get<{ data: FrequencyAnalysis }>(`/api/analytics/frequency${queryString}`) },
      ];

      const results = await Promise.allSettled(requests.map(r => r.promise));
      
      if (requestCompleted || cancelled) return;
      
      requestCompleted = true;
      clearTimeout(timeoutId);
      
      const summaryRes = results[0].status === 'fulfilled' ? results[0].value : { data: { data: null } };
      const byLeagueRes = results[1].status === 'fulfilled' ? results[1].value : { data: { data: [] } };
      const byResponsibleRes = results[2].status === 'fulfilled' ? results[2].value : { data: { data: [] } };
      const responsibleDetailedRes = results[3].status === 'fulfilled' ? results[3].value : { data: { data: [] } };
      const byBetTypeRes = results[4].status === 'fulfilled' ? results[4].value : { data: { data: [] } };
      const byCategoryRes = results[5].status === 'fulfilled' ? results[5].value : { data: { data: [] } };
      const legAnalyticsRes = results[6].status === 'fulfilled' ? results[6].value : { data: { data: null } };
      const oddsAnalysisRes = results[7].status === 'fulfilled' ? results[7].value : { data: { data: [] } };
      const teamPerformanceRes = results[8].status === 'fulfilled' ? results[8].value : { data: { data: [] } };
      const bestWorstRes = results[9].status === 'fulfilled' ? results[9].value : { data: { data: null } };
      const streakRes = results[10].status === 'fulfilled' ? results[10].value : { data: { data: null } };
      const timeSeriesRes = results[11].status === 'fulfilled' ? results[11].value : { data: { data: [] } };
      const byLegsRes = results[12].status === 'fulfilled' ? results[12].value : { data: { data: [] } };
      const temporalRes = results[13].status === 'fulfilled' ? results[13].value : { data: { data: null } };
      const stakeAnalysisRes = results[14].status === 'fulfilled' ? results[14].value : { data: { data: [] } };
      const combinationsRes = results[15].status === 'fulfilled' ? results[15].value : { data: { data: null } };
      const riskMetricsRes = results[16].status === 'fulfilled' ? results[16].value : { data: { data: null } };
      const periodComparisonRes = results[17].status === 'fulfilled' ? results[17].value : { data: { data: null } };
      const evAnalysisRes = results[18].status === 'fulfilled' ? results[18].value : { data: { data: null } };
      const recoveryRes = results[19].status === 'fulfilled' ? results[19].value : { data: { data: null } };
      const bankrollRes = results[20].status === 'fulfilled' ? results[20].value : { data: { data: null } };
      const frequencyRes = results[21].status === 'fulfilled' ? results[21].value : { data: { data: null } };

      // Log any failures
      results.forEach((result, index) => {
        if (result.status === 'rejected') {
          console.error(`Failed to fetch ${requests[index].name}:`, result.reason);
        }
      });
      
      if (!cancelled) {
        // Check if we have any data at all
        const summaryData = summaryRes.data?.data as AnalyticsSummary | undefined;
        const hasAnyData = 
          (summaryData && summaryData.total_bets > 0) ||
          (byLeagueRes.data?.data && Array.isArray(byLeagueRes.data.data) && byLeagueRes.data.data.length > 0) ||
          (byResponsibleRes.data?.data && Array.isArray(byResponsibleRes.data.data) && byResponsibleRes.data.data.length > 0) ||
          (byBetTypeRes.data?.data && Array.isArray(byBetTypeRes.data.data) && byBetTypeRes.data.data.length > 0) ||
          (byCategoryRes.data?.data && Array.isArray(byCategoryRes.data.data) && byCategoryRes.data.data.length > 0) ||
          (timeSeriesRes.data?.data && Array.isArray(timeSeriesRes.data.data) && timeSeriesRes.data.data.length > 0);

        // If summary request failed but we have other data, create a default summary
        if (!summaryData && hasAnyData) {
          setSummary({
            total_stake: 0,
            total_profit: 0,
            roi: 0,
            win_rate: 0,
            total_bets: 0,
            won_bets: 0,
            lost_bets: 0,
            pending_bets: 0,
            cumulative_profit: 0,
          });
        } else {
          setSummary(summaryData || null);
        }
        
        setByLeague((byLeagueRes.data?.data as AnalyticsByLeague[]) || []);
        setByResponsible((byResponsibleRes.data?.data as AnalyticsByResponsible[]) || []);
        const detailedData = (responsibleDetailedRes.data?.data as ResponsibleDetailedAnalytics[]) || [];
        console.log('Responsible detailed analytics:', detailedData);
        setResponsibleDetailed(detailedData);
        setByBetType((byBetTypeRes.data?.data as AnalyticsByBetType[]) || []);
        setByCategory((byCategoryRes.data?.data as AnalyticsByCategory[]) || []);
        setLegAnalytics((legAnalyticsRes.data?.data as LegAnalytics) || null);
        setByLegs((byLegsRes.data?.data as AnalyticsByLegs[]) || []);
        setTemporal((temporalRes.data?.data as TemporalAnalytics) || null);
        setStakeAnalysis((stakeAnalysisRes.data?.data as StakeAnalysis[]) || []);
        setCombinations((combinationsRes.data?.data as CombinationAnalytics) || null);
        setRiskMetrics((riskMetricsRes.data?.data as RiskMetrics) || null);
        setPeriodComparison((periodComparisonRes.data?.data as PeriodComparison) || null);
        setEvAnalysis((evAnalysisRes.data?.data as EVAnalysis) || null);
        setRecovery((recoveryRes.data?.data as RecoveryAnalysis) || null);
        setBankroll((bankrollRes.data?.data as BankrollAnalysis) || null);
        setFrequency((frequencyRes.data?.data as FrequencyAnalysis) || null);
        setOddsAnalysis((oddsAnalysisRes.data?.data as OddsAnalysis[]) || []);
        setTeamPerformance((teamPerformanceRes.data?.data as TeamPerformance[]) || []);
        setBestWorstPerformers((bestWorstRes.data?.data as BestWorstPerformers) || null);
        setStreakAnalysis((streakRes.data?.data as StreakAnalysis) || null);
        setTimeSeries((timeSeriesRes.data?.data as TimeSeriesData[]) || []);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Failed to fetch analytics:', error);
      if (requestCompleted || cancelled) return;
      
      requestCompleted = true;
      clearTimeout(timeoutId);
      setSummary(null);
      setByLeague([]);
      setByResponsible([]);
      setResponsibleDetailed([]);
      setByBetType([]);
      setByCategory([]);
      setLegAnalytics(null);
      setOddsAnalysis([]);
      setTeamPerformance([]);
      setBestWorstPerformers(null);
      setStreakAnalysis(null);
      setTimeSeries([]);
      setLoading(false);
    } finally {
      // Ensure loading is always set to false, even if timeout already fired
      if (!cancelled && !requestCompleted) {
        clearTimeout(timeoutId);
        setLoading(false);
      }
    }
  }, [startDate, endDate, granularity]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  // Auto-refresh when page becomes visible (e.g., after updating a bet)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        // Small delay to ensure any pending updates are complete
        setTimeout(() => {
          fetchAnalytics();
        }, 500);
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchAnalytics]);

  if (loading) {
    return <div className="text-center py-12">Loading...</div>;
  }

  return (
    <div className="px-4 py-6 sm:px-0">
      <div className="mb-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics</h1>
            <p className="mt-2 text-sm text-gray-600">
              Detailed breakdowns of your betting performance by league, time period, and more. 
              Use this page to analyze trends and identify your most profitable betting strategies.
            </p>
          </div>
          <button
            onClick={() => fetchAnalytics()}
            disabled={loading}
            className="ml-4 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed min-h-[44px] sm:min-h-0 flex items-center gap-2"
            title="Refresh analytics data"
          >
            <svg 
              className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} 
              fill="none" 
              stroke="currentColor" 
              viewBox="0 0 24 24"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth={2} 
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" 
              />
            </svg>
            <span className="hidden sm:inline">{loading ? 'Refreshing...' : 'Refresh'}</span>
          </button>
        </div>
        
        {/* Filters */}
        <div className="mt-4 flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900"
              aria-label="Start Date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900"
              aria-label="End Date"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as 'daily' | 'weekly' | 'monthly' | 'all-time')}
              className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm text-gray-900"
              aria-label="Time Period"
            >
              <option value="all-time">All Time</option>
              <option value="daily">Daily</option>
              <option value="weekly">Weekly</option>
              <option value="monthly">Monthly</option>
            </select>
          </div>
          {(startDate || endDate) && (
            <button
              onClick={() => {
                setStartDate('');
                setEndDate('');
              }}
              className="px-4 py-3 text-base sm:text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 min-h-[44px]"
            >
              Clear Filters
            </button>
          )}
        </div>
      </div>

      <div className="mb-8">
        <MLScenarioSimulator />
      </div>

      {summary ? (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4 mb-8">
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className={`text-2xl font-bold ${summary.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              ${summary.total_profit.toFixed(2)}
            </div>
            <div className="text-sm font-medium text-gray-500">Total Profit</div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className="text-2xl font-bold text-gray-900">{(summary.win_rate * 100).toFixed(1)}%</div>
            <div className="text-sm font-medium text-gray-500">Win Rate</div>
            <div className="text-xs text-gray-400 mt-1">
              {summary.won_bets}W / {summary.lost_bets}L
              {summary.pending_bets > 0 && ` / ${summary.pending_bets}P`}
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className={`text-2xl font-bold ${summary.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
              {(summary.roi * 100).toFixed(1)}%
            </div>
            <div className="text-sm font-medium text-gray-500">ROI</div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg p-5">
            <div className="text-2xl font-bold text-gray-900">{summary.total_bets}</div>
            <div className="text-sm font-medium text-gray-500">Total Bets</div>
            <div className="text-xs text-gray-400 mt-1">
              ${summary.total_stake.toFixed(2)} staked
            </div>
          </div>
        </div>
      ) : (byLeague.length === 0 && byResponsible.length === 0 && byBetType.length === 0 && byCategory.length === 0 && timeSeries.length === 0) ? (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <p className="text-gray-500 text-center">No analytics data available. Create some bets to see your performance.</p>
        </div>
      ) : null}

      {byLeague.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Performance by League</h2>
          
          {/* Bar Chart for Profit by League */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Profit by League</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byLeague}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="league_name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Bar dataKey="total_profit" fill="#0ea5e9" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* ROI Chart */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">ROI by League</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byLeague}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="league_name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `${value.toFixed(0)}%`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Bar dataKey="roi" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Detailed Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">League</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {byLeague.map((league) => (
                    <tr key={league.league_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {league.league_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${league.total_stake.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        league.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${league.total_profit.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        league.roi >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(league.roi * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(league.win_rate * 100).toFixed(1)}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {byLegs.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Performance by Number of Legs</h2>
          <p className="text-sm text-gray-600 mb-6">
            Analyze which bet sizes (number of legs) perform best. Are 2-leg bets more profitable than 3 or 4-leg bets?
          </p>
          
          {/* Bar Chart for ROI by Legs */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">ROI by Number of Legs</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byLegs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="num_legs"
                  label={{ value: 'Number of Legs', position: 'insideBottom', offset: -5 }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'ROI (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Bar 
                  dataKey="roi" 
                  radius={[4, 4, 0, 0]}
                  fill="#10b981"
                />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart for Win Rate by Legs */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Win Rate by Number of Legs</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byLegs}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="num_legs"
                  label={{ value: 'Number of Legs', position: 'insideBottom', offset: -5 }}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Bar dataKey="win_rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Detailed Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Legs</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Won</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lost</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Odds</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {byLegs.map((legs) => {
                    const isBestROI = byLegs.filter(l => l.bet_count > 0).every(l => l.roi <= legs.roi || l.num_legs === legs.num_legs);
                    const isBestWinRate = byLegs.filter(l => l.bet_count > 0).every(l => l.win_rate <= legs.win_rate || l.num_legs === legs.num_legs);
                    
                    return (
                      <tr key={legs.num_legs} className={isBestROI && legs.bet_count > 0 ? 'bg-green-50' : ''}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <span className="text-sm font-bold text-gray-900">{legs.num_legs}</span>
                            {isBestROI && legs.bet_count > 0 && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                Best ROI
                              </span>
                            )}
                            {isBestWinRate && !isBestROI && legs.bet_count > 0 && (
                              <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                Best Win Rate
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {legs.bet_count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-medium">
                          {legs.won_bets}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-medium">
                          {legs.lost_bets}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {(legs.win_rate * 100).toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          ${legs.total_stake.toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          legs.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          ${legs.total_profit.toFixed(2)}
                        </td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                          legs.roi >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {(legs.roi * 100).toFixed(1)}%
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {legs.avg_odds.toFixed(2)}x
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Insights */}
          {byLegs.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Insights</h4>
              {(() => {
                const bestROI = byLegs.filter(l => l.bet_count > 0).reduce((best, current) => 
                  current.roi > best.roi ? current : best, byLegs[0]
                );
                const bestWinRate = byLegs.filter(l => l.bet_count > 0).reduce((best, current) => 
                  current.win_rate > best.win_rate ? current : best, byLegs[0]
                );
                
                return (
                  <div className="text-sm text-blue-800 space-y-1">
                    {bestROI && bestROI.bet_count > 0 && (
                      <p>
                        <strong>{bestROI.num_legs}-leg bets</strong> have the best ROI at {(bestROI.roi * 100).toFixed(1)}% 
                        ({bestROI.bet_count} bets, ${bestROI.total_profit.toFixed(2)} profit)
                      </p>
                    )}
                    {bestWinRate && bestWinRate.bet_count > 0 && bestWinRate.num_legs !== bestROI.num_legs && (
                      <p>
                        <strong>{bestWinRate.num_legs}-leg bets</strong> have the highest win rate at {(bestWinRate.win_rate * 100).toFixed(1)}%
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {byResponsible.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Performance by Responsible</h2>
          <p className="text-sm text-gray-600 mb-6">
            Analyze which responsible persons perform best. Compare ROI, win rates, and profitability across all responsibles.
          </p>
          
          {/* Bar Chart for ROI by Responsible */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">ROI by Responsible</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byResponsible}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="responsible_name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'ROI (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Bar dataKey="roi" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart for Win Rate by Responsible */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Win Rate by Responsible</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byResponsible}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="responsible_name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Win Rate (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value: number) => `${(value * 100).toFixed(2)}%`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Bar dataKey="win_rate" fill="#3b82f6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Bar Chart for Profit by Responsible */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Profit by Responsible</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byResponsible}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="responsible_name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  tick={{ fontSize: 12 }}
                  label={{ value: 'Profit ($)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Bar dataKey="total_profit" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Detailed Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Responsible</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {byResponsible
                    .sort((a, b) => b.roi - a.roi) // Sort by ROI descending
                    .map((responsible, index) => {
                      const isBestROI = index === 0 && responsible.bet_count > 0;
                      const isBestWinRate = byResponsible
                        .filter(r => r.bet_count > 0)
                        .every(r => r.win_rate <= responsible.win_rate || r.responsible_id === responsible.responsible_id) 
                        && responsible.bet_count > 0 
                        && !isBestROI;
                      const isBestProfit = byResponsible
                        .filter(r => r.bet_count > 0)
                        .every(r => r.total_profit <= responsible.total_profit || r.responsible_id === responsible.responsible_id)
                        && responsible.bet_count > 0
                        && !isBestROI
                        && !isBestWinRate;
                      
                      return (
                        <tr 
                          key={responsible.responsible_id} 
                          className={isBestROI ? 'bg-green-50' : ''}
                        >
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="flex items-center">
                              <span className="text-sm font-medium text-gray-900">
                                {responsible.responsible_name}
                              </span>
                              {isBestROI && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-100 text-green-800">
                                  🏆 Best ROI
                                </span>
                              )}
                              {isBestWinRate && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-blue-100 text-blue-800">
                                  ⭐ Best Win Rate
                                </span>
                              )}
                              {isBestProfit && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800">
                                  💰 Most Profitable
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {responsible.bet_count}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {(responsible.win_rate * 100).toFixed(1)}%
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            ${responsible.total_stake.toFixed(2)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            responsible.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            ${responsible.total_profit.toFixed(2)}
                          </td>
                          <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                            responsible.roi >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {(responsible.roi * 100).toFixed(1)}%
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Summary Insights */}
          {byResponsible.length > 0 && (
            <div className="mt-6 p-4 bg-blue-50 rounded-lg">
              <h4 className="text-sm font-semibold text-blue-900 mb-2">💡 Insights</h4>
              {(() => {
                const bestROI = byResponsible
                  .filter(r => r.bet_count > 0)
                  .reduce((best, current) => current.roi > best.roi ? current : best, byResponsible[0]);
                const bestWinRate = byResponsible
                  .filter(r => r.bet_count > 0)
                  .reduce((best, current) => current.win_rate > best.win_rate ? current : best, byResponsible[0]);
                const bestProfit = byResponsible
                  .filter(r => r.bet_count > 0)
                  .reduce((best, current) => current.total_profit > best.total_profit ? current : best, byResponsible[0]);
                
                return (
                  <div className="text-sm text-blue-800 space-y-1">
                    {bestROI && bestROI.bet_count > 0 && (
                      <p>
                        <strong>{bestROI.responsible_name}</strong> has the best ROI at {(bestROI.roi * 100).toFixed(1)}% 
                        ({bestROI.bet_count} bets, ${bestROI.total_profit.toFixed(2)} profit)
                      </p>
                    )}
                    {bestWinRate && bestWinRate.bet_count > 0 && bestWinRate.responsible_id !== bestROI.responsible_id && (
                      <p>
                        <strong>{bestWinRate.responsible_name}</strong> has the highest win rate at {(bestWinRate.win_rate * 100).toFixed(1)}%
                        ({bestWinRate.bet_count} bets)
                      </p>
                    )}
                    {bestProfit && bestProfit.bet_count > 0 && bestProfit.responsible_id !== bestROI.responsible_id && bestProfit.responsible_id !== bestWinRate.responsible_id && (
                      <p>
                        <strong>{bestProfit.responsible_name}</strong> is the most profitable at ${bestProfit.total_profit.toFixed(2)}
                        ({bestProfit.bet_count} bets, {(bestProfit.roi * 100).toFixed(1)}% ROI)
                      </p>
                    )}
                  </div>
                );
              })()}
            </div>
          )}
        </div>
      )}

      {responsibleDetailed.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Detailed Analytics by Responsible</h2>
          
          {responsibleDetailed.map((responsible) => (
            <div key={responsible.responsible_id} className="mb-8 pb-8 border-b border-gray-200 last:border-b-0 last:mb-0 last:pb-0">
              <div className="mb-6">
                <h3 className="text-lg font-semibold text-gray-900 mb-4">{responsible.responsible_name}</h3>
                
                {/* Summary Cards */}
                <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Total Stake</div>
                    <div className="text-lg font-bold text-gray-900">${responsible.summary.total_stake.toFixed(2)}</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Total Profit</div>
                    <div className={`text-lg font-bold ${responsible.summary.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${responsible.summary.total_profit >= 0 ? '+' : ''}{responsible.summary.total_profit.toFixed(2)}
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">ROI</div>
                    <div className={`text-lg font-bold ${responsible.summary.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(responsible.summary.roi * 100).toFixed(1)}%
                    </div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Win Rate</div>
                    <div className="text-lg font-bold text-gray-900">{(responsible.summary.win_rate * 100).toFixed(1)}%</div>
                  </div>
                  <div className="bg-gray-50 p-4 rounded-lg">
                    <div className="text-sm text-gray-600 mb-1">Total Bets</div>
                    <div className="text-lg font-bold text-gray-900">{responsible.summary.bet_count}</div>
                  </div>
                </div>

                {/* Most Profitable */}
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-700 mb-3">Most Profitable</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {responsible.most_profitable_league && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-600 font-medium mb-1">League</div>
                        <div className="text-base font-bold text-blue-900">{responsible.most_profitable_league.league_name}</div>
                        <div className="text-sm text-blue-700 mt-1">
                          ${responsible.most_profitable_league.total_profit >= 0 ? '+' : ''}{responsible.most_profitable_league.total_profit.toFixed(2)} ({responsible.most_profitable_league.bet_count} bets)
                        </div>
                      </div>
                    )}
                    {responsible.most_profitable_team && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-600 font-medium mb-1">Team</div>
                        <div className="text-base font-bold text-blue-900">{responsible.most_profitable_team.team_name}</div>
                        <div className="text-sm text-blue-700 mt-1">
                          ${responsible.most_profitable_team.total_profit >= 0 ? '+' : ''}{responsible.most_profitable_team.total_profit.toFixed(2)} ({responsible.most_profitable_team.bet_count} bets)
                        </div>
                      </div>
                    )}
                    {responsible.most_profitable_category && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-600 font-medium mb-1">Category</div>
                        <div className="text-base font-bold text-blue-900">{responsible.most_profitable_category.category_name}</div>
                        <div className="text-sm text-blue-700 mt-1">
                          ${responsible.most_profitable_category.total_profit >= 0 ? '+' : ''}{responsible.most_profitable_category.total_profit.toFixed(2)} ({responsible.most_profitable_category.bet_count} bets)
                        </div>
                      </div>
                    )}
                    {responsible.most_profitable_bet_type && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-600 font-medium mb-1">Bet Type</div>
                        <div className="text-base font-bold text-blue-900">{responsible.most_profitable_bet_type.bet_type_name}</div>
                        <div className="text-sm text-blue-700 mt-1">
                          ${responsible.most_profitable_bet_type.total_profit >= 0 ? '+' : ''}{responsible.most_profitable_bet_type.total_profit.toFixed(2)} ({responsible.most_profitable_bet_type.bet_count} bets)
                        </div>
                      </div>
                    )}
                    {responsible.most_profitable_day && (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="text-sm text-blue-600 font-medium mb-1">Day</div>
                        <div className="text-base font-bold text-blue-900">{responsible.most_profitable_day.day}</div>
                        <div className="text-sm text-blue-700 mt-1">
                          ${responsible.most_profitable_day.total_profit >= 0 ? '+' : ''}{responsible.most_profitable_day.total_profit.toFixed(2)} ({responsible.most_profitable_day.bet_count} bets)
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Favorites */}
                <div className="mb-6">
                  <h4 className="text-md font-semibold text-gray-700 mb-3">Favorites</h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {responsible.favorite_league && (
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-sm text-purple-600 font-medium mb-1">League</div>
                        <div className="text-base font-bold text-purple-900">{responsible.favorite_league.league_name}</div>
                        <div className="text-sm text-purple-700 mt-1">{responsible.favorite_league.bet_count} bets</div>
                      </div>
                    )}
                    {responsible.favorite_team && (
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-sm text-purple-600 font-medium mb-1">Team</div>
                        <div className="text-base font-bold text-purple-900">{responsible.favorite_team.team_name}</div>
                        <div className="text-sm text-purple-700 mt-1">{responsible.favorite_team.bet_count} bets</div>
                      </div>
                    )}
                    {responsible.favorite_category && (
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-sm text-purple-600 font-medium mb-1">Category</div>
                        <div className="text-base font-bold text-purple-900">{responsible.favorite_category.category_name}</div>
                        <div className="text-sm text-purple-700 mt-1">{responsible.favorite_category.bet_count} bets</div>
                      </div>
                    )}
                    {responsible.favorite_bet_type && (
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-sm text-purple-600 font-medium mb-1">Bet Type</div>
                        <div className="text-base font-bold text-purple-900">{responsible.favorite_bet_type.bet_type_name}</div>
                        <div className="text-sm text-purple-700 mt-1">{responsible.favorite_bet_type.bet_count} bets</div>
                      </div>
                    )}
                    {responsible.favorite_day && (
                      <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                        <div className="text-sm text-purple-600 font-medium mb-1">Day</div>
                        <div className="text-base font-bold text-purple-900">{responsible.favorite_day.day}</div>
                        <div className="text-sm text-purple-700 mt-1">{responsible.favorite_day.bet_count} bets</div>
                      </div>
                    )}
                  </div>
                </div>

              {responsible.performance_by_leg_count && responsible.performance_by_leg_count.length > 0 && (
                <div className="mb-8">
                  <h4 className="text-md font-semibold text-gray-700 mb-3">Best Number of Legs</h4>
                  
                  {responsible.best_leg_count && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div className="bg-green-50 p-4 rounded-lg border border-green-100">
                        <div className="text-sm text-green-700 mb-1">Top Performing Leg Count</div>
                        <div className="text-2xl font-bold text-green-900">
                          {responsible.best_leg_count.num_legs} legs
                        </div>
                        <div className="text-sm text-green-800 mt-2">
                          {(responsible.best_leg_count.roi * 100).toFixed(1)}% ROI · {(responsible.best_leg_count.win_rate * 100).toFixed(1)}% win rate
                        </div>
                        <div className="text-xs text-green-700 mt-1">
                          {responsible.best_leg_count.bet_count} bets · ${responsible.best_leg_count.total_profit.toFixed(2)} profit
                        </div>
                      </div>
                    </div>
                  )}

                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Legs</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                          <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {responsible.performance_by_leg_count.map((legStat: { num_legs: number; bet_count: number; win_rate: number; total_profit: number; roi: number; total_stake: number }) => (
                          <tr key={`${responsible.responsible_id}-${legStat.num_legs}`}>
                            <td className="px-4 py-3 text-sm font-medium text-gray-900">
                              {legStat.num_legs}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {legStat.bet_count}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-500">
                              {(legStat.win_rate * 100).toFixed(1)}%
                            </td>
                            <td className={`px-4 py-3 text-sm font-medium ${
                              legStat.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              ${legStat.total_profit.toFixed(2)}
                            </td>
                            <td className={`px-4 py-3 text-sm font-medium ${
                              legStat.roi >= 0 ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {(legStat.roi * 100).toFixed(1)}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

                {/* Performance by League */}
                {responsible.performance_by_league.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-semibold text-gray-700 mb-3">Performance by League</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">League</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {responsible.performance_by_league.map((league) => (
                            <tr key={league.league_id}>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{league.league_name}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">${league.total_stake.toFixed(2)}</td>
                              <td className={`px-4 py-2 text-sm font-medium ${league.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${league.total_profit >= 0 ? '+' : ''}{league.total_profit.toFixed(2)}
                              </td>
                              <td className={`px-4 py-2 text-sm font-medium ${league.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(league.roi * 100).toFixed(1)}%
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500">{(league.win_rate * 100).toFixed(1)}%</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{league.bet_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Performance by Bet Type */}
                {responsible.performance_by_bet_type.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-semibold text-gray-700 mb-3">Performance by Bet Type</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bet Type</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {responsible.performance_by_bet_type.map((betType) => (
                            <tr key={betType.bet_type_id}>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{betType.bet_type_name}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">${betType.total_stake.toFixed(2)}</td>
                              <td className={`px-4 py-2 text-sm font-medium ${betType.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${betType.total_profit >= 0 ? '+' : ''}{betType.total_profit.toFixed(2)}
                              </td>
                              <td className={`px-4 py-2 text-sm font-medium ${betType.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(betType.roi * 100).toFixed(1)}%
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500">{(betType.win_rate * 100).toFixed(1)}%</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{betType.bet_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Performance by Category */}
                {responsible.performance_by_category.length > 0 && (
                  <div>
                    <h4 className="text-md font-semibold text-gray-700 mb-3">Performance by Category</h4>
                    <div className="overflow-x-auto">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {responsible.performance_by_category.map((category) => (
                            <tr key={category.category_id}>
                              <td className="px-4 py-2 text-sm font-medium text-gray-900">{category.category_name}</td>
                              <td className="px-4 py-2 text-sm text-gray-500">${category.total_stake.toFixed(2)}</td>
                              <td className={`px-4 py-2 text-sm font-medium ${category.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                ${category.total_profit >= 0 ? '+' : ''}{category.total_profit.toFixed(2)}
                              </td>
                              <td className={`px-4 py-2 text-sm font-medium ${category.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                {(category.roi * 100).toFixed(1)}%
                              </td>
                              <td className="px-4 py-2 text-sm text-gray-500">{(category.win_rate * 100).toFixed(1)}%</td>
                              <td className="px-4 py-2 text-sm text-gray-500">{category.bet_count}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {byBetType.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Performance by Bet Type</h2>
          
          {/* Bar Chart for Profit by Bet Type */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Profit by Bet Type</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={byBetType}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="bet_type_name"
                  angle={-45}
                  textAnchor="end"
                  height={100}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Bar dataKey="total_profit" fill="#f59e0b" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Detailed Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bet Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {byBetType.map((betType) => (
                    <tr key={betType.bet_type_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {betType.bet_type_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${betType.total_stake.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        betType.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${betType.total_profit.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        betType.roi >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(betType.roi * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(betType.win_rate * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {betType.bet_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {byCategory.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Performance by Category</h2>
          
          {/* Bar Chart for Profit by Category */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Profit by Category (Top 20)</h3>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={byCategory.slice(0, 20).sort((a, b) => b.total_profit - a.total_profit)}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="category_name"
                  angle={-45}
                  textAnchor="end"
                  height={120}
                  tick={{ fontSize: 11 }}
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Bar dataKey="total_profit" fill="#ec4899" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
            {byCategory.length > 20 && (
              <p className="text-sm text-gray-500 mt-2">Showing top 20 categories by profit (out of {byCategory.length} total)</p>
            )}
          </div>

          {/* Detailed Table */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Detailed Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {byCategory.sort((a, b) => b.total_profit - a.total_profit).map((category) => (
                    <tr key={category.category_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {category.category_name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${category.total_stake.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        category.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${category.total_profit.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        category.roi >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {(category.roi * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(category.win_rate * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {category.bet_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {legAnalytics && legAnalytics.total_legs > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Leg-Level Analytics</h2>
          
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-gray-900">{legAnalytics.total_legs}</div>
              <div className="text-sm text-gray-600">Total Legs</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-green-600">{legAnalytics.won_legs}</div>
              <div className="text-sm text-gray-600">Won Legs</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-red-600">{legAnalytics.lost_legs}</div>
              <div className="text-sm text-gray-600">Lost Legs</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{(legAnalytics.leg_win_rate * 100).toFixed(1)}%</div>
              <div className="text-sm text-gray-600">Leg Win Rate</div>
            </div>
          </div>

          {legAnalytics.performance_by_league.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Performance by League</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">League</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Legs</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Won</th>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {legAnalytics.performance_by_league.map((item) => (
                      <tr key={item.league_id}>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.league_name}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.total_legs}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{item.won_legs}</td>
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{(item.win_rate * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {oddsAnalysis.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Odds Analysis</h2>
          
          <div className="mb-6">
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={oddsAnalysis}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="range" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `$${value.toFixed(0)}`} tick={{ fontSize: 12 }} />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'total_profit') return [`$${value.toFixed(2)}`, 'Profit'];
                    if (name === 'roi') return [`${(value * 100).toFixed(1)}%`, 'ROI'];
                    return [value, name];
                  }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Legend />
                <Bar dataKey="total_profit" fill="#0ea5e9" name="Profit" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Odds Range</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {oddsAnalysis.map((item) => (
                  <tr key={item.range}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{item.range}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">{item.total_bets}</td>
                    <td className="px-4 py-3 text-sm text-gray-500">${item.total_stake.toFixed(2)}</td>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      item.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      ${item.total_profit.toFixed(2)}
                    </td>
                    <td className={`px-4 py-3 text-sm font-medium ${
                      item.roi >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}>
                      {(item.roi * 100).toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">{(item.win_rate * 100).toFixed(1)}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {bestWorstPerformers && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Best & Worst Performers</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {bestWorstPerformers.best_leagues.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-green-600 mb-3">Top 5 Leagues</h3>
                <div className="space-y-2">
                  {bestWorstPerformers.best_leagues.map((league, idx) => (
                    <div key={league.league_id} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm font-medium text-gray-900">{idx + 1}. {league.league_name}</span>
                      <span className="text-sm font-bold text-green-600">${league.total_profit.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bestWorstPerformers.worst_leagues.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-red-600 mb-3">Bottom 5 Leagues</h3>
                <div className="space-y-2">
                  {bestWorstPerformers.worst_leagues.map((league, idx) => (
                    <div key={league.league_id} className="flex justify-between items-center p-2 bg-red-50 rounded">
                      <span className="text-sm font-medium text-gray-900">{idx + 1}. {league.league_name}</span>
                      <span className="text-sm font-bold text-red-600">${league.total_profit.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {bestWorstPerformers.best_categories.length > 0 && (
              <div>
                <h3 className="text-lg font-semibold text-green-600 mb-3">Top 5 Categories</h3>
                <div className="space-y-2">
                  {bestWorstPerformers.best_categories.map((category, idx) => (
                    <div key={category.category_id} className="flex justify-between items-center p-2 bg-green-50 rounded">
                      <span className="text-sm font-medium text-gray-900">{idx + 1}. {category.category_name}</span>
                      <span className="text-sm font-bold text-green-600">${category.total_profit.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {streakAnalysis && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Streak Analysis</h2>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Current Streak</div>
              <div className={`text-2xl font-bold ${streakAnalysis.current_streak.type === 'win' ? 'text-green-600' : 'text-red-600'}`}>
                {streakAnalysis.current_streak.length} {streakAnalysis.current_streak.type === 'win' ? 'Wins' : 'Losses'}
              </div>
              {streakAnalysis.current_streak.start_date && (
                <div className="text-xs text-gray-500 mt-1">
                  Since {new Date(streakAnalysis.current_streak.start_date).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Longest Win Streak</div>
              <div className="text-2xl font-bold text-green-600">{streakAnalysis.longest_win_streak.length}</div>
              {streakAnalysis.longest_win_streak.start_date && (
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(streakAnalysis.longest_win_streak.start_date).toLocaleDateString()} - {new Date(streakAnalysis.longest_win_streak.end_date).toLocaleDateString()}
                </div>
              )}
            </div>

            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Longest Loss Streak</div>
              <div className="text-2xl font-bold text-red-600">{streakAnalysis.longest_loss_streak.length}</div>
              {streakAnalysis.longest_loss_streak.start_date && (
                <div className="text-xs text-gray-500 mt-1">
                  {new Date(streakAnalysis.longest_loss_streak.start_date).toLocaleDateString()} - {new Date(streakAnalysis.longest_loss_streak.end_date).toLocaleDateString()}
                </div>
              )}
            </div>
          </div>

          {streakAnalysis.recent_bets.length > 0 && (
            <div>
              <h3 className="text-lg font-semibold text-gray-700 mb-3">Recent Bets</h3>
              <div className="flex gap-2 flex-wrap">
                {streakAnalysis.recent_bets.map((bet, idx) => (
                  <div
                    key={idx}
                    className={`px-3 py-1 rounded-full text-xs font-medium ${
                      bet.state === 'won' ? 'bg-green-100 text-green-800' :
                      bet.state === 'lost' ? 'bg-red-100 text-red-800' :
                      'bg-gray-100 text-gray-800'
                    }`}
                  >
                    {bet.state === 'won' ? 'W' : bet.state === 'lost' ? 'L' : bet.state.charAt(0).toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {teamPerformance.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Team Performance</h2>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Team</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">As Home</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">As Away</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {teamPerformance.slice(0, 20).map((team) => (
                  <tr key={team.team_id}>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{team.team_name}</td>
                    <td className="px-4 py-3 text-sm">
                      <div>{team.as_home.won_legs}/{team.as_home.total_legs} ({(team.as_home.win_rate * 100).toFixed(0)}%)</div>
                      <div className="text-xs text-gray-500">${team.as_home.total_profit.toFixed(2)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{team.as_away.won_legs}/{team.as_away.total_legs} ({(team.as_away.win_rate * 100).toFixed(0)}%)</div>
                      <div className="text-xs text-gray-500">${team.as_away.total_profit.toFixed(2)}</div>
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div>{team.total.won_legs}/{team.total.total_legs} ({(team.total.win_rate * 100).toFixed(0)}%)</div>
                      <div className={`text-xs font-medium ${
                        team.total.total_profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${team.total.total_profit.toFixed(2)}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {teamPerformance.length > 20 && (
              <p className="text-sm text-gray-500 mt-2">Showing top 20 teams (out of {teamPerformance.length} total)</p>
            )}
          </div>
        </div>
      )}

      {timeSeries.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Performance Over Time</h2>
            <div className="text-sm text-gray-500">
              Showing {granularity === 'all-time' ? 'all time' : granularity} data
            </div>
          </div>
          
          {/* Profit Over Time Line Chart */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Profit Trend</h3>
            <ResponsiveContainer width="100%" height={350}>
              <LineChart
                data={timeSeries.map((item) => ({
                  ...item,
                  date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                }))}
                margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number, name: string) => {
                    if (name === 'profit') return [`$${value.toFixed(2)}`, 'Profit'];
                    if (name === 'stake') return [`$${value.toFixed(2)}`, 'Stake'];
                    return [value, name];
                  }}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="profit"
                  stroke="#0ea5e9"
                  strokeWidth={2}
                  dot={{ fill: '#0ea5e9', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Profit"
                />
                <Line
                  type="monotone"
                  dataKey="stake"
                  stroke="#8b5cf6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={{ fill: '#8b5cf6', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Stake"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Cumulative Profit Chart */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Cumulative Profit</h3>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart
                data={timeSeries
                  .map((item) => ({
                    ...item,
                    date: new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                  }))
                  .map((item, index, array) => ({
                    ...item,
                    cumulativeProfit: array
                      .slice(0, index + 1)
                      .reduce((sum, d) => sum + d.profit, 0),
                  }))}
                margin={{ top: 5, right: 30, left: 20, bottom: 60 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  angle={-45}
                  textAnchor="end"
                  height={80}
                  tick={{ fontSize: 12 }}
                />
                <YAxis
                  tickFormatter={(value) => `$${value.toFixed(0)}`}
                  tick={{ fontSize: 12 }}
                />
                <Tooltip
                  formatter={(value: number) => `$${value.toFixed(2)}`}
                  contentStyle={{ backgroundColor: '#fff', border: '1px solid #e5e7eb', borderRadius: '6px' }}
                />
                <Line
                  type="monotone"
                  dataKey="cumulativeProfit"
                  stroke="#10b981"
                  strokeWidth={3}
                  dot={{ fill: '#10b981', r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Cumulative Profit"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Detailed Table */}
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Daily Breakdown</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {timeSeries.map((data) => (
                    <tr key={data.date}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {new Date(data.date).toLocaleDateString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        ${data.stake.toFixed(2)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${
                        data.profit >= 0 ? 'text-green-600' : 'text-red-600'
                      }`}>
                        ${data.profit.toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {data.bet_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Period Comparison */}
      {periodComparison && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Period Comparison</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Current Period</h3>
              <p className="text-xs text-gray-400 mb-4">{periodComparison.current_period.start_date} to {periodComparison.current_period.end_date}</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Bets:</span>
                  <span className="text-sm font-medium">{periodComparison.current_period.total_bets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Win Rate:</span>
                  <span className="text-sm font-medium">{(periodComparison.current_period.win_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Profit:</span>
                  <span className={`text-sm font-medium ${periodComparison.current_period.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${periodComparison.current_period.total_profit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">ROI:</span>
                  <span className={`text-sm font-medium ${periodComparison.current_period.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(periodComparison.current_period.roi * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h3 className="text-sm font-medium text-gray-500 mb-2">Previous Period</h3>
              <p className="text-xs text-gray-400 mb-4">{periodComparison.previous_period.start_date} to {periodComparison.previous_period.end_date}</p>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Bets:</span>
                  <span className="text-sm font-medium">{periodComparison.previous_period.total_bets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Win Rate:</span>
                  <span className="text-sm font-medium">{(periodComparison.previous_period.win_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Profit:</span>
                  <span className={`text-sm font-medium ${periodComparison.previous_period.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${periodComparison.previous_period.total_profit.toFixed(2)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">ROI:</span>
                  <span className={`text-sm font-medium ${periodComparison.previous_period.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(periodComparison.previous_period.roi * 100).toFixed(1)}%
                  </span>
                </div>
              </div>
            </div>
          </div>
          <div className={`p-4 rounded-lg ${periodComparison.trend === 'improving' ? 'bg-green-50' : periodComparison.trend === 'declining' ? 'bg-red-50' : 'bg-gray-50'}`}>
            <h3 className="text-sm font-semibold mb-2">Trend: {periodComparison.trend.toUpperCase()}</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-gray-600">Bets Change:</span>
                <span className={`ml-2 font-medium ${periodComparison.change.bets_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {periodComparison.change.bets_change >= 0 ? '+' : ''}{periodComparison.change.bets_change.toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-600">Win Rate:</span>
                <span className={`ml-2 font-medium ${periodComparison.change.win_rate_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {periodComparison.change.win_rate_change >= 0 ? '+' : ''}{(periodComparison.change.win_rate_change * 100).toFixed(1)}%
                </span>
              </div>
              <div>
                <span className="text-gray-600">Profit:</span>
                <span className={`ml-2 font-medium ${periodComparison.change.profit_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {Math.abs(periodComparison.change.profit_change) > 1000 
                      ? `$${periodComparison.change.profit_change >= 0 ? '+' : ''}${periodComparison.change.profit_change.toFixed(2)}`
                      : `${periodComparison.change.profit_change >= 0 ? '+' : ''}${periodComparison.change.profit_change.toFixed(1)}%`
                    }
                </span>
              </div>
              <div>
                <span className="text-gray-600">ROI:</span>
                <span className={`ml-2 font-medium ${periodComparison.change.roi_change >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {periodComparison.change.roi_change >= 0 ? '+' : ''}{(periodComparison.change.roi_change * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Stake Analysis */}
      {stakeAnalysis.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Stake Size Analysis</h2>
          <p className="text-sm text-gray-600 mb-6">
            Analyze performance by bet size to identify optimal stake amounts.
          </p>
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">ROI by Stake Range</h3>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stakeAnalysis}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="stake_range" tick={{ fontSize: 12 }} />
                <YAxis tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} tick={{ fontSize: 12 }} />
                <Tooltip formatter={(value: number) => `${(value * 100).toFixed(2)}%`} />
                <Bar dataKey="roi" fill="#10b981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stake Range</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total Stake</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Avg Odds</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {stakeAnalysis.map((stake) => (
                  <tr key={stake.stake_range}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{stake.stake_range}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stake.total_bets}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(stake.win_rate * 100).toFixed(1)}%</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">${stake.total_stake.toFixed(2)}</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${stake.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${stake.total_profit.toFixed(2)}
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${stake.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(stake.roi * 100).toFixed(1)}%
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{stake.avg_odds.toFixed(2)}x</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Temporal Analytics */}
      {temporal && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Temporal Patterns</h2>
          <p className="text-sm text-gray-600 mb-6">
            Discover when you perform best - by day of week, hour, and month.
          </p>
          
          {/* Day of Week */}
          {temporal.by_day_of_week.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Performance by Day of Week</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={temporal.by_day_of_week}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `${(value * 100).toFixed(0)}%`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `${(value * 100).toFixed(2)}%`} />
                  <Bar dataKey="roi" fill="#8b5cf6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Weekend vs Weekday */}
          <div className="mb-6 grid grid-cols-2 gap-4">
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Weekend</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bets:</span>
                  <span className="font-medium">{temporal.weekend_vs_weekday.weekend.total_bets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Win Rate:</span>
                  <span className="font-medium">{(temporal.weekend_vs_weekday.weekend.win_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ROI:</span>
                  <span className={`font-medium ${temporal.weekend_vs_weekday.weekend.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(temporal.weekend_vs_weekday.weekend.roi * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Profit:</span>
                  <span className={`font-medium ${temporal.weekend_vs_weekday.weekend.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${temporal.weekend_vs_weekday.weekend.total_profit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
            <div className="border rounded-lg p-4">
              <h4 className="text-sm font-semibold text-gray-700 mb-2">Weekday</h4>
              <div className="space-y-1 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Bets:</span>
                  <span className="font-medium">{temporal.weekend_vs_weekday.weekday.total_bets}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Win Rate:</span>
                  <span className="font-medium">{(temporal.weekend_vs_weekday.weekday.win_rate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">ROI:</span>
                  <span className={`font-medium ${temporal.weekend_vs_weekday.weekday.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {(temporal.weekend_vs_weekday.weekday.roi * 100).toFixed(1)}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Profit:</span>
                  <span className={`font-medium ${temporal.weekend_vs_weekday.weekday.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${temporal.weekend_vs_weekday.weekday.total_profit.toFixed(2)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Risk Metrics */}
      {riskMetrics && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Risk & Volatility Metrics</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Volatility</div>
              <div className="text-lg font-bold text-gray-900">${riskMetrics.volatility.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Consistency Score</div>
              <div className="text-lg font-bold text-gray-900">{riskMetrics.consistency_score.toFixed(0)}/100</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Sharpe Ratio</div>
              <div className="text-lg font-bold text-gray-900">{riskMetrics.sharpe_ratio.toFixed(2)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Profit Factor</div>
              <div className="text-lg font-bold text-gray-900">{riskMetrics.profit_factor.toFixed(2)}</div>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Avg Win</div>
              <div className="text-lg font-bold text-green-600">${riskMetrics.average_win.toFixed(2)}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Avg Loss</div>
              <div className="text-lg font-bold text-red-600">${Math.abs(riskMetrics.average_loss).toFixed(2)}</div>
            </div>
            <div className="bg-green-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Largest Win</div>
              <div className="text-lg font-bold text-green-600">${riskMetrics.largest_win.toFixed(2)}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Largest Loss</div>
              <div className="text-lg font-bold text-red-600">${Math.abs(riskMetrics.largest_loss).toFixed(2)}</div>
            </div>
          </div>
          {riskMetrics.max_drawdown.amount > 0 && (
            <div className="p-4 bg-red-50 rounded-lg">
              <h4 className="text-sm font-semibold text-red-900 mb-2">Max Drawdown</h4>
              <div className="text-sm text-red-800">
                <p>Amount: ${riskMetrics.max_drawdown.amount.toFixed(2)}</p>
                <p>Duration: {riskMetrics.max_drawdown.duration_days} days</p>
                <p>Period: {riskMetrics.max_drawdown.start_date} to {riskMetrics.max_drawdown.end_date}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Bankroll Analysis */}
      {bankroll && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Bankroll Management</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Current Bankroll</div>
              <div className="text-2xl font-bold text-gray-900">${bankroll.current_bankroll.toFixed(2)}</div>
              <div className={`text-sm mt-1 ${bankroll.growth_rate >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {bankroll.growth_rate >= 0 ? '+' : ''}{bankroll.growth_rate.toFixed(1)}% growth
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Health Score</div>
              <div className="text-2xl font-bold text-gray-900">{bankroll.health_score}/100</div>
              <div className={`text-sm mt-1 font-medium ${bankroll.risk_level === 'low' ? 'text-green-600' : bankroll.risk_level === 'medium' ? 'text-yellow-600' : 'text-red-600'}`}>
                Risk: {bankroll.risk_level.toUpperCase()}
              </div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Kelly Criterion</div>
              <div className="text-2xl font-bold text-gray-900">{bankroll.kelly_criterion.recommended_stake_pct.toFixed(1)}%</div>
              <div className="text-sm mt-1 text-gray-600">
                Current: {bankroll.kelly_criterion.current_avg_stake_pct.toFixed(1)}%
              </div>
            </div>
          </div>
          {bankroll.bankroll_history.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Bankroll History</h3>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={bankroll.bankroll_history}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis tickFormatter={(value) => `$${value.toFixed(0)}`} tick={{ fontSize: 12 }} />
                  <Tooltip formatter={(value: number) => `$${value.toFixed(2)}`} />
                  <Line type="monotone" dataKey="amount" stroke="#10b981" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Frequency Analysis */}
      {frequency && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Betting Frequency Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Avg Bets/Day</div>
              <div className="text-lg font-bold text-gray-900">{frequency.avg_bets_per_day.toFixed(1)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Avg Bets/Week</div>
              <div className="text-lg font-bold text-gray-900">{frequency.avg_bets_per_week.toFixed(1)}</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Activity Trend</div>
              <div className={`text-lg font-bold ${frequency.activity_trend === 'increasing' ? 'text-green-600' : frequency.activity_trend === 'decreasing' ? 'text-red-600' : 'text-gray-600'}`}>
                {frequency.activity_trend.toUpperCase()}
              </div>
            </div>
          </div>
          {frequency.bets_per_day.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">Bets Per Day</h3>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={frequency.bets_per_day.slice(-30)}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Bar dataKey="bet_count" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* EV Analysis */}
      {evAnalysis && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Expected Value (EV) Analysis</h2>
          <div className="mb-6">
            <div className="bg-blue-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Overall EV</div>
              <div className={`text-2xl font-bold ${evAnalysis.overall_ev >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {evAnalysis.overall_ev >= 0 ? '+' : ''}{(evAnalysis.overall_ev * 100).toFixed(2)}%
              </div>
            </div>
          </div>
          {evAnalysis.ev_by_category.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-700 mb-4">EV by Category</h3>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Expected ROI</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actual ROI</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">EV Difference</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {evAnalysis.ev_by_category.map((cat) => (
                      <tr key={cat.category_id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{cat.category_name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(cat.expected_roi * 100).toFixed(1)}%</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(cat.actual_roi * 100).toFixed(1)}%</td>
                        <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${cat.ev_difference >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {cat.ev_difference >= 0 ? '+' : ''}{(cat.ev_difference * 100).toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Recovery Analysis */}
      {recovery && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Recovery Analysis</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Avg Recovery Time</div>
              <div className="text-lg font-bold text-gray-900">{recovery.avg_recovery_time_days.toFixed(1)} days</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Recovery Rate</div>
              <div className="text-lg font-bold text-gray-900">{recovery.recovery_rate.toFixed(1)}%</div>
            </div>
            <div className="bg-gray-50 p-4 rounded-lg">
              <div className="text-sm text-gray-600 mb-1">Post-Loss Win Rate</div>
              <div className="text-lg font-bold text-gray-900">{(recovery.post_loss_performance.win_rate * 100).toFixed(1)}%</div>
            </div>
          </div>
          {recovery.longest_recovery_period.days > 0 && (
            <div className="p-4 bg-yellow-50 rounded-lg">
              <h4 className="text-sm font-semibold text-yellow-900 mb-2">Longest Recovery Period</h4>
              <div className="text-sm text-yellow-800">
                <p>Duration: {recovery.longest_recovery_period.days} days</p>
                <p>Loss Amount: ${recovery.longest_recovery_period.loss_amount.toFixed(2)}</p>
                <p>Period: {recovery.longest_recovery_period.start_date} to {recovery.longest_recovery_period.end_date}</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Combination Analytics */}
      {combinations && combinations.top_combinations.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Top Combinations</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Combination</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {combinations.top_combinations.slice(0, 10).map((combo, idx) => (
                  <tr key={idx}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {combo.factors.join(' × ')}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{combo.total_bets}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{(combo.win_rate * 100).toFixed(1)}%</td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${combo.roi >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {(combo.roi * 100).toFixed(1)}%
                    </td>
                    <td className={`px-6 py-4 whitespace-nowrap text-sm font-medium ${combo.total_profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      ${combo.total_profit.toFixed(2)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

