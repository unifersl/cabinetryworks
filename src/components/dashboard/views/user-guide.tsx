"use client";

import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  Rocket,
  LayoutDashboard,
  ClipboardList,
  Building2,
  Ruler,
  Camera,
  Scissors,
  Boxes,
  ArrowLeftRight,
  DollarSign,
  CalendarCheck,
  BarChart3,
  Users,
  Settings,
  ScrollText,
  LayoutGrid,
  Keyboard,
  Lightbulb,
  AlertTriangle,
  Info,
  ChevronRight,
  Sun,
  Moon,
  Printer,
  FileSpreadsheet,
  PackageCheck,
  Wrench,
  Flag,
  CalendarRange,
  CalendarDays,
  Bug,
  GitBranch,
  MessageSquare,
  HardHat,
  PackageSearch,
  ShieldCheck,
  FolderArchive,
  LayoutTemplate,
  QrCode,
  TrendingUp,
  ClipboardCheck,
  Maximize2,
  ListChecks,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Small presentational helpers                                       */
/* ------------------------------------------------------------------ */

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex items-center justify-center rounded border border-border bg-muted px-1.5 py-0.5 text-xs font-mono text-foreground/80 shadow-[0_1px_0_rgb(0_0_0/0.08)]">
      {children}
    </kbd>
  );
}

function Tip({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 flex gap-2.5 border border-amber-500/30 bg-amber-500/5 rounded-md p-3">
      <Lightbulb className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
      <div className="text-sm text-foreground/90">{children}</div>
    </div>
  );
}

function Warn({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 flex gap-2.5 border border-rose-500/30 bg-rose-500/5 rounded-md p-3">
      <AlertTriangle className="h-4 w-4 shrink-0 text-rose-600 mt-0.5" />
      <div className="text-sm text-foreground/90">{children}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-3 flex gap-2.5 border border-sky-500/30 bg-sky-500/5 rounded-md p-3">
      <Info className="h-4 w-4 shrink-0 text-sky-600 mt-0.5" />
      <div className="text-sm text-foreground/90">{children}</div>
    </div>
  );
}

function Step({
  n,
  title,
  children,
}: {
  n: number;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 py-1.5">
      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary tabular-nums">
        {n}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <div className="text-sm text-muted-foreground mt-0.5">{children}</div>
      </div>
    </div>
  );
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-base font-semibold text-foreground mt-5 mb-2">
      {children}
    </h3>
  );
}

function Bullets({ children }: { children: React.ReactNode }) {
  const items = React.Children.toArray(children).filter(Boolean);
  return (
    <ul className="space-y-1.5">
      {items.map((it, i) => (
        <li key={i} className="flex gap-2 text-sm text-muted-foreground">
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-primary/70 mt-1" />
          <span className="flex-1">{it}</span>
        </li>
      ))}
    </ul>
  );
}

function RelatedLinks({ links }: { links: { id: string; label: string }[] }) {
  return (
    <div className="mt-4 pt-3 border-t border-border/60">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1.5">
        Related sections
      </p>
      <div className="flex flex-wrap gap-1.5">
        {links.map((l) => (
          <button
            key={l.id}
            onClick={() => scrollToSection(l.id)}
            className="inline-flex items-center gap-1 rounded-full border border-border bg-background px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <ChevronRight className="h-3 w-3" />
            {l.label}
          </button>
        ))}
      </div>
    </div>
  );
}

function SectionCard({
  id,
  icon: Icon,
  number,
  title,
  description,
  children,
}: {
  id: string;
  icon: React.ComponentType<{ className?: string }>;
  number: number;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-4">
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="flex items-center gap-2 text-lg font-bold">
                <span className="text-muted-foreground/60 tabular-nums">
                  {String(number).padStart(2, "0")}
                </span>
                {title}
              </CardTitle>
              <CardDescription className="mt-1">{description}</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          {children}
        </CardContent>
      </Card>
    </section>
  );
}

function CodeBlock({ children }: { children: string }) {
  return (
    <pre className="my-3 overflow-x-auto rounded-md border border-border bg-muted/60 p-3 text-xs font-mono text-foreground/90">
      <code>{children}</code>
    </pre>
  );
}

/* ------------------------------------------------------------------ */
/*  Section TOC                                                        */
/* ------------------------------------------------------------------ */

interface SectionMeta {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const SECTIONS: SectionMeta[] = [
  { id: "getting-started", label: "Getting Started", icon: Rocket },
  { id: "overview", label: "Overview Dashboard", icon: LayoutDashboard },
  { id: "job-orders", label: "Job Orders", icon: ClipboardList },
  { id: "customers", label: "Customers", icon: Building2 },
  { id: "measurements", label: "Site Measurements", icon: Ruler },
  { id: "site-notebook", label: "Site Notebook Builder", icon: Camera },
  { id: "cutting-lists", label: "Factory Cutting Lists", icon: Scissors },
  { id: "inventory", label: "Inventory Management", icon: Boxes },
  { id: "stock-logic", label: "Stock Operation Logic", icon: ArrowLeftRight },
  { id: "quotes", label: "Quotes & Costing", icon: DollarSign },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "reports", label: "Reports", icon: BarChart3 },
  { id: "users", label: "User Management", icon: Users },
  { id: "settings", label: "System Settings", icon: Settings },
  { id: "audit", label: "Audit Log", icon: ScrollText },
  { id: "add-ons", label: "Add-on Modules", icon: LayoutGrid },
  { id: "shortcuts", label: "Keyboard Shortcuts", icon: Keyboard },
];

function scrollToSection(id: string) {
  if (typeof document === "undefined") return;
  const el = document.getElementById(id);
  if (el) {
    el.scrollIntoView({ behavior: "smooth", block: "start" });
  }
}

/* ------------------------------------------------------------------ */
/*  Main view                                                          */
/* ------------------------------------------------------------------ */

export function UserGuideView() {
  const [activeId, setActiveId] = React.useState<string>("getting-started");

  // Track which section is currently in view for the TOC highlight.
  React.useEffect(() => {
    if (typeof window === "undefined") return;
    const observer = new IntersectionObserver(
      (entries) => {
        // Pick the entry closest to the top that is intersecting.
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]?.target.id) {
          setActiveId(visible[0].target.id);
        }
      },
      { rootMargin: "-80px 0px -70% 0px", threshold: 0 }
    );
    SECTIONS.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) observer.observe(el);
    });
    return () => observer.disconnect();
  }, []);

  return (
    <div className="space-y-4 pb-6">
      {/* Page header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold tracking-tight">
            <BookOpen className="h-5 w-5 text-primary" />
            User Guide
          </h1>
          <p className="text-sm text-muted-foreground">
            Comprehensive manual for the CabinetryWorks Manufacturing Console
            v2.0 — covering every module, workflow, and shortcut.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.print()}
          className="self-start"
        >
          <Printer className="mr-2 h-4 w-4" />
          Print / Save PDF
        </Button>
      </div>

      {/* Layout: TOC sidebar + content */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)]">
        {/* Sticky TOC */}
        <aside className="hidden lg:block">
          <div className="sticky top-0 max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-warm pr-2">
            <Card className="border-border/60">
              <CardHeader className="px-3 py-3">
                <CardTitle className="flex items-center gap-2 text-sm">
                  <ListChecks className="h-4 w-4 text-primary" />
                  Contents
                </CardTitle>
              </CardHeader>
              <CardContent className="px-2 pb-3 pt-0">
                <nav className="flex flex-col gap-0.5">
                  {SECTIONS.map((s, i) => {
                    const Icon = s.icon;
                    const isActive = activeId === s.id;
                    return (
                      <button
                        key={s.id}
                        onClick={() => scrollToSection(s.id)}
                        className={`flex items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs transition-colors ${
                          isActive
                            ? "bg-primary/10 font-medium text-primary"
                            : "text-muted-foreground hover:bg-muted hover:text-foreground"
                        }`}
                      >
                        <Icon className="h-3.5 w-3.5 shrink-0" />
                        <span className="flex-1 truncate">
                          <span className="tabular-nums text-muted-foreground/70">
                            {String(i + 1).padStart(2, "0")}{" "}
                          </span>
                          {s.label}
                        </span>
                      </button>
                    );
                  })}
                </nav>
              </CardContent>
            </Card>
          </div>
        </aside>

        {/* Content */}
        <div className="space-y-5 min-w-0">
          {/* ===== 1. Getting Started ===== */}
          <SectionCard
            id="getting-started"
            icon={Rocket}
            number={1}
            title="Getting Started"
            description="Sign in, navigate the console, and switch themes."
          >
            <SubHeading>Account Access</SubHeading>
            <p className="text-sm">
              Your system administrator will provide your login credentials.
              Two roles are available:
            </p>
            <CodeBlock>{`Admin / Super Admin  →  Full access to all modules, stock override, user management
Technician           →  Simplified mobile/tablet view (Site Measurement, Notebook, Cutting Lists)`}</CodeBlock>
            <Tip>
              Use the <strong>role selector</strong> on the login screen to
              pre-fill your role for a quicker sign-in.
            </Tip>

            <SubHeading>Role-based access</SubHeading>
            <Bullets>
                <span>
                  <strong>Admin / SuperAdmin</strong> — full access: Overview
                  Job Orders, Customers, Inventory, Suppliers, Quotes, Reports
                  User Management, Settings, Audit Log, and all add-on modules.
                </span>
                <span>
                  <strong>Technician</strong> — focused field set: Job Orders
                  Site Measurements, Site Notebook Builder, Factory Cutting
                  Lists, My Jobs, plus any enabled field add-ons (QC, Barcode
                  Site Visits, Punch List).
                </span>
            </Bullets>
            <Warn>
              The sidebar only displays modules your role is permitted to see.
              Even if you know the URL of a hidden module, the backend API
              enforces RBAC and will reject the request.
            </Warn>

            <SubHeading>Navigation overview</SubHeading>
            <Bullets>
                <span>
                  <strong>Sidebar</strong> — primary navigation. Collapsible on
                  desktop (click “Collapse sidebar” at the bottom); opens as a
                  slide-in <em>Sheet</em> on mobile via the hamburger icon.
                </span>
                <span>
                  <strong>Command palette</strong> — press{" "}
                  <Kbd>⌘K</Kbd> (macOS) or <Kbd>Ctrl</Kbd>+
                  <Kbd>K</Kbd> (Windows/Linux) anywhere to open a fuzzy search
                  over jobs, customers, items, modules, and quick actions.
                </span>
                <span>
                  <strong>Topbar</strong> — shows current module title
                  search trigger, quick module toggle (
                  <LayoutGrid className="inline h-3.5 w-3.5" />), notifications
                  bell, theme toggle, and user menu.
                </span>
                <span>
                  <strong>Footer</strong> — copyright / legal notice button +
                  live system status indicator (green dot).
                </span>
            </Bullets>

            <SubHeading>Theme toggle</SubHeading>
            <p>
              Click the <Sun className="inline h-3.5 w-3.5" /> /
              <Moon className="inline h-3.5 w-3.5" /> icon in the topbar to
              switch between light and dark modes. On mobile, find it inside the{" "}
              <strong>More (⋮)</strong> dropdown. Your choice is persisted to{" "}
              <code className="rounded bg-muted px-1">localStorage</code> and
              applied on the next load.
            </p>
            <Note>
              The console auto-signs-out after <strong>30 minutes</strong> of
              inactivity. Any unsaved form data will be lost — always click
              “Save” before stepping away.
            </Note>

            <RelatedLinks
              links={[
                { id: "overview", label: "Overview Dashboard" },
                { id: "job-orders", label: "Job Orders" },
                { id: "shortcuts", label: "Keyboard Shortcuts" },
              ]}
            />
          </SectionCard>

          {/* ===== 2. Overview Dashboard ===== */}
          <SectionCard
            id="overview"
            icon={LayoutDashboard}
            number={2}
            title="Overview Dashboard"
            description="At-a-glance production snapshot, KPIs, and charts."
          >
            <SubHeading>Today’s Snapshot</SubHeading>
            <p>
              A greeting banner up top shows the signed-in user, today’s date,
              and three live counters: <strong>Active jobs</strong>,{" "}
              <strong>Pending jobs</strong>, and <strong>Overdue jobs</strong>.
              Click any counter to jump straight into the filtered Job Orders
              view.
            </p>

            <SubHeading>Stat cards</SubHeading>
            <Bullets>
                <span>
                  Four stat cards: Total Jobs, In Production, Completed (30d)
                  Pending Approval.
                </span>
                <span>
                  Each card shows a trend arrow (
                  <TrendingUp className="inline h-3.5 w-3.5 text-emerald-600" />{" "}
                  up / <TrendingUp className="inline h-3.5 w-3.5 rotate-180 text-rose-600" />{" "}
                  down) comparing this period to the previous.
                </span>
                <span>
                  Cards are <strong>clickable</strong> — they navigate to the
                  relevant filtered view (e.g. Job Orders filtered by status).
                </span>
            </Bullets>

            <SubHeading>Needs Attention panel</SubHeading>
            <p>Five KPI chips surface items that need a human decision:</p>
            <Bullets>
                <span>
                  <strong>Pending</strong> — jobs not yet started.
                </span>
                <span>
                  <strong>Urgent</strong> — priority = Urgent &amp; not
                  Completed.
                </span>
                <span>
                  <strong>High</strong> — priority = High &amp; not Completed.
                </span>
                <span>
                  <strong>Low Stock</strong> — inventory items at or below
                  reorder level.
                </span>
                <span>
                  <strong>Overdue</strong> — past due date &amp; not Completed.
                </span>
            </Bullets>

            <SubHeading>Charts</SubHeading>
            <Bullets>
                <span>
                  <strong>Job Throughput</strong> — area chart of created vs
                  completed jobs. Toggle <Kbd>7d</Kbd> / <Kbd>30d</Kbd> /{" "}
                  <Kbd>90d</Kbd> in the top-right.
                </span>
                <span>
                  <strong>Status Distribution</strong> — donut chart with
                  legend; hover a slice to see count &amp; percentage.
                </span>
                <span>
                  <strong>Priority Breakdown</strong> — horizontal bar chart by
                  priority level.
                </span>
                <span>
                  <strong>Material Usage</strong> — donut chart aggregating
                  cutting-list material consumption.
                </span>
                <span>
                  <strong>Technician Workload</strong> — bar chart showing how
                  many jobs each technician is assigned.
                </span>
            </Bullets>

            <SubHeading>Recent Activity feed</SubHeading>
            <p>
              A live, scrolling list of recent system events (jobs created,
              status changes, stock movements, logins). Use the quick filter
              chips above the feed to scope by event type.
            </p>

            <SubHeading>Inventory Alerts (collapsible)</SubHeading>
            <p>
              An accordion panel below the activity feed lists every item that
              has fallen at or below its reorder level. Expand the section to
              see item name, current stock, reorder level, and a “Restock”
              shortcut that opens the relevant stock request form.
            </p>
            <Tip>
              Pin the Overview tab in a browser window on a wall-mounted TV to
              give the whole floor a live view of production health.
            </Tip>
            <RelatedLinks
              links={[
                { id: "job-orders", label: "Job Orders" },
                { id: "inventory", label: "Inventory Management" },
                { id: "reports", label: "Reports" },
              ]}
            />
          </SectionCard>

          {/* ===== 3. Job Orders ===== */}
          <SectionCard
            id="job-orders"
            icon={ClipboardList}
            number={3}
            title="Job Orders"
            description="The production pipeline — table, kanban board, and calendar."
          >
            <SubHeading>Creating a new job order</SubHeading>
            <Step n={1} title="Open the dialog">
              Click the <strong>“New Job”</strong> button in the top-right of
              the Job Orders view.
            </Step>
            <Step n={2} title="Pick a customer">
              Select an existing customer or jump to <em>Customers</em> to add a
              new one. The customer’s phone &amp; address auto-fill the job
              reference card.
            </Step>
            <Step n={3} title="Enter job details">
              Provide job title, description, priority (Low/Medium/High/Urgent),
              due date, and assignee. The system auto-generates a sequential job
              number (e.g. <code className="rounded bg-muted px-1">KCM-00021</code>).
            </Step>
            <Step n={4} title="Save">
              Click <strong>Create Job</strong>. The new job appears in the
              table, the kanban board, and the Overview dashboard instantly.
            </Step>

            <SubHeading>View modes</SubHeading>
            <Bullets>
                <span>
                  <strong>Table</strong> — sortable columns, dense rows, ideal
                  for admin work.
                </span>
                <span>
                  <strong>Board (Kanban)</strong> — drag-and-drop cards between
                  status columns. Great for daily stand-ups.
                </span>
                <span>
                  <strong>Calendar</strong> — month grid keyed off due date.
                  Click a day to see that day’s jobs.
                </span>
            </Bullets>

            <SubHeading>Filters &amp; search</SubHeading>
            <p>
              Above the table, combine any of: <strong>Status</strong> (single
              or all), <strong>Priority</strong>, <strong>Assigned to</strong>,
              plus a free-text <strong>Search</strong> box that matches job
              number, title, customer name, or description.
            </p>

            <SubHeading>Bulk actions</SubHeading>
            <Step n={1} title="Select rows">
              Tick the checkbox in the leftmost column of each row you want to
              affect. Use the master checkbox in the header to select all.
            </Step>
            <Step n={2} title="Pick an action">
              A bulk-action bar appears: <strong>Set Status</strong>,{" "}
              <strong>Assign</strong>, <strong>Export (CSV)</strong>,{" "}
              <strong>Delete</strong>.
            </Step>
            <Step n={3} title="Confirm">
              Destructive actions (Delete) require an extra confirmation dialog.
            </Step>

            <SubHeading>Row actions (⋯)</SubHeading>
            <p>
              Each row has a <strong>⋯</strong> dropdown on the right with:
            </p>
            <Bullets>
                <span>
                  <strong>View / Edit</strong> — opens the Job Detail sheet.
                </span>
                <span>
                  <strong>Set Status →</strong> submenu to jump the job to any
                  status instantly.
                </span>
                <span>
                  <strong>Duplicate</strong> — clones the job (without
                  measurements/cutting lists).
                </span>
                <span>
                  <strong>Delete</strong> — confirmation required.
                </span>
            </Bullets>

            <SubHeading>Right-click context menu</SubHeading>
            <p>
              Right-click any row to get the same actions as the{" "}
              <strong>⋯</strong> menu, plus <em>“Copy job number”</em> for
              quick pasting into emails.
            </p>

            <SubHeading>Keyboard shortcuts</SubHeading>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>Del</Kbd> delete selected
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>Ctrl</Kbd>+<Kbd>D</Kbd> duplicate
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>↑</Kbd>/<Kbd>↓</Kbd> move selection
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>Ctrl</Kbd>+<Kbd>A</Kbd> select all
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>Esc</Kbd> clear selection
              </span>
            </div>

            <SubHeading>Job detail sheet</SubHeading>
            <p>
              Click any row (or use <strong>View / Edit</strong> in the menu) to
              open a right-side <strong>Sheet</strong> with full job context.
              Tabs include:
            </p>
            <Bullets>
                <span>
                  <strong>Overview</strong> — inline status/priority/assignee
                  selectors (admin only), customer card, metadata tiles
                  activity timeline.
                </span>
                <span>
                  <strong>Measurements</strong> — site measurements for this
                  job.
                </span>
                <span>
                  <strong>Cutting Lists</strong> — every cutting list for the
                  job, with CSV export per list.
                </span>
                <span>
                  <strong>Stock</strong> — stock issues, returns, and outside
                  purchases tied to the job.
                </span>
                <span>
                  <strong>Notes &amp; Files</strong> — attachments, change
                  orders, punch items, communications.
                </span>
            </Bullets>
            <RelatedLinks
              links={[
                { id: "customers", label: "Customers" },
                { id: "measurements", label: "Site Measurements" },
                { id: "cutting-lists", label: "Factory Cutting Lists" },
                { id: "shortcuts", label: "Keyboard Shortcuts" },
              ]}
            />
          </SectionCard>

          {/* ===== 4. Customers ===== */}
          <SectionCard
            id="customers"
            icon={Building2}
            number={4}
            title="Customers"
            description="Manage the client directory and their full job history."
          >
            <SubHeading>Adding a customer</SubHeading>
            <Step n={1} title="Open the dialog">
              Click <strong>New Customer</strong> in the Customers view.
            </Step>
            <Step n={2} title="Fill the form">
              Name, phone, email, address, and notes. Email must be unique
              across the directory.
            </Step>
            <Step n={3} title="Save">
              Click <strong>Create</strong>. The new customer appears in the
              searchable table immediately.
            </Step>
            <Tip>
              Add customers ahead of time so the Job Order dialog auto-suggests
              them — saves typing on the shop floor.
            </Tip>

            <SubHeading>Customer detail view</SubHeading>
            <p>
              Click any customer row to open a right-side detail sheet showing
              contact info, total jobs, total quoted value, plus tabs for Jobs,
              Quotes, Statements, and Communications.
            </p>

            <SubHeading>Job history per customer</SubHeading>
            <p>
              The detail sheet’s <strong>Jobs</strong> tab lists every job for
              that customer, sortable by status and date. Click any job to jump
              to the Job Detail sheet.
            </p>
            <RelatedLinks
              links={[
                { id: "job-orders", label: "Job Orders" },
                { id: "quotes", label: "Quotes & Costing" },
              ]}
            />
          </SectionCard>

          {/* ===== 5. Site Measurements ===== */}
          <SectionCard
            id="measurements"
            icon={Ruler}
            number={5}
            title="Site Measurements"
            description="Capture on-site wall dimensions and generate material requirements."
          >
            <SubHeading>Recording site measurements</SubHeading>
            <Step n={1} title="Open the form">
              Click <strong>New Measurement</strong> in the Site Measurements
              view.
            </Step>
            <Step n={2} title="Pick a job">
              Select the linked job (required). Customer &amp; site address
              auto-fill.
            </Step>
            <Step n={3} title="Enter room &amp; wall dimensions">
              Specify room type, then enter each wall’s length (mm), height
              (mm), plus notes about openings, corners, or obstructions.
            </Step>
            <Step n={4} title="Save">
              The measurement is saved and can be opened later from the
              measurement card grid.
            </Step>

            <SubHeading>Wall dimensions</SubHeading>
            <p>
              Each wall records <strong>length</strong>, <strong>height</strong>,{" "}
              <strong>thickness</strong>, and any obstructions (doors, windows,
              columns). Add multiple walls per measurement to model the entire
              room.
            </p>

            <SubHeading>Generate material requirements</SubHeading>
            <p>
              From any saved measurement, click <strong>Generate Material
              Requirements</strong>. The system cross-references the wall
              dimensions with cabinet module types and produces a list of
              required board, edge banding, hardware, and consumables — which can
              then be pushed to a Stock Request.
            </p>
            <Tip>
              Always re-measure before cutting list generation — even a 5 mm wall
              out-of-plumb can ruin a base cabinet fit.
            </Tip>
            <RelatedLinks
              links={[
                { id: "site-notebook", label: "Site Notebook Builder" },
                { id: "cutting-lists", label: "Factory Cutting Lists" },
                { id: "stock-logic", label: "Stock Operation Logic" },
              ]}
            />
          </SectionCard>

          {/* ===== 6. Site Notebook Builder ===== */}
          <SectionCard
            id="site-notebook"
            icon={Camera}
            number={6}
            title="Site Notebook Builder"
            description="Drag-and-drop elevation design plus per-module cutting lists."
          >
            <SubHeading>Site Information form</SubHeading>
            <p>
              The top of the builder shows a single-row form: site name, job
              number, job date, section type (Wall A / Base Units, Wall Units,
              Tall Unit / Appliance Tower, Island / Ceiling), and overall
              dimensions (width × height × depth in mm).
            </p>

            <SubHeading>Elevation Blueprint</SubHeading>
            <p>
              A CorelDRAW-style canvas with grid + rulers lets you lay out
              cabinet modules against the wall elevation.
            </p>

            <SubHeading>Drag palette (27 cabinet types)</SubHeading>
            <p>
              The left palette lists every standard cabinet type — Base Cabinet,
              Wall Cabinet, Sink Unit (Zink), Hob Unit, Cooker Hood Space, Up-Lift
              Flap Cabinet, Appliance Tower, Fridge Space, Window Clearance,
              Oven Housing, Microwave Housing, Dishwasher Space, Washing Machine
              Space, Wine Rack Unit, Spice Rack Pull-out, Corner Base Unit,
              Corner Wall Unit, Pantry Tall Unit, Open Shelving Unit, Plinth /
              Kickboard, Cornice / Crown Moulding, End Panel / Bullnose, Glass
              Display Cabinet, Bin Pull-out Unit, Appliance Garage, Plate Rack
              Unit, Tray Divider Unit.
            </p>
            <p>
              <strong>Drag</strong> any palette item onto the canvas to place
              it, or <strong>double-click</strong> to drop it at the cursor.
            </p>

            <SubHeading>Canvas with grid &amp; rulers</SubHeading>
            <Bullets>
                <span>
                  Top ruler shows horizontal mm scale; left ruler shows vertical
                  mm scale.
                </span>
                <span>
                  Grid dots every 100 mm help you eyeball cabinet widths.
                </span>
                <span>
                  The overall wall outline is drawn from the Site Information
                  dimensions, so modules snap inside the wall footprint.
                </span>
            </Bullets>

            <SubHeading>Snap modes</SubHeading>
            <p>Choose a snap mode from the toolbar:</p>
            <Bullets>
                <span>
                  <strong>OFF (Free)</strong> — no snapping; place anywhere.
                </span>
                <span>
                  <strong>Edges</strong> — snaps to module edges (left/right/top
                  of neighbours).
                </span>
                <span>
                  <strong>Grid</strong> — snaps to the 100 mm grid.
                </span>
            </Bullets>
            <SubHeading>Snap threshold</SubHeading>
            <p>
              Choose how aggressively snapping engages:{" "}
              <Kbd>10</Kbd> / <Kbd>25</Kbd> / <Kbd>50</Kbd> / <Kbd>100</Kbd> mm.
              A larger threshold makes the canvas feel “stickier” — useful for
              coarse layouts; smaller for fine adjustments.
            </p>

            <SubHeading>8-node resize handles</SubHeading>
            <p>
              Select a module to reveal eight resize handles — four corners and
              four midpoints — CorelDRAW-style. Drag any handle to resize;
              dimensions update live in the Properties panel.
            </p>

            <SubHeading>Multi-select</SubHeading>
            <Bullets>
                <span>
                  <strong>Shift+Click</strong> each module to add it to the
                  selection.
                </span>
                <span>
                  <strong>Shift+Drag</strong> to draw a marquee rectangle; all
                  modules inside the marquee are selected.
                </span>
                <span>
                  Multi-selected modules can be moved, aligned, duplicated, or
                  deleted as a group.
                </span>
            </Bullets>

            <SubHeading>Right-click context menu</SubHeading>
            <p>Right-click a module (or selection) for quick actions:</p>
            <Bullets>
                <span>Duplicate, Delete, Bring to Front, Send to Back.</span>
                <span>Align (Left / Right / Top / Bottom / Centers).</span>
                <span>Distribute Horizontally / Vertically.</span>
                <span>Set Type → submenu to swap cabinet type.</span>
                <span>Open Cutting List for this module.</span>
            </Bullets>

            <SubHeading>Properties panel</SubHeading>
            <p>
              The right-side Properties panel shows numeric inputs for{" "}
              <strong>W</strong>, <strong>H</strong>, <strong>X</strong>,{" "}
              <strong>Y</strong>, plus dropdowns for type, opening style, drawer
              configuration, shelf configuration, and a notes field. Type a value
              and press <Kbd>Enter</Kbd> to apply.
            </p>

            <SubHeading>Keyboard shortcuts (Elevation Canvas)</SubHeading>
            <div className="flex flex-wrap gap-2">
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>Del</Kbd> delete
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>Ctrl</Kbd>+<Kbd>D</Kbd> duplicate
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> undo
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>Z</Kbd> redo
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>↑↓←→</Kbd> nudge 1 mm
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>Ctrl</Kbd>+<Kbd>A</Kbd> select all
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>Esc</Kbd> deselect
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>+</Kbd>/<Kbd>−</Kbd> zoom
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>0</Kbd> reset zoom
              </span>
              <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Kbd>F</Kbd> fullscreen
              </span>
            </div>

            <SubHeading>Zoom controls</SubHeading>
            <Bullets>
                <span>
                  Zoom slider in the bottom-right (range 25%–400%).
                </span>
                <span>
                  <Kbd>+</Kbd> / <Kbd>−</Kbd> buttons for one-step zoom.
                </span>
                <span>
                  <strong>100%</strong> button to reset.
                </span>
                <span>
                  <strong>Fit</strong> button auto-scales to fit all modules in
                  view.
                </span>
            </Bullets>

            <SubHeading>Pan &amp; fullscreen</SubHeading>
            <Bullets>
                <span>
                  Hold <Kbd>Space</Kbd> and drag to pan the canvas. The cursor
                  changes to a hand to confirm pan mode.
                </span>
                <span>
                  Click <Maximize2 className="inline h-3.5 w-3.5" />{" "}
                  <strong>Fullscreen</strong> in the toolbar to expand the
                  canvas to the full viewport (great for site presentations).
                  Press <Kbd>Esc</Kbd> to exit.
                </span>
            </Bullets>

            <SubHeading>Module Cutting Lists</SubHeading>
            <p>
              Each module has its own cutting list with these column headers:
            </p>
            <Bullets>
                <span><strong>Length</strong> (mm) — part length.</span>
                <span><strong>Width</strong> (mm) — part width.</span>
                <span><strong>Qty</strong> — number of identical parts.</span>
                <span>
                  <strong>Material</strong> — Standard Board, PVC Board, Glass
                  Door, Backing.
                </span>
                <span>
                  <strong>Note</strong> — component type: Side Panel, Shelf
                  Top/Bottom, Divider, Door Front, Back Panel, Plinth, Cornice.
                </span>
            </Bullets>

            <SubHeading>Summary bar</SubHeading>
            <p>
              Below the cutting list, a summary bar shows three live metrics:
            </p>
            <Bullets>
                <span><strong>Total pieces</strong> — sum of all qty.</span>
                <span>
                  <strong>Total area</strong> — sum of (length × width × qty)
                  in m².
                </span>
                <span>
                  <strong>Sheets needed</strong> — area × 1.15 wastage ÷ 2.977
                  m² per sheet, rounded up.
                </span>
            </Bullets>

            <SubHeading>Check Stock button</SubHeading>
            <p>
              Click <strong>Check Stock</strong> to query inventory for the
              material tags used in the cutting list. A side panel shows
              available quantity per matched inventory item; any shortfall is
              highlighted in red.
            </p>

            <SubHeading>Sync shortages to Stock Requests</SubHeading>
            <p>
              If shortfalls exist, the dialog offers a{" "}
              <strong>“Create Stock Request”</strong> button that pre-fills a
              request with every short item, the linked job, and the warehouse
              with the most stock — ready to submit for approval.
            </p>
            <Tip>
              Use <Kbd>Ctrl</Kbd>+<Kbd>D</Kbd> to duplicate a module when laying
              out identical adjacent cabinets — much faster than re-dragging from
              the palette.
            </Tip>
            <RelatedLinks
              links={[
                { id: "cutting-lists", label: "Factory Cutting Lists" },
                { id: "inventory", label: "Inventory Management" },
                { id: "stock-logic", label: "Stock Operation Logic" },
                { id: "shortcuts", label: "Keyboard Shortcuts" },
              ]}
            />
          </SectionCard>

          {/* ===== 7. Factory Cutting Lists ===== */}
          <SectionCard
            id="cutting-lists"
            icon={Scissors}
            number={7}
            title="Factory Cutting Lists"
            description="Generate shop-floor-ready cut lists with nesting &amp; print support."
          >
            <SubHeading>Creating a cutting list</SubHeading>
            <Step n={1} title="Open the dialog">
              Click <strong>New Cutting List</strong> in the Factory Cutting
              Lists view, or open the Job Detail sheet and use the Cutting
              Lists tab.
            </Step>
            <Step n={2} title="Pick a job (required)">
              Every cutting list must be linked to a job — the system rejects
              creation without one. This ensures stock deductions always
              attribute to a job.
            </Step>
            <Step n={3} title="Add line items">
              For each part: length (mm), width (mm), thickness (mm), qty,
              material, edge banding, and a note (e.g. “Side Panel LH”).
            </Step>
            <Step n={4} title="Save &amp; deduct stock">
              On save, the system automatically deducts the consumed material
              from inventory (FIFO across stock lots). The deduction is recorded
              against the linked job.
            </Step>
            <Warn>
              Deleting a cutting list <strong>restores</strong> the deducted
              stock back to inventory. Use with care on production-floor lists
              where material has already been consumed.
            </Warn>

            <SubHeading>Part editor with column headers</SubHeading>
            <p>
              The inline editor displays a grid with column headers (Part,
              Length, Width, Thickness, Qty, Material, Edge Banding, Note) so
              you can scan &amp; edit many rows at once.
            </p>

            <SubHeading>Nesting dialog</SubHeading>
            <p>
              Click <strong>Nest</strong> on any cutting list to open the
              nesting dialog. The system lays every part out on standard{" "}
              <code className="rounded bg-muted px-1">2440 × 1220 mm</code>{" "}
              sheets, showing:
            </p>
            <Bullets>
                <span>Number of sheets required.</span>
                <span>Per-sheet utilization percentage.</span>
                <span>Visual preview of part placement.</span>
                <span>Total offcut area (waste).</span>
            </Bullets>

            <SubHeading>Printable cutting list</SubHeading>
            <p>
              Click <Printer className="inline h-3.5 w-3.5" />{" "}
              <strong>Print</strong> to open a print-optimized layout — one page
              per cutting list with job number, customer, material breakdown,
              and part table — ready to clip to the cutting machine. Use the
              browser’s “Save as PDF” option to archive.
            </p>
            <RelatedLinks
              links={[
                { id: "site-notebook", label: "Site Notebook Builder" },
                { id: "stock-logic", label: "Stock Operation Logic" },
                { id: "inventory", label: "Inventory Management" },
              ]}
            />
          </SectionCard>

          {/* ===== 8. Inventory Management ===== */}
          <SectionCard
            id="inventory"
            icon={Boxes}
            number={8}
            title="Inventory Management"
            description="Multi-warehouse stock, transfers, requests, issues, returns &amp; reports."
          >
            <SubHeading>Dashboard</SubHeading>
            <p>The Inventory landing page surfaces four widgets:</p>
            <Bullets>
                <span><strong>Stock Value</strong> — total value of all on-hand stock.</span>
                <span>
                  <strong>KPIs</strong> — total items, low-stock count
                  out-of-stock count, pending requests.
                </span>
                <span>
                  <strong>Recent Activity</strong> — last 20 stock movements
                  (issues, returns, transfers, adjustments).
                </span>
                <span>
                  <strong>Low Stock</strong> — items at or below reorder level
                  sorted by urgency.
                </span>
                <span>
                  <strong>Warehouse Capacity</strong> — utilization per
                  warehouse.
                </span>
            </Bullets>

            <SubHeading>Items tab</SubHeading>
            <p>
              Full CRUD for inventory items: name, SKU, category, material,
              unit, reorder level, unit cost, and current stock level. Search
              by name or SKU; filter by category.
            </p>

            <SubHeading>Warehouses tab</SubHeading>
            <p>
              Multi-warehouse support — add named warehouses (e.g. “Main Store”,
              “Site Van 1”). Each item’s stock is broken down per warehouse via
              the <code className="rounded bg-muted px-1">StockLot</code> table.
            </p>

            <SubHeading>Categories tab</SubHeading>
            <p>
              Organize items into categories (Board, Hardware, Edge Banding,
              Adhesive, etc.). Categories drive filtering and reporting.
            </p>

            <SubHeading>Transfers tab</SubHeading>
            <p>
              Warehouse-to-warehouse stock moves. Each transfer records source,
              destination, item, qty, date, and operator. The system validates
              that the source warehouse has enough stock before deducting (FIFO)
              and adding to the destination.
            </p>

            <SubHeading>Stock Take tab</SubHeading>
            <p>
              Count reconciliation: create a stock-take session, list every item
              with system qty, enter counted qty, and post the adjustment. The
              variance becomes a <strong>Stock Adjustment</strong> record (which
              requires a reason ≥5 characters).
            </p>

            <SubHeading>Requests tab</SubHeading>
            <p>
              Stock requests flow through three statuses:{" "}
              <Badge variant="secondary" className="mx-1">Pending</Badge> →
              <Badge variant="secondary" className="mx-1">Approved</Badge> →
              <Badge variant="secondary" className="mx-1">Issued</Badge>. Every
              request must be linked to a job.
            </p>

            <SubHeading>Issues tab</SubHeading>
            <p>
              <strong>Goods Issue</strong> deducts stock from a warehouse.
              Requires a job link. The system checks that enough stock exists
              before deducting (FIFO across lots in the chosen warehouse).
            </p>

            <SubHeading>Returns tab</SubHeading>
            <p>
              <strong>Goods Return</strong> adds stock back. Items must have
              been previously issued to (or outside-purchased for) the exact
              same job. Return qty ≤ available (issued − already returned).
            </p>

            <SubHeading>Outside Purchase tab</SubHeading>
            <p>
              <strong>Outside Purchase</strong> records items bought directly
              for a site (bypassing main warehouse). Requires a job. When status
              becomes <em>“Received”</em>, the items are added to the chosen
              warehouse as a new lot.
            </p>

            <SubHeading>Reports tab</SubHeading>
            <Bullets>
                <span><strong>Stock Level</strong> — current levels per item/warehouse.</span>
                <span><strong>Movement</strong> — issue/return/transfer/adjustment history.</span>
                <span><strong>Job-wise</strong> — stock consumed per job.</span>
                <span><strong>Low Stock</strong> — items needing reorder.</span>
            </Bullets>
            <Tip>
              All reports export to CSV — open in Excel/Google Sheets for further
              pivoting or charting.
            </Tip>
            <RelatedLinks
              links={[
                { id: "stock-logic", label: "Stock Operation Logic" },
                { id: "cutting-lists", label: "Factory Cutting Lists" },
                { id: "reports", label: "Reports" },
              ]}
            />
          </SectionCard>

          {/* ===== 9. Stock Operation Logic ===== */}
          <SectionCard
            id="stock-logic"
            icon={ArrowLeftRight}
            number={9}
            title="Stock Operation Logic"
            description="Business rules enforced on every stock movement."
          >
            <Warn>
              The rules below are enforced <strong>both</strong> in the API
              (security) and in the UI (guidance). Attempting to bypass them via
              direct API calls returns a 400 error.
            </Warn>

            <SubHeading>Goods Issue</SubHeading>
            <Bullets>
                <span><strong>Requires:</strong> a linked job.</span>
                <span>
                  <strong>Deducts:</strong> stock from the chosen warehouse
                  FIFO across StockLot records.
                </span>
                <span>
                  <strong>Validation:</strong> refuses if warehouse has
                  insufficient stock.
                </span>
                <span>
                  <strong>Admin override:</strong> admins can issue without a job
                  by providing a written reason — but the issue still has to
                  pass the stock check.
                </span>
            </Bullets>

            <SubHeading>Goods Return</SubHeading>
            <Bullets>
                <span><strong>Requires:</strong> a linked job.</span>
                <span>
                  <strong>Items:</strong> must come from the list of items
                  previously issued to (or outside-purchased for) the same job.
                </span>
                <span>
                  <strong>Quantity:</strong> ≤ available (issued − already
                  returned, plus outside-purchased received).
                </span>
                <span><strong>Adds:</strong> stock back to the warehouse.</span>
            </Bullets>

            <SubHeading>Stock Request</SubHeading>
            <Bullets>
                <span><strong>Requires:</strong> a linked job (for all users, including admins).</span>
                <span>
                  <strong>Flow:</strong> pending → approved → issued. Approving
                  does not deduct stock; issuing triggers a Goods Issue.
                </span>
            </Bullets>

            <SubHeading>Stock Adjustment</SubHeading>
            <Bullets>
                <span><strong>Requires:</strong> a reason of at least 5 characters.</span>
                <span>
                  <strong>Adjusts:</strong> the stock level up or down. Optional
                  job link may be provided for traceability.
                </span>
                <span>
                  Typical use: stock-take reconciliation, damaged-goods
                  write-off, found stock.
                </span>
            </Bullets>

            <SubHeading>Stock Transfer</SubHeading>
            <Bullets>
                <span><strong>Requires:</strong> source warehouse, destination warehouse, item, qty.</span>
                <span>
                  <strong>Validation:</strong> source warehouse must have
                  sufficient stock.
                </span>
                <span>
                  <strong>Moves:</strong> stock from source lots (FIFO) to a new
                  lot in the destination warehouse.
                </span>
            </Bullets>

            <SubHeading>Cutting List</SubHeading>
            <Bullets>
                <span><strong>Requires:</strong> a linked job.</span>
                <span>
                  <strong>Deducts:</strong> material from stock on save (FIFO).
                </span>
                <span>
                  <strong>On delete:</strong> restores the deducted stock back
                  to inventory.
                </span>
            </Bullets>

            <SubHeading>Outside Purchase</SubHeading>
            <Bullets>
                <span><strong>Requires:</strong> a linked job.</span>
                <span>
                  <strong>When received:</strong> adds the purchased items to
                  the chosen warehouse as a new lot, and recalculates the
                  InventoryItem.stockLevel.
                </span>
                <span>
                  Outside-purchased items can later be returned via Goods Return
                  against the same job.
                </span>
            </Bullets>

            <SubHeading>Admin Override</SubHeading>
            <p>
              Admins (Admin / SuperAdmin) may issue or adjust stock{" "}
              <strong>without</strong> a job by supplying a written reason. The
              override is logged in the Audit Log with actor, reason, and
              timestamp. This is the only path that bypasses the job requirement
              — and even then, the reason field is mandatory.
            </p>
            <Note>
              The full stock flow is: <strong>Request → Issue (deduct) → Return
              (add back)</strong>. Every step requires a job; every step is
              logged.
            </Note>
            <RelatedLinks
              links={[
                { id: "inventory", label: "Inventory Management" },
                { id: "cutting-lists", label: "Factory Cutting Lists" },
                { id: "audit", label: "Audit Log" },
              ]}
            />
          </SectionCard>

          {/* ===== 10. Quotes & Costing ===== */}
          <SectionCard
            id="quotes"
            icon={DollarSign}
            number={10}
            title="Quotes & Costing"
            description="Material pricing, job cost estimates, and quote generation."
          >
            <SubHeading>Material pricing</SubHeading>
            <p>
              Maintain a price list per inventory item (cost price, markup %,
              sale price). The Quotes module reads these to compute estimated
              job cost.
            </p>

            <SubHeading>Job cost estimates</SubHeading>
            <p>
              Open a job and click <strong>Estimate Cost</strong>. The system
              aggregates:
            </p>
            <Bullets>
                <span>Material cost (from cutting lists × unit price).</span>
                <span>Hardware cost.</span>
                <span>Labour cost (estimated hours × rate).</span>
                <span>Outside purchases (actual).</span>
                <span>Overhead / margin (configurable in Settings).</span>
            </Bullets>

            <SubHeading>Quote generation</SubHeading>
            <Step n={1} title="Open the quote builder">
              From a job, click <strong>Generate Quote</strong>.
            </Step>
            <Step n={2} title="Review line items">
              Adjust prices, add discount line, set tax rate.
            </Step>
            <Step n={3} title="Save or send">
              <strong>Save</strong> as draft, or <strong>Finalize</strong> to
              lock the quote. Finalized quotes appear in the Saved Quotes list.
            </Step>
            <Tip>
              Compare quotes across jobs to spot margin drift — if material
              cost % creeps up, it may be time to renegotiate supplier pricing.
            </Tip>
            <RelatedLinks
              links={[
                { id: "job-orders", label: "Job Orders" },
                { id: "customers", label: "Customers" },
                { id: "inventory", label: "Inventory Management" },
              ]}
            />
          </SectionCard>

          {/* ===== 11. Attendance ===== */}
          <SectionCard
            id="attendance"
            icon={CalendarCheck}
            number={11}
            title="Attendance"
            description="Worker check-in/check-out and monthly summary."
          >
            <SubHeading>Worker check-in / check-out</SubHeading>
            <Step n={1} title="Open the Attendance view">
              Click the check-in button for the worker (or scan their QR badge
              if the Barcode module is enabled).
            </Step>
            <Step n={2} title="Check-out">
              Repeat at end of shift. The system records total hours
              automatically.
            </Step>

            <SubHeading>Monthly attendance summary</SubHeading>
            <p>
              Switch the date range to “Month” to see per-worker totals:
              present days, absent days, late arrivals, total hours, overtime
              hours. Export to CSV for payroll.
            </p>
            <Tip>
              Link workers to jobs via the Job Detail sheet’s Labour tab to get
              per-job labour cost attribution — feeds into the Quotes module.
            </Tip>
            <RelatedLinks
              links={[{ id: "reports", label: "Reports" }]} />
          </SectionCard>

          {/* ===== 12. Reports ===== */}
          <SectionCard
            id="reports"
            icon={BarChart3}
            number={12}
            title="Reports"
            description="Consumption, job-wise usage, low-stock alerts, CSV export."
          >
            <SubHeading>Consumption reports</SubHeading>
            <p>
              Filter by date range, material, or warehouse to see total
              consumption in units &amp; value. Drill into a row to see the
              underlying stock movements.
            </p>

            <SubHeading>Job-wise stock usage</SubHeading>
            <p>
              For each job, see a breakdown of all stock issued, returned,
              adjusted, and outside-purchased — net consumption per item with
              cost roll-up.
            </p>

            <SubHeading>Low-stock alerts</SubHeading>
            <p>
              A live list of every item at or below its reorder level, with
              current stock, reorder level, and a one-click “Create Purchase
              Request” action.
            </p>

            <SubHeading>Export to CSV</SubHeading>
            <p>
              Every report has a <FileSpreadsheet className="inline h-3.5 w-3.5" />{" "}
              <strong>Export CSV</strong> button. The export reflects the current
              filter selection, not the full dataset.
            </p>
            <RelatedLinks
              links={[
                { id: "inventory", label: "Inventory Management" },
                { id: "audit", label: "Audit Log" },
              ]}
            />
          </SectionCard>

          {/* ===== 13. User Management ===== */}
          <SectionCard
            id="users"
            icon={Users}
            number={13}
            title="User Management"
            description="Create users, assign roles, manage passwords."
          >
            <SubHeading>Creating users</SubHeading>
            <Step n={1} title="Open the dialog">
              Click <strong>New User</strong> in the User Management view.
            </Step>
            <Step n={2} title="Enter details">
              Full name, username, email, role (Admin / SuperAdmin /
              Technician), initial password.
            </Step>
            <Step n={3} title="Save">
              The frontend generates a UUID, calls the primary create endpoint,
              and — on failure — automatically falls back to the direct-insert
              endpoint. A toast confirms success and the table refetches.
            </Step>
            <Tip>
              The robust primary+fallback pattern means user creation will
              succeed even if the primary RPC handler fails — no “ghost” users
              left in limbo.
            </Tip>

            <SubHeading>Role-based access control</SubHeading>
            <p>
              Roles drive sidebar visibility, API authorization, and feature
              toggles. The system prevents deleting the last SuperAdmin to avoid
              lockout.
            </p>

            <SubHeading>Password management</SubHeading>
            <Bullets>
                <span>
                  <strong>Reset password</strong> from the user’s edit dialog —
                  admins set a new temporary password; the user changes it on
                  next login.
                </span>
                <span>
                  Passwords are hashed with bcrypt; the plaintext is never
                  stored or logged.
                </span>
                <span>
                  Users can self-change their password from the profile menu
                  (coming soon).
                </span>
            </Bullets>
            <Warn>
              Never share SuperAdmin credentials. If a SuperAdmin leaves, demote
              their account to Technician <em>before</em> deleting — that frees
              the username without losing the audit-trail attribution.
            </Warn>
            <RelatedLinks
              links={[
                { id: "getting-started", label: "Getting Started" },
                { id: "audit", label: "Audit Log" },
                { id: "settings", label: "System Settings" },
              ]}
            />
          </SectionCard>

          {/* ===== 14. System Settings ===== */}
          <SectionCard
            id="settings"
            icon={Settings}
            number={14}
            title="System Settings"
            description="Module visibility, backup/restore, general configuration."
          >
            <SubHeading>Module visibility</SubHeading>
            <p>
              Toggle the 17 add-on modules on or off per installation. New
              modules default to <strong>OFF</strong> and must be explicitly
              enabled here before they appear in the sidebar.
            </p>
            <p>Each toggle has:</p>
            <Bullets>
                <span><strong>Name</strong> + short description.</span>
                <span><strong>“NEW”</strong> badge for v2.0 modules.</span>
                <span>Switch to enable/disable.</span>
            </Bullets>
            <Tip>
              Enable only the modules your factory actually uses — keeps the
              sidebar focused and reduces onboarding confusion for new staff.
            </Tip>

            <SubHeading>Backup &amp; restore</SubHeading>
            <Step n={1} title="Export">
              Click <strong>Backup</strong> → downloads a JSON snapshot of the
              entire database (users, customers, jobs, inventory, etc.).
            </Step>
            <Step n={2} title="Restore">
              Click <strong>Restore</strong> → upload a previously-exported JSON
              file. Confirm the overwrite warning.
            </Step>
            <Warn>
              Restore <strong>replaces</strong> the current database. Always
              take a fresh backup before restoring, in case you need to roll back.
            </Warn>
            <Note>
              Auto-backups are taken on every admin logout — see the{" "}
              <code className="rounded bg-muted px-1">/backups</code> folder.
            </Note>

            <SubHeading>General settings</SubHeading>
            <Bullets>
                <span>Company profile (name, logo, address, tax ID).</span>
                <span>Production defaults (default carcase board, finish, hardware).</span>
                <span>Quote defaults (markup %, tax rate, validity days).</span>
                <span>Currency &amp; date format.</span>
            </Bullets>
            <RelatedLinks
              links={[
                { id: "add-ons", label: "Add-on Modules" },
                { id: "audit", label: "Audit Log" },
              ]}
            />
          </SectionCard>

          {/* ===== 15. Audit Log ===== */}
          <SectionCard
            id="audit"
            icon={ScrollText}
            number={15}
            title="Audit Log"
            description="Tracking every change for compliance &amp; traceability."
          >
            <SubHeading>What gets logged</SubHeading>
            <p>
              Every create / update / delete / status-change / assign / login
              event across jobs, customers, users, measurements, cutting lists,
              stock operations, and settings is written to the persistent audit
              log with actor, timestamp, entity type, and a summary.
            </p>

            <SubHeading>Filtering by action &amp; entity</SubHeading>
            <p>
              Use the dropdowns above the table to filter by:
            </p>
            <Bullets>
                <span><strong>Action</strong> — create, update, delete, login, status_change, assign.</span>
                <span>
                  <strong>Entity type</strong> — job, customer, user
                  measurement, cutting_list, auth, settings.
                </span>
                <span>
                  <strong>Free-text search</strong> over the summary, actor
                  name, or entity type.
                </span>
            </Bullets>

            <SubHeading>Retention</SubHeading>
            <p>
              The retention policy (configurable in Settings) auto-prunes audit
              entries older than the configured window. Default is 12 months.
            </p>
            <Tip>
              Investigating a stock discrepancy? Filter by entity = stock and
              the date range to see every issue, return, adjustment, and
              transfer at a glance.
            </Tip>
            <RelatedLinks
              links={[
                { id: "stock-logic", label: "Stock Operation Logic" },
                { id: "users", label: "User Management" },
                { id: "reports", label: "Reports" },
              ]}
            />
          </SectionCard>

          {/* ===== 16. Add-on Modules ===== */}
          <SectionCard
            id="add-ons"
            icon={LayoutGrid}
            number={16}
            title="Add-on Modules"
            description="17 optional modules — enable in System Settings as needed."
          >
            <p>
              The 17 add-on modules are off by default. Toggle them on in{" "}
              <strong>System Settings → Module Visibility</strong> to add them
              to the sidebar.
            </p>

            <div className="grid gap-3 sm:grid-cols-2 mt-3">
              {ADDON_MODULES.map((m) => {
                const Icon = m.icon;
                return (
                  <div
                    key={m.id}
                    className="flex gap-3 rounded-md border border-border/60 bg-background/60 p-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-foreground">
                        {m.label}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {m.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            <RelatedLinks
              links={[
                { id: "settings", label: "System Settings" },
                { id: "getting-started", label: "Getting Started" },
              ]}
            />
          </SectionCard>

          {/* ===== 17. Keyboard Shortcuts ===== */}
          <SectionCard
            id="shortcuts"
            icon={Keyboard}
            number={17}
            title="Keyboard Shortcuts"
            description="Quick reference for every keyboard shortcut in the console."
          >
            <SubHeading>Global</SubHeading>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="py-2 pr-4 font-medium">Shortcut</th>
                    <th className="py-2 font-medium">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  <ShortcutRow keys={["⌘K", "Ctrl+K"]} action="Open the command palette / global search" />
                  <ShortcutRow keys={["Esc"]} action="Close any open dialog, sheet, or palette" />
                  <ShortcutRow keys={["Enter"]} action="Confirm the focused dialog’s primary action" />
                </tbody>
              </table>
            </div>

            <SubHeading>Job Orders</SubHeading>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border/60">
                  <ShortcutRow keys={["Del"]} action="Delete selected row(s)" />
                  <ShortcutRow keys={["Ctrl+D"]} action="Duplicate selected job" />
                  <ShortcutRow keys={["↑", "↓"]} action="Move row selection up / down" />
                  <ShortcutRow keys={["Ctrl+A"]} action="Select all rows" />
                  <ShortcutRow keys={["Esc"]} action="Clear selection" />
                </tbody>
              </table>
            </div>

            <SubHeading>Elevation Canvas (Site Notebook)</SubHeading>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <tbody className="divide-y divide-border/60">
                  <ShortcutRow keys={["Del"]} action="Delete selected module(s)" />
                  <ShortcutRow keys={["Ctrl+D"]} action="Duplicate selected module(s)" />
                  <ShortcutRow keys={["Ctrl+Z"]} action="Undo last action" />
                  <ShortcutRow keys={["Ctrl+Shift+Z"]} action="Redo (or Ctrl+Y)" />
                  <ShortcutRow keys={["↑", "↓", "←", "→"]} action="Nudge selected module(s) by 1 mm" />
                  <ShortcutRow keys={["Ctrl+A"]} action="Select all modules" />
                  <ShortcutRow keys={["Esc"]} action="Deselect / exit fullscreen" />
                  <ShortcutRow keys={["+"]} action="Zoom in" />
                  <ShortcutRow keys={["−"]} action="Zoom out" />
                  <ShortcutRow keys={["0"]} action="Reset zoom to 100%" />
                  <ShortcutRow keys={["F"]} action="Toggle fullscreen canvas" />
                  <ShortcutRow keys={["Space+drag"]} action="Pan the canvas" />
                </tbody>
              </table>
            </div>

            <SubHeading>Undo / Redo</SubHeading>
            <Bullets>
                <span>
                  <Kbd>Ctrl</Kbd>+<Kbd>Z</Kbd> — undo (canvas, dialogs with
                  history).
                </span>
                <span>
                  <Kbd>Ctrl</Kbd>+<Kbd>Shift</Kbd>+<Kbd>Z</Kbd> — redo. On
                  Windows you can also use <Kbd>Ctrl</Kbd>+<Kbd>Y</Kbd>.
                </span>
            </Bullets>
            <Tip>
              Press <Kbd>⌘K</Kbd> anywhere to jump to any module, job, or
              customer without taking your hands off the keyboard — the fastest
              way to navigate the console.
            </Tip>
            <RelatedLinks
              links={[
                { id: "getting-started", label: "Getting Started" },
                { id: "job-orders", label: "Job Orders" },
                { id: "site-notebook", label: "Site Notebook Builder" },
              ]}
            />
          </SectionCard>

          {/* Footer of the guide */}
          <div className="flex flex-col items-center justify-center gap-1 py-6 text-center">
            <p className="text-xs text-muted-foreground">
              CabinetryWorks Manufacturing Console · v2.0 ·{" "}
              {new Date().getFullYear()}
            </p>
            <p className="text-xs text-muted-foreground">
              Need more help? Contact your system administrator or consult the
              in-app tooltips (hover any field with a{" "}
              <Info className="inline h-3 w-3" /> icon).
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Small in-file helpers used by the shortcuts table                  */
/* ------------------------------------------------------------------ */

function ShortcutRow({ keys, action }: { keys: string[]; action: string }) {
  return (
    <tr>
      <td className="py-2 pr-4">
        <div className="flex flex-wrap items-center gap-1">
          {keys.map((k, i) => (
            <React.Fragment key={k}>
              {i > 0 && (
                <span className="text-xs text-muted-foreground">or</span>
              )}
              <Kbd>{k}</Kbd>
            </React.Fragment>
          ))}
        </div>
      </td>
      <td className="py-2 text-foreground/80">{action}</td>
    </tr>
  );
}

/* ------------------------------------------------------------------ */
/*  Add-on module metadata                                             */
/* ------------------------------------------------------------------ */

const ADDON_MODULES: {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  desc: string;
}[] = [
  {
    id: "scheduling",
    label: "Production Schedule",
    icon: CalendarDays,
    desc: "Production timeline & workstation allocation across active jobs.",
  },
  {
    id: "quality-control",
    label: "Quality Control",
    icon: ShieldCheck,
    desc: "QC checkpoints & inspection management — pass/fail per stage.",
  },
  {
    id: "deliveries",
    label: "Delivery & Install",
    icon: PackageCheck,
    desc: "Delivery scheduling & on-site installation management.",
  },
  {
    id: "documents",
    label: "Documents",
    icon: FolderArchive,
    desc: "Job document management — contracts, drawings, permits.",
  },
  {
    id: "templates",
    label: "Job Templates",
    icon: LayoutTemplate,
    desc: "Save recurring job configurations as reusable templates.",
  },
  {
    id: "warranty",
    label: "Warranty",
    icon: ShieldCheck,
    desc: "Warranty claims & after-sales service tracking.",
  },
  {
    id: "barcodes",
    label: "Barcode / QR",
    icon: QrCode,
    desc: "Generate & scan barcode/QR labels for inventory and jobs.",
  },
  {
    id: "forecasting",
    label: "Forecasting",
    icon: TrendingUp,
    desc: "Inventory demand forecasting & reorder predictions.",
  },
  {
    id: "calendar",
    label: "Unified Calendar",
    icon: CalendarRange,
    desc: "All events in one calendar — jobs, deliveries, attendance, schedules.",
  },
  {
    id: "punch-list",
    label: "Punch List",
    icon: Bug,
    desc: "Post-installation deficiency tracking & resolution.",
  },
  {
    id: "change-orders",
    label: "Change Orders",
    icon: GitBranch,
    desc: "Track scope changes & modifications during production.",
  },
  {
    id: "communications",
    label: "Communication Log",
    icon: MessageSquare,
    desc: "Customer communication history — calls, emails, meetings.",
  },
  {
    id: "subcontractors",
    label: "Subcontractors",
    icon: HardHat,
    desc: "External team management & assignment tracking.",
  },
  {
    id: "equipment",
    label: "Equipment",
    icon: Wrench,
    desc: "Machine registry, assignment & maintenance scheduling.",
  },
  {
    id: "milestones",
    label: "Milestones",
    icon: Flag,
    desc: "Key project dates — measurement, design, cutting, installation.",
  },
  {
    id: "mrp",
    label: "Material Planning",
    icon: PackageSearch,
    desc: "Auto-calculate material requirements from cutting lists.",
  },
  {
    id: "site-visits",
    label: "Site Visits",
    icon: ClipboardCheck,
    desc: "Log on-site visits — inspections, measurements, handovers.",
  },
];
