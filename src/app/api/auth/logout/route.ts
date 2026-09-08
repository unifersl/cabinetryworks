import { NextResponse } from "next/server";
import { getSession, destroySession } from "@/lib/auth";
import { createBackup } from "@/lib/backup";

export const runtime = "nodejs";

export async function POST() {
  const session = await getSession();
  // Auto-backup on logout (non-blocking — don't delay logout)
  if (session?.id) {
    try {
      await createBackup(session.id, "auto-logout");
    } catch (e) {
      console.error("[logout] Auto-backup failed:", e);
    }
  }
  await destroySession();
  return NextResponse.json({ ok: true });
}
