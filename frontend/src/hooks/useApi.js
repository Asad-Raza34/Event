import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

/**
 * Runs an API call and exposes `{ data, meta, loading, error, reload, setData }`.
 * `deps` controls re-fetching; pass `{ enabled: false }` to fetch manually.
 */
export const useApi = (fetcher, deps = [], options = {}) => {
  const { enabled = true, initialData = null, keepPreviousData = false, onSuccess, onError } = options;
  const [data, setData] = useState(initialData);
  const [meta, setMeta] = useState(null);
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);
  const mounted = useRef(true);
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const run = useCallback(async () => {
    setLoading(true);
    if (!keepPreviousData) setError(null);
    try {
      const response = await fetcherRef.current();
      if (!mounted.current) return;
      const payload = response?.data !== undefined ? response.data : response;
      setData(payload);
      setMeta(response?.meta || null);
      setError(null);
      onSuccess?.(payload, response);
    } catch (caught) {
      if (!mounted.current) return;
      setError(caught);
      onError?.(caught);
    } finally {
      if (mounted.current) setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keepPreviousData, onSuccess, onError]);

  useEffect(() => {
    if (!enabled) {
      setLoading(false);
      return;
    }
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, reloadKey, ...deps]);

  const reload = useCallback(() => setReloadKey((key) => key + 1), []);

  return useMemo(
    () => ({ data, meta, loading, error, reload, setData, setMeta }),
    [data, meta, loading, error, reload],
  );
};

/** Imperative mutation helper: `const { run, loading, error } = useMutation(fn)`. */
export const useMutation = (fn) => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const run = useCallback(
    async (...args) => {
      setLoading(true);
      setError(null);
      try {
        const result = await fn(...args);
        setData(result?.data !== undefined ? result.data : result);
        return result;
      } catch (caught) {
        setError(caught);
        throw caught;
      } finally {
        setLoading(false);
      }
    },
    [fn],
  );

  const reset = useCallback(() => {
    setError(null);
    setData(null);
  }, []);

  return { run, loading, error, data, reset };
};

export default useApi;
