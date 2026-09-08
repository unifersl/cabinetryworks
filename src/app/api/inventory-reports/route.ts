import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { apiHandler } from "@/lib/api-handler";

export const runtime = "nodejs";

type ReportType = "stock-level" | "movement" | "job-wise" | "low-stock";

function toCsv(rows: Record<string, unknown>[], headers: string[]): string {
  const escape = (v: unknown) => {
    if (v === null || v === undefined) return "";
    const s = String(v);
    if (s.includes(",") || s.includes('"') || s.includes("\n")) {
      return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
  };
  const headerLine = headers.join(",");
  const dataLines = rows.map((r) => headers.map((h) => escape(r[h])).join(","));
  return [headerLine, ...dataLines].join("\n");
}

export const GET = apiHandler(async (req: NextRequest) => {
  const session = await getSession();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const type = (searchParams.get("type") ?? "stock-level") as ReportType;
  const format = (searchParams.get("format") ?? "json") as "json" | "csv";
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const warehouseId = searchParams.get("warehouseId");

  if (!["stock-level", "movement", "job-wise", "low-stock"].includes(type)) {
    return NextResponse.json({ error: "Invalid report type" }, { status: 400 });
  }

  let rows: Record<string, unknown>[] = [];
  let headers: string[] = [];
  let title = "";

  if (type === "stock-level") {
    title = "Stock Level by Warehouse";
    headers = ["Item", "Code", "Material", "Unit", "Warehouse", "Quantity"];
    const warehouses = await db.warehouse.findMany({
      where: warehouseId ? { id: warehouseId } : undefined,
      orderBy: { code: "asc" },
    });
    const items = await db.inventoryItem.findMany({
      orderBy: { name: "asc" },
      include: { stockLots: { include: { warehouse: true } } },
    });
    for (const item of items) {
      const filteredLots = warehouseId
        ? item.stockLots.filter((l) => l.warehouseId === warehouseId)
        : item.stockLots;
      if (filteredLots.length === 0) {
        rows.push({
          Item: item.name,
          Code: item.code ?? "",
          Material: item.material,
          Unit: item.unit,
          Warehouse: "(no stock)",
          Quantity: 0,
        });
        continue;
      }
      // Group by warehouse
      const byWh = new Map<string, number>();
      for (const lot of filteredLots) {
        byWh.set(
          lot.warehouse.code,
          (byWh.get(lot.warehouse.code) ?? 0) + Number(lot.quantity)
        );
      }
      for (const [whCode, qty] of byWh.entries()) {
        rows.push({
          Item: item.name,
          Code: item.code ?? "",
          Material: item.material,
          Unit: item.unit,
          Warehouse: whCode,
          Quantity: qty,
        });
      }
    }
  } else if (type === "movement") {
    title = "Stock Movement Log";
    headers = ["Date", "Type", "Number", "Item", "Warehouse", "Quantity", "Job"];
    const dateFilter: { gte?: Date; lte?: Date } = {};
    if (from) dateFilter.gte = new Date(from);
    if (to) {
      const t = new Date(to);
      t.setHours(23, 59, 59, 999);
      dateFilter.lte = t;
    }
    const dateWhere = (Object.keys(dateFilter).length > 0 ? { createdAt: dateFilter } : {});

    // Issues (negative)
    const issues = await db.goodsIssue.findMany({
      where: dateWhere as never,
      include: { warehouse: true, job: true, lines: { include: { item: true } } },
    });
    for (const i of issues) {
      for (const line of i.lines) {
        rows.push({
          Date: i.createdAt.toISOString().slice(0, 10),
          Type: "Issue",
          Number: i.issueNo,
          Item: line.item.name,
          Warehouse: i.warehouse.code,
          Quantity: -Number(line.quantity),
          Job: i.job?.orderNumber ?? "",
        });
      }
    }

    // Returns (positive)
    const returns = await db.goodsReturn.findMany({
      where: dateWhere as never,
      include: { warehouse: true, job: true, lines: { include: { item: true } } },
    });
    for (const r of returns) {
      for (const line of r.lines) {
        rows.push({
          Date: r.createdAt.toISOString().slice(0, 10),
          Type: "Return",
          Number: r.returnNo,
          Item: line.item.name,
          Warehouse: r.warehouse.code,
          Quantity: Number(line.quantity),
          Job: r.job?.orderNumber ?? "",
        });
      }
    }

    // Adjustments
    const adj = await db.stockAdjustment.findMany({
      where: dateWhere as never,
      include: { warehouse: true, item: true },
    });
    for (const a of adj) {
      rows.push({
        Date: a.createdAt.toISOString().slice(0, 10),
        Type: `Adjustment (${a.type})`,
        Number: a.adjNo,
        Item: a.item.name,
        Warehouse: a.warehouse.code,
        Quantity: Number(a.diff),
        Job: "",
      });
    }

    // Transfers (out of source)
    const transfers = await db.stockTransfer.findMany({
      where: dateWhere as never,
      include: { fromWarehouse: true, items: { include: { item: true } } },
    });
    for (const t of transfers) {
      if (t.status === "draft" || t.status === "cancelled") continue;
      for (const line of t.items) {
        rows.push({
          Date: t.createdAt.toISOString().slice(0, 10),
          Type: `Transfer (${t.status})`,
          Number: t.transferNo,
          Item: line.item.name,
          Warehouse: t.fromWarehouse.code,
          Quantity: -Number(line.quantity),
          Job: "",
        });
      }
    }

    rows.sort((a, b) => String(b.Date).localeCompare(String(a.Date)));
  } else if (type === "job-wise") {
    title = "Job-wise Issue/Return Summary";
    headers = ["Job", "Title", "Customer", "Items Issued", "Items Returned", "Net Issued"];
    const issues = await db.goodsIssue.findMany({
      include: { job: { include: { customer: true } }, lines: true },
    });
    const returns = await db.goodsReturn.findMany({
      include: { job: { include: { customer: true } }, lines: true },
    });

    const byJob = new Map<
      string,
      {
        job: {
          id: string;
          orderNumber: string;
          title: string;
          customer?: { name: string } | null;
        };
        issued: number;
        returned: number;
      }
    >();
    for (const i of issues) {
      if (!i.job) continue;
      const key = i.job.id;
      const entry = byJob.get(key) ?? {
        job: i.job,
        issued: 0,
        returned: 0,
      };
      entry.issued += i.lines.reduce((sum, l) => sum + Number(l.quantity), 0);
      byJob.set(key, entry);
    }
    for (const r of returns) {
      if (!r.job) continue;
      const key = r.job.id;
      const entry = byJob.get(key) ?? { job: r.job, issued: 0, returned: 0 };
      entry.returned += r.lines.reduce((sum, l) => sum + Number(l.quantity), 0);
      byJob.set(key, entry);
    }

    for (const entry of byJob.values()) {
      rows.push({
        Job: entry.job.orderNumber,
        Title: entry.job.title,
        Customer: entry.job.customer?.name ?? "",
        "Items Issued": entry.issued,
        "Items Returned": entry.returned,
        "Net Issued": entry.issued - entry.returned,
      });
    }
  } else if (type === "low-stock") {
    title = "Low Stock Report";
    headers = ["Item", "Code", "Material", "Unit", "Current Stock", "Min Stock", "Reorder Point", "Supplier"];
    const items = await db.inventoryItem.findMany({
      where: { status: "active" },
      orderBy: { name: "asc" },
    });
    for (const item of items) {
      const stock = Number(item.stockLevel);
      const reorder = Number(item.reorderPoint);
      if (reorder > 0 && stock <= reorder) {
        rows.push({
          Item: item.name,
          Code: item.code ?? "",
          Material: item.material,
          Unit: item.unit,
          "Current Stock": stock,
          "Min Stock": Number(item.minStock),
          "Reorder Point": reorder,
          Supplier: item.supplier ?? "",
        });
      }
    }
  }

  if (format === "csv") {
    const csv = toCsv(rows, headers);
    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="${type}-report.csv"`,
      },
    });
  }

  return NextResponse.json({ type, title, headers, rows, generatedAt: new Date().toISOString() });
});
