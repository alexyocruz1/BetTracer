import { useCallback, useMemo, useState } from 'react';
import { apiClient } from '@/lib/api/client';
import {
  MLPredictionRequest,
  MLPredictionResponse,
} from '@/types';

interface UseMLPredictionResult {
  prediction: MLPredictionResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  predict: (payload: MLPredictionRequest) => Promise<void>;
  reset: () => void;
}

export function useMLPrediction(): UseMLPredictionResult {
  const [prediction, setPrediction] = useState<MLPredictionResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const predict = useCallback(async (payload: MLPredictionRequest) => {
    if (!payload.legs || payload.legs.length === 0) {
      setError('Add at least one leg to generate a prediction.');
      setPrediction(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const { data } = await apiClient.post<MLPredictionResponse>('/api/ml/predict', payload);
      setPrediction(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      const message =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to fetch ML prediction';
      setError(message);
      setPrediction(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const reset = useCallback(() => {
    setPrediction(null);
    setError(null);
    setLastUpdated(null);
  }, []);

  return useMemo(
    () => ({
      prediction,
      loading,
      error,
      lastUpdated,
      predict,
      reset,
    }),
    [prediction, loading, error, lastUpdated, predict, reset]
  );
}

