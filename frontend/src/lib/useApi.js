// ==============================================================
// useApi — small data-fetching hook
// --------------------------------------------------------------
// Standardizes the "load → spinner → render or error" pattern.
// Returns { data, loading, error, refetch }.
//
// Usage:
//   const { data, loading, error, refetch } = useApi(() => api.get('/vendors'));
//   if (loading) return <Spinner />;
//   if (error) return <ErrorState onRetry={refetch} />;
//   return <List items={data.data.vendors} />;
//
// Re-runs when `deps` change. Cancels stale requests so a fast
// re-fetch doesn't end up rendering the slower-arriving response.
// ==============================================================

import { useEffect, useState, useCallback, useRef } from "react";
import { errorMessage } from "./api";

export function useApi(fetcher, deps = []) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const reqIdRef = useRef(0);

  const run = useCallback(async () => {
    const myReq = ++reqIdRef.current;
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetcherRef.current();
      // If a newer request started after this one, drop our result
      if (myReq !== reqIdRef.current) return;
      setState({ data: res?.data ?? null, loading: false, error: null });
    } catch (err) {
      if (myReq !== reqIdRef.current) return;
      setState({ data: null, loading: false, error: errorMessage(err) });
    }
  }, []);

  useEffect(() => {
    run();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { ...state, refetch: run };
}

// Variant for actions you trigger manually (form submits, button clicks)
// Returns [callable, { loading, error }] tuple, so the call site can await.
export function useAction(fn) {
  const [state, setState] = useState({ loading: false, error: null });
  const fnRef = useRef(fn);
  fnRef.current = fn;

  const run = useCallback(async (...args) => {
    setState({ loading: true, error: null });
    try {
      const result = await fnRef.current(...args);
      setState({ loading: false, error: null });
      return { ok: true, data: result };
    } catch (err) {
      const msg = errorMessage(err);
      setState({ loading: false, error: msg });
      return { ok: false, error: msg, raw: err };
    }
  }, []);

  return [run, state];
}
