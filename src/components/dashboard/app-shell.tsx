"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/components/providers";
import { navForRole, type NavItem } from "./nav-config";
import { userPermissionsApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { ErrorBoundary } from "@/components/error-boundary";
import {
  Hammer,
  Menu,
  LogOut,
  ChevronRight,
  PanelTopClose,
  PanelTopOpen,
  Sun,
  Moon,
  Search,
  LayoutGrid,
  EllipsisVertical,
} from "lucide-react";
import { toast } from "sonner";
import type { SessionUser, Role } from "@/lib/types";

import { CommandPalette } from "./command-palette";
import { JobDetailSheet } from "./jobs/job-detail-sheet";
import { NotificationsBell } from "./notifications-bell";
import { LegalModal } from "./legal-modal";
import { SessionWarning } from "@/components/session-warning";
import { ShortcutOverlay } from "./shortcut-overlay";

// Static imports — React.lazy causes ChunkLoadError in Turbopack dev mode.
import { OverviewView } from "./views/overview";
import { UsersView } from "./views/users";
import { JobOrdersView } from "./views/job-orders";
import { JobTrackingView } from "./views/job-tracking";
import { CustomersView } from "./views/customers";
import { KanbanBoard } from "./views/kanban";
import { MeasurementsView } from "./views/measurements";
import { SiteNotebookView } from "./views/site-notebook";
import { CuttingListsView } from "./views/cutting-lists";
import { MyJobsView } from "./views/my-jobs";
import { SettingsView } from "./views/settings";
import { AuditLogView } from "./views/audit-log";
import { QuotesView } from "./views/quotes";
import { SavedQuotesView } from "./views/saved-quotes";
import { InventoryView } from "./views/inventory";
import { PurchaseOrdersView } from "./views/purchase-orders";
import { SuppliersView } from "./views/suppliers";
import { ReportsView } from "./views/reports";
import { AttendanceView } from "./views/attendance";
import { ProductionScheduleView } from "./views/production-schedule";
import { QualityControlView } from "./views/quality-control";
import { DeliveriesView } from "./views/deliveries";
import { JobDocumentsView } from "./views/job-documents";
import { JobTemplatesView } from "./views/job-templates";
import { WarrantyView } from "./views/warranty";
import { BarcodesView } from "./views/barcodes";
import { ForecastingView } from "./views/forecasting";
import { UnifiedCalendarView } from "./views/unified-calendar";
import { PunchListView } from "./views/punch-list";
import { ChangeOrdersView } from "./views/change-orders";
import { CommunicationsView } from "./views/communications";
import { SubcontractorsView } from "./views/subcontractors";
import { EquipmentView } from "./views/equipment";
import { MilestonesView } from "./views/milestones";
import { MaterialPlanningView } from "./views/mrp";
import { SiteVisitsView } from "./views/site-visits";
import { UserGuideView } from "./views/user-guide";
import { UserCentralView } from "./views/user-central";

const VIEW_COMPONENTS: Record<string, React.ComponentType> = {
  overview: OverviewView,
  users: UsersView,
  "job-orders": JobOrdersView,
  "job-tracking": JobTrackingView,
  attendance: AttendanceView,
  customers: CustomersView,
  kanban: KanbanBoard,
  measurements: MeasurementsView,
  blueprints: SiteNotebookView,
  "cutting-lists": CuttingListsView,
  "my-jobs": MyJobsView,
  quotes: QuotesView,
  "saved-quotes": SavedQuotesView,
  inventory: InventoryView,
  "purchase-orders": PurchaseOrdersView,
  suppliers: SuppliersView,
  reports: ReportsView,
  settings: SettingsView,
  audit: AuditLogView,
  "user-guide": UserGuideView,
  "user-central": UserCentralView,
  // Toggleable v2 modules — still routed, but hidden from nav until enabled
  scheduling: ProductionScheduleView,
  "quality-control": QualityControlView,
  deliveries: DeliveriesView,
  documents: JobDocumentsView,
  templates: JobTemplatesView,
  warranty: WarrantyView,
  barcodes: BarcodesView,
  forecasting: ForecastingView,
  calendar: UnifiedCalendarView,
  "punch-list": PunchListView,
  "change-orders": ChangeOrdersView,
  communications: CommunicationsView,
  subcontractors: SubcontractorsView,
  equipment: EquipmentView,
  milestones: MilestonesView,
  mrp: MaterialPlanningView,
  "site-visits": SiteVisitsView,
  // Redirects — old nav IDs that map to consolidated views
  "pipeline": KanbanBoard, // alias for kanban
  "saved-quotes-alt": SavedQuotesView, // alias
};

function useTheme() {
  const [theme, setTheme] = React.useState<"light" | "dark">("light");
  React.useEffect(() => {
    const stored = localStorage.getItem("kcm-theme");
    const initial = (stored as "light" | "dark") || "light";
    setTheme(initial);
    document.documentElement.classList.toggle("dark", initial === "dark");
  }, []);
  const toggle = React.useCallback(() => {
    setTheme((prev) => {
      const next = prev === "light" ? "dark" : "light";
      document.documentElement.classList.toggle("dark", next === "dark");
      localStorage.setItem("kcm-theme", next);
      return next;
    });
  }, []);
  return { theme, toggle };
}

/** Top-level nav list — avoids "components during render" lint error. */
function NavList({
  items,
  active,
  onSelect,
  onNavigate,
  collapsed,
  mobile,
}: {
  items: NavItem[];
  active: string;
  onSelect: (id: string) => void;
  onNavigate?: () => void;
  collapsed?: boolean;
  mobile?: boolean;
}) {
  return (
    <nav className="flex flex-col gap-1 px-3 py-4">
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = active === item.id;
        return (
          <button
            key={item.id}
            onClick={() => {
              onSelect(item.id);
              onNavigate?.();
            }}
            title={collapsed ? item.label : undefined}
            aria-label={item.label}
            className={`group flex w-full items-center gap-3 rounded-lg text-left text-sm font-medium transition-all border-l-2 ${
              collapsed ? "justify-center px-0" : "px-3"
            } ${mobile ? "min-h-[44px] py-2.5" : "py-2"} ${
              isActive
                ? "bg-primary text-primary-foreground shadow-sm border-primary"
                : "text-sidebar-foreground/80 hover:bg-sidebar-accent/50 hover:text-sidebar-accent-foreground border-transparent"
            }`}
          >
            <Icon className="h-[18px] w-[18px] shrink-0" />
            {!collapsed && (
              <>
                <span className="flex-1 truncate">{item.label}</span>
                {item.isNew && !isActive && (
                  <span className="rounded-full bg-emerald-500 px-1.5 py-0.5 text-[8px] font-bold leading-none text-white">
                    NEW
                  </span>
                )}
                {isActive && <ChevronRight className="h-4 w-4 opacity-70" />}
              </>
            )}
          </button>
        );
      })}
    </nav>
  );
}

function SidebarBrand() {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
        <Hammer className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold">CabinetryWorks</p>
        <p className="truncate text-[11px] text-sidebar-foreground/60">
          Manufacturing Console
        </p>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  const labels: Record<Role, string> = {
    SuperAdmin: "Super Admin",
    Admin: "Admin",
    Manager: "Manager",
    Storekeeper: "Storekeeper",
    Auditor: "Auditor",
    Technician: "Technician",
  };
  return (
    <Badge
      variant="outline"
      className="bg-sidebar-primary/20 text-sidebar-primary border-sidebar-primary/30"
    >
      {labels[role] ?? role}
    </Badge>
  );
}

/** Kanban board wrapper with job detail sheet integration. */
function KanbanBoardWithDetail({
  focusJobId,
  onFocusConsumed,
}: {
  focusJobId?: string | null;
  onFocusConsumed?: () => void;
}) {
  const [selectedJobId, setSelectedJobId] = React.useState<string | null>(null);
  const [detailOpen, setDetailOpen] = React.useState(false);

  React.useEffect(() => {
    if (focusJobId) {
      setSelectedJobId(focusJobId);
      setDetailOpen(true);
      onFocusConsumed?.();
    }
  }, [focusJobId, onFocusConsumed]);

  return (
    <>
      <KanbanBoard
        onJobClick={(jobId) => {
          setSelectedJobId(jobId);
          setDetailOpen(true);
        }}
      />
      <JobDetailSheet
        jobId={selectedJobId}
        open={detailOpen}
        onOpenChange={(o) => {
          setDetailOpen(o);
          if (!o) setSelectedJobId(null);
        }}
      />
    </>
  );
}

export function AppShell({ user }: { user: SessionUser }) {
  const { logout } = useAuth();
  const { theme, toggle } = useTheme();
  // Fetch per-user permission overrides (for non-SuperAdmin users)
  const { data: permsData } = useQuery({
    queryKey: ["user-permissions", user.id],
    queryFn: () => userPermissionsApi.list(user.id),
    enabled: user.role !== "SuperAdmin",
  });
  const userPerms = React.useMemo(() => {
    const map: Record<string, boolean> = {};
    for (const p of permsData?.permissions ?? []) {
      map[p.moduleId] = p.allowed;
    }
    return Object.keys(map).length > 0 ? map : undefined;
  }, [permsData]);

  const items = React.useMemo(() => navForRole(user.role, userPerms), [user.role, userPerms]);
  // Restore last active view from localStorage (persists across page refresh)
  const [active, setActive] = React.useState(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("kcm-active-view");
      if (saved && saved !== "overview") return saved;
    }
    return items[0]?.id ?? "overview";
  });
  const [collapsed, setCollapsed] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [legalOpen, setLegalOpen] = React.useState(false);
  const [focusJobId, setFocusJobId] = React.useState<string | null>(null);
  const [focusCustomerId, setFocusCustomerId] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!items.some((i) => i.id === active)) {
      const fallback = items[0]?.id ?? "overview";
      setActive(fallback);
      if (typeof window !== "undefined") {
        localStorage.setItem("kcm-active-view", fallback);
      }
    }
  }, [items, active]);

  // Keyboard shortcut: Cmd+K / Ctrl+K to open search
  React.useEffect(() => {
    function handler(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setSearchOpen((s) => !s);
      }
    }
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  // Session inactivity timeout — auto-logout after 30 minutes of no activity
  React.useEffect(() => {
    let timeoutId: ReturnType<typeof setTimeout>;
    const INACTIVITY_MS = 30 * 60 * 1000; // 30 minutes

    function resetTimer() {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(async () => {
        toast.info("Session expired due to inactivity. Please sign in again.");
        await logout();
      }, INACTIVITY_MS);
    }

    // Reset timer on user activity
    const events = ["mousedown", "keydown", "touchstart", "scroll"];
    events.forEach((evt) => window.addEventListener(evt, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      clearTimeout(timeoutId);
      events.forEach((evt) => window.removeEventListener(evt, resetTimer));
    };
  }, [logout]);

  function handleNavigate(view: string, entityId?: string) {
    // Redirects for merged modules
    const REDIRECTS: Record<string, string> = {
      "kanban": "job-orders",
      "my-jobs": "job-orders",
      "saved-quotes": "quotes",
      "purchase-orders": "inventory",
    };
    const target = REDIRECTS[view] ?? view;
    setActive(target);
    if (typeof window !== "undefined") {
      localStorage.setItem("kcm-active-view", target);
    }
    if (target === "job-orders" && entityId) {
      setFocusJobId(entityId);
    } else if (target === "customers" && entityId) {
      setFocusCustomerId(entityId);
    }
  }

  const activeItem: NavItem | undefined = items.find((i) => i.id === active);
  const ViewComponent = VIEW_COMPONENTS[active] ?? OverviewView;

  const initials = user.fullName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  async function handleLogout() {
    try {
      await logout();
      toast.success("Signed out");
    } catch {
      toast.error("Failed to sign out");
    }
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background">
      {/* Desktop sidebar */}
      <aside
        className={`hidden md:flex md:flex-col md:border-r md:border-sidebar-border md:bg-sidebar md:text-sidebar-foreground ${
          collapsed ? "md:w-16" : "md:w-64"
        } transition-[width] duration-200 shrink-0`}
      >
        <div className="flex items-center justify-between">
          {!collapsed && <SidebarBrand />}
          {collapsed && (
            <div className="mx-auto my-5 flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Hammer className="h-5 w-5" />
            </div>
          )}
        </div>
        {!collapsed && (
          <div className="px-4 pb-1.5">
            <RoleBadge role={user.role} />
          </div>
        )}
        <div className="flex-1 overflow-y-auto scrollbar-warm min-h-0">
          <NavList
            items={items}
            active={active}
            onSelect={(id: string) => handleNavigate(id)}
            collapsed={collapsed}
          />
        </div>
        <div className="border-t border-sidebar-border p-3">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs text-sidebar-foreground/70 transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed ? (
              <PanelTopOpen className="h-4 w-4" />
            ) : (
              <>
                <PanelTopClose className="h-4 w-4" />
                Collapse sidebar
              </>
            )}
          </button>
        </div>
      </aside>

      {/* Mobile sidebar */}
      <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
        <SheetContent
          side="left"
          className="w-[280px] max-w-[85vw] border-sidebar-border bg-sidebar p-0 text-sidebar-foreground"
        >
          <SheetTitle className="sr-only">Navigation menu</SheetTitle>
          <SidebarBrand />
          <div className="px-4 pb-1.5">
            <RoleBadge role={user.role} />
          </div>
          <div className="overflow-y-auto scrollbar-warm">
            <NavList
              items={items}
              active={active}
              onSelect={(id: string) => handleNavigate(id)}
              onNavigate={() => setMobileOpen(false)}
              mobile
            />
          </div>
        </SheetContent>
      </Sheet>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col h-full overflow-hidden">
        {/* Topbar — fixed, always visible. Mobile: hamburger + title + avatar + More menu. */}
        <header className="flex h-12 sm:h-14 shrink-0 items-center gap-2 sm:gap-3 border-b border-border bg-background/95 px-3 sm:px-4 lg:px-6 backdrop-blur-md z-30">
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            aria-label="Open menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="h-5 w-5" />
          </Button>

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-semibold sm:text-base lg:text-lg">
              {activeItem?.label ?? "Overview"}
            </h2>
            <p className="hidden truncate text-xs text-muted-foreground lg:block">
              {activeItem?.description}
            </p>
          </div>

          {/* Search trigger (full) — desktop only */}
          <Button
            variant="outline"
            onClick={() => setSearchOpen(true)}
            className="hidden h-9 gap-2 px-3 text-sm text-muted-foreground lg:flex"
          >
            <Search className="h-4 w-4" />
            <span className="text-xs">Search jobs, customers, items…</span>
            <kbd className="ml-2 inline-flex h-5 items-center gap-0.5 rounded border border-border bg-muted px-1 text-[10px] font-mono">
              ⌘K
            </kbd>
          </Button>
          {/* Search icon — tablet only */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSearchOpen(true)}
            className="hidden md:inline-flex lg:hidden"
            aria-label="Search"
          >
            <Search className="h-[18px] w-[18px]" />
          </Button>

          {/* Quick module toggle button — jumps to settings — tablet/desktop */}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => handleNavigate("settings")}
            className="hidden md:inline-flex"
            aria-label="Module Settings"
            title="Enable/Disable Modules"
          >
            <LayoutGrid className="h-[18px] w-[18px]" />
          </Button>

          {/* Notifications bell — tablet/desktop */}
          <div className="hidden md:block">
            <NotificationsBell onNavigate={handleNavigate} />
          </div>

          {/* Theme toggle — tablet/desktop */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggle}
            className="hidden md:inline-flex"
            aria-label="Toggle theme"
          >
            {theme === "light" ? (
              <Moon className="h-[18px] w-[18px]" />
            ) : (
              <Sun className="h-[18px] w-[18px]" />
            )}
          </Button>

          {/* More dropdown — mobile only (search / module settings / theme) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="md:hidden"
                aria-label="More options"
              >
                <EllipsisVertical className="h-5 w-5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuItem onClick={() => setSearchOpen(true)}>
                <Search className="mr-2 h-4 w-4" />
                Search…
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => handleNavigate("settings")}>
                <LayoutGrid className="mr-2 h-4 w-4" />
                Module Settings
              </DropdownMenuItem>
              <DropdownMenuItem onClick={toggle}>
                {theme === "light" ? (
                  <Moon className="mr-2 h-4 w-4" />
                ) : (
                  <Sun className="mr-2 h-4 w-4" />
                )}
                {theme === "light" ? "Dark mode" : "Light mode"}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* User profile — avatar always; name on tablet+; username on desktop+ */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button className="flex items-center gap-2 rounded-full py-1 pl-1 pr-1 md:pr-2 transition-colors hover:bg-muted">
                <Avatar className="h-8 w-8 border border-border">
                  <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                    {initials}
                  </AvatarFallback>
                </Avatar>
                <div className="hidden md:block text-left">
                  <p className="text-xs font-medium leading-tight">
                    {user.fullName}
                  </p>
                  <p className="hidden lg:block text-[10px] leading-tight text-muted-foreground">
                    @{user.username}
                  </p>
                </div>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user.fullName}</span>
                  <span className="text-xs text-muted-foreground">
                    {user.role}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={handleLogout}
                className="text-destructive focus:text-destructive"
              >
                <LogOut className="mr-2 h-4 w-4" />
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </header>

        {/* Content — only this scrolls */}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-2 md:p-4 lg:p-5 scrollbar-warm">
          <ErrorBoundary fallbackTitle="View failed to load">
            {active === "job-orders" ? (
              <JobOrdersView focusJobId={focusJobId} onFocusConsumed={() => setFocusJobId(null)} />
            ) : active === "customers" ? (
              <CustomersView focusCustomerId={focusCustomerId} onFocusConsumed={() => setFocusCustomerId(null)} />
            ) : active === "overview" ? (
              <OverviewView onNavigate={(view) => handleNavigate(view)} />
            ) : active === "job-tracking" ? (
              <JobTrackingView onNavigate={(view, entityId) => handleNavigate(view, entityId)} />
            ) : (
              <div key={active} className="fade-in">
                <ViewComponent />
              </div>
            )}
          </ErrorBoundary>
        </main>

        {/* Footer — fixed at bottom, always visible. Mobile: ultra-compact single line. */}
        <footer className="shrink-0 border-t border-border bg-background/95 px-3 py-1.5 backdrop-blur-md sm:px-5 sm:py-2">
          <div className="flex items-center justify-between gap-2 text-[10px] sm:text-xs text-muted-foreground">
            <button
              onClick={() => setLegalOpen(true)}
              className="truncate transition-colors hover:text-foreground hover:underline"
            >
              <span className="sm:hidden">© 2026 Kitchen Workspace</span>
              <span className="hidden sm:inline">
                © 2026 Kitchen Workspace | System Ownership &amp; Legal Notice
              </span>
            </button>
            <p className="flex shrink-0 items-center gap-1.5">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              <span className="hidden sm:inline">
                CabinetryWorks · Manufacturing Console
              </span>
            </p>
          </div>
        </footer>
      </div>

      <CommandPalette
        open={searchOpen}
        onOpenChange={setSearchOpen}
        onNavigate={handleNavigate}
      />

      <LegalModal open={legalOpen} onOpenChange={setLegalOpen} />

      <ShortcutOverlay />

      <SessionWarning />
    </div>
  );
}
