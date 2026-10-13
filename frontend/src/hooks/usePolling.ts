import { useState, useEffect, useRef, useCallback } from 'react';

interface UsePollingOptions<T> {
  interval?: number; // Milliseconds, default 2000
  enabled?: boolean;
  shouldStop?: (data: T) => boolean;
  onError?: (error: any) => void;
  onSuccess?: (data: T) => void;
}

interface UsePollingResult<T> {
  data: T | null;
  error: Error | null;
  loading: boolean;
  isPolling: boolean;
  refetch: () => Promise<T | null>;
  stop: () => void;
  start: () => void;
}

export function usePolling<T>(
  fetcher: () => Promise<T>,
  options: UsePollingOptions<T> = {}
): UsePollingResult<T> {
  const {
    interval = 2000,
    enabled = true,
    shouldStop,
    onError,
    onSuccess,
  } = options;

  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isPolling, setIsPolling] = useState<boolean>(enabled);

  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  const shouldStopRef = useRef(shouldStop);
  shouldStopRef.current = shouldStop;

  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  const onSuccessRef = useRef(onSuccess);
  onSuccessRef.current = onSuccess;

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isMountedRef = useRef<boolean>(true);

  const executeFetch = useCallback(async (): Promise<T | null> => {
    try {
      const result = await fetcherRef.current();
      if (!isMountedRef.current) return null;

      setData(result);
      setError(null);
      onSuccessRef.current?.(result);

      if (shouldStopRef.current && shouldStopRef.current(result)) {
        setIsPolling(false);
      }

      return result;
    } catch (err: any) {
      if (!isMountedRef.current) return null;
      const errorObj = err instanceof Error ? err : new Error(String(err));
      setError(errorObj);
      onErrorRef.current?.(errorObj);
      return null;
    } finally {
      if (isMountedRef.current) {
        setLoading(false);
      }
    }
  }, []);

  const stop = useCallback(() => {
    setIsPolling(false);
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const start = useCallback(() => {
    setIsPolling(true);
  }, []);

  // Sync isPolling state when `enabled` prop changes
  useEffect(() => {
    setIsPolling(enabled);
  }, [enabled]);

  useEffect(() => {
    isMountedRef.current = true;

    // Initial fetch
    executeFetch();

    return () => {
      isMountedRef.current = false;
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [executeFetch]);

  useEffect(() => {
    if (!isPolling) {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      return;
    }

    const poll = async () => {
      await executeFetch();
      if (isMountedRef.current && isPolling) {
        timerRef.current = setTimeout(poll, interval);
      }
    };

    timerRef.current = setTimeout(poll, interval);

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [isPolling, interval, executeFetch]);

  return {
    data,
    error,
    loading,
    isPolling,
    refetch: executeFetch,
    stop,
    start,
  };
}
