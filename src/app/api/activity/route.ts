import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

/**
 * GET /api/activity?limit=20
 * Returns a unified activity feed derived from recent jobs, measurements,
 * and cutting lists. Each event has: type, timestamp, title, description,
 * and entity references.
 */
export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = Math.min(Number(searchParams.get("limit") ?? "10"), 20);

  // Fetch recent records in parallel — reduced limits for memory efficiency
  const [jobs, measurements, cuttingLists] = await Promise.all([
    db.jobOrder.findMany({
      take: Math.min(limit, 10),
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        orderNumber: true,
        title: true,
        status: true,
        priority: true,
        createdAt: true,
        updatedAt: true,
        customerId: true,
        assignedToId: true,
        customer: { select: { name: true } },
        assignedTo: { select: { fullName: true } },
      },
    }),
    db.siteMeasurement.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        roomType: true,
        status: true,
        createdAt: true,
        jobId: true,
        job: { select: { orderNumber: true, title: true } },
        takenBy: { select: { fullName: true } },
      },
    }),
    db.cuttingList.findMany({
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        panelName: true,
        material: true,
        status: true,
        createdAt: true,
        jobId: true,
        job: { select: { orderNumber: true, title: true } },
        createdBy: { select: { fullName: true } },
      },
    }),
  ]);

  type ActivityEvent = {
    id: string;
    type: "job_created" | "job_assigned" | "job_status" | "measurement" | "cutting_list";
    timestamp: string;
    title: string;
    description: string;
    entityId: string;
    entityType: "job" | "measurement" | "cutting_list";
    actor: string | null;
    meta?: Record<string, string | null>;
  };

  const events: ActivityEvent[] = [];

  // Job events
  for (const job of jobs) {
    // Job created
    events.push({
      id: `job-created-${job.id}`,
      type: "job_created",
      timestamp: job.createdAt.toISOString(),
      title: `New job: ${job.orderNumber}`,
      description: job.title,
      entityId: job.id,
      entityType: "job",
      actor: null,
      meta: {
        customer: job.customer?.name ?? null,
        priority: job.priority,
      },
    });

    // Job assigned (if has assignee)
    if (job.assignedToId && job.assignedTo) {
      events.push({
        id: `job-assigned-${job.id}`,
        type: "job_assigned",
        timestamp: job.updatedAt.toISOString(),
        title: `${job.orderNumber} assigned`,
        description: `Assigned to ${job.assignedTo.fullName}`,
        entityId: job.id,
        entityType: "job",
        actor: null,
        meta: {
          assignee: job.assignedTo.fullName,
          status: job.status,
        },
      });
    }

    // Job status (if not Pending — implies a status change happened)
    if (job.status !== "Pending") {
      events.push({
        id: `job-status-${job.id}`,
        type: "job_status",
        timestamp: job.updatedAt.toISOString(),
        title: `${job.orderNumber} → ${job.status}`,
        description: `Status updated to ${job.status}`,
        entityId: job.id,
        entityType: "job",
        actor: null,
        meta: { status: job.status },
      });
    }
  }

  // Measurement events
  for (const m of measurements) {
    events.push({
      id: `measurement-${m.id}`,
      type: "measurement",
      timestamp: m.createdAt.toISOString(),
      title: `Measurement captured`,
      description: `${m.roomType ?? "Measurement"} for ${m.job?.orderNumber ?? ""}`,
      entityId: m.id,
      entityType: "measurement",
      actor: m.takenBy?.fullName ?? null,
      meta: {
        jobId: m.jobId,
        status: m.status,
      },
    });
  }

  // Cutting list events
  for (const cl of cuttingLists) {
    events.push({
      id: `cutting-${cl.id}`,
      type: "cutting_list",
      timestamp: cl.createdAt.toISOString(),
      title: `Cutting list generated`,
      description: `${cl.panelName ?? "List"} (${cl.material ?? ""}) for ${cl.job?.orderNumber ?? ""}`,
      entityId: cl.id,
      entityType: "cutting_list",
      actor: cl.createdBy?.fullName ?? null,
      meta: {
        jobId: cl.jobId,
        status: cl.status,
      },
    });
  }

  // Sort by timestamp desc and take limit
  events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

  return NextResponse.json({ events: events.slice(0, limit) });
});
