"use client";

import { useCallback, useState } from "react";

/**
 * Tracks which async action is running (by key), so its button can show a spinner
 * and refuse a second click until the server has answered.
 */
export function usePending() {
  const [pending, setPending] = useState<string | null>(null);
  const run = useCallback(async <T>(key: string, action: () => Promise<T>): Promise<T> => {
    setPending(key);
    try {
      return await action();
    } finally {
      setPending(null);
    }
  }, []);
  return { pending, run };
}
