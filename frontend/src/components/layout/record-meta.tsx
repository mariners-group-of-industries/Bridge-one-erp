"use client";

import { formatDateTime, timeAgo } from "@/lib/format";

/** Footer line under a form, like ERPNext's timeline ("Last updated 5 minutes ago"). */
export function RecordMeta({ updatedAt }: { updatedAt: string }) {
  return (
    <p className="mt-3 px-1 text-xs text-ink-faint">
      Last updated{" "}
      <time dateTime={updatedAt} title={formatDateTime(updatedAt)}>
        {timeAgo(updatedAt)}
      </time>
    </p>
  );
}
