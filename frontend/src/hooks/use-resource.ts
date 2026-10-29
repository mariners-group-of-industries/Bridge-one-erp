"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResourceState<T> {
  key: string | null;
  version: number;
  data?: T;
  error?: Error;
}

export interface ResourceOptions {
  /** Load again when the user comes back to the browser tab (others may have changed the data). */
  refreshOnFocus?: boolean;
  /** Load again every this many milliseconds while the tab is visible. */
  refreshInterval?: number;
}

/**
 * Loads data for `key` (null = don't load) and re-loads when the key changes or
 * `reload()` is called. Loading state is derived, so no state is set
 * synchronously inside the effect. Lists and dashboards can opt in to refreshing
 * on focus and on an interval, so changes made elsewhere show without a page reload.
 */
export function useResource<T>(key: string | null, loader: () => Promise<T>, options: ResourceOptions = {}) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({ key: null, version: -1 });
  const loaderRef = useRef(loader);
  const { refreshOnFocus = false, refreshInterval } = options;

  useEffect(() => {
    loaderRef.current = loader;
  });

  useEffect(() => {
    if (key === null) return;
    let cancelled = false;
    loaderRef.current().then(
      (data) => !cancelled && setState({ key, version, data }),
      (error: unknown) =>
        !cancelled &&
        setState({ key, version, error: error instanceof Error ? error : new Error(String(error)) }),
    );
    return () => {
      cancelled = true;
    };
  }, [key, version]);

  const reload = useCallback(() => setVersion((value) => value + 1), []);

  useEffect(() => {
    if (key === null || (!refreshOnFocus && !refreshInterval)) return;
    const refreshIfVisible = () => {
      if (document.visibilityState === "visible") reload();
    };
    if (refreshOnFocus) {
      window.addEventListener("focus", refreshIfVisible);
      document.addEventListener("visibilitychange", refreshIfVisible);
    }
    const timer = refreshInterval ? window.setInterval(refreshIfVisible, refreshInterval) : undefined;
    return () => {
      window.removeEventListener("focus", refreshIfVisible);
      document.removeEventListener("visibilitychange", refreshIfVisible);
      if (timer !== undefined) window.clearInterval(timer);
    };
  }, [key, refreshOnFocus, refreshInterval, reload]);

  const current = state.key === key;
  const mutate = useCallback(
    (update: (data: T | undefined) => T) =>
      setState((previous) => ({ ...previous, data: update(previous.data) })),
    [],
  );

  return {
    data: current ? state.data : undefined,
    // Keep showing the last data while a refresh of the same key runs.
    error: current ? state.error : undefined,
    loading: key !== null && (!current || state.version !== version),
    reload,
    mutate,
  };
}
