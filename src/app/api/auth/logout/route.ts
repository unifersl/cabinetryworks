import { NextResponse } from "next/server";
import { getSession, destroySession } from "@/lib/auth";
import { createBackup } from "@/lib/backup";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  // Auto-backup on logout. Fire-and-forget — don't delay the logout
  // response. If the backup is slow (large DB), the user shouldn't wait.
  // The promise is detached with a `.catch` so an unhandled rejection
  // can't crash the process.
  if (session?.id) {
    void createBackup(session.id, "auto-logout").catch((err) =>
      console.error("[logout] Auto-backup failed:", err)
    );
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
