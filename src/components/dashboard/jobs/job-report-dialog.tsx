"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { jobsApi, jobInsightsApi, attendanceApi } from "@/lib/api";
import {
  Dialog, DialogContent, DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import {
  X, Download, Printer, FileText, Clock, Truck, Utensils, Wrench,
  Wallet, Package, TrendingUp, Users, Calendar, MapPin, User, Briefcase,
} from "lucide-react";

interface JobReportDialogProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  jobId: string;
}

export function JobReportDialog({ open, onOpenChange, jobId }: JobReportDialogProps) {
  const { data: insights, isLoading } = useQuery({
    queryKey: ["job-insights", jobId],
    queryFn: () => jobInsightsApi.get(jobId),
    enabled: open && !!jobId,
  });

  const { data: jobData } = useQuery({
    queryKey: ["job", jobId],
    queryFn: () => jobsApi.get(jobId),
    enabled: open && !!jobId,
  });

  function exportCSV() {
    if (!insights) return;
    const rows: string[][] = [];
    const j = insights.job;
    rows.push(["JOB/PROJECT/SITE REPORT"]);
    rows.push(["Generated", new Date().toLocaleString()]);
    rows.push([]);
    rows.push(["=== JOB INFORMATION ==="]);
    rows.push(["Order Number", j.orderNumber]);
    rows.push(["Title", j.title]);
    rows.push(["Status", j.status]);
    rows.push(["Priority", j.priority]);
    rows.push(["Created", new Date(j.createdAt).toLocaleDateString()]);
    rows.push(["Updated", new Date(j.updatedAt).toLocaleDateString()]);
    if (j.deliveryDate) rows.push(["Delivery Date", new Date(j.deliveryDate).toLocaleDateString()]);
    rows.push(["Progress", `${insights.progress.percent}%`]);
    rows.push([]);

    rows.push(["=== SUMMARY ==="]);
    rows.push(["Category", "Metric", "Value"]);
    rows.push(["Time Logs", "Total Entries", String(insights.timeLogs.total)]);
    rows.push(["Time Logs", "Total Hours", String(insights.timeLogs.totalHours)]);
    rows.push(["Time Logs", "Labor Cost (LKR)", String(insights.costSummary?.labor ?? insights.timeLogs.totalLaborCost ?? 0)]);
    rows.push(["Transport", "Total Trips", String(insights.transports.total)]);
    rows.push(["Transport", "Total Distance (km)", String(insights.transports.totalDistance)]);
    rows.push(["Transport", "Transport Cost (LKR)", String(insights.costSummary?.transport ?? insights.transports.totalCost ?? 0)]);
    rows.push(["Food & Beverage", "Total Records", String(insights.foodBeverage.total)]);
    rows.push(["Food & Beverage", "Total Meals", String(insights.foodBeverage.totalMeals)]);
    rows.push(["Food & Beverage", "F&B Cost (LKR)", String(insights.costSummary?.foodBeverage ?? insights.foodBeverage.totalCost ?? 0)]);
    rows.push(["Tools", "Issues Count", String(insights.tools.issuesCount)]);
    rows.push(["Tools", "Returns Count", String(insights.tools.returnsCount)]);
    rows.push(["Tools", "Issued Qty", String(insights.tools.totalIssuedQty)]);
    rows.push(["Tools", "Returned Qty", String(insights.tools.totalReturnedQty)]);
    rows.push(["Tools", "Lost Qty", String(insights.tools.totalLostQty)]);
    rows.push(["Tools", "Damaged Qty", String(insights.tools.totalDamagedQty)]);
    rows.push(["Stock", "Requests", String(insights.stock.requestsCount)]);
    rows.push(["Stock", "Goods Issues", String(insights.stock.issuesCount)]);
    rows.push(["Stock", "Goods Returns", String(insights.stock.returnsCount)]);
    rows.push(["Stock", "Outside Purchases", String(insights.stock.outsidePurchasesCount)]);
    rows.push(["Expenses", "Total Count", String(insights.expenses.count)]);
    rows.push(["Expenses", "Total Amount (LKR)", String(insights.expenses.total)]);
    rows.push([]);

    if (insights.costSummary) {
      rows.push(["=== COST SUMMARY ==="]);
      rows.push(["Labor Cost", String(insights.costSummary.labor)]);
      rows.push(["Transport Cost", String(insights.costSummary.transport)]);
      rows.push(["F&B Cost", String(insights.costSummary.foodBeverage)]);
      rows.push(["Other Expenses", String(insights.costSummary.expenses)]);
      rows.push(["GRAND TOTAL", String(insights.costSummary.grandTotal)]);
      rows.push([]);
    }

    rows.push(["=== HOURS BY WORKER ==="]);
    rows.push(["Worker", "Hours", "Log Count"]);
    for (const w of insights.timeLogs.hoursByWorker) {
      rows.push([w.workerName, String(w.hours), String(w.logCount)]);
    }
    rows.push([]);

    rows.push(["=== HOURS BY WORK TYPE ==="]);
    rows.push(["Work Type", "Hours"]);
    for (const w of insights.timeLogs.hoursByWorkType) {
      rows.push([w.workType, String(w.hours)]);
    }
    rows.push([]);

    rows.push(["=== EXPENSES BY CATEGORY ==="]);
    rows.push(["Category", "Total (LKR)", "Count"]);
    for (const c of insights.expenses.byCategory) {
      rows.push([c.category, String(c.total), String(c.count)]);
    }
    rows.push([]);

    rows.push(["=== TOOL UTILIZATION ==="]);
    rows.push(["Tool", "Code", "Issued", "Returned", "Lost", "Damaged"]);
    for (const t of insights.tools.utilization) {
      rows.push([t.toolName, t.toolCode ?? "", String(t.issued), String(t.returned), String(t.lost), String(t.damaged)]);
    }

    const csv = rows.map((r) => r.map((c) => `"${c.replace(/"/g, '""')}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `job-report-${j.orderNumber}-${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Report exported as CSV");
  }

  // ---- A4 portrait report focused on Raw Materials, Labour Timing, Other Expenses ----
  function printA4Report() {
    if (!insights || !jobData) return;
    const j = insights.job;
    const job: any = jobData;
    const w = window.open("", "_blank");
    if (!w) return;

    const fmtLKR = (v: number) => `${(v || 0).toLocaleString()}`;
    const fmtDate = (d?: string | null) => d ? new Date(d).toLocaleDateString("en-GB") : "—";

    // ====== Build the 3 focused categories ======
    type Row = { cols: string[]; bold?: boolean; highlight?: boolean };
    type Section = { title: string; headers: string[]; rows: Row[]; summary?: Row };

    const sections: Section[] = [];

    // --- Section 1: RAW MATERIALS ---
    // Stock issues (materials issued to this job from warehouse)
    const materialRows: Row[] = [];
    let materialTotal = 0;
    // Goods issues — each line item is a raw material issued
    if (insights.stock.issuesCount > 0) {
      // We only have aggregate data from insights, so show summary
      materialRows.push({ cols: ["Goods Issued from Warehouse", String(insights.stock.issuesCount), String(insights.stock.totalIssuedQty), "—"] });
    }
    if (insights.stock.outsidePurchasesCount > 0) {
      materialRows.push({ cols: ["Outside Purchases (Site)", String(insights.stock.outsidePurchasesCount), String(insights.stock.totalPurchasedQty), "—"] });
    }
    if (insights.stock.returnsCount > 0) {
      materialRows.push({ cols: ["Materials Returned", String(insights.stock.returnsCount), String(insights.stock.totalReturnedQty), "—"] });
    }
    if (insights.stock.requestsCount > 0) {
      materialRows.push({ cols: ["Stock Requests (Pending/Approved)", String(insights.stock.requestsCount), "—", "—"] });
    }
    // Net material used = issued + purchased - returned
    const netMaterial = insights.stock.totalIssuedQty + insights.stock.totalPurchasedQty - insights.stock.totalReturnedQty;
    if (materialRows.length > 0) {
      sections.push({
        title: "RAW MATERIALS",
        headers: ["Description", "Count", "Qty (units)", "Notes"],
        rows: materialRows,
        summary: { cols: ["NET MATERIAL CONSUMED", "", String(netMaterial), ""], bold: true, highlight: true },
      });
    }

    // --- Section 2: LABOUR TIMING ---
    const labourRows: Row[] = [];
    let totalLabourHours = 0;
    let totalLabourCost = 0;
    for (const w of insights.timeLogs.hoursByWorker) {
      const rate = insights.costSummary ? (insights.costSummary.labor / (insights.timeLogs.totalHours || 1)) : 0;
      const cost = Math.round(w.hours * rate);
      labourRows.push({ cols: [w.workerName, String(w.hours), String(w.logCount), fmtLKR(cost)] });
      totalLabourHours += w.hours;
      totalLabourCost += cost;
    }
    // Add work type breakdown
    if (insights.timeLogs.hoursByWorkType.length > 0) {
      for (const wt of insights.timeLogs.hoursByWorkType) {
        labourRows.push({ cols: [`  ↳ ${wt.workType.charAt(0).toUpperCase() + wt.workType.slice(1)} Work`, String(wt.hours), "—", "—"] });
      }
    }
    if (labourRows.length > 0) {
      sections.push({
        title: "LABOUR TIMING",
        headers: ["Worker / Work Type", "Hours", "Log Count", "Cost (LKR)"],
        rows: labourRows,
        summary: { cols: ["TOTAL LABOUR", String(totalLabourHours), "", fmtLKR(totalLabourCost)], bold: true, highlight: true },
      });
    }

    // --- Section 3: OTHER EXPENSES ---
    const expenseRows: Row[] = [];
    let totalExpenses = 0;
    // Expense categories
    for (const c of insights.expenses.byCategory) {
      const label = c.category.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
      expenseRows.push({ cols: [label, String(c.count), fmtLKR(c.total), "—"] });
      totalExpenses += c.total;
    }
    // Transport cost
    if (insights.costSummary && insights.costSummary.transport > 0) {
      expenseRows.push({ cols: ["Transport Cost", String(insights.transports.total), fmtLKR(insights.costSummary.transport), `${insights.transports.totalDistance} km`] });
      totalExpenses += insights.costSummary.transport;
    }
    // F&B cost
    if (insights.costSummary && insights.costSummary.foodBeverage > 0) {
      expenseRows.push({ cols: ["Food & Beverage", String(insights.foodBeverage.totalMeals) + " meals", fmtLKR(insights.costSummary.foodBeverage), "—"] });
      totalExpenses += insights.costSummary.foodBeverage;
    }
    // Tool losses (if any lost/damaged)
    if (insights.tools.totalLostQty > 0 || insights.tools.totalDamagedQty > 0) {
      expenseRows.push({ cols: ["Tool Losses/Damage", `${insights.tools.totalLostQty} lost, ${insights.tools.totalDamagedQty} damaged`, "—", "—"] });
    }
    if (expenseRows.length > 0) {
      sections.push({
        title: "OTHER EXPENSES",
        headers: ["Description", "Qty/Count", "Amount (LKR)", "Notes"],
        rows: expenseRows,
        summary: { cols: ["TOTAL OTHER EXPENSES", "", fmtLKR(totalExpenses), ""], bold: true, highlight: true },
      });
    }

    // --- Grand total ---
    const grandTotal = totalLabourCost + totalExpenses;

    // Render sections as HTML
    const sectionsHtml = sections.map((s) => {
      const rowsHtml = s.rows.map((r) => {
        const cls = r.bold ? "row-bold" : "";
        return `<tr class="${cls}">${r.cols.map((c, i) => `<td class="${i === 0 ? "col-name" : i >= 2 && s.headers[i].includes("LKR") || s.headers[i].includes("Amount") ? "col-num" : "col-center"}">${c}</td>`).join("")}</tr>`;
      }).join("");
      const summaryHtml = s.summary ? `<tr class="summary-row">${s.summary.cols.map((c, i) => `<td class="${i === 0 ? "col-name" : "col-num"}">${c}</td>`).join("")}</tr>` : "";
      return `<div class="section">
        <div class="section-title">${s.title}</div>
        <table class="data-table">
          <thead><tr>${s.headers.map((h) => `<th>${h}</th>`).join("")}</tr></thead>
          <tbody>${rowsHtml}${summaryHtml}</tbody>
        </table>
      </div>`;
    }).join("");

    // Determine dates
    const stDate = job?.createdAt ? fmtDate(job.createdAt) : fmtDate(j.createdAt);
    const fiDate = j.deliveryDate ? fmtDate(j.deliveryDate) : fmtDate(j.updatedAt);

    w.document.write(`<!DOCTYPE html><html><head><title>Project Report — ${j.orderNumber}</title>
      <style>
        @page {
          size: A4 portrait;
          margin: 12mm 14mm;
        }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
          font-family: 'Calibri', 'Segoe UI', 'Arial', sans-serif;
          color: #1a1a1a;
          font-size: 9.5pt;
          line-height: 1.35;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
        }
        .page {
          width: 100%;
          max-width: 182mm;
          margin: 0 auto;
        }
        /* Header */
        .report-header {
          text-align: center;
          border-bottom: 2.5px solid #1e293b;
          padding-bottom: 6px;
          margin-bottom: 8px;
        }
        .report-title {
          font-size: 14pt;
          font-weight: bold;
          text-transform: uppercase;
          letter-spacing: 1px;
          color: #1e293b;
        }
        .report-subtitle {
          font-size: 9pt;
          color: #64748b;
          margin-top: 2px;
        }
        /* Job info grid */
        .job-info {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 0 20px;
          margin-bottom: 10px;
          font-size: 9pt;
        }
        .job-info-row {
          display: flex;
          padding: 1.5px 0;
          border-bottom: 0.5px dotted #cbd5e1;
        }
        .job-info-label {
          font-weight: bold;
          min-width: 90px;
          color: #475569;
        }
        .job-info-val {
          flex: 1;
          font-weight: normal;
        }
        /* Progress */
        .progress-bar-container {
          margin: 6px 0 10px;
        }
        .progress-label {
          font-size: 9pt;
          font-weight: bold;
          color: #475569;
        }
        .progress-track {
          width: 100%;
          height: 10px;
          background: #e2e8f0;
          border: 0.5px solid #94a3b8;
          border-radius: 2px;
          overflow: hidden;
          margin-top: 2px;
        }
        .progress-fill {
          height: 100%;
          background: #2563eb;
        }
        /* Sections */
        .section {
          margin-bottom: 8px;
        }
        .section-title {
          font-weight: bold;
          font-size: 10pt;
          color: #ffffff;
          background: #1e293b;
          padding: 3px 8px;
          border-radius: 2px 2px 0 0;
          letter-spacing: 0.5px;
        }
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9pt;
        }
        .data-table th {
          font-weight: bold;
          padding: 3px 6px;
          border: 0.5px solid #64748b;
          background: #e2e8f0;
          text-align: left;
          font-size: 8.5pt;
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .data-table td {
          padding: 2.5px 6px;
          border: 0.5px solid #cbd5e1;
          font-size: 9pt;
          vertical-align: top;
        }
        .data-table .col-name { text-align: left; }
        .data-table .col-num { text-align: right; font-family: 'Calibri', monospace; font-weight: 500; }
        .data-table .col-center { text-align: center; }
        .data-table .row-bold td { font-weight: bold; }
        .data-table .summary-row td {
          font-weight: bold;
          background: #fef3c7;
          border-top: 1.5px solid #92400e;
          font-size: 9.5pt;
        }
        /* Grand total */
        .grand-total {
          margin-top: 8px;
          padding: 8px 12px;
          background: #1e293b;
          color: #ffffff;
          border-radius: 3px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 12pt;
          font-weight: bold;
        }
        .grand-total-label { letter-spacing: 1px; }
        .grand-total-val { font-size: 14pt; }
        /* Footer */
        .report-footer {
          margin-top: 12px;
          padding-top: 5px;
          border-top: 1px solid #94a3b8;
          font-size: 8pt;
          color: #64748b;
          display: flex;
          justify-content: space-between;
        }
        /* Print page break control */
        .section { page-break-inside: avoid; }
        @media print {
          .page { max-width: none; }
          body { font-size: 9.5pt; }
        }
      </style>
      </head><body>
      <div class="page">

        <div class="report-header">
          <div class="report-title">CabinetryWorks — Project Report</div>
          <div class="report-subtitle">${j.orderNumber} · ${j.title}</div>
        </div>

        <div class="job-info">
          <div>
            <div class="job-info-row"><span class="job-info-label">Project:</span> <span class="job-info-val">${j.title}</span></div>
            <div class="job-info-row"><span class="job-info-label">Order No:</span> <span class="job-info-val">${j.orderNumber}</span></div>
            <div class="job-info-row"><span class="job-info-label">Customer:</span> <span class="job-info-val">${job?.customer?.name ?? "—"}</span></div>
            <div class="job-info-row"><span class="job-info-label">Address:</span> <span class="job-info-val">${job?.customer?.address ?? "—"}</span></div>
          </div>
          <div>
            <div class="job-info-row"><span class="job-info-label">St. Date:</span> <span class="job-info-val">${stDate}</span></div>
            <div class="job-info-row"><span class="job-info-label">Fi. Date:</span> <span class="job-info-val">${fiDate}</span></div>
            <div class="job-info-row"><span class="job-info-label">Status:</span> <span class="job-info-val">${j.status}</span></div>
            <div class="job-info-row"><span class="job-info-label">Priority:</span> <span class="job-info-val">${j.priority}</span></div>
          </div>
        </div>

        <div class="progress-bar-container">
          <span class="progress-label">Progress: ${insights.progress.percent}% (${j.status})</span>
          <div class="progress-track"><div class="progress-fill" style="width:${insights.progress.percent}%"></div></div>
        </div>

        ${sectionsHtml}

        <div class="grand-total">
          <span class="grand-total-label">GRAND TOTAL (Labour + Other Expenses)</span>
          <span class="grand-total-val">${fmtLKR(grandTotal)} LKR</span>
        </div>

        <div class="report-footer">
          <span>Generated: ${new Date().toLocaleString()}</span>
          <span>CabinetryWorks Manufacturing Console</span>
        </div>

      </div>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  // ---- Detailed multi-page print (for full report with all data) ----
  function printDetailedReport() {
    if (!insights) return;
    const j = insights.job;
    const w = window.open("", "_blank");
    if (!w) return;

    const fmtLKR = (v: number) => `${(v || 0).toLocaleString()} LKR`;
    const fmtDate = (d: string) => new Date(d).toLocaleDateString();

    const sections: string[] = [];

    // Hours by worker
    if (insights.timeLogs.hoursByWorker.length > 0) {
      sections.push(`<h2>Hours by Worker</h2>
        <table><tr><th>#</th><th>Worker</th><th class="right">Hours</th><th class="right">Log Count</th></tr>
        ${insights.timeLogs.hoursByWorker.map((w, i) => `<tr><td>${i + 1}</td><td>${w.workerName}</td><td class="right">${w.hours}</td><td class="right">${w.logCount}</td></tr>`).join("")}
        </table>`);
    }
    // Hours by work type
    if (insights.timeLogs.hoursByWorkType.length > 0) {
      sections.push(`<h2>Hours by Work Type</h2>
        <table><tr><th>#</th><th>Work Type</th><th class="right">Hours</th></tr>
        ${insights.timeLogs.hoursByWorkType.map((w, i) => `<tr><td>${i + 1}</td><td>${w.workType}</td><td class="right">${w.hours}</td></tr>`).join("")}
        </table>`);
    }
    // Expenses by category
    if (insights.expenses.byCategory.length > 0) {
      sections.push(`<h2>Expenses by Category</h2>
        <table><tr><th>#</th><th>Category</th><th class="right">Amount</th><th class="right">Count</th></tr>
        ${insights.expenses.byCategory.map((c, i) => `<tr><td>${i + 1}</td><td>${c.category}</td><td class="right">${fmtLKR(c.total)}</td><td class="right">${c.count}</td></tr>`).join("")}
        </table>`);
    }
    // Tool utilization
    if (insights.tools.utilization.length > 0) {
      sections.push(`<h2>Tool Utilization</h2>
        <table><tr><th>#</th><th>Tool</th><th>Code</th><th class="right">Issued</th><th class="right">Returned</th><th class="right">Lost</th><th class="right">Damaged</th></tr>
        ${insights.tools.utilization.map((t, i) => `<tr><td>${i + 1}</td><td>${t.toolName}</td><td>${t.toolCode ?? "—"}</td><td class="right">${t.issued}</td><td class="right">${t.returned}</td><td class="right">${t.lost}</td><td class="right">${t.damaged}</td></tr>`).join("")}
        </table>`);
    }
    // Cost summary
    if (insights.costSummary) {
      sections.push(`<h2>Cost Summary</h2>
        <table class="cost-table">
          <tr><td>Labor Cost</td><td class="right">${fmtLKR(insights.costSummary.labor)}</td></tr>
          <tr><td>Transport Cost</td><td class="right">${fmtLKR(insights.costSummary.transport)}</td></tr>
          <tr><td>Food & Beverage Cost</td><td class="right">${fmtLKR(insights.costSummary.foodBeverage)}</td></tr>
          <tr><td>Other Expenses</td><td class="right">${fmtLKR(insights.costSummary.expenses)}</td></tr>
          <tr class="total-row"><td>GRAND TOTAL</td><td class="right">${fmtLKR(insights.costSummary.grandTotal)}</td></tr>
        </table>`);
    }
    // Activity timeline
    if (insights.timeline.length > 0) {
      sections.push(`<h2>Activity Timeline</h2>
        <table><tr><th>#</th><th>Date</th><th>Action</th><th>Summary</th><th>By</th></tr>
        ${insights.timeline.slice(0, 30).map((t, i) => `<tr><td>${i + 1}</td><td>${fmtDate(t.createdAt)}</td><td>${t.action}</td><td>${t.summary}</td><td>${t.actorName ?? "System"}</td></tr>`).join("")}
        </table>`);
    }

    w.document.write(`<!DOCTYPE html><html><head><title>Job Detailed Report — ${j.orderNumber}</title>
      <style>
        @page { size: A4 portrait; margin: 15mm; }
        * { box-sizing: border-box; margin: 0; padding: 0; }
        body { font-family: 'Calibri', 'Arial', sans-serif; color: #1e293b; font-size: 10pt; }
        h1 { font-size: 16pt; margin-bottom: 4px; }
        h2 { font-size: 12pt; margin: 16px 0 6px; border-bottom: 2px solid #475569; padding-bottom: 3px; }
        .sub { color: #64748b; font-size: 9pt; margin-bottom: 12px; }
        .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 2px 24px; margin: 8px 0 12px; font-size: 10pt; }
        .info-grid .lbl { color: #64748b; font-weight: bold; }
        table { width: 100%; border-collapse: collapse; margin: 4px 0; font-size: 9pt; }
        th, td { border: 1px solid #94a3b8; padding: 3px 6px; text-align: left; }
        th { background: #e2e8f0; font-weight: bold; }
        .right { text-align: right; }
        .cost-table { max-width: 350px; }
        .total-row { font-weight: bold; background: #fef3c7; border-top: 2px solid #92400e; }
        .badge { display: inline-block; padding: 1px 6px; border-radius: 3px; font-size: 9pt; font-weight: bold; background: #fef3c7; color: #92400e; }
        @media print { body { -webkit-print-color-adjust: exact; print-color-adjust: exact; } }
      </style>
      </head><body>
      <h1>Project Detailed Report</h1>
      <p class="sub">Generated ${new Date().toLocaleString()}</p>
      <div class="info-grid">
        <div><span class="lbl">Order Number:</span> ${j.orderNumber}</div>
        <div><span class="lbl">Title:</span> ${j.title}</div>
        <div><span class="lbl">Status:</span> <span class="badge">${j.status}</span></div>
        <div><span class="lbl">Priority:</span> ${j.priority}</div>
        <div><span class="lbl">Created:</span> ${fmtDate(j.createdAt)}</div>
        <div><span class="lbl">Updated:</span> ${fmtDate(j.updatedAt)}</div>
      </div>
      ${sections.join("")}
      <p style="margin-top:16px;font-size:9pt;color:#64748b">— End of Report —</p>
      </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 500);
  }

  if (!open) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} aria-describedby={undefined} className="sm:max-w-[800px] max-h-[90vh] overflow-y-auto">
        <DialogTitle className="sr-only">Job Report</DialogTitle>
        <div className="flex items-center justify-between border-b border-border pb-3">
          <h2 className="flex items-center gap-2 text-lg font-bold">
            <FileText className="h-5 w-5 text-primary" />
            Job / Project / Site Report
          </h2>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={exportCSV} disabled={!insights}>
              <Download className="mr-1.5 h-4 w-4" /> CSV
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onOpenChange(false)}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {isLoading || !insights ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent mr-2" />
            Loading report data…
          </div>
        ) : (
          <div className="space-y-4 mt-4">
            {/* Print buttons */}
            <div className="flex flex-wrap gap-2">
              <Button variant="default" size="sm" onClick={printA4Report}>
                <Printer className="mr-1.5 h-4 w-4" />
                Print A4 Report (Materials · Labour · Expenses)
              </Button>
              <Button variant="outline" size="sm" onClick={printDetailedReport}>
                <FileText className="mr-1.5 h-4 w-4" />
                Print Detailed Report
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              The A4 Report produces a print-optimized A4 portrait report focused on Raw Materials, Labour Timing, and Other Expenses.
              The Detailed Report produces a multi-page full report with all data tables.
            </p>

            <Separator />

            {/* Summary cards */}
            <div>
              <h3 className="font-semibold text-base mb-3">{insights.job.orderNumber} — {insights.job.title}</h3>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <SummaryCard icon={Clock} label="Total Hours" value={`${insights.timeLogs.totalHours}h`} tint="bg-blue-500/10 text-blue-600" />
                <SummaryCard icon={Users} label="Workers" value={insights.timeLogs.hoursByWorker.length} tint="bg-indigo-500/10 text-indigo-600" />
                <SummaryCard icon={Truck} label="Transport Trips" value={insights.transports.total} tint="bg-cyan-500/10 text-cyan-600" />
                <SummaryCard icon={Utensils} label="Total Meals" value={insights.foodBeverage.totalMeals} tint="bg-orange-500/10 text-orange-600" />
                <SummaryCard icon={Wrench} label="Tool Issues" value={insights.tools.issuesCount} tint="bg-amber-500/10 text-amber-600" />
                <SummaryCard icon={Package} label="Goods Issues" value={insights.stock.issuesCount} tint="bg-emerald-500/10 text-emerald-600" />
              </div>
            </div>

            {/* Cost summary */}
            {insights.costSummary && (
              <div className="rounded-lg border border-border p-4">
                <h4 className="flex items-center gap-2 font-semibold mb-3">
                  <Wallet className="h-4 w-4 text-primary" /> Cost Summary
                </h4>
                <div className="space-y-1.5">
                  <CostRow label="Labor Cost" amount={insights.costSummary.labor} icon={Clock} />
                  <CostRow label="Transport Cost" amount={insights.costSummary.transport} icon={Truck} />
                  <CostRow label="Food & Beverage Cost" amount={insights.costSummary.foodBeverage} icon={Utensils} />
                  <CostRow label="Other Expenses" amount={insights.costSummary.expenses} icon={Wallet} />
                  <Separator className="my-2" />
                  <div className="flex items-center justify-between pt-1">
                    <span className="font-bold text-base">GRAND TOTAL</span>
                    <span className="font-bold text-lg text-primary">
                      {insights.costSummary.grandTotal.toLocaleString()} LKR
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Preview of categorized tables */}
            <div className="rounded-lg border border-border p-4">
              <h4 className="flex items-center gap-2 font-semibold mb-3">
                <FileText className="h-4 w-4 text-primary" /> Categorized Data Preview
              </h4>
              <div className="grid grid-cols-2 gap-4 text-xs">
                <div>
                  <p className="font-semibold mb-1 text-muted-foreground">Left Column</p>
                  {insights.timeLogs.hoursByWorker.length > 0 && (
                    <div className="mb-2">
                      <p className="font-bold text-[11px] bg-muted/50 px-1.5 py-0.5 rounded">Time Logs ({insights.timeLogs.hoursByWorker.length})</p>
                      {insights.timeLogs.hoursByWorker.slice(0, 5).map((w, i) => (
                        <div key={i} className="flex justify-between px-1.5 py-0.5 border-b border-border/50">
                          <span>{w.workerName}</span><span className="font-mono">{w.hours}h</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {insights.timeLogs.hoursByWorkType.length > 0 && (
                    <div className="mb-2">
                      <p className="font-bold text-[11px] bg-muted/50 px-1.5 py-0.5 rounded">Work Types ({insights.timeLogs.hoursByWorkType.length})</p>
                      {insights.timeLogs.hoursByWorkType.slice(0, 5).map((w, i) => (
                        <div key={i} className="flex justify-between px-1.5 py-0.5 border-b border-border/50">
                          <span className="capitalize">{w.workType}</span><span className="font-mono">{w.hours}h</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-semibold mb-1 text-muted-foreground">Right Column</p>
                  {insights.expenses.byCategory.length > 0 && (
                    <div className="mb-2">
                      <p className="font-bold text-[11px] bg-muted/50 px-1.5 py-0.5 rounded">Expenses ({insights.expenses.byCategory.length})</p>
                      {insights.expenses.byCategory.slice(0, 5).map((c, i) => (
                        <div key={i} className="flex justify-between px-1.5 py-0.5 border-b border-border/50">
                          <span className="capitalize">{c.category.replace(/_/g, " ")}</span><span className="font-mono">{c.total.toLocaleString()}</span>
                        </div>
                      ))}
                    </div>
                  )}
                  {insights.costSummary && (
                    <div>
                      <p className="font-bold text-[11px] bg-muted/50 px-1.5 py-0.5 rounded">Cost Summary</p>
                      <div className="flex justify-between px-1.5 py-0.5 border-b border-border/50"><span>Labor</span><span className="font-mono">{insights.costSummary.labor.toLocaleString()}</span></div>
                      <div className="flex justify-between px-1.5 py-0.5 border-b border-border/50"><span>Transport</span><span className="font-mono">{insights.costSummary.transport.toLocaleString()}</span></div>
                      <div className="flex justify-between px-1.5 py-0.5 border-b border-border/50"><span>F&B</span><span className="font-mono">{insights.costSummary.foodBeverage.toLocaleString()}</span></div>
                      <div className="flex justify-between px-1.5 py-0.5 border-b border-border/50 font-bold"><span>Grand Total</span><span className="font-mono">{insights.costSummary.grandTotal.toLocaleString()}</span></div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* ---- Helper components ---- */
function SummaryCard({ icon: Icon, label, value, tint }: { icon: any; label: string; value: any; tint: string }) {
  return (
    <div className="rounded-lg border border-border p-3">
      <div className={`mb-1 inline-flex h-7 w-7 items-center justify-center rounded ${tint}`}>
        <Icon className="h-4 w-4" />
      </div>
      <p className="text-lg font-bold tabular-nums">{value}</p>
      <p className="text-[11px] text-muted-foreground">{label}</p>
    </div>
  );
}

function CostRow({ label, amount, icon: Icon }: { label: string; amount: number; icon: any }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </span>
      <span className="font-mono font-semibold">{amount.toLocaleString()} LKR</span>
    </div>
  );
}
