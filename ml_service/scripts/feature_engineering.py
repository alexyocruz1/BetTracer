"""
Feature Engineering for BetTracer ML Model
Creates ML features from raw bet data
"""
import pandas as pd
import numpy as np
from datetime import datetime
from sklearn.preprocessing import LabelEncoder

def decimal_to_american(decimal_odds):
    """Convert decimal odds to American odds."""
    if pd.isna(decimal_odds) or decimal_odds < 1:
        return 0
    if decimal_odds >= 2.0:
        return int((decimal_odds - 1) * 100)
    else:
        return int(-100 / (decimal_odds - 1))

def create_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Create ML features from raw bet data.
    
    Features created:
    1. Odds-based features (implied probability, value)
    2. Historical performance features
    3. Categorical encodings
    4. Temporal features
    5. Bet composition features
    """
    if len(df) == 0:
        return df
    
    df = df.copy()
    
    # 1. Odds-based features
    df['implied_probability'] = 1 / df['leg_odd'].clip(lower=1.01)
    df['decimal_odds'] = df['leg_odd']
    df['american_odds'] = df['leg_odd'].apply(decimal_to_american)
    
    # 2. Bet-level features
    # Check which columns exist before aggregating
    agg_dict = {
        'leg_odd': ['count', 'mean', 'min', 'max'],
    }
    
    # Add stake and odds if they exist in the dataframe
    if 'stake' in df.columns:
        agg_dict['stake'] = 'first'
    if 'odds' in df.columns:
        agg_dict['odds'] = 'first'
    
    bet_stats = df.groupby('bet_id').agg(agg_dict).reset_index()
    
    # Flatten column names
    new_columns = ['bet_id', 'num_legs', 'avg_leg_odd', 'min_leg_odd', 'max_leg_odd']
    if 'stake' in agg_dict:
        new_columns.append('stake')
    if 'odds' in agg_dict:
        new_columns.append('total_odds')
    
    bet_stats.columns = new_columns
    df = df.merge(bet_stats, on='bet_id', how='left')
    
    # Fill NaN values
    df['num_legs'] = df['num_legs'].fillna(1)
    df['avg_leg_odd'] = df['avg_leg_odd'].fillna(df['leg_odd'])
    df['min_leg_odd'] = df['min_leg_odd'].fillna(df['leg_odd'])
    df['max_leg_odd'] = df['max_leg_odd'].fillna(df['leg_odd'])
    
    # Handle stake - use merged stake or original stake or 0
    if 'stake' in df.columns:
        df['stake'] = df['stake'].fillna(0)
    else:
        df['stake'] = 0
    
    # Handle total_odds
    if 'total_odds' in df.columns:
        df['total_odds'] = df['total_odds'].fillna(df.get('odds', df['leg_odd']))
    else:
        df['total_odds'] = df.get('odds', df['leg_odd'])
    
    # 3. Historical performance features (per league, bet type, etc.)
    # League performance
    league_stats = df.groupby('league_id').agg({
        'leg_result': lambda x: (x == 'won').sum() / len(x) if len(x) > 0 else 0
    }).reset_index()
    league_stats.columns = ['league_id', 'league_win_rate']
    df = df.merge(league_stats, on='league_id', how='left')
    df['league_win_rate'] = df['league_win_rate'].fillna(0.5)
    
    # Bet type performance
    bet_type_stats = df.groupby('bet_type_id').agg({
        'leg_result': lambda x: (x == 'won').sum() / len(x) if len(x) > 0 else 0
    }).reset_index()
    bet_type_stats.columns = ['bet_type_id', 'bet_type_win_rate']
    df = df.merge(bet_type_stats, on='bet_type_id', how='left')
    df['bet_type_win_rate'] = df['bet_type_win_rate'].fillna(0.5)
    
    # Responsible person performance
    responsible_stats = df.groupby('responsible_id').agg({
        'leg_result': lambda x: (x == 'won').sum() / len(x) if len(x) > 0 else 0
    }).reset_index()
    responsible_stats.columns = ['responsible_id', 'responsible_win_rate']
    df = df.merge(responsible_stats, on='responsible_id', how='left')
    df['responsible_win_rate'] = df['responsible_win_rate'].fillna(0.5)
    
    # 4. Temporal features
    df['date'] = pd.to_datetime(df['date'], format='ISO8601', errors='coerce')
    df['day_of_week'] = df['date'].dt.dayofweek
    df['month'] = df['date'].dt.month
    df['hour'] = df['date'].dt.hour
    df['is_weekend'] = df['day_of_week'].isin([5, 6]).astype(int)
    
    # 5. User historical performance
    user_stats = df.groupby('user_id').agg({
        'leg_result': lambda x: (x == 'won').sum() / len(x) if len(x) > 0 else 0,
        'profit_loss': 'mean'
    }).reset_index()
    user_stats.columns = ['user_id', 'user_win_rate', 'user_avg_profit']
    df = df.merge(user_stats, on='user_id', how='left')
    df['user_win_rate'] = df['user_win_rate'].fillna(0.5)
    df['user_avg_profit'] = df['user_avg_profit'].fillna(0)
    
    # 6. Value calculation
    df['expected_value'] = (df['implied_probability'] * df['leg_odd'] - 1) * df['stake']
    df['is_value_bet'] = (df['expected_value'] > 0).astype(int)
    
    # 7. Categorical encoding (label encoding for IDs)
    categorical_cols = ['league_id', 'bet_type_id', 'category_id', 
                       'responsible_id', 'home_team_id', 'away_team_id']
    
    for col in categorical_cols:
        if col in df.columns:
            le = LabelEncoder()
            # Fill NaN with 'unknown' for encoding
            df[col] = df[col].fillna('unknown')
            df[f'{col}_encoded'] = le.fit_transform(df[col].astype(str))
    
    return df

