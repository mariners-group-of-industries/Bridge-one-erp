"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface ResourceState<T> {
  key: string | null;
  version: number;
  data?: T;
  error?: Error;
}

/**
 * Loads data for `key` (null = don't load) and re-loads when the key changes or
 * `reload()` is called. Loading state is derived, so no state is set
 * synchronously inside the effect.
 */
export function useResource<T>(key: string | null, loader: () => Promise<T>) {
  const [version, setVersion] = useState(0);
  const [state, setState] = useState<ResourceState<T>>({ key: null, version: -1 });
  const loaderRef = useRef(loader);

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

  const current = state.key === key;
  const reload = useCallback(() => setVersion((value) => value + 1), []);
  const mutate = useCallback(
    (update: (data: T | undefined) => T) =>
      setState((previous) => ({ ...previous, data: update(previous.data) })),
    [],
  );

  return {
    data: current ? state.data : undefined,
    error: current ? state.error : undefined,
    loading: key !== null && (!current || state.version !== version),
    reload,
    mutate,
  };
}
