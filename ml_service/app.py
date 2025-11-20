"""
BetTracer ML Service
FastAPI application for serving ML predictions
"""
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import joblib
import json
import numpy as np
import pandas as pd
from dotenv import load_dotenv
import sys

# Add scripts directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'scripts'))

load_dotenv()

app = FastAPI(
    title="BetTracer ML Service",
    description="ML service for bet predictions",
    version="1.0.0",
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Global model and metadata
model = None
model_metadata = None
feature_columns = None

def load_model():
    """Load the trained model and metadata."""
    global model, model_metadata, feature_columns
    
    model_path = "models/model.pkl"
    metadata_path = "models/model_metadata.json"
    
    if not os.path.exists(model_path):
        print("⚠️  Model not found. Using placeholder predictions.")
        return
    
    try:
        model = joblib.load(model_path)
        
        if os.path.exists(metadata_path):
            with open(metadata_path, 'r') as f:
                model_metadata = json.load(f)
                feature_columns = model_metadata.get('feature_columns', [])
        
        print(f"✅ Model loaded: {model_metadata.get('model_type', 'Unknown')}")
        print(f"   Features: {len(feature_columns)}")
    except Exception as e:
        print(f"❌ Error loading model: {e}")
        model = None

# Load model on startup
@app.on_event("startup")
async def startup_event():
    load_model()

# Request/Response models
class LegInput(BaseModel):
    league_id: Optional[str] = None
    bet_type_id: Optional[str] = None
    category_id: Optional[str] = None
    responsible_id: Optional[str] = None
    odd: float

class UserAnalytics(BaseModel):
    """User-specific analytics data for enhanced predictions"""
    overall_win_rate: Optional[float] = None
    overall_roi: Optional[float] = None
    cumulative_profit: Optional[float] = None
    total_stake: Optional[float] = None
    league_win_rates: Optional[dict] = None  # {league_id: win_rate}
    bet_type_win_rates: Optional[dict] = None  # {bet_type_id: win_rate}
    responsible_win_rates: Optional[dict] = None  # {responsible_id: win_rate}
    leg_count_win_rates: Optional[dict] = None  # {num_legs: win_rate}
    temporal_win_rates: Optional[dict] = None  # {day_of_week: win_rate, hour: win_rate, is_weekend: win_rate}
    current_streak: Optional[dict] = None  # {type: "win"/"loss", length: int}
    recent_performance: Optional[dict] = None  # {last_7_days_profit: float, last_30_days_profit: float}
    combination_performance: Optional[dict] = None  # {f"{league_id}_{bet_type_id}": {wins: int, losses: int}}

class PredictRequest(BaseModel):
    legs: List[LegInput]
    stake: Optional[float] = None
    user_id: Optional[str] = None
    user_analytics: Optional[UserAnalytics] = None  # User-specific historical data

class PredictResponse(BaseModel):
    per_leg_probabilities: List[float]
    combined_probability: float
    suggested_stake: Optional[float] = None
    expected_value: Optional[float] = None
    confidence: Optional[float] = None
    # Enhanced decision-making features
    recommendation: Optional[str] = None  # "strong_value", "value", "neutral", "avoid"
    recommendation_reason: Optional[str] = None
    kelly_stake: Optional[float] = None
    kelly_percentage: Optional[float] = None
    value_detected: Optional[float] = None  # Percentage value (e.g., +15% means 15% edge)
    risk_warnings: List[str] = []
    leg_optimization: Optional[dict] = None  # Suggestions for removing/adding legs
    bankroll_health: Optional[str] = None  # "healthy", "caution", "critical"
    bankroll_advice: Optional[str] = None
    optimal_timing: Optional[dict] = None  # Best days/times to bet
    parlay_risk: Optional[dict] = None  # Risk analysis by leg count
    responsible_insights: Optional[dict] = None  # Insights based on responsible person
    streak_impact: Optional[dict] = None  # How current streak affects recommendation

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "ml-service",
        "model_loaded": model is not None,
        "model_type": model_metadata.get('model_type') if model_metadata else None
    }

def prepare_features_for_prediction(legs: List[LegInput], stake: float = None) -> pd.DataFrame:
    """
    Prepare features for prediction from leg inputs.
    Note: This is simplified - in production, fetch historical stats from database.
    """
    # Create basic features
    features = []
    
    for leg in legs:
        implied_prob = 1 / max(leg.odd, 1.01)
        
        # Basic features
        feature_dict = {
            'implied_probability': implied_prob,
            'decimal_odds': leg.odd,
            'american_odds': int((leg.odd - 1) * 100) if leg.odd >= 2.0 else int(-100 / (leg.odd - 1)),
            'num_legs': len(legs),
            'stake': stake or 0,
            'total_odds': np.prod([l.odd for l in legs]),
        }
        
        # Add placeholder values for features that require historical data
        # In production, fetch these from database
        placeholder_features = {
            'avg_leg_odd': np.mean([l.odd for l in legs]),
            'min_leg_odd': min([l.odd for l in legs]),
            'max_leg_odd': max([l.odd for l in legs]),
            'league_win_rate': 0.5,
            'bet_type_win_rate': 0.5,
            'responsible_win_rate': 0.5,
            'day_of_week': 0,
            'month': 1,
            'hour': 12,
            'is_weekend': 0,
            'user_win_rate': 0.5,
            'user_avg_profit': 0,
            'expected_value': 0,
            'is_value_bet': 0,
        }
        feature_dict.update(placeholder_features)
        
        # Add encoded categorical features (placeholder)
        if feature_columns:
            for col in feature_columns:
                if col not in feature_dict and col.endswith('_encoded'):
                    feature_dict[col] = 0
        
        features.append(feature_dict)
    
    df = pd.DataFrame(features)
    
    # Ensure all feature columns are present
    if feature_columns:
        for col in feature_columns:
            if col not in df.columns:
                df[col] = 0.0
        # Reorder to match training order
        missing_cols = [col for col in feature_columns if col not in df.columns]
        if missing_cols:
            for col in missing_cols:
                df[col] = 0.0
        df = df[[col for col in feature_columns if col in df.columns]]
    
    return df

# ============================================================================
# Decision-Making ML Functions
# ============================================================================

def calculate_kelly_criterion(win_probability: float, odds: float, bankroll: float = None) -> tuple:
    """
    Calculate Kelly Criterion stake sizing.
    Returns: (kelly_stake, kelly_percentage)
    """
    if win_probability <= 0 or odds <= 1:
        return None, None
    
    # Kelly formula: f = (bp - q) / b
    # where b = odds - 1, p = win probability, q = 1 - p
    b = odds - 1
    p = win_probability
    q = 1 - p
    
    kelly_fraction = (b * p - q) / b
    
    # Cap at 25% for safety (full Kelly is often too aggressive)
    kelly_fraction = min(kelly_fraction, 0.25)
    kelly_fraction = max(kelly_fraction, 0)  # No negative Kelly
    
    if bankroll:
        kelly_stake = bankroll * kelly_fraction
        return kelly_stake, kelly_fraction * 100
    else:
        return None, kelly_fraction * 100

def detect_value(implied_prob: float, actual_win_rate: float) -> Optional[float]:
    """
    Detect value by comparing implied probability vs actual win rate.
    Returns percentage edge (positive = value bet, negative = avoid).
    """
    if actual_win_rate is None or actual_win_rate <= 0:
        return None
    
    edge = (actual_win_rate - implied_prob) / implied_prob * 100
    return edge

def generate_recommendation(ev: float, value_edge: Optional[float], risk_warnings: List[str]) -> tuple:
    """
    Generate bet recommendation based on EV, value, and risks.
    Returns: (recommendation, reason)
    """
    if len(risk_warnings) >= 2:
        return "avoid", "Multiple risk factors detected"
    
    if value_edge and value_edge > 15 and ev > 0:
        return "strong_value", f"Strong value bet with {value_edge:.1f}% edge and positive EV"
    elif value_edge and value_edge > 5 and ev > 0:
        return "value", f"Value bet with {value_edge:.1f}% edge"
    elif ev > 0:
        return "neutral", "Positive expected value"
    elif ev < -10:
        return "avoid", "Negative expected value"
    else:
        return "neutral", "Neutral recommendation"

def analyze_leg_optimization(legs: List[LegInput], leg_probs: List[float], total_odds: float, 
                            stake: float, user_analytics: Optional[UserAnalytics] = None) -> Optional[dict]:
    """
    Analyze which legs to remove to improve EV.
    Returns optimization suggestions.
    """
    if len(legs) <= 2:
        return None
    
    optimizations = []
    
    # Try removing each leg
    for i in range(len(legs)):
        remaining_legs = [legs[j] for j in range(len(legs)) if j != i]
        remaining_probs = [leg_probs[j] for j in range(len(leg_probs)) if j != i]
        
        new_combined_prob = float(np.prod(remaining_probs))
        new_total_odds = np.prod([l.odd for l in remaining_legs])
        new_ev = (new_combined_prob * new_total_odds - 1) * (stake or 0)
        
        current_ev = (float(np.prod(leg_probs)) * total_odds - 1) * (stake or 0)
        ev_improvement = new_ev - current_ev
        
        if ev_improvement > 0:
            optimizations.append({
                "remove_leg": i + 1,
                "ev_improvement": float(ev_improvement),
                "new_combined_probability": new_combined_prob,
                "new_ev": float(new_ev)
            })
    
    if optimizations:
        # Sort by EV improvement
        optimizations.sort(key=lambda x: x["ev_improvement"], reverse=True)
        return {
            "suggestions": optimizations[:3],  # Top 3 suggestions
            "message": f"Removing leg {optimizations[0]['remove_leg']} improves EV by ${optimizations[0]['ev_improvement']:.2f}"
        }
    
    return None

def check_risk_warnings(legs: List[LegInput], user_analytics: Optional[UserAnalytics] = None) -> List[str]:
    """
    Check for risk factors and generate warnings.
    """
    warnings = []
    
    if not user_analytics:
        return warnings
    
    # Check combination performance
    if user_analytics.combination_performance:
        for leg in legs:
            if leg.league_id and leg.bet_type_id:
                combo_key = f"{leg.league_id}_{leg.bet_type_id}"
                combo_perf = user_analytics.combination_performance.get(combo_key)
                if combo_perf:
                    wins = combo_perf.get("wins", 0)
                    losses = combo_perf.get("losses", 0)
                    total = wins + losses
                    if total >= 3 and losses > wins * 2:  # At least 3 bets, losing twice as often
                        warnings.append(f"Poor track record on {combo_key} combination ({wins}W-{losses}L)")
    
    # Check league performance
    if user_analytics.league_win_rates:
        for leg in legs:
            if leg.league_id:
                league_wr = user_analytics.league_win_rates.get(leg.league_id)
                if league_wr and league_wr < 0.3:  # Less than 30% win rate
                    warnings.append(f"Low win rate ({league_wr*100:.1f}%) on this league")
    
    # Check parlay risk
    num_legs = len(legs)
    if user_analytics.leg_count_win_rates:
        leg_wr = user_analytics.leg_count_win_rates.get(num_legs)
        if leg_wr and leg_wr < 0.2:  # Less than 20% win rate for this leg count
            warnings.append(f"Low win rate ({leg_wr*100:.1f}%) for {num_legs}-leg parlays")
    
    return warnings

def analyze_bankroll_health(user_analytics: Optional[UserAnalytics] = None, 
                           current_stake: float = None) -> tuple:
    """
    Analyze bankroll health and provide advice.
    Returns: (health_status, advice)
    """
    if not user_analytics or not user_analytics.recent_performance:
        return None, None
    
    recent = user_analytics.recent_performance
    last_7_days = recent.get("last_7_days_profit", 0)
    last_30_days = recent.get("last_30_days_profit", 0)
    cumulative = user_analytics.cumulative_profit or 0
    total_stake = user_analytics.total_stake or 1
    
    # Calculate drawdown
    if cumulative < 0:
        drawdown_pct = abs(cumulative) / total_stake * 100 if total_stake > 0 else 0
    else:
        drawdown_pct = 0
    
    # Check streak impact
    if user_analytics.current_streak:
        streak_type = user_analytics.current_streak.get("type")
        streak_length = user_analytics.current_streak.get("length", 0)
        
        if streak_type == "loss" and streak_length >= 3:
            if drawdown_pct > 20:
                return "critical", f"On {streak_length}-loss streak with {drawdown_pct:.1f}% drawdown. Consider reducing stakes by 50% or taking a break."
            else:
                return "caution", f"On {streak_length}-loss streak. Reduce stakes by 30% until you recover."
    
    if drawdown_pct > 30:
        return "critical", f"Significant drawdown ({drawdown_pct:.1f}%). Reduce stakes by 50% and focus on value bets only."
    elif drawdown_pct > 15:
        return "caution", f"Moderate drawdown ({drawdown_pct:.1f}%). Consider reducing stakes by 25%."
    elif last_7_days < -total_stake * 0.1:  # Lost more than 10% of total stake in 7 days
        return "caution", "Recent losses detected. Consider reducing stake size temporarily."
    else:
        return "healthy", "Bankroll is healthy. Continue with normal stake sizing."

def analyze_optimal_timing(user_analytics: Optional[UserAnalytics] = None) -> Optional[dict]:
    """
    Analyze optimal betting times based on temporal analytics.
    """
    if not user_analytics or not user_analytics.temporal_win_rates:
        return None
    
    temporal = user_analytics.temporal_win_rates
    insights = {}
    
    # Best day of week
    if "day_of_week" in temporal:
        day_wrs = temporal["day_of_week"]
        if day_wrs:
            best_day = max(day_wrs.items(), key=lambda x: x[1])
            worst_day = min(day_wrs.items(), key=lambda x: x[1])
            insights["best_day"] = {
                "day": best_day[0],
                "win_rate": best_day[1] * 100
            }
            insights["worst_day"] = {
                "day": worst_day[0],
                "win_rate": worst_day[1] * 100
            }
    
    # Weekend vs weekday
    if "is_weekend" in temporal:
        weekend_wr = temporal["is_weekend"].get(1, 0)
        weekday_wr = temporal["is_weekend"].get(0, 0)
        if weekend_wr > weekday_wr + 0.1:  # 10% difference
            insights["weekend_advantage"] = {
                "weekend_win_rate": weekend_wr * 100,
                "weekday_win_rate": weekday_wr * 100,
                "message": f"Your win rate is {weekend_wr*100:.1f}% on weekends vs {weekday_wr*100:.1f}% on weekdays"
            }
    
    return insights if insights else None

def analyze_parlay_risk(num_legs: int, user_analytics: Optional[UserAnalytics] = None) -> Optional[dict]:
    """
    Analyze parlay risk based on historical performance by leg count.
    """
    if not user_analytics or not user_analytics.leg_count_win_rates:
        return None
    
    leg_wrs = user_analytics.leg_count_win_rates
    current_wr = leg_wrs.get(num_legs)
    
    if not current_wr:
        return None
    
    # Find best leg count
    best_leg_count = max(leg_wrs.items(), key=lambda x: x[1])
    worst_leg_count = min(leg_wrs.items(), key=lambda x: x[1])
    
    analysis = {
        "current_leg_count": num_legs,
        "current_win_rate": current_wr * 100,
        "best_leg_count": {
            "legs": best_leg_count[0],
            "win_rate": best_leg_count[1] * 100
        },
        "worst_leg_count": {
            "legs": worst_leg_count[0],
            "win_rate": worst_leg_count[1] * 100
        }
    }
    
    if current_wr < 0.2:
        analysis["risk_level"] = "high"
        analysis["message"] = f"Your {num_legs}-leg parlays have only {current_wr*100:.1f}% win rate. Consider splitting into smaller parlays."
    elif current_wr < 0.3:
        analysis["risk_level"] = "medium"
        analysis["message"] = f"Your {num_legs}-leg parlays have {current_wr*100:.1f}% win rate. Proceed with caution."
    else:
        analysis["risk_level"] = "low"
        analysis["message"] = f"Your {num_legs}-leg parlays have {current_wr*100:.1f}% win rate."
    
    return analysis

def analyze_responsible_insights(legs: List[LegInput], user_analytics: Optional[UserAnalytics] = None) -> Optional[dict]:
    """
    Analyze insights based on responsible person performance.
    """
    if not user_analytics or not user_analytics.responsible_win_rates:
        return None
    
    responsible_wrs = user_analytics.responsible_win_rates
    insights = []
    
    for i, leg in enumerate(legs):
        if leg.responsible_id and leg.responsible_id in responsible_wrs:
            wr = responsible_wrs[leg.responsible_id]
            insights.append({
                "leg": i + 1,
                "responsible_id": leg.responsible_id,
                "win_rate": wr * 100,
                "message": f"Leg {i+1} responsible has {wr*100:.1f}% win rate"
            })
    
    if insights:
        best = max(insights, key=lambda x: x["win_rate"])
        return {
            "insights": insights,
            "best_responsible": best,
            "message": f"Best performing responsible is on leg {best['leg']} with {best['win_rate']:.1f}% win rate"
        }
    
    return None

def analyze_streak_impact(user_analytics: Optional[UserAnalytics] = None) -> Optional[dict]:
    """
    Analyze how current streak impacts betting recommendations.
    """
    if not user_analytics or not user_analytics.current_streak:
        return None
    
    streak = user_analytics.current_streak
    streak_type = streak.get("type")
    streak_length = streak.get("length", 0)
    
    impact = {
        "streak_type": streak_type,
        "streak_length": streak_length
    }
    
    if streak_type == "loss" and streak_length >= 3:
        impact["recommendation"] = "reduce_stakes"
        impact["message"] = f"On {streak_length}-loss streak. Reduce stake size by {min(streak_length * 10, 50)}% to manage risk."
        impact["stake_reduction_pct"] = min(streak_length * 10, 50)
    elif streak_type == "win" and streak_length >= 3:
        impact["recommendation"] = "maintain"
        impact["message"] = f"On {streak_length}-win streak. Maintain current stake sizing but avoid overconfidence."
    else:
        impact["recommendation"] = "normal"
        impact["message"] = "Normal betting conditions."
    
    return impact

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """
    Enhanced prediction endpoint with all decision-making ML features.
    """
    try:
        user_analytics = request.user_analytics
        num_legs = len(request.legs)
        total_odds = np.prod([leg.odd for leg in request.legs])
        
        # Get base predictions
        if model is None:
            # Fallback to simple probability calculation
            per_leg_probabilities = [1 / max(leg.odd, 1.01) for leg in request.legs]
            combined_probability = float(np.prod(per_leg_probabilities))
        else:
            # Prepare features
            X = prepare_features_for_prediction(request.legs, request.stake)
            # Make predictions
            per_leg_probabilities = model.predict_proba(X)[:, 1].tolist()
            combined_probability = float(np.prod(per_leg_probabilities))
        
        # Calculate expected value
        expected_value = (combined_probability * total_odds - 1) * (request.stake or 0)
        confidence = float(np.mean(per_leg_probabilities))
        
        # ========================================================================
        # Decision-Making Features
        # ========================================================================
        
        # 1. Kelly Criterion Stake Sizing
        bankroll = user_analytics.total_stake if user_analytics else None
        kelly_stake, kelly_percentage = calculate_kelly_criterion(
            combined_probability, total_odds, bankroll
        )
        
        # 2. Value Detection
        implied_prob = 1 / total_odds
        actual_win_rate = user_analytics.overall_win_rate if user_analytics else None
        value_detected = detect_value(implied_prob, actual_win_rate)
        
        # 3. Risk Warnings
        risk_warnings = check_risk_warnings(request.legs, user_analytics)
        
        # 4. Recommendation Engine
        recommendation, recommendation_reason = generate_recommendation(
            expected_value, value_detected, risk_warnings
        )
        
        # 5. Leg Optimization
        leg_optimization = analyze_leg_optimization(
            request.legs, per_leg_probabilities, total_odds, request.stake or 0, user_analytics
        )
        
        # 6. Bankroll Health
        bankroll_health, bankroll_advice = analyze_bankroll_health(user_analytics, request.stake)
        
        # 7. Optimal Timing
        optimal_timing = analyze_optimal_timing(user_analytics)
        
        # 8. Parlay Risk Analysis
        parlay_risk = analyze_parlay_risk(num_legs, user_analytics)
        
        # 9. Responsible Person Insights
        responsible_insights = analyze_responsible_insights(request.legs, user_analytics)
        
        # 10. Streak Impact
        streak_impact = analyze_streak_impact(user_analytics)
        
        # Smart Stake Sizing (combines Kelly with streak impact)
        if request.stake:
            if streak_impact and streak_impact.get("recommendation") == "reduce_stakes":
                reduction_pct = streak_impact.get("stake_reduction_pct", 0) / 100
                suggested_stake = request.stake * (1 - reduction_pct)
            elif kelly_stake and kelly_stake > 0:
                # Use Kelly but cap at 10% of current stake for safety
                suggested_stake = min(kelly_stake, request.stake * 0.1)
            elif expected_value > 0:
                # Fallback: 5% of stake for positive EV
                suggested_stake = request.stake * 0.05
            else:
                suggested_stake = None
        else:
            suggested_stake = kelly_stake if kelly_stake else None
        
        return PredictResponse(
            per_leg_probabilities=per_leg_probabilities,
            combined_probability=combined_probability,
            suggested_stake=suggested_stake,
            expected_value=float(expected_value),
            confidence=confidence,
            recommendation=recommendation,
            recommendation_reason=recommendation_reason,
            kelly_stake=kelly_stake,
            kelly_percentage=kelly_percentage,
            value_detected=value_detected,
            risk_warnings=risk_warnings,
            leg_optimization=leg_optimization,
            bankroll_health=bankroll_health,
            bankroll_advice=bankroll_advice,
            optimal_timing=optimal_timing,
            parlay_risk=parlay_risk,
            responsible_insights=responsible_insights,
            streak_impact=streak_impact,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
