import * as React from "react"
import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

/**
 * Returns `false` on the initial (SSR + first client) render and `true`
 * after the component has mounted on the client. Use this to defer
 * rendering of date/time-dependent content so that the server-rendered
 * HTML matches the first client render — avoiding React hydration
 * mismatches around midnight or month boundaries.
 */
export function useMounted(): boolean {
  const [mounted, setMounted] = React.useState(false)
  React.useEffect(() => {
    setMounted(true)
  }, [])
  return mounted
}

/**
 * Escape a user-controlled string before interpolating it into raw HTML
 * (e.g., for `window.open()` + `document.write()` print flows). Prevents
 * XSS in the print window which inherits the opener's origin.
 */
export function escapeHtml(s: unknown): string {
  if (s === null || s === undefined) return ""
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;")
}
