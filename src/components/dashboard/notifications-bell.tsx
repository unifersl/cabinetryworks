"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { activityApi, type ActivityEvent } from "@/lib/api";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  Bell,
  ClipboardList,
  UserCheck,
  RefreshCw,
  Ruler,
  Scissors,
  ChevronRight,
  CheckCheck,
} from "lucide-react";

const EVENT_ICONS: Record<ActivityEvent["type"], typeof Bell> = {
  job_created: ClipboardList,
  job_assigned: UserCheck,
  job_status: RefreshCw,
  measurement: Ruler,
  cutting_list: Scissors,
};

const EVENT_TINTS: Record<ActivityEvent["type"], string> = {
  job_created: "bg-orange-500/10 text-orange-600",
  job_assigned: "bg-violet-500/10 text-violet-600",
  job_status: "bg-sky-500/10 text-sky-600",
  measurement: "bg-teal-500/10 text-teal-600",
  cutting_list: "bg-rose-500/10 text-rose-600",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}

interface NotificationsBellProps {
  onNavigate?: (view: string, entityId?: string) => void;
}

export function NotificationsBell({ onNavigate }: NotificationsBellProps) {
  const [open, setOpen] = React.useState(false);
  const [seenIds, setSeenIds] = React.useState<Set<string>>(new Set());
  const [hasOpened, setHasOpened] = React.useState(false);

  const { data } = useQuery({
    queryKey: ["activity", 15],
    queryFn: () => activityApi.list(15),
    refetchInterval: 120_000, // refresh every 2 min
  });

  const events = data?.events ?? [];

  // Track unread count (events newer than last-seen)
  const unreadCount = React.useMemo(() => {
    if (!hasOpened) return Math.min(events.length, 5);
    return events.filter((e) => !seenIds.has(e.id)).length;
  }, [events, seenIds, hasOpened]);

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      setHasOpened(true);
      // Mark all current events as seen
      setSeenIds(new Set(events.map((e) => e.id)));
    }
  }

  function handleEventClick(event: ActivityEvent) {
    setOpen(false);
    if (event.entityType === "job") {
      onNavigate?.("job-orders", event.entityId);
    } else if (event.entityType === "measurement") {
      onNavigate?.("measurements");
    } else if (event.entityType === "cutting_list") {
      onNavigate?.("cutting-lists");
    }
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="relative"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground ring-2 ring-background">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-80 p-0 sm:w-96"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold">Recent Activity</span>
          </div>
          {unreadCount > 0 && (
            <Badge variant="secondary" className="text-[10px]">
              {unreadCount} new
            </Badge>
          )}
        </div>

        {/* Events list */}
        {events.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-10 text-center">
            <div className="rounded-full bg-muted p-3">
              <Bell className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">No activity yet</p>
            <p className="text-xs text-muted-foreground">
              Recent events will appear here.
            </p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="divide-y divide-border">
              {events.map((event) => {
                const Icon = EVENT_ICONS[event.type] ?? Bell;
                const tint = EVENT_TINTS[event.type] ?? "bg-muted text-muted-foreground";
                const isNew = !seenIds.has(event.id) && !hasOpened;
                return (
                  <button
                    key={event.id}
                    onClick={() => handleEventClick(event)}
                    className="group flex w-full items-start gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
                  >
                    <div className={`mt-0.5 shrink-0 rounded-md p-1.5 ${tint}`}>
                      <Icon className="h-3.5 w-3.5" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <p className="truncate text-sm font-medium">
                          {event.title}
                        </p>
                        {isNew && (
                          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-primary" />
                        )}
                      </div>
                      <p className="truncate text-xs text-muted-foreground">
                        {event.description}
                      </p>
                      <div className="mt-1 flex items-center gap-2 text-[10px] text-muted-foreground/70">
                        <span>{timeAgo(event.timestamp)}</span>
                        {event.actor && (
                          <>
                            <span>·</span>
                            <span className="truncate">by {event.actor}</span>
                          </>
                        )}
                      </div>
                    </div>
                    <ChevronRight className="mt-1 h-3.5 w-3.5 shrink-0 text-muted-foreground/40 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}

        {/* Footer */}
        <Separator />
        <div className="flex items-center justify-between px-4 py-2.5">
          <span className="text-[10px] text-muted-foreground">
            Updates every 30 seconds
          </span>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setSeenIds(new Set(events.map((e) => e.id)))}
            disabled={unreadCount === 0}
          >
            <CheckCheck className="h-3 w-3" />
            Mark all read
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
