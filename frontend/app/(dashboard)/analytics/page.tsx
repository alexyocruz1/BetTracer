'use client';

import { useEffect, useState, useCallback } from 'react';
import { apiClient } from '@/lib/api/client';
import { AnalyticsSummary, AnalyticsByLeague, AnalyticsByResponsible, AnalyticsByBetType, AnalyticsByCategory, TimeSeriesData, LegAnalytics, OddsAnalysis, TeamPerformance, BestWorstPerformers, StreakAnalysis, ResponsibleDetailedAnalytics } from '@/types';
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

export default function AnalyticsPage() {
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
              className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Time Period</label>
            <select
              value={granularity}
              onChange={(e) => setGranularity(e.target.value as 'daily' | 'weekly' | 'monthly' | 'all-time')}
              className="block w-full border border-gray-300 rounded-md px-3 py-2.5 text-base sm:text-sm"
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
            <ResponsiveContainer width="100%" height={300}>
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
            <ResponsiveContainer width="100%" height={300}>
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

      {byResponsible.length > 0 && (
        <div className="bg-white shadow rounded-lg p-6 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-6">Performance by Responsible</h2>
          
          {/* Bar Chart for Profit by Responsible */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-700 mb-4">Profit by Responsible</h3>
            <ResponsiveContainer width="100%" height={300}>
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
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Stake</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ROI</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Win Rate</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Bets</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {byResponsible.map((responsible) => (
                    <tr key={responsible.responsible_id}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {responsible.responsible_name}
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
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {(responsible.win_rate * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {responsible.bet_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
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

                {/* Key Insights */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  {responsible.most_profitable_league && (
                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                      <div className="text-sm text-blue-600 font-medium mb-1">Most Profitable League</div>
                      <div className="text-base font-bold text-blue-900">{responsible.most_profitable_league.league_name}</div>
                      <div className="text-sm text-blue-700 mt-1">
                        ${responsible.most_profitable_league.total_profit >= 0 ? '+' : ''}{responsible.most_profitable_league.total_profit.toFixed(2)} ({responsible.most_profitable_league.bet_count} bets)
                      </div>
                    </div>
                  )}
                  {responsible.favorite_league && (
                    <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
                      <div className="text-sm text-purple-600 font-medium mb-1">Favorite League</div>
                      <div className="text-base font-bold text-purple-900">{responsible.favorite_league.league_name}</div>
                      <div className="text-sm text-purple-700 mt-1">{responsible.favorite_league.bet_count} bets</div>
                    </div>
                  )}
                  {responsible.favorite_team && (
                    <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                      <div className="text-sm text-green-600 font-medium mb-1">Favorite Team</div>
                      <div className="text-base font-bold text-green-900">{responsible.favorite_team.team_name}</div>
                      <div className="text-sm text-green-700 mt-1">{responsible.favorite_team.bet_count} bets</div>
                    </div>
                  )}
                </div>

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
            <ResponsiveContainer width="100%" height={300}>
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
            <ResponsiveContainer width="100%" height={400}>
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
            <ResponsiveContainer width="100%" height={300}>
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
            <ResponsiveContainer width="100%" height={300}>
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
    </div>
  );
}

