"use client";
import * as React from "react";
import { Loader2, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

/** Standard loading spinner with label */
export function LoadingState({
  label = "Loading…",
  icon: Icon = Loader2,
}: {
  label?: string;
  icon?: LucideIcon;
}) {
  return (
    <div className="flex items-center justify-center gap-2 py-12 text-muted-foreground">
      <Icon className="h-5 w-5 animate-spin" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

/** Skeleton placeholder for cards/rows */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn("skeleton-warm rounded", className)} />;
}

/** Standard empty state with icon, title, description, and optional CTA */
export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 py-12 text-center",
        className,
      )}
    >
      <div className="rounded-full bg-muted p-4">
        <Icon className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}

/** Standard page header for views */
export function ViewHeader({
  title,
  description,
  icon: Icon,
  actions,
}: {
  title: string;
  description?: string;
  icon?: LucideIcon;
  actions?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-3 mb-3">
      <div className="min-w-0">
        <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
          {Icon && <Icon className="h-5 w-5 text-primary" />}
          {title}
        </h1>
        {description && (
          <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">{actions}</div>
      )}
    </div>
  );
}

/** Stat tile for dashboards */
export function StatTile({
  label,
  value,
  sub,
  icon: Icon,
  tint = "bg-primary/10 text-primary",
  trend,
  onClick,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  icon: LucideIcon;
  tint?: string;
  trend?: { value: string; up: boolean };
  onClick?: () => void;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      onClick={onClick}
      className={cn(
        "group relative overflow-hidden rounded-lg border border-border bg-card p-3 text-left transition-all",
        onClick && "card-lift cursor-pointer hover:border-primary/40",
      )}
    >
      <div className="flex items-center justify-between">
        <div className={cn("rounded-lg p-1.5", tint)}>
          <Icon className="h-4 w-4" />
        </div>
        {trend && (
          <span
            className={cn(
              "flex items-center gap-0.5 text-[10px] font-medium",
              trend.up ? "text-emerald-600" : "text-rose-600",
            )}
          >
            {trend.up ? "↗" : "↘"} {trend.value}
          </span>
        )}
      </div>
      <p className="mt-1.5 text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] text-muted-foreground">{label}</p>
      {sub && <p className="text-[10px] text-muted-foreground/70">{sub}</p>}
    </Comp>
  );
}

/** Inline section divider with label */
export function SectionDivider({ label }: { label?: string }) {
  if (!label) return <div className="h-px bg-border my-3" />;
  return (
    <div className="flex items-center gap-2 my-3">
      <div className="h-px flex-1 bg-border" />
      <span className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <div className="h-px flex-1 bg-border" />
    </div>
  );
}
