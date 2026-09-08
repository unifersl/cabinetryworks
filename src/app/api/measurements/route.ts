import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const jobId = searchParams.get("jobId");

  const where: Record<string, unknown> = {};
  if (jobId) where.jobId = jobId;

  const items = await db.siteMeasurement.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: {
      job: { select: { id: true, title: true, orderNumber: true } },
      takenBy: { select: { id: true, fullName: true } },
    },
  });
  return NextResponse.json({ measurements: items });
}

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const jobId = String(body?.jobId ?? "").trim();
  if (!jobId) {
    return NextResponse.json({ error: "Job is required" }, { status: 400 });
  }

  const item = await db.siteMeasurement.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      jobId,
      takenById: session.id,
      roomType: body?.roomType ? String(body.roomType) : null,
      wallLength: body?.wallLength ? String(body.wallLength) : null,
      ceilingHt: body?.ceilingHt ? String(body.ceilingHt) : null,
      notes: body?.notes ? String(body.notes) : null,
      photoUrls: body?.photoUrls ? JSON.stringify(body.photoUrls) : null,
      blueprint: body?.blueprint ? JSON.stringify(body.blueprint) : null,
      status: body?.status ? String(body.status) : "Draft",
    },
    include: {
      job: { select: { id: true, title: true, orderNumber: true } },
      takenBy: { select: { id: true, fullName: true } },
    },
  });
  return NextResponse.json({ measurement: item }, { status: 201 });
}
