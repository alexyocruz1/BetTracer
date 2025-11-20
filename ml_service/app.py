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

class PredictRequest(BaseModel):
    legs: List[LegInput]
    stake: Optional[float] = None
    user_id: Optional[str] = None

class PredictResponse(BaseModel):
    per_leg_probabilities: List[float]
    combined_probability: float
    suggested_stake: Optional[float] = None
    expected_value: Optional[float] = None
    confidence: Optional[float] = None

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

@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """
    Predict win probabilities for a bet with multiple legs.
    """
    try:
        if model is None:
            # Fallback to simple probability calculation
            num_legs = len(request.legs)
            per_leg_probabilities = [1 / max(leg.odd, 1.01) for leg in request.legs]
            combined_probability = float(np.prod(per_leg_probabilities))
            
            return PredictResponse(
                per_leg_probabilities=per_leg_probabilities,
                combined_probability=combined_probability,
                suggested_stake=request.stake * 0.1 if request.stake else None,
                expected_value=1.0,
                confidence=0.5,
            )
        
        # Prepare features
        X = prepare_features_for_prediction(request.legs, request.stake)
        
        # Make predictions
        per_leg_probabilities = model.predict_proba(X)[:, 1].tolist()
        combined_probability = float(np.prod(per_leg_probabilities))
        
        # Calculate expected value
        total_odds = np.prod([leg.odd for leg in request.legs])
        expected_value = (combined_probability * total_odds - 1) * (request.stake or 0)
        
        # Calculate confidence (based on model's prediction certainty)
        confidence = float(np.mean(per_leg_probabilities))
        
        # Suggest stake (Kelly Criterion or simple percentage)
        if request.stake and expected_value > 0:
            # Simple stake suggestion: 5% of bankroll for positive EV bets
            suggested_stake = request.stake * 0.05
        else:
            suggested_stake = None
        
        return PredictResponse(
            per_leg_probabilities=per_leg_probabilities,
            combined_probability=combined_probability,
            suggested_stake=suggested_stake,
            expected_value=float(expected_value),
            confidence=confidence,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=int(os.getenv("PORT", 8000)))
