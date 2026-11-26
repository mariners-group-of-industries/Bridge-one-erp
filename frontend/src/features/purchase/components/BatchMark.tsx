"use client";

import { useQuery } from "@tanstack/react-query";
import { Layers } from "lucide-react";
import { useMemo } from "react";
import type { Item } from "@bridgeone/contracts";
import { fetchApi } from "@/lib/api";

/** Ids of the items whose Item Profile Tracking is Batch (shares the purchase item list cache). */
export function useBatchItemIds(): Set<string> {
  const { data } = useQuery<Item[]>({ queryKey: ["items"], queryFn: () => fetchApi("/master/items") });
  return useMemo(() => new Set((data ?? []).filter((item) => item.tracking === "BATCH").map((item) => item.id)), [data]);
}

/** Small batch sign shown before the name of a batch-tracked item. */
export function BatchMark() {
  return (
    <span
      title="Batch tracked item"
      className="mr-1 inline-flex size-4 shrink-0 items-center justify-center rounded-sm bg-amber-500/15 align-[-3px] text-amber-600 dark:text-amber-400"
    >
      <Layers className="size-3" aria-hidden="true" />
      <span className="sr-only">Batch tracked: </span>
    </span>
  );
}
