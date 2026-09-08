import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/customers/[id]/statement
 * Returns a financial summary for a customer: jobs with costs, quotes, totals.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const customer = await db.customer.findUnique({
    where: { id },
    include: {
      jobOrders: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          orderNumber: true,
          title: true,
          status: true,
          priority: true,
          createdAt: true,
          deliveryDate: true,
          archived: true,
          _count: { select: { measurements: true, cuttingLists: true } },
        },
      },
      quotes: {
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          quoteNumber: true,
          status: true,
          total: true,
          currency: true,
          createdAt: true,
        },
      },
    },
  });

  if (!customer) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Compute summary stats
  const totalJobs = customer.jobOrders.length;
  const activeJobs = customer.jobOrders.filter(
    (j) => !j.archived && j.status !== "Completed" && j.status !== "Cancelled"
  ).length;
  const completedJobs = customer.jobOrders.filter((j) => j.status === "Completed").length;

  const quotes = customer.quotes;
  const acceptedQuotes = quotes.filter((q) => q.status === "accepted");
  const totalQuoted = quotes.reduce((s, q) => s + Number(q.total), 0);
  const totalAccepted = acceptedQuotes.reduce((s, q) => s + Number(q.total), 0);
  const pendingQuotes = quotes.filter((q) => q.status === "draft" || q.status === "sent").length;

  return NextResponse.json({
    customer: {
      id: customer.id,
      name: customer.name,
      email: customer.email,
      phone: customer.phone,
      address: customer.address,
      createdAt: customer.createdAt,
    },
    jobs: customer.jobOrders,
    quotes,
    summary: {
      totalJobs,
      activeJobs,
      completedJobs,
      totalQuotes: quotes.length,
      acceptedQuotes: acceptedQuotes.length,
      pendingQuotes,
      totalQuoted,
      totalAccepted,
    },
  });
}
