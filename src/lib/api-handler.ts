import { NextResponse } from "next/server";

/**
 * Converts a technical/Prisma error into a user-friendly message that is
 * safe to surface to end users. The original technical message is still
 * preserved in the `detail` field (only in non-production) for debugging.
 */
function friendlyError(err: unknown): { message: string; status: number } {
  const raw = err instanceof Error ? err.message : String(err);
  const lower = raw.toLowerCase();
  let status = 500;
  let message = "Something went wrong. Please try again.";

  // Prisma known errors carry a `code` property
  const prismaCode =
    err && typeof err === "object" && "code" in err
      ? String((err as { code?: unknown }).code ?? "")
      : "";

  // Unique constraint violation (P2002)
  if (prismaCode === "P2002" || lower.includes("unique constraint")) {
    status = 409;
    message = "An item with this name already exists.";
  }
  // Foreign key constraint failure (P2003) — record is referenced elsewhere
  else if (
    prismaCode === "P2003" ||
    lower.includes("foreign key constraint") ||
    lower.includes("foreign key")
  ) {
    status = 400;
    message =
      "This item is in use and cannot be deleted. Remove any related records first.";
  }
  // Record not found (P2025)
  else if (prismaCode === "P2025" || lower.includes("record not found")) {
    status = 404;
    message = "We couldn't find that record. It may have been deleted already.";
  }
  // Missing required field (validation)
  else if (
    lower.includes("required field") ||
    lower.includes("missing required") ||
    lower.includes("is required") ||
    lower.includes("argument is missing")
  ) {
    status = 400;
    message = "Please fill in all required fields.";
  }
  // Auth: unauthorized
  else if (lower.includes("unauthorized") || lower.includes("not authenticated")) {
    status = 401;
    message = "Your session has expired. Please log in again.";
  }
  // Auth: forbidden
  else if (lower.includes("forbidden") || lower.includes("not allowed")) {
    status = 403;
    message = "You don't have permission to perform this action.";
  }
  // Database unreachable
  else if (
    lower.includes("can't reach database") ||
    lower.includes("database connection") ||
    lower.includes("timed out")
  ) {
    status = 503;
    message = "The database is temporarily unavailable. Please retry shortly.";
  }
  // Invalid input (Prisma validation)
  else if (lower.includes("prismaclientvalidationerror") || lower.includes("invalid data")) {
    status = 400;
    message = "Some of the data you entered isn't valid. Please review and try again.";
  }
  // Fallback — keep the raw message but guard against leaking internals
  else {
    message = raw || message;
  }

  return { message, status };
}

/**
 * Wraps an async API route handler with global error handling.
 * Catches any unhandled exceptions and returns a structured JSON
 * error response instead of crashing the server process (which
 * causes 502 Bad Gateway).
 *
 * Usage:
 *   export const GET = apiHandler(async (req) => { ... });
 *   export const POST = apiHandler(async (req) => { ... });
 */
export function apiHandler<TArgs extends unknown[]>(
  handler: (...args: TArgs) => Promise<NextResponse>
): (...args: TArgs) => Promise<NextResponse> {
  return async (...args: TArgs) => {
    try {
      return await handler(...args);
    } catch (error) {
      // Log the full error for debugging
      console.error("[API Error]", error);

      // Convert to a user-friendly message + appropriate HTTP status
      const { message, status } = friendlyError(error);
      const detail =
        error instanceof Error ? error.message : String(error);

      return NextResponse.json(
        {
          error: message,
          detail: process.env.NODE_ENV === "production" ? undefined : detail,
        },
        { status }
      );
    }
  };
}
