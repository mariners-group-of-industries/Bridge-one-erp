import type { SearchEntry } from "./registry";

/**
 * Awesomebar matching: every word of the query must appear in the label,
 * group, description or keywords. Label-prefix matches rank first.
 */
export function filterEntries(entries: readonly SearchEntry[], query: string): SearchEntry[] {
  const words = query.trim().toLowerCase().split(/\s+/).filter(Boolean);
  if (words.length === 0) return [...entries];

  const haystack = (entry: SearchEntry) =>
    [entry.label, entry.group, entry.description ?? "", ...(entry.keywords ?? [])].join(" ").toLowerCase();

  return entries
    .filter((entry) => {
      const text = haystack(entry);
      return words.every((word) => text.includes(word));
    })
    .map((entry, index) => ({ entry, index, rank: entry.label.toLowerCase().startsWith(words[0]) ? 0 : 1 }))
    .sort((a, b) => a.rank - b.rank || a.index - b.index)
    .map(({ entry }) => entry);
}
