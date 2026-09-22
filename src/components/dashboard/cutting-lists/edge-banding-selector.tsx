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
      {/* Visual panel selector */}
      <div className="relative mx-auto" style={{ width: 96, height: 64 }}>
        {/* Top edge (long 1) */}
        <EdgeButton
          active={!!value.edgeLong1}
          onClick={() => toggle("edgeLong1")}
          className="absolute top-0 left-2 right-2 h-2.5"
          label="L1"
          orientation="h"
        />
        {/* Bottom edge (long 2) */}
        <EdgeButton
          active={!!value.edgeLong2}
          onClick={() => toggle("edgeLong2")}
          className="absolute bottom-0 left-2 right-2 h-2.5"
          label="L2"
          orientation="h"
        />
        {/* Left edge (short 1) */}
        <EdgeButton
          active={!!value.edgeShort1}
          onClick={() => toggle("edgeShort1")}
          className="absolute left-0 top-2 bottom-2 w-2.5"
          label="S1"
          orientation="v"
        />
        {/* Right edge (short 2) */}
        <EdgeButton
          active={!!value.edgeShort2}
          onClick={() => toggle("edgeShort2")}
          className="absolute right-0 top-2 bottom-2 w-2.5"
          label="S2"
          orientation="v"
        />
        {/* Center label */}
        <div className="absolute inset-2 flex items-center justify-center">
          <span className="text-[8px] text-muted-foreground font-mono">
            {anyBanded ? `${thk}mm` : "none"}
          </span>
        </div>
      </div>

      {/* Thickness quick-select */}
      <div className="flex items-center gap-1">
        <span className="text-[9px] text-muted-foreground uppercase">Thk</span>
        {[0.5, 1, 1.5, 2, 3].map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => onChange({ ...value, edgeThk: t })}
            className={cn(
              "h-5 w-7 rounded text-[9px] font-mono font-semibold transition-colors",
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
        "flex items-center justify-center transition-colors",
        active
          ? "bg-primary"
          : "bg-muted hover:bg-primary/30",
        orientation === "h" ? "rounded-sm" : "rounded-sm",
        className,
      )}
    >
      <span
        className={cn(
          "font-mono font-bold leading-none",
          orientation === "h" ? "text-[7px]" : "text-[7px]",
          active ? "text-primary-foreground" : "text-muted-foreground",
        )}
      >
        {label}
      </span>
    </button>
  );
}
