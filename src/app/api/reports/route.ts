import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession, canManageUsers } from "@/lib/auth";
import { cutLength, cutWidth } from "@/lib/cutting";

export const runtime = "nodejs";

/**
 * GET /api/reports?type=consumption&from=&to=
 * Returns material consumption report aggregated from cutting lists.
 * Groups by material type, shows total area, sheet count, and job count.
 */
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  // Reports expose business-wide consumption / cost data — restrict to
  // Admin / SuperAdmin / Manager only. Technicians and Storekeepers can do
  // their work without seeing aggregate material consumption across all jobs.
  if (!canManageUsers(session.role)) {
    return NextResponse.json(
      { error: "Forbidden — reports are admin/manager only" },
      { status: 403 }
    );
  }

  const { searchParams } = new URL(req.url);
  const reportType = searchParams.get("type") ?? "consumption";
  const fromStr = searchParams.get("from");
  const toStr = searchParams.get("to");

  const from = fromStr ? new Date(fromStr) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  // Fix off-by-one: include the ENTIRE "to" date by advancing to end-of-day
  const toDate = toStr ? new Date(toStr) : new Date();
  toDate.setHours(23, 59, 59, 999);
  const to = toDate;

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

    // Get configurable sheet size (default 2440×1220 = 2.977 m², the industry standard 8×4 ft sheet)
    const sheetSizeSetting = await db.systemSetting.findUnique({
      where: { key: "sheet_size_sqm" },
    });
    const sheetSizeSqm = sheetSizeSetting?.value ? Number(sheetSizeSetting.value) : 2.977;

    // Get wastage factor (default 15% — industry average for guillotine nesting of rectangular parts)
    const wastageSetting = await db.systemSetting.findUnique({
      where: { key: "sheet_wastage_pct" },
    });
    const wastagePct = wastageSetting?.value ? Number(wastageSetting.value) : 15;
    const yieldFactor = 1 - wastagePct / 100; // effective usable area per sheet

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
      let items: Array<{ part: string; qty: number; length: string; width: string; edgeLong1?: boolean; edgeLong2?: boolean; edgeShort1?: boolean; edgeShort2?: boolean; edgeThk?: number }> = [];
      try {
        items = cl.items ? JSON.parse(cl.items) : [];
      } catch {
        items = [];
      }

      let totalAreaSqm = 0;
      for (const item of items) {
        // Use CUT dimensions (substrate = nominal minus banding thickness on banded edges)
        const lengthMm = cutLength(item as any);
        const widthMm = cutWidth(item as any);
        const qty = Number(item.qty) || 1;
        totalAreaSqm += (lengthMm * widthMm * qty) / 1_000_000;
      }
      // Sheets needed = area / (sheet area × yield factor)
      // e.g. 15% wastage means only 85% of each sheet is usable → divide by 0.85
      const sheets = Math.ceil(totalAreaSqm / (sheetSizeSqm * yieldFactor));

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
