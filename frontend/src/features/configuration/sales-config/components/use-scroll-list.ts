"use client";

import { useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api/client";

export interface ScrollList<R> {
  rows: R[];
  /** null until the first page has loaded. */
  total: number | null;
  loading: boolean;
  error: string | null;
  hasMore: boolean;
  retry: () => void;
}

/**
 * Loads a server-paged list page by page as `sentinel` (placed after the last
 * row) scrolls into view. A new filter or `reloadKey` starts again from page 1.
 * `load` must be stable (a module-level API function).
 */
export function useScrollList<F, R>(filter: F, reloadKey: number, load: (filter: F, page: number, pageSize: number) => Promise<{ rows: R[]; total: number }>, pageSize = 50) {
  const filterJson = JSON.stringify(filter);
  const queryKey = `${filterJson}|${reloadKey}`;
  const [loadedKey, setLoadedKey] = useState("");
  const [rows, setRows] = useState<R[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [retry, setRetry] = useState(0);
  const [settled, setSettled] = useState<{ key: string; error: string | null }>({ key: "", error: null });
  const sentinel = useRef<HTMLDivElement>(null);

  if (loadedKey !== queryKey) {
    setLoadedKey(queryKey);
    setRows([]);
    setTotal(null);
    setPage(1);
  }
  const requestKey = `${queryKey}|${page}|${retry}`;
  const loading = settled.key !== requestKey;
  const error = settled.key === requestKey ? settled.error : null;

  useEffect(() => {
    let cancelled = false;
    load(JSON.parse(filterJson) as F, page, pageSize)
      .then((result) => {
        if (cancelled) return;
        setTotal(result.total);
        setRows((current) => (page === 1 ? result.rows : [...current, ...result.rows]));
        setSettled({ key: requestKey, error: null });
      })
      .catch((err) => {
        if (!cancelled) setSettled({ key: requestKey, error: errorMessage(err) });
      });
    return () => {
      cancelled = true;
    };
  }, [filterJson, page, requestKey, load, pageSize]);

  const hasMore = total !== null && rows.length < total;
  useEffect(() => {
    const element = sentinel.current;
    if (!element || !hasMore || loading) return;
    const observer = new IntersectionObserver((entries) => {
      if (entries.some((entry) => entry.isIntersecting)) setPage((p) => p + 1);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [hasMore, loading]);

  const list: ScrollList<R> = { rows, total, loading, error, hasMore, retry: () => setRetry((n) => n + 1) };
  return { list, sentinel };
}
