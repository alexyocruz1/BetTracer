/**
 * Shared TypeScript types between frontend and backend
 */

// Bet related types
export interface MainBet {
  id: string;
  external_id?: string;
  user_id: string;
  date: string;
  stake: number;
  odds: number;
  profit_loss?: number;
  state: 'pending' | 'won' | 'lost' | 'void';
  cumulative_profit?: number;
  notes?: string;
  deleted_at?: string;
  created_at: string;
  updated_at: string;
  legs?: Leg[];
}

export interface Leg {
  id: string;
  main_bet_id: string;
  home_team_id?: string;
  away_team_id?: string;
  league_id?: string;
  bet_type_id?: string;
  category_id?: string;
  responsible_id?: string;
  odd: number;
  result_state: 'pending' | 'won' | 'lost' | 'void';
  probability_est?: number;
  notes?: string;
  created_at: string;
  updated_at: string;
}

// Machine Learning prediction types
export interface MLPredictionLegInput {
  odd: number;
  league_id?: string;
  bet_type_id?: string;
  category_id?: string;
  responsible_id?: string;
}

export interface MLPredictionRequest {
  legs: MLPredictionLegInput[];
  stake?: number;
  user_id?: string;
}

export interface MLPredictionResponse {
  per_leg_probabilities: number[];
  combined_probability: number;
  suggested_stake?: number;
  expected_value?: number;
  confidence?: number;
}

// Reference items
export interface ReferenceItem {
  id: string;
  kind: 'team' | 'league' | 'bet_type' | 'category' | 'responsible';
  name: string;
  metadata?: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

// API Request/Response types
export interface CreateBetRequest {
  date: string;
  stake: number;
  odds?: number;
  state?: 'pending' | 'won' | 'lost' | 'void';
  notes?: string;
  legs: CreateLegRequest[];
}

export interface CreateLegRequest {
  home_team_id?: string;
  away_team_id?: string;
  league_id?: string;
  bet_type_id?: string;
  category_id?: string;
  responsible_id?: string;
  odd: number;
  result_state?: 'pending' | 'won' | 'lost' | 'void';
  notes?: string;
}

export interface UpdateBetRequest {
  stake?: number;
  odds?: number;
  state?: 'pending' | 'won' | 'lost' | 'void';
  notes?: string;
  profit_loss?: number;
}

export interface UpdateBetStateRequest {
  state: 'won' | 'lost' | 'void';
  profit_loss?: number;
}

// Analytics types
export interface AnalyticsSummary {
  total_stake: number;
  total_profit: number;
  roi: number;
  win_rate: number;
  total_bets: number;
  won_bets: number;
  lost_bets: number;
  pending_bets: number;
  cumulative_profit: number;
}

export interface AnalyticsByLeague {
  league_id: string;
  league_name: string;
  total_stake: number;
  total_profit: number;
  roi: number;
  win_rate: number;
  bet_count: number;
}

export interface AnalyticsByResponsible {
  responsible_id: string;
  responsible_name: string;
  total_stake: number;
  total_profit: number;
  roi: number;
  win_rate: number;
  bet_count: number;
}

export interface AnalyticsByBetType {
  bet_type_id: string;
  bet_type_name: string;
  total_stake: number;
  total_profit: number;
  roi: number;
  win_rate: number;
  bet_count: number;
}

export interface AnalyticsByCategory {
  category_id: string;
  category_name: string;
  total_stake: number;
  total_profit: number;
  roi: number;
  win_rate: number;
  bet_count: number;
}

export interface AnalyticsByLegs {
  num_legs: number;
  total_stake: number;
  total_profit: number;
  roi: number;
  win_rate: number;
  bet_count: number;
  won_bets: number;
  lost_bets: number;
  avg_odds: number;
}

export interface TimeSeriesData {
  date: string;
  stake: number;
  profit: number;
  bet_count: number;
}

export interface LegAnalytics {
  total_legs: number;
  won_legs: number;
  lost_legs: number;
  pending_legs: number;
  void_legs: number;
  leg_win_rate: number;
  avg_leg_odds: number;
  performance_by_league: Array<{
    league_id: string;
    league_name: string;
    total_legs: number;
    won_legs: number;
    win_rate: number;
  }>;
  performance_by_bet_type: Array<{
    bet_type_id: string;
    bet_type_name: string;
    total_legs: number;
    won_legs: number;
    win_rate: number;
  }>;
}

export interface OddsAnalysis {
  range: string; // e.g., "1.0-1.5", "1.5-2.0", "2.0+"
  min_odds: number;
  max_odds: number;
  total_bets: number;
  total_stake: number;
  total_profit: number;
  roi: number;
  win_rate: number;
}

export interface TeamPerformance {
  team_id: string;
  team_name: string;
  as_home: {
    total_legs: number;
    won_legs: number;
    win_rate: number;
    total_profit: number;
  };
  as_away: {
    total_legs: number;
    won_legs: number;
    win_rate: number;
    total_profit: number;
  };
  total: {
    total_legs: number;
    won_legs: number;
    win_rate: number;
    total_profit: number;
  };
}

export interface BestWorstPerformers {
  best_leagues: AnalyticsByLeague[];
  worst_leagues: AnalyticsByLeague[];
  best_bet_types: AnalyticsByBetType[];
  worst_bet_types: AnalyticsByBetType[];
  best_categories: AnalyticsByCategory[];
  worst_categories: AnalyticsByCategory[];
}

export interface StreakAnalysis {
  current_streak: {
    type: 'win' | 'loss';
    length: number;
    start_date: string;
  };
  longest_win_streak: {
    length: number;
    start_date: string;
    end_date: string;
  };
  longest_loss_streak: {
    length: number;
    start_date: string;
    end_date: string;
  };
  recent_bets: Array<{
    date: string;
    state: 'won' | 'lost' | 'pending' | 'void';
    profit_loss: number | null;
  }>;
}

export interface ResponsibleDetailedAnalytics {
  responsible_id: string;
  responsible_name: string;
  summary: {
    total_stake: number;
    total_profit: number;
    roi: number;
    win_rate: number;
    bet_count: number;
  };
  most_profitable_league: {
    league_id: string;
    league_name: string;
    total_profit: number;
    bet_count: number;
  } | null;
  favorite_league: {
    league_id: string;
    league_name: string;
    bet_count: number;
  } | null;
  favorite_team: {
    team_id: string;
    team_name: string;
    bet_count: number;
  } | null;
  performance_by_league: Array<{
    league_id: string;
    league_name: string;
    total_stake: number;
    total_profit: number;
    roi: number;
    win_rate: number;
    bet_count: number;
  }>;
  performance_by_bet_type: Array<{
    bet_type_id: string;
    bet_type_name: string;
    total_stake: number;
    total_profit: number;
    roi: number;
    win_rate: number;
    bet_count: number;
  }>;
  performance_by_category: Array<{
    category_id: string;
    category_name: string;
    total_stake: number;
    total_profit: number;
    roi: number;
    win_rate: number;
    bet_count: number;
  }>;
  performance_by_leg_count: Array<{
    num_legs: number;
    bet_count: number;
    win_rate: number;
    total_profit: number;
    roi: number;
    total_stake: number;
  }>;
  best_leg_count: {
    num_legs: number;
    bet_count: number;
    win_rate: number;
    total_profit: number;
    roi: number;
    total_stake: number;
  } | null;
}

// Temporal Analytics
export interface TemporalAnalytics {
  by_day_of_week: {
    day: string; // Monday, Tuesday, etc.
    day_number: number; // 0-6 (Sunday = 0)
    total_bets: number;
    win_rate: number;
    total_profit: number;
    roi: number;
    total_stake: number;
  }[];
  by_hour: {
    hour: number; // 0-23
    total_bets: number;
    win_rate: number;
    total_profit: number;
    total_stake: number;
    roi: number;
  }[];
  by_month: {
    month: string; // January, February, etc.
    month_number: number; // 1-12
    year: number;
    total_bets: number;
    win_rate: number;
    total_profit: number;
    roi: number;
    total_stake: number;
  }[];
  weekend_vs_weekday: {
    weekend: {
      total_bets: number;
      win_rate: number;
      total_profit: number;
      roi: number;
      total_stake: number;
    };
    weekday: {
      total_bets: number;
      win_rate: number;
      total_profit: number;
      roi: number;
      total_stake: number;
    };
  };
}

// Stake Analysis
export interface StakeAnalysis {
  stake_range: string; // "$0-10", "$10-25", etc.
  min_stake: number;
  max_stake: number;
  total_bets: number;
  win_rate: number;
  total_stake: number;
  total_profit: number;
  roi: number;
  avg_odds: number;
  won_bets: number;
  lost_bets: number;
}

// Combination Analytics
export interface CombinationAnalytics {
  league_bet_type: {
    league_id: string;
    league_name: string;
    bet_type_id: string;
    bet_type_name: string;
    total_bets: number;
    win_rate: number;
    total_profit: number;
    roi: number;
    total_stake: number;
  }[];
  responsible_league: {
    responsible_id: string;
    responsible_name: string;
    league_id: string;
    league_name: string;
    total_bets: number;
    win_rate: number;
    total_profit: number;
    roi: number;
    total_stake: number;
  }[];
  category_legs: {
    category_id: string;
    category_name: string;
    num_legs: number;
    total_bets: number;
    win_rate: number;
    total_profit: number;
    roi: number;
  }[];
  top_combinations: {
    factors: string[]; // ["League A", "Bet Type B", "2 legs"]
    total_bets: number;
    win_rate: number;
    roi: number;
    total_profit: number;
    total_stake: number;
  }[];
}

// Risk Metrics
export interface RiskMetrics {
  volatility: number; // Standard deviation of ROI
  consistency_score: number; // 0-100, higher = more consistent
  max_drawdown: {
    amount: number;
    start_date: string;
    end_date: string;
    duration_days: number;
  };
  sharpe_ratio: number;
  profit_distribution: {
    range: string; // "$0-50", "$50-100", etc.
    count: number;
  }[];
  average_win: number;
  average_loss: number;
  profit_factor: number; // Total wins / Total losses
  largest_win: number;
  largest_loss: number;
  win_loss_ratio: number; // Average win / Average loss
}

// Period Comparison
export interface PeriodComparison {
  current_period: {
    start_date: string;
    end_date: string;
    total_bets: number;
    win_rate: number;
    total_profit: number;
    roi: number;
    total_stake: number;
  };
  previous_period: {
    start_date: string;
    end_date: string;
    total_bets: number;
    win_rate: number;
    total_profit: number;
    roi: number;
    total_stake: number;
  };
  change: {
    bets_change: number; // percentage
    win_rate_change: number;
    profit_change: number;
    roi_change: number;
    stake_change: number;
  };
  trend: 'improving' | 'declining' | 'stable';
}

// EV Analysis
export interface EVAnalysis {
  overall_ev: number;
  ev_by_category: {
    category_id: string;
    category_name: string;
    avg_odds: number;
    win_rate: number;
    expected_roi: number;
    actual_roi: number;
    ev_difference: number; // actual - expected
    bet_count: number;
  }[];
  ev_by_bet_type: {
    bet_type_id: string;
    bet_type_name: string;
    avg_odds: number;
    win_rate: number;
    expected_roi: number;
    actual_roi: number;
    ev_difference: number;
    bet_count: number;
  }[];
  value_bets: {
    bet_id: string;
    date: string;
    odds: number;
    stake: number;
    expected_value: number;
    actual_result: number;
    category?: string;
  }[];
}

// Recovery Analysis
export interface RecoveryAnalysis {
  avg_recovery_time_days: number;
  recovery_rate: number; // % of losses recovered
  post_loss_performance: {
    bets_after_loss: number;
    win_rate: number;
    avg_profit: number;
    total_profit: number;
  };
  longest_recovery_period: {
    days: number;
    start_date: string;
    end_date: string;
    loss_amount: number;
    recovered_amount: number;
  };
  recovery_periods: {
    start_date: string;
    end_date: string;
    loss_amount: number;
    recovery_days: number;
    recovered: boolean;
  }[];
}

// Bankroll Analysis
export interface BankrollAnalysis {
  current_bankroll: number;
  starting_bankroll: number;
  growth_rate: number; // percentage
  stake_percentage_distribution: {
    range: string; // "0-1%", "1-2%", etc.
    bet_count: number;
    avg_roi: number;
    total_profit: number;
  }[];
  kelly_criterion: {
    recommended_stake_pct: number;
    current_avg_stake_pct: number;
    difference: number;
  };
  health_score: number; // 0-100
  risk_level: 'low' | 'medium' | 'high';
  bankroll_history: {
    date: string;
    amount: number;
  }[];
}

// Betting Frequency Analysis
export interface FrequencyAnalysis {
  bets_per_day: {
    date: string;
    bet_count: number;
    total_profit: number;
  }[];
  avg_bets_per_day: number;
  avg_bets_per_week: number;
  most_active_day: {
    day: string;
    bet_count: number;
  };
  activity_trend: 'increasing' | 'decreasing' | 'stable';
  frequency_performance: {
    frequency_range: string; // "0-1 bets/day", "2-3 bets/day", etc.
    bet_count: number;
    win_rate: number;
    roi: number;
    total_profit: number;
  }[];
}

// ML Prediction types
export interface MLPredictRequest {
  legs: MLPredictLeg[];
  stake?: number;
  user_id?: string;
}

export interface MLPredictLeg {
  league_id?: string;
  bet_type_id?: string;
  category_id?: string;
  responsible_id?: string;
  odd: number;
}

export interface MLPredictResponse {
  per_leg_probabilities: number[];
  combined_probability: number;
  suggested_stake?: number;
  expected_value?: number;
  confidence?: number;
}

// API Response types
export interface ApiResponse<T> {
  data: T;
  meta?: {
    pagination?: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

// User types
export interface User {
  id: string;
  email: string;
  username?: string;
  full_name?: string;
  avatar_url?: string;
  created_at: string;
  updated_at: string;
}

