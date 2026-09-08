import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { Prisma } from "@prisma/client";

export const runtime = "nodejs";

/**
 * GET /api/job-orders/[id]/cost
 * Calculates the estimated cost for a job based on its cutting lists.
 * Sums material area × pricePerSqm + edge banding length × edgePrice + labor.
 * Returns line items and totals including tax.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const job = await db.jobOrder.findUnique({
    where: { id },
    include: {
      customer: true,
      cuttingLists: {
        select: { items: true, material: true, panelName: true },
      },
    },
  });
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Get all material prices for lookup
  const materialPrices = await db.materialPrice.findMany();
  const priceMap = new Map(materialPrices.map((p) => [p.name.toLowerCase(), p]));

  // Get settings for currency & tax
  const settingsRows = await db.systemSetting.findMany();
  const settings = settingsRows.reduce<Record<string, string>>((acc, r) => {
    acc[r.key] = r.value ?? "";
    return acc;
  }, {});
  const currency = settings.currency || "USD";
  const taxRate = Number(settings.tax_rate || "0");

  type CostLine = {
    panelName: string;
    material: string;
    partName: string;
    qty: number;
    areaSqm: number;
    edgeLengthM: number;
    materialCost: number;
    edgeCost: number;
    unitPrice: number;
  };

  const lines: CostLine[] = [];
  let totalMaterialCost = 0;
  let totalEdgeCost = 0;
  let totalLaborCost = 0;
  let totalAreaSqm = 0;
  let totalEdgeLengthM = 0;

  for (const cl of job.cuttingLists) {
    let items: Array<{
      part: string;
      qty: number;
      length: string;
      width: string;
      thickness: string;
      edge?: string;
    }> = [];
    try {
      items = cl.items ? JSON.parse(cl.items) : [];
    } catch {
      items = [];
    }

    // Find matching material price — try exact material name, then material type
    const materialKey = (cl.material ?? "").toLowerCase();
    let priceEntry = priceMap.get(materialKey);
    if (!priceEntry) {
      // Try matching by material type (MDF, Plywood, etc.)
      priceEntry = materialPrices.find(
        (p) => p.material.toLowerCase() === materialKey
      );
    }

    const pricePerSqm = priceEntry ? Number(priceEntry.pricePerSqm) : 0;
    const edgePricePerM = priceEntry ? Number(priceEntry.edgeBandingPricePerM) : 0;
    const laborRate = priceEntry ? Number(priceEntry.laborRatePerHour) : 0;
    const estHours = priceEntry ? Number(priceEntry.estimatedHours) : 0;

    if (priceEntry && estHours > 0) {
      totalLaborCost += laborRate * estHours;
    }

    for (const item of items) {
      // Parse dimensions (extract numeric part from strings like "720mm")
      const lengthMm = parseFloat(item.length) || 0;
      const widthMm = parseFloat(item.width) || 0;
      const qty = Number(item.qty) || 1;
      const areaSqm = (lengthMm * widthMm * qty) / 1_000_000; // mm² → m²

      // Estimate edge banding length (perimeter of the panel)
      const edgeLengthM = ((lengthMm + widthMm) * 2 * qty) / 1000; // mm → m

      const materialCost = areaSqm * pricePerSqm;
      const edgeCost = item.edge && item.edge !== "—"
        ? edgeLengthM * edgePricePerM
        : 0;

      lines.push({
        panelName: cl.panelName ?? "Panel",
        material: cl.material ?? "Unspecified",
        partName: item.part,
        qty,
        areaSqm: Math.round(areaSqm * 1000) / 1000,
        edgeLengthM: Math.round(edgeLengthM * 1000) / 1000,
        materialCost: Math.round(materialCost * 100) / 100,
        edgeCost: Math.round(edgeCost * 100) / 100,
        unitPrice: pricePerSqm,
      });

      totalMaterialCost += materialCost;
      totalEdgeCost += edgeCost;
      totalAreaSqm += areaSqm;
      totalEdgeLengthM += edgeLengthM;
    }
  }

  const subtotal = totalMaterialCost + totalEdgeCost + totalLaborCost;
  const taxAmount = subtotal * (taxRate / 100);
  const total = subtotal + taxAmount;

  const formatMoney = (n: number) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: currency,
      minimumFractionDigits: 2,
    }).format(n);

  return NextResponse.json({
    job: {
      orderNumber: job.orderNumber,
      title: job.title,
      customer: { name: job.customer?.name ?? "" },
      deliveryDate: job.deliveryDate,
    },
    currency,
    taxRate,
    lines,
    summary: {
      totalAreaSqm: Math.round(totalAreaSqm * 1000) / 1000,
      totalEdgeLengthM: Math.round(totalEdgeLengthM * 1000) / 1000,
      materialCost: Math.round(totalMaterialCost * 100) / 100,
      edgeCost: Math.round(totalEdgeCost * 100) / 100,
      laborCost: Math.round(totalLaborCost * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      taxAmount: Math.round(taxAmount * 100) / 100,
      total: Math.round(total * 100) / 100,
    },
    formatted: {
      materialCost: formatMoney(totalMaterialCost),
      edgeCost: formatMoney(totalEdgeCost),
      laborCost: formatMoney(totalLaborCost),
      subtotal: formatMoney(subtotal),
      taxAmount: formatMoney(taxAmount),
      total: formatMoney(total),
    },
  });
}
