"use client";

import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Visual per-edge banding selector. Renders a panel outline with four
 * clickable edges. Long edges (top/bottom) reduce the CUT WIDTH; short edges
 * (left/right) reduce the CUT LENGTH.
 *
 *      ┌─────────────────────────────┐  ← long edge 1 (top)
 *      │                             │
 * short │                           │ short
 * edge 1 │       panel face          │ edge 2
 *      │                             │
 *      │                             │
 *      └─────────────────────────────┘  ← long edge 2 (bottom)
 *
 * Touch targets are bumped to ≥36px (WCAG 2.5.5) while the visible bar
 * stays compact (10px) for a clean visual frame.
 */
export interface EdgeBandingValue {
  edgeLong1?: boolean;
  edgeLong2?: boolean;
  edgeShort1?: boolean;
  edgeShort2?: boolean;
  edgeThk?: number;
}

interface Props {
  value: EdgeBandingValue;
  onChange: (v: EdgeBandingValue) => void;
  className?: string;
}

export function EdgeBandingSelector({ value, onChange, className }: Props) {
  const thk = value.edgeThk ?? 1;
  const anyBanded =
    value.edgeLong1 || value.edgeLong2 || value.edgeShort1 || value.edgeShort2;

  function toggle(key: keyof EdgeBandingValue) {
    onChange({ ...value, [key]: !value[key] });
  }

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      {/* Visual panel selector — sized so each edge has a 36px touch target
          without overlapping its neighbours. */}
      <div className="relative mx-auto" style={{ width: 144, height: 108 }}>
        {/* Top edge (long 1) — full width, 36px touch target */}
        <EdgeButton
          active={!!value.edgeLong1}
          onClick={() => toggle("edgeLong1")}
          className="absolute top-0 left-0 right-0"
          label="L1"
          orientation="h"
        />
        {/* Bottom edge (long 2) */}
        <EdgeButton
          active={!!value.edgeLong2}
          onClick={() => toggle("edgeLong2")}
          className="absolute bottom-0 left-0 right-0"
          label="L2"
          orientation="h"
        />
        {/* Left edge (short 1) — between top and bottom edges */}
        <EdgeButton
          active={!!value.edgeShort1}
          onClick={() => toggle("edgeShort1")}
          className="absolute left-0 top-9 bottom-9"
          label="S1"
          orientation="v"
        />
        {/* Right edge (short 2) */}
        <EdgeButton
          active={!!value.edgeShort2}
          onClick={() => toggle("edgeShort2")}
          className="absolute right-0 top-9 bottom-9"
          label="S2"
          orientation="v"
        />
        {/* Center label */}
        <div className="absolute inset-9 flex items-center justify-center pointer-events-none">
          <span className="text-[8px] text-muted-foreground font-mono">
            {anyBanded ? `${thk}mm` : "none"}
          </span>
        </div>
      </div>

      {/* Thickness quick-select — bumped to h-9 (36px) for WCAG 2.5.5 */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-muted-foreground uppercase">Thk</span>
        {[0.5, 1, 1.5, 2, 3].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ ...value, edgeThk: t })}
            className={cn(
              "h-9 min-w-[36px] rounded px-2 text-[9px] font-mono font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
              thk === t
                ? "bg-primary text-primary-foreground"
                : "bg-muted text-muted-foreground hover:bg-muted/70",
            )}
          >
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

function EdgeButton({
  active,
  onClick,
  className,
  label,
  orientation,
}: {
  active: boolean;
  onClick: () => void;
  className?: string;
  label: string;
  orientation: "h" | "v";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} edge ${active ? "banded" : "unbanded"}`}
      aria-pressed={active}
      aria-label={`${label} edge banding`}
      className={cn(
        // Touch target is the full 36px button (WCAG 2.5.5). The visible bar
        // is rendered as a thin inner span so the visual frame stays compact.
        "group flex min-h-[36px] min-w-[36px] items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-1",
        className,
      )}
    >
      <span
        className={cn(
          "pointer-events-none block rounded-sm transition-colors",
          orientation === "h" ? "h-2.5 w-full" : "w-2.5 h-full",
          active
            ? "bg-primary"
            : "bg-muted group-hover:bg-primary/30",
        )}
      />
      <span
        className={cn(
          "pointer-events-none absolute font-mono font-bold leading-none text-[7px]",
          active ? "text-primary-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}
