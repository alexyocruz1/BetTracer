import { useCallback, useMemo, useState, useRef } from 'react';
import { apiClient } from '@/lib/api/client';
import {
  MLPredictRequest,
  MLPredictResponse,
} from '@/types';

interface UseMLPredictionResult {
  prediction: MLPredictResponse | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  predict: (payload: MLPredictRequest) => Promise<void>;
  reset: () => void;
}

// Debounce utility
function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout | null = null;
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

export function useMLPrediction(): UseMLPredictionResult {
  const [prediction, setPrediction] = useState<MLPredictResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  
  // Track pending requests to prevent duplicate calls
  const pendingRequestRef = useRef<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  const predict = useCallback(async (payload: MLPredictRequest) => {
    if (!payload.legs || payload.legs.length === 0) {
      setError('Add at least one leg to generate a prediction.');
      setPrediction(null);
      return;
    }

    // Create a unique key for this request
    const requestKey = JSON.stringify(payload);
    
    // If same request is already pending, don't make another
    if (pendingRequestRef.current === requestKey && loading) {
      return;
    }

    // Cancel previous request if different
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    pendingRequestRef.current = requestKey;
    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    setLoading(true);
    setError(null);

    try {
      const { data } = await apiClient.post<MLPredictResponse>('/api/ml/predict', payload, {
        signal: abortController.signal,
      });
      
      // Only update if request wasn't aborted
      if (!abortController.signal.aborted) {
        setPrediction(data);
        setLastUpdated(new Date());
        pendingRequestRef.current = null;
      }
    } catch (err: any) {
      // Don't set error if request was aborted
      if (err.name === 'AbortError' || abortController.signal.aborted) {
        return;
      }
      
      const message =
        err?.response?.data?.error?.message ||
        err?.message ||
        'Failed to fetch ML prediction';
      setError(message);
      setPrediction(null);
      pendingRequestRef.current = null;
    } finally {
      if (!abortController.signal.aborted) {
        setLoading(false);
      }
    }
  }, [loading]);

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

