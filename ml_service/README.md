# BetTracer ML Service

FastAPI service for serving ML predictions for bet probability.

## Setup

1. Install dependencies:
```bash
pip install -r requirements.txt
```

2. Set up environment variables:
```bash
cp env.example .env
# Edit .env with your configuration
```

3. Train model (when you have data):
```bash
python train.py
```

4. Start the service:
```bash
uvicorn app:app --reload
```

## Endpoints

- `GET /health` - Health check
- `POST /predict` - Get ML predictions for a bet

## Model Training

The model training script (`train.py`) is a placeholder. To train a real model:

1. Export data from Supabase using the ETL script
2. Load and preprocess the data
3. Train the model
4. Save the model to `models/model.pkl`
5. The service will automatically load the model on startup

## Future Enhancements

- Add actual model training logic
- Implement feature engineering
- Add model versioning
- Add model evaluation metrics
- Add A/B testing for models

