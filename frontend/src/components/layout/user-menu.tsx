"use client";

import { Keyboard, Moon, Sun } from "lucide-react";
import { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { DropdownMenu } from "@/components/ui/dropdown-menu";
import { Kbd } from "@/components/ui/kbd";
import { applyTheme, readTheme } from "@/lib/theme";

export const SHORTCUTS: { keys: string[]; action: string }[] = [
  { keys: ["Ctrl", "K"], action: "Search workspaces and pages (also Ctrl + G)" },
  { keys: ["Ctrl", "S"], action: "Save the open form" },
  { keys: ["Ctrl", "B"], action: "Show or hide the sidebar" },
  { keys: ["Esc"], action: "Close a dialog or menu" },
];

/**
 * Avatar menu. Authentication is not implemented yet, so the user is the
 * development actor; replace the initials once a session provider exists.
 */
export function UserMenu() {
  const [showShortcuts, setShowShortcuts] = useState(false);

  return (
    <>
      <DropdownMenu
        items={[
          {
            label: "Toggle dark mode",
            icon: <ThemeIcon />,
            onSelect: () => applyTheme(readTheme() === "dark" ? "light" : "dark"),
          },
          { label: "Keyboard shortcuts", icon: <Keyboard />, onSelect: () => setShowShortcuts(true) },
        ]}
        trigger="DV"
        triggerLabel="User menu"
        triggerClassName="flex size-7 items-center justify-center rounded-full bg-control text-xs font-semibold text-ink-muted hover:bg-hover focus-visible:outline-2"
      />
      <Dialog open={showShortcuts} title="Keyboard shortcuts" onClose={() => setShowShortcuts(false)}>
        <dl className="flex flex-col divide-y divide-line text-sm">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.action} className="flex items-center justify-between gap-4 py-2">
              <dt className="text-ink-muted">{shortcut.action}</dt>
              <dd className="flex gap-1">
                {shortcut.keys.map((key) => (
                  <Kbd key={key}>{key}</Kbd>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </Dialog>
    </>
  );
}

/** Both icons are rendered; CSS picks the one for the active theme (no hydration mismatch). */
function ThemeIcon() {
  return (
    <>
      <Moon className="dark:hidden" />
      <Sun className="hidden dark:block" />
    </>
  );
}
