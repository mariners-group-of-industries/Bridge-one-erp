"use client";

import { CornerDownLeft, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useId, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { cn } from "@/lib/cn";
import { searchEntries } from "@/lib/navigation/registry";
import { filterEntries } from "@/lib/navigation/search";
import { Kbd } from "@/components/ui/kbd";

const ENTRIES = searchEntries();

/** ERPNext "awesomebar": jump to any workspace or page (Ctrl+K / Ctrl+G). */
export function Awesomebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog || !open) return;
    if (!dialog.open) dialog.showModal();
    return () => dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-label="Search"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      className="mx-auto mt-[12vh] w-[calc(100%-2rem)] max-w-xl rounded-xl bg-surface p-0 text-ink shadow-dropdown backdrop:bg-black/30"
    >
      {/* Remounted on every open so the query and selection start fresh. */}
      {open && <SearchPanel onClose={onClose} />}
    </dialog>
  );
}

function SearchPanel({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const results = useMemo(() => filterEntries(ENTRIES, query), [query]);
  const activeIndex = Math.min(active, Math.max(results.length - 1, 0));

  function go(href: string) {
    onClose();
    if (href.startsWith("http")) {
      window.open(href, "_blank", "noopener,noreferrer");
    } else {
      router.push(href);
    }
  }

  function onKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (results.length === 0) return;
      const offset = event.key === "ArrowDown" ? 1 : -1;
      setActive((activeIndex + offset + results.length) % results.length);
    } else if (event.key === "Enter" && results[activeIndex]) {
      event.preventDefault();
      go(results[activeIndex].href);
    }
  }

  return (
    <div className="flex flex-col">
      <div className="flex items-center gap-2 border-b border-line px-4">
        <Search aria-hidden="true" className="size-4 text-ink-faint" />
        <input
          autoFocus
          role="combobox"
          aria-expanded="true"
          aria-controls={listId}
          aria-activedescendant={results[activeIndex] ? `${listId}-${activeIndex}` : undefined}
          aria-autocomplete="list"
          aria-label="Search workspaces and pages"
          placeholder="Search or type a command"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActive(0);
          }}
          onKeyDown={onKeyDown}
          className="h-12 flex-1 bg-transparent text-base text-ink outline-none placeholder:text-ink-faint"
        />
        <Kbd>Esc</Kbd>
      </div>
      <ul id={listId} role="listbox" aria-label="Results" className="max-h-80 overflow-y-auto p-1.5">
        {results.length === 0 && <li className="px-3 py-6 text-center text-sm text-ink-faint">No results for “{query}”</li>}
        {results.map((entry, index) => (
          <li
            key={entry.href}
            id={`${listId}-${index}`}
            role="option"
            aria-selected={index === activeIndex}
            onMouseMove={() => setActive(index)}
            onClick={() => go(entry.href)}
            className={cn(
              "flex cursor-pointer items-center gap-3 rounded-lg px-3 py-2",
              index === activeIndex && "bg-control",
            )}
          >
            <div className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm text-ink">{entry.label}</span>
              {entry.description && <span className="truncate text-xs text-ink-faint">{entry.description}</span>}
            </div>
            <span className="text-xs text-ink-faint">{entry.group}</span>
            {index === activeIndex && <CornerDownLeft aria-hidden="true" className="size-3.5 text-ink-faint" />}
          </li>
        ))}
      </ul>
    </div>
  );
}
