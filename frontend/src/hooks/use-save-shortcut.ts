"use client";

import { useEffect, useRef } from "react";

/** Ctrl/Cmd + S runs `onSave` (ERPNext's save shortcut) while `enabled`. */
export function useSaveShortcut(onSave: () => void, enabled = true) {
  const handler = useRef(onSave);

  useEffect(() => {
    handler.current = onSave;
  });

  useEffect(() => {
    if (!enabled) return;
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        handler.current();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [enabled]);
}
