/**
 * Shared TypeScript types between frontend and backend
 */
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
export interface ReferenceItem {
    id: string;
    kind: 'team' | 'league' | 'bet_type' | 'category' | 'responsible';
    name: string;
    metadata?: Record<string, unknown>;
    created_at: string;
    updated_at: string;
}
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
    range: string;
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
}
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
export interface User {
    id: string;
    email: string;
    username?: string;
    full_name?: string;
    avatar_url?: string;
    created_at: string;
    updated_at: string;
}
//# sourceMappingURL=index.d.ts.map