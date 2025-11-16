"""
BetTracer ML Service
FastAPI application for serving ML predictions
"""

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
from dotenv import load_dotenv

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
    return {"status": "ok", "service": "ml-service"}


# Predict endpoint
@app.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """
    Predict win probabilities for a bet with multiple legs.
    
    This is a placeholder implementation. In production, this would:
    1. Load the trained model
    2. Preprocess the input features
    3. Generate predictions
    4. Calculate combined probability and suggested stake
    """
    try:
        # TODO: Load model and make predictions
        # For now, return placeholder probabilities
        num_legs = len(request.legs)
        per_leg_probabilities = [0.5] * num_legs  # Placeholder
        combined_probability = 0.5 ** num_legs  # Placeholder
        
        return PredictResponse(
            per_leg_probabilities=per_leg_probabilities,
            combined_probability=combined_probability,
            suggested_stake=request.stake * 0.1 if request.stake else None,
            expected_value=1.0,
            confidence=0.5,
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)

