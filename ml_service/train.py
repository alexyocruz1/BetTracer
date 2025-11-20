"""
BetTracer ML Training Script
Train ML models for bet prediction
"""
import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split, cross_val_score
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.metrics import accuracy_score, roc_auc_score, classification_report, confusion_matrix
from sklearn.preprocessing import StandardScaler
import xgboost as xgb
try:
    import lightgbm as lgb
    LIGHTGBM_AVAILABLE = True
except ImportError:
    LIGHTGBM_AVAILABLE = False
    print("⚠️  LightGBM not available (optional dependency). Using XGBoost and RandomForest.")
import joblib
import os
import sys
from datetime import datetime
import json

# Add scripts directory to path
sys.path.append(os.path.join(os.path.dirname(__file__), 'scripts'))

from fetch_training_data import fetch_training_data_from_db
from feature_engineering import create_features

def prepare_features(df: pd.DataFrame) -> tuple:
    """
    Prepare features and target for training.
    
    Returns:
        X: Feature matrix
        y: Target vector (1 = won, 0 = lost/void)
        feature_cols: List of feature column names
    """
    # Create features
    df_features = create_features(df)
    
    # Select feature columns (exclude IDs and target)
    feature_cols = [
        'implied_probability', 'decimal_odds', 'american_odds',
        'num_legs', 'avg_leg_odd', 'min_leg_odd', 'max_leg_odd',
        'stake', 'total_odds',
        'league_win_rate', 'bet_type_win_rate', 'responsible_win_rate',
        'day_of_week', 'month', 'hour', 'is_weekend',
        'user_win_rate', 'user_avg_profit',
        'expected_value', 'is_value_bet',
    ]
    
    # Add encoded categorical features
    encoded_cols = [col for col in df_features.columns if col.endswith('_encoded')]
    feature_cols.extend(encoded_cols)
    
    # Filter to available columns
    feature_cols = [col for col in feature_cols if col in df_features.columns]
    
    X = df_features[feature_cols].fillna(0)
    
    # Target: 1 if leg won, 0 otherwise
    y = (df_features['leg_result'] == 'won').astype(int)
    
    print(f"Features: {len(feature_cols)}")
    print(f"Target distribution: {y.value_counts().to_dict()}")
    
    return X, y, feature_cols


def train_model(X_train, y_train, model_type='xgboost'):
    """
    Train the ML model.
    
    Args:
        model_type: 'xgboost', 'lightgbm', 'random_forest', or 'gradient_boosting'
    """
    if model_type == 'xgboost':
        model = xgb.XGBClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            eval_metric='logloss'
        )
    elif model_type == 'lightgbm':
        if not LIGHTGBM_AVAILABLE:
            raise ImportError("LightGBM is not installed. Install it with: pip install lightgbm")
        model = lgb.LGBMClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            subsample=0.8,
            colsample_bytree=0.8,
            random_state=42,
            verbose=-1
        )
    elif model_type == 'random_forest':
        model = RandomForestClassifier(
            n_estimators=100,
            max_depth=10,
            random_state=42,
            n_jobs=-1
        )
    elif model_type == 'gradient_boosting':
        model = GradientBoostingClassifier(
            n_estimators=100,
            max_depth=6,
            learning_rate=0.1,
            random_state=42
        )
    else:
        raise ValueError(f"Unknown model type: {model_type}")
    
    print(f"Training {model_type} model...")
    model.fit(X_train, y_train)
    return model


def evaluate_model(model, X_test, y_test):
    """Evaluate the model performance."""
    y_pred = model.predict(X_test)
    y_pred_proba = model.predict_proba(X_test)[:, 1]
    
    accuracy = accuracy_score(y_test, y_pred)
    auc = roc_auc_score(y_test, y_pred_proba)
    
    print(f"\n{'='*50}")
    print(f"Model Evaluation Results")
    print(f"{'='*50}")
    print(f"Accuracy: {accuracy:.4f}")
    print(f"AUC-ROC: {auc:.4f}")
    print(f"\nConfusion Matrix:")
    print(confusion_matrix(y_test, y_pred))
    print(f"\nClassification Report:")
    print(classification_report(y_test, y_pred))
    print(f"{'='*50}\n")
    
    return {
        'accuracy': float(accuracy),
        'auc': float(auc),
        'confusion_matrix': confusion_matrix(y_test, y_pred).tolist()
    }


def save_model(model, feature_cols, file_path: str, metadata: dict = None):
    """Save the trained model and metadata."""
    os.makedirs(os.path.dirname(file_path), exist_ok=True)
    
    # Save model
    joblib.dump(model, file_path)
    print(f"Model saved to {file_path}")
    
    # Save metadata
    metadata_path = file_path.replace('.pkl', '_metadata.json')
    metadata = metadata or {}
    metadata.update({
        'feature_columns': feature_cols,
        'model_type': type(model).__name__,
        'trained_at': datetime.now().isoformat(),
    })
    
    with open(metadata_path, 'w') as f:
        json.dump(metadata, f, indent=2)
    print(f"Metadata saved to {metadata_path}")


def main():
    """Main training function."""
    print("="*50)
    print("BetTracer ML Model Training")
    print("="*50)
    
    # Load data - Direct from database (no export needed!)
    print("\n📊 Fetching training data from Supabase...")
    df = fetch_training_data_from_db()
    
    if len(df) == 0:
        print("❌ No training data available. Please add some completed bets (won/lost) to your database.")
        return
    
    # Prepare features
    print("\n🔧 Creating features...")
    X, y, feature_cols = prepare_features(df)
    
    if len(X) < 10:
        print(f"⚠️  Warning: Only {len(X)} samples available. Need at least 10 for training.")
        print("   Model will use placeholder predictions until more data is available.")
        return
    
    # Split data
    print("\n📊 Splitting data...")
    X_train, X_test, y_train, y_test = train_test_split(
        X, y, test_size=0.2, random_state=42, stratify=y if y.nunique() > 1 else None
    )
    
    print(f"Train set: {len(X_train)} samples")
    print(f"Test set: {len(X_test)} samples")
    
    # Train multiple models and compare
    models_to_try = ['xgboost', 'random_forest']
    if LIGHTGBM_AVAILABLE:
        models_to_try.append('lightgbm')
    best_model = None
    best_score = 0
    best_model_type = None
    best_metrics = None
    
    for model_type in models_to_try:
        print(f"\n{'='*50}")
        print(f"Training {model_type}...")
        print(f"{'='*50}")
        
        try:
            model = train_model(X_train, y_train, model_type=model_type)
            metrics = evaluate_model(model, X_test, y_test)
            
            if metrics['auc'] > best_score:
                best_score = metrics['auc']
                best_model = model
                best_model_type = model_type
                best_metrics = metrics
        except Exception as e:
            print(f"❌ Error training {model_type}: {e}")
            continue
    
    # Save best model
    if best_model:
        model_path = "models/model.pkl"
        save_model(best_model, feature_cols, model_path, {
            'best_model_type': best_model_type,
            'best_auc': best_score,
            'best_accuracy': best_metrics['accuracy'],
            'training_samples': len(X_train),
            'test_samples': len(X_test),
        })
        print(f"\n✅ Best model ({best_model_type}) saved with AUC: {best_score:.4f}")
    else:
        print("\n❌ No models were successfully trained.")
    
    print("\n" + "="*50)
    print("Training completed!")
    print("="*50)


if __name__ == "__main__":
    main()
