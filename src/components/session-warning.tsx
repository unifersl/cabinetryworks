"use client";

import * as React from "react";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Loader2, LogIn, Clock } from "lucide-react";
import { toast } from "sonner";

/**
 * Session inactivity warning.
 *
 * The server enforces an 8-hour absolute session cap (SESSION_MAX_AGE) and the
 * app shell auto-logs-out after 30 minutes of inactivity (INACTIVITY_TIMEOUT).
 *
 * This component shows a non-blocking warning dialog 5 minutes BEFORE that
 * 30-minute inactivity threshold fires, giving the user a chance to extend.
 *
 * Activity events tracked: mousemove, mousedown, keydown, touchstart, scroll,
 * and window focus. Any such event resets the inactivity countdown.
 */

const WARN_AFTER_MS = 25 * 60 * 1000; // 25 min → 5 min before 30-min logout
const CHECK_INTERVAL_MS = 1000; // 1s tick for countdown
const ACTIVITY_EVENTS: Array<keyof WindowEventMap> = [
  "mousemove",
  "mousedown",
  "keydown",
  "touchstart",
  "scroll",
];

export function SessionWarning() {
  const { logout, refresh } = useAuth();
  const [showWarning, setShowWarning] = React.useState(false);
  const [secondsLeft, setSecondsLeft] = React.useState(5 * 60); // 5:00 countdown
  const [extending, setExtending] = React.useState(false);

  // Use refs to avoid re-subscribing listeners on every state change
  const lastActivityRef = React.useRef<number>(Date.now());
  const showWarningRef = React.useRef(false);

  const markActivity = React.useCallback(() => {
    lastActivityRef.current = Date.now();
    if (showWarningRef.current) {
      showWarningRef.current = false;
      setShowWarning(false);
      setSecondsLeft(5 * 60);
    }
  }, []);

  // Track user activity
  React.useEffect(() => {
    const onActivity = () => markActivity();
    const onFocus = () => markActivity();

    ACTIVITY_EVENTS.forEach((evt) =>
      window.addEventListener(evt, onActivity, { passive: true })
    );
    window.addEventListener("focus", onFocus);

    return () => {
      ACTIVITY_EVENTS.forEach((evt) =>
        window.removeEventListener(evt, onActivity)
      );
      window.removeEventListener("focus", onFocus);
    };
  }, [markActivity]);

  // Tick: every 1s, check if we should show the warning / update countdown
  React.useEffect(() => {
    const tick = () => {
      const idleMs = Date.now() - lastActivityRef.current;
      if (idleMs >= WARN_AFTER_MS) {
        // Remaining time before the 30-min logout fires
        const remainingMs = 30 * 60 * 1000 - idleMs;
        const remainingSec = Math.max(0, Math.floor(remainingMs / 1000));
        setSecondsLeft(remainingSec);
        if (!showWarningRef.current) {
          showWarningRef.current = true;
          setShowWarning(true);
        }
      }
    };
    const interval = window.setInterval(tick, CHECK_INTERVAL_MS);
    return () => window.clearInterval(interval);
  }, []);

  // Stay logged in: refresh session, reset activity
  async function handleStayLoggedIn() {
    setExtending(true);
    try {
      await refresh(); // Calls /api/auth/me → confirms session validity
      lastActivityRef.current = Date.now();
      showWarningRef.current = false;
      setShowWarning(false);
      setSecondsLeft(5 * 60);
      toast.success("Session extended");
    } catch {
      toast.error("Could not extend session. Please sign in again.");
      await logout();
    } finally {
      setExtending(false);
    }
  }

  // Sign out now
  async function handleSignOut() {
    await logout();
  }

  // Don't render anything if no warning is showing
  if (!showWarning) return null;

  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const timeLabel = `${mins}:${secs.toString().padStart(2, "0")}`;

  return (
    <AlertDialog open={showWarning} onOpenChange={(o) => {
      // Prevent closing by clicking outside / pressing Escape
      if (!o) return;
    }}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-amber-600" />
            Session expiring soon
          </AlertDialogTitle>
          <AlertDialogDescription asChild>
            <div>
              <p>
                Your session will expire in{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {timeLabel}
                </span>{" "}
                due to inactivity. Any unsaved changes may be lost.
              </p>
              <p className="mt-2 text-xs">
                Click <strong>Stay logged in</strong> to extend your session,
                or <strong>Sign out</strong> to leave now.
              </p>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel
            onClick={handleSignOut}
            className="gap-2"
          >
            <LogIn className="h-4 w-4 rotate-180" />
            Sign out
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              void handleStayLoggedIn();
            }}
            disabled={extending}
            className="gap-2"
          >
            {extending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Clock className="h-4 w-4" />
            )}
            Stay logged in
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
