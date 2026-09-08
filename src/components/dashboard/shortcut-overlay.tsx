"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Keyboard } from "lucide-react";

type Shortcut = {
  keys: string;
  description: string;
};

type ShortcutGroup = {
  title: string;
  shortcuts: Shortcut[];
};

const SHORTCUT_GROUPS: ShortcutGroup[] = [
  {
    title: "Global",
    shortcuts: [
      { keys: "⌘K", description: "Open command palette / global search" },
      { keys: "?", description: "Show this help overlay" },
      { keys: "Esc", description: "Close dialog, menu, or overlay" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: "Click", description: "Click sidebar items to navigate" },
      { keys: "⌘K", description: "Opens search — jump to any view by name" },
    ],
  },
  {
    title: "Job Orders",
    shortcuts: [
      { keys: "Del / ⌫", description: "Delete selected job" },
      { keys: "Ctrl+D", description: "Duplicate selected job" },
      { keys: "Ctrl+A", description: "Select all jobs" },
      { keys: "↑ ↓ ← →", description: "Nudge selected job by 1mm" },
      { keys: "Shift+↑ ↓ ← →", description: "Nudge selected job by 10mm" },
      { keys: "Esc", description: "Deselect current job" },
    ],
  },
  {
    title: "Elevation Canvas",
    shortcuts: [
      { keys: "+ / −", description: "Zoom in / out" },
      { keys: "0", description: "Reset zoom to 100%" },
      { keys: "F", description: "Toggle fullscreen" },
      { keys: "Space + Drag", description: "Pan the canvas" },
      { keys: "Del", description: "Delete selected cabinet" },
      { keys: "Ctrl+Z", description: "Undo last action" },
      { keys: "Ctrl+Shift+Z", description: "Redo last undone action" },
      { keys: "Ctrl+A", description: "Select all cabinets" },
      { keys: "Shift+Click", description: "Add cabinet to multi-selection" },
      { keys: "Shift+Drag", description: "Marquee / box select" },
    ],
  },
];

/**
 * Global keyboard-shortcut help overlay.
 * Shows when the user presses `?` (which is Shift+/ on a US keyboard).
 * Closes on Esc or by clicking outside (default Dialog behavior).
 *
 * The listener ignores key events originating from form fields so that
 * typing `?` into a search box, textarea, or contenteditable doesn't
 * trigger the overlay.
 */
export function ShortcutOverlay() {
  const [open, setOpen] = React.useState(false);

  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      // Only react to the literal "?" character (Shift+/ on most layouts).
      if (e.key !== "?") return;

      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName;
        const isEditable =
          tag === "INPUT" ||
          tag === "TEXTAREA" ||
          tag === "SELECT" ||
          target.isContentEditable;
        if (isEditable) return;
      }

      e.preventDefault();
      setOpen((v) => !v);
    }

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="sm:max-w-[640px] max-h-[85vh] overflow-y-auto scrollbar-warm">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Keyboard className="h-5 w-5" />
            </div>
            <div>
              <DialogTitle>Keyboard Shortcuts</DialogTitle>
              <DialogDescription>
                Press <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">?</kbd> anywhere to open this help. Press <kbd className="rounded border border-border bg-muted px-1 font-mono text-[10px]">Esc</kbd> to close.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-5 pt-2">
          {SHORTCUT_GROUPS.map((group) => (
            <section key={group.title} aria-labelledby={`grp-${group.title}`}>
              <h3
                id={`grp-${group.title}`}
                className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground"
              >
                {group.title}
              </h3>
              <ul className="space-y-1.5">
                {group.shortcuts.map((s) => (
                  <li
                    key={s.keys + s.description}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50"
                  >
                    <span className="text-sm text-foreground/90">{s.description}</span>
                    <kbd className="shrink-0 rounded border border-border bg-muted px-2 py-0.5 font-mono text-[11px] text-foreground/80">
                      {s.keys}
                    </kbd>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
