import type { Role } from "@/lib/types";
import {
  LayoutDashboard,
  Users,
  ClipboardList,
  Ruler,
  Scissors,
  Settings,
  Camera,
  PanelTop,
  ClipboardCheck,
  Building2,
  LayoutGrid,
  ScrollText,
  DollarSign,
  Boxes,
  FileText,
  ShoppingCart,
  Truck,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  ShieldCheck,
  PackageCheck,
  FolderArchive,
  LayoutTemplate,
  QrCode,
  TrendingUp,
  CalendarRange,
  Bug,
  GitBranch,
  MessageSquare,
  HardHat,
  Wrench,
  Flag,
  PackageSearch,
  BookOpen,
} from "lucide-react";

export interface NavItem {
  id: string;
  label: string;
  icon: typeof LayoutDashboard;
  roles: Role[];
  description: string;
  toggleable?: boolean; // if true, can be toggled on/off from Settings
  isNew?: boolean; // shows "NEW" badge in sidebar and settings
  version?: string; // which version this was added in
}

// App version info
export const APP_VERSION = "2.0.0";
export const APP_VERSION_DATE = "2026-08-17";

// All modules added after v1.0 — used for "NEW" badges and changelog
export const NEW_MODULES_V2 = [
  "scheduling", "quality-control", "deliveries", "documents", "templates",
  "warranty", "barcodes", "forecasting",
  "calendar", "punch-list", "change-orders", "communications",
  "subcontractors", "equipment", "milestones", "mrp", "site-visits",
];

export const NAV_ITEMS: NavItem[] = [
  // ===== Core Navigation (always visible) =====
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    roles: ["Admin", "SuperAdmin", "Manager", "Storekeeper", "Auditor"],
    description: "Production summary & key metrics",
  },
  {
    id: "job-orders",
    label: "Job Orders",
    icon: ClipboardList,
    roles: ["Admin", "SuperAdmin", "Manager", "Technician", "Storekeeper", "Auditor"],
    description: "Track cabinetry production jobs — includes pipeline board & assigned jobs",
  },
  {
    id: "job-tracking",
    label: "Job Tracking",
    icon: TrendingUp,
    roles: ["Admin", "SuperAdmin", "Manager", "Storekeeper", "Auditor"],
    description: "Track all jobs per customer — repairs, touch-ups, add-ons, modifications & warranty",
  },
  {
    id: "customers",
    label: "Customers",
    icon: Building2,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Manage client relationships",
  },
  {
    id: "attendance",
    label: "Attendance",
    icon: CalendarCheck,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Worker attendance tracking — factory & on-site",
  },
  // ===== Site & Design (grouped) =====
  {
    id: "measurements",
    label: "Site Measurements",
    icon: Ruler,
    roles: ["Admin", "SuperAdmin", "Manager", "Technician"],
    description: "On-site measurement capture",
  },
  {
    id: "blueprints",
    label: "Site Notebook Builder",
    icon: Camera,
    roles: ["Technician", "Admin", "SuperAdmin", "Manager"],
    description: "Practical elevation & cutting list builder",
  },
  {
    id: "cutting-lists",
    label: "Factory Cutting Lists",
    icon: Scissors,
    roles: ["Admin", "SuperAdmin", "Manager", "Technician"],
    description: "Generate factory-ready cut lists with nesting",
  },
  // ===== Inventory & Procurement (grouped) =====
  {
    id: "inventory",
    label: "Inventory",
    icon: Boxes,
    roles: ["Admin", "SuperAdmin", "Manager", "Storekeeper"],
    description: "Multi-warehouse stock, transfers, requests, issues & reports",
    toggleable: true,
  },
  {
    id: "suppliers",
    label: "Suppliers",
    icon: Truck,
    roles: ["Admin", "SuperAdmin", "Manager", "Storekeeper"],
    description: "Supplier directory & contacts",
    toggleable: true,
  },
  {
    id: "quotes",
    label: "Quotes & Costing",
    icon: DollarSign,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Job cost estimation, quotes & saved quote history",
    toggleable: true,
  },
  // ===== System =====
  {
    id: "users",
    label: "User Management",
    icon: Users,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Create & manage console users",
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart3,
    roles: ["Admin", "SuperAdmin", "Manager", "Storekeeper", "Auditor"],
    description: "Consumption & analytics reports",
    toggleable: true,
  },
  {
    id: "settings",
    label: "System Settings",
    icon: Settings,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Configure factory defaults, modules & backup",
  },
  {
    id: "audit",
    label: "Audit Log",
    icon: ScrollText,
    roles: ["Admin", "SuperAdmin", "Manager", "Auditor"],
    description: "Compliance & change history",
  },
  {
    id: "user-guide",
    label: "User Guide",
    icon: BookOpen,
    roles: ["Admin", "SuperAdmin", "Manager", "Technician", "Storekeeper", "Auditor"],
    description: "Comprehensive manual for every module & shortcut",
  },
  {
    id: "user-central",
    label: "User Central",
    icon: ShieldCheck,
    roles: ["SuperAdmin"],
    description: "Assign or revoke modules & features per user",
  },
  // ===== Optional Add-on Modules (default OFF, toggle in Settings) =====
  {
    id: "scheduling",
    label: "Production Schedule",
    icon: CalendarDays,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Production timeline & workstation allocation",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "quality-control",
    label: "Quality Control",
    icon: ShieldCheck,
    roles: ["Admin", "SuperAdmin", "Manager", "Technician"],
    description: "QC checkpoints & inspection management",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "deliveries",
    label: "Delivery & Install",
    icon: PackageCheck,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Delivery scheduling & installation management",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "documents",
    label: "Documents",
    icon: FolderArchive,
    roles: ["Admin", "SuperAdmin", "Manager", "Technician"],
    description: "Job document management (contracts, drawings, permits)",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "templates",
    label: "Job Templates",
    icon: LayoutTemplate,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Save recurring job configurations as templates",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "warranty",
    label: "Warranty",
    icon: ShieldCheck,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Warranty claims & after-sales service tracking",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "barcodes",
    label: "Barcode / QR",
    icon: QrCode,
    roles: ["Admin", "SuperAdmin", "Manager", "Technician"],
    description: "Generate & scan barcode/QR labels for inventory",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "forecasting",
    label: "Forecasting",
    icon: TrendingUp,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Inventory demand forecasting & reorder predictions",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "calendar",
    label: "Unified Calendar",
    icon: CalendarRange,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "All events in one calendar — jobs, deliveries, attendance, schedules",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "punch-list",
    label: "Punch List",
    icon: Bug,
    roles: ["Admin", "SuperAdmin", "Manager", "Technician"],
    description: "Post-installation deficiency tracking & resolution",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "change-orders",
    label: "Change Orders",
    icon: GitBranch,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Track scope changes & modifications during production",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "communications",
    label: "Communication Log",
    icon: MessageSquare,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Customer communication history — calls, emails, meetings",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "subcontractors",
    label: "Subcontractors",
    icon: HardHat,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "External team management & assignment tracking",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "equipment",
    label: "Equipment",
    icon: Wrench,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Machine registry, assignment & maintenance scheduling",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "milestones",
    label: "Milestones",
    icon: Flag,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Key project dates — measurement, design, cutting, installation",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "mrp",
    label: "Material Planning",
    icon: PackageSearch,
    roles: ["Admin", "SuperAdmin", "Manager"],
    description: "Auto-calculate material requirements from cutting lists",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  {
    id: "site-visits",
    label: "Site Visits",
    icon: ClipboardCheck,
    roles: ["Admin", "SuperAdmin", "Manager", "Technician"],
    description: "Log on-site visits — inspections, measurements, handovers",
    toggleable: true,
    isNew: true,
    version: "2.0",
  },
  // ===== Hidden from nav — accessible via Job Management Sheet tabs or redirects =====
  // These IDs are still in VIEW_COMPONENTS for internal routing
  // but NOT shown in the sidebar to reduce clutter:
  // - "kanban" (Pipeline Board) → accessible via Job Orders "Pipeline" tab
  // - "my-jobs" (My Assigned Jobs) → accessible via Job Orders "My Jobs" filter
  // - "saved-quotes" (Saved Quotes) → merged into "quotes" view
  // - "purchase-orders" → merged into Inventory "Purchases" tab
];

// Module toggle state — stored in localStorage
const TOGGLE_KEY = "kcm-module-toggles";

export function getModuleToggles(): Record<string, boolean> {
  if (typeof window === "undefined") return {};
  try {
    const stored = localStorage.getItem(TOGGLE_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

export function setModuleToggles(toggles: Record<string, boolean>) {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOGGLE_KEY, JSON.stringify(toggles));
}

// New modules that default to OFF (must be explicitly enabled in Settings)
const DEFAULT_OFF_MODULES = new Set([
  "scheduling",
  "quality-control",
  "deliveries",
  "documents",
  "templates",
  "warranty",
  "barcodes",
  "forecasting",
  "calendar",
  "punch-list",
  "change-orders",
  "communications",
  "subcontractors",
  "equipment",
  "milestones",
  "mrp",
  "site-visits",
  // These were previously in nav but now hidden — keep in DEFAULT_OFF so they don't show
  "kanban",
  "my-jobs",
  "saved-quotes",
  "purchase-orders",
]);

export function isModuleEnabled(id: string): boolean {
  const toggles = getModuleToggles();
  // New modules default OFF unless explicitly turned on
  if (DEFAULT_OFF_MODULES.has(id)) {
    return toggles[id] === true;
  }
  // Existing toggleable modules default ON unless explicitly turned off
  return toggles[id] !== false;
}

export function navForRole(role: Role, userPermissions?: Record<string, boolean>): NavItem[] {
  const toggles = getModuleToggles();
  return NAV_ITEMS.filter((n) => {
    // SuperAdmin always sees everything
    if (role !== "SuperAdmin") {
      if (!n.roles.includes(role)) return false;
    }
    // Check per-user permission overrides
    if (userPermissions && n.id in userPermissions) {
      if (!userPermissions[n.id]) return false; // explicitly revoked
    }
    // Check toggle state
    if (n.toggleable) {
      if (DEFAULT_OFF_MODULES.has(n.id)) {
        if (toggles[n.id] !== true) return false;
      } else {
        if (toggles[n.id] === false) return false;
      }
    }
    return true;
  });
}
