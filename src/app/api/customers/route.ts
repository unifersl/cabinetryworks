import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";
import { randomUUID } from "crypto";

export const runtime = "nodejs";

export const GET = apiHandler(async () => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const customers = await db.customer.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { jobOrders: true } } },
  });
  return NextResponse.json({ customers });
});

export const POST = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const name = String(body?.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Customer name is required" }, { status: 400 });
  }

  const customer = await db.customer.create({
    data: {
      id: body?.id ? String(body.id) : randomUUID(),
      name,
      phone: body?.phone ? String(body.phone) : null,
      email: body?.email ? String(body.email) : null,
      address: body?.address ? String(body.address) : null,
      notes: body?.notes ? String(body.notes) : null,
    },
  });
  return NextResponse.json({ customer }, { status: 201 });
});
