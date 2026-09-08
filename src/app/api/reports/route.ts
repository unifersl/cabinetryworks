import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";

export const runtime = "nodejs";

/**
 * GET /api/reports?type=consumption&from=&to=
 * Returns material consumption report aggregated from cutting lists.
 * Groups by material type, shows total area, sheet count, and job count.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const reportType = searchParams.get("type") ?? "consumption";
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const to = toStr ? new Date(toStr) : new Date();

  if (reportType === "consumption") {
    // Get all cutting lists in date range with their items
    const cuttingLists = await db.cuttingList.findMany({
      where: {
        createdAt: { gte: from, lte: to },
      },
      select: {
        id: true,
        material: true,
        panelName: true,
        items: true,
        createdAt: true,
        job: {
          select: {
            id: true,
            orderNumber: true,
            title: true,
            customer: { select: { name: true } },
          },
        },
      },
    });

    // Get configurable sheet size
    const sheetSizeSetting = await db.systemSetting.findUnique({
      where: { key: "sheet_size_sqm" },
    });
    const sheetSizeSqm = sheetSizeSetting?.value ? Number(sheetSizeSetting.value) : 2.88;

    // Aggregate by material
    type MaterialAgg = {
      material: string;
      totalAreaSqm: number;
      totalSheets: number;
      cuttingListCount: number;
      jobs: Set<string>;
    };
    const materialMap = new Map<string, MaterialAgg>();

    // Per-cutting-list details
    const details: Array<{
      id: string;
      orderNumber: string;
      jobTitle: string;
      customerName: string;
      material: string;
      panelName: string | null;
      areaSqm: number;
      sheets: number;
      createdAt: string;
    }> = [];

    for (const cl of cuttingLists) {
      let items: Array<{ part: string; qty: number; length: string; width: string }> = [];
      try {
        items = cl.items ? JSON.parse(cl.items) : [];
      } catch {
        items = [];
      }

      let totalAreaSqm = 0;
      for (const item of items) {
        const lengthMm = parseFloat(item.length) || 0;
        const widthMm = parseFloat(item.width) || 0;
        const qty = Number(item.qty) || 1;
        totalAreaSqm += (lengthMm * widthMm * qty) / 1_000_000;
      }
      const sheets = Math.ceil(totalAreaSqm / sheetSizeSqm);

      const materialKey = cl.material ?? "Unspecified";
      const existing = materialMap.get(materialKey) ?? {
        material: materialKey,
        totalAreaSqm: 0,
        totalSheets: 0,
        cuttingListCount: 0,
        jobs: new Set<string>(),
      };
      existing.totalAreaSqm += totalAreaSqm;
      existing.totalSheets += sheets;
      existing.cuttingListCount += 1;
      if (cl.job) existing.jobs.add(cl.job.id);
      materialMap.set(materialKey, existing);

      details.push({
        id: cl.id,
        orderNumber: cl.job?.orderNumber ?? "—",
        jobTitle: cl.job?.title ?? "—",
        customerName: cl.job?.customer?.name ?? "—",
        material: materialKey,
        panelName: cl.panelName,
        areaSqm: Math.round(totalAreaSqm * 1000) / 1000,
        sheets,
        createdAt: cl.createdAt.toISOString(),
      });
    }

    const summary = Array.from(materialMap.values())
      .map((m) => ({
        material: m.material,
        totalAreaSqm: Math.round(m.totalAreaSqm * 1000) / 1000,
        totalSheets: m.totalSheets,
        cuttingListCount: m.cuttingListCount,
        jobCount: m.jobs.size,
      }))
      .sort((a, b) => b.totalAreaSqm - a.totalAreaSqm);

    return NextResponse.json({
      type: "consumption",
      dateRange: { from: from.toISOString(), to: to.toISOString() },
      sheetSizeSqm,
      summary,
      details: details.sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      ),
      totals: {
        totalAreaSqm: Math.round(summary.reduce((s, m) => s + m.totalAreaSqm, 0) * 1000) / 1000,
        totalSheets: summary.reduce((s, m) => s + m.totalSheets, 0),
        totalCuttingLists: cuttingLists.length,
        totalJobs: new Set(details.map((d) => d.orderNumber)).size,
      },
    });
  }

  return NextResponse.json({ error: "Unknown report type" }, { status: 400 });
}
