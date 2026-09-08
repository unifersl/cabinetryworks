import type {
  User,
  SessionUser,
  JobOrder,
  Customer,
  SiteMeasurement,
  CuttingList,
  Stats,
  Role,
  JobStatus,
  Priority,
  JobDetail,
} from "@/lib/types";

async function request<T>(
  url: string,
  options?: RequestInit
): Promise<T> {
  let lastError: Error | null = null;
  const maxRetries = 2;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);

      const res = await fetch(url, {
        ...options,
        headers: {
          "Content-Type": "application/json",
          ...(options?.headers || {}),
        },
        credentials: "same-origin",
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      let data: unknown = null;
      try {
        data = await res.json();
      } catch {
        /* non-json response */
      }

      if (!res.ok) {
        const msg =
          (data && typeof data === "object" && "error" in data
            ? String((data as Record<string, unknown>).error)
            : null) ?? `Request failed (${res.status})`;
        const err = new Error(msg) as Error & {
          status: number;
          fallback?: string;
          detail?: string;
        };
        err.status = res.status;
        if (data && typeof data === "object") {
          const d = data as Record<string, unknown>;
          if (typeof d.fallback === "string") err.fallback = d.fallback;
          if (typeof d.detail === "string") err.detail = d.detail;
        }
        throw err;
      }
      return data as T;
    } catch (error) {
      lastError = error as Error;
      // Retry on network errors (502, connection refused, abort/timeout)
      // but not on 4xx client errors
      const status = (error as { status?: number }).status;
      const isNetworkError =
        !status ||
        status === 502 ||
        status === 503 ||
        error instanceof TypeError ||
        (error as Error).name === "AbortError";

      if (isNetworkError && attempt < maxRetries) {
        // Exponential backoff: 500ms, 1000ms
        await new Promise((r) => setTimeout(r, 500 * (attempt + 1)));
        continue;
      }
      throw error;
    }
  }

  throw lastError ?? new Error("Request failed after retries");
}

/* ---------------- Auth ---------------- */
export const authApi = {
  login: (username: string, password: string) =>
    request<{ user: SessionUser }>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ username, password }),
    }),
  logout: () =>
    request<{ ok: true }>("/api/auth/logout", { method: "POST" }),
  me: () => request<{ user: SessionUser | null }>("/api/auth/me"),
};

/* ---------------- Users ---------------- */
export interface CreateUserPayload {
  id: string;
  p_id: string;
  username: string;
  fullName: string;
  full_name?: string;
  password: string;
  role: Role;
  status: string;
  created_at: string;
  email?: string;
  phone?: string;
}

export const usersApi = {
  list: () => request<{ users: User[] }>("/api/users"),
  /**
   * Primary create handler (mirrors Supabase RPC `admin_create_user`).
   * Sends frontend-generated UUID in both `id` and `p_id`.
   */
  create: (payload: CreateUserPayload) =>
    request<{ user: User }>("/api/users", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  /**
   * Mandatory fallback — direct table insert. Invoked by the UI when the
   * primary handler returns an error or a 4xx/5xx.
   */
  createDirect: (payload: CreateUserPayload) =>
    request<{ user: User }>("/api/users/direct", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<User> & { password?: string }) =>
    request<{ user: User }>(`/api/users/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/users/${id}`, { method: "DELETE" }),
};

/* ---------------- Customers ---------------- */
export const customersApi = {
  list: () => request<{ customers: Customer[] }>("/api/customers"),
  get: (id: string) =>
    request<{ customer: Customer & { jobOrders: Array<{ id: string; orderNumber: string; title: string; status: string; priority: string; createdAt: string }> } }>(
      `/api/customers/${id}`
    ),
  create: (payload: Partial<Customer>) =>
    request<{ customer: Customer }>("/api/customers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<Customer>) =>
    request<{ customer: Customer }>(`/api/customers/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/customers/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Orders ---------------- */
export const jobsApi = {
  list: (params?: {
    status?: JobStatus;
    assignedToId?: string;
    includeArchived?: boolean;
    archived?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.assignedToId) qs.set("assignedToId", params.assignedToId);
    if (params?.includeArchived) qs.set("includeArchived", "true");
    if (params?.archived) qs.set("archived", "true");
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ jobs: JobOrder[] }>(`/api/job-orders${suffix}`);
  },
  create: (payload: {
    title: string;
    customerId: string;
    assignedToId?: string;
    description?: string;
    priority?: Priority;
    deliveryDate?: string;
  }) =>
    request<{ job: JobOrder }>("/api/job-orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  get: (id: string) =>
    request<{ job: JobDetail }>(`/api/job-orders/${id}`),
  update: (
    id: string,
    patch: Partial<{
      title: string;
      status: JobStatus;
      priority: Priority;
      description: string;
      assignedToId: string | null;
      deliveryDate: string | null;
      archived: boolean;
    }>
  ) =>
    request<{ job: JobOrder }>(`/api/job-orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/job-orders/${id}`, { method: "DELETE" }),
};

/* ---------------- Measurements ---------------- */
export const measurementsApi = {
  list: (jobId?: string) => {
    const qs = jobId ? `?jobId=${jobId}` : "";
    return request<{ measurements: SiteMeasurement[] }>(
      `/api/measurements${qs}`
    );
  },
  create: (payload: Partial<SiteMeasurement> & { jobId: string }) =>
    request<{ measurement: SiteMeasurement }>("/api/measurements", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/measurements/${id}`, { method: "DELETE" }),
};

/* ---------------- Cutting Lists ---------------- */
export const cuttingListsApi = {
  list: (jobId?: string) => {
    const qs = jobId ? `?jobId=${jobId}` : "";
    return request<{ cuttingLists: CuttingList[] }>(`/api/cutting-lists${qs}`);
  },
  create: (
    payload: Omit<Partial<CuttingList>, "items"> & {
      jobId: string;
      items?: unknown[];
    }
  ) =>
    request<{ cuttingList: CuttingList }>("/api/cutting-lists", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/cutting-lists/${id}`, { method: "DELETE" }),
};

/* ---------------- Stats & Settings ---------------- */
export const statsApi = {
  get: (range?: number) =>
    request<Stats>(`/api/stats${range ? `?range=${range}` : ""}`),
};

/* ---------------- Search ---------------- */
export interface SearchResult {
  jobs: Array<{
    id: string;
    orderNumber: string;
    title: string;
    status: string;
    priority: string;
    customerId: string;
    customerName: string | null;
  }>;
  customers: Array<{
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
  }>;
  users: Array<{
    id: string;
    username: string;
    fullName: string;
    role: string;
    status: string;
  }>;
}

export const searchApi = {
  search: (q: string) =>
    request<SearchResult>(
      `/api/search?q=${encodeURIComponent(q)}`
    ),
};

export const settingsApi = {
  get: () =>
    request<{ settings: Record<string, string> }>("/api/settings"),
  update: (settings: Record<string, string>) =>
    request<{ ok: true }>("/api/settings", {
      method: "PUT",
      body: JSON.stringify(settings),
    }),
};

/* ---------------- Activity Feed ---------------- */
export interface ActivityEvent {
  id: string;
  type: "job_created" | "job_assigned" | "job_status" | "measurement" | "cutting_list";
  timestamp: string;
  title: string;
  description: string;
  entityId: string;
  entityType: "job" | "measurement" | "cutting_list";
  actor: string | null;
  meta?: Record<string, string | null>;
}

export const activityApi = {
  list: (limit = 20) =>
    request<{ events: ActivityEvent[] }>(`/api/activity?limit=${limit}`),
};

/* ---------------- Audit Log ---------------- */
export interface AuditLogEntry {
  id: string;
  action: string;
  entityType: string;
  entityId: string | null;
  actorId: string | null;
  actorName: string | null;
  summary: string;
  details: string | null;
  ipAddress: string | null;
  createdAt: string;
  actor?: { id: string; fullName: string; role: string } | null;
}

export const auditApi = {
  list: (params?: {
    action?: string;
    entityType?: string;
    entityId?: string;
    limit?: number;
  }) => {
    const qs = new URLSearchParams();
    if (params?.action) qs.set("action", params.action);
    if (params?.entityType) qs.set("entityType", params.entityType);
    if (params?.entityId) qs.set("entityId", params.entityId);
    if (params?.limit) qs.set("limit", String(params.limit));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ logs: AuditLogEntry[]; stats: { total: number; todayCount: number } }>(
      `/api/audit${suffix}`
    );
  },
  retention: (days: number) =>
    request<{ deleted: number; days: number }>(`/api/audit/retention`, {
      method: "POST",
      body: JSON.stringify({ days }),
    }),
};

/* ---------------- Material Prices ---------------- */
export interface MaterialPrice {
  id: string;
  name: string;
  material: string;
  thickness: string | null;
  pricePerSqm: number;
  unit: string;
  edgeBandingPricePerM: number;
  laborRatePerHour: number;
  estimatedHours: number;
  createdAt?: string;
  updatedAt?: string;
}

export const materialPricesApi = {
  list: () => request<{ prices: MaterialPrice[] }>("/api/material-prices"),
  create: (payload: Partial<MaterialPrice>) =>
    request<{ price: MaterialPrice }>("/api/material-prices", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<MaterialPrice>) =>
    request<{ price: MaterialPrice }>(`/api/material-prices/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/material-prices/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Cost ---------------- */
export interface JobCost {
  job: {
    orderNumber: string;
    title: string;
    customer: { name: string };
    deliveryDate: string | null;
  };
  currency: string;
  taxRate: number;
  lines: Array<{
    panelName: string;
    material: string;
    partName: string;
    qty: number;
    areaSqm: number;
    edgeLengthM: number;
    materialCost: number;
    edgeCost: number;
    unitPrice: number;
  }>;
  summary: {
    totalAreaSqm: number;
    totalEdgeLengthM: number;
    materialCost: number;
    edgeCost: number;
    laborCost: number;
    subtotal: number;
    taxAmount: number;
    total: number;
  };
  formatted: {
    materialCost: string;
    edgeCost: string;
    laborCost: string;
    subtotal: string;
    taxAmount: string;
    total: string;
  };
}

export const costApi = {
  get: (jobId: string) =>
    request<JobCost>(`/api/job-orders/${jobId}/cost`),
};

/* ---------------- Bulk Operations ---------------- */
export const bulkApi = {
  updateJobs: (ids: string[], action: "archive" | "restore" | "status" | "assign", value?: string) =>
    request<{ updated: number; action: string }>(`/api/job-orders/bulk`, {
      method: "POST",
      body: JSON.stringify({ ids, action, value }),
    }),
};

/* ---------------- Saved Quotes ---------------- */
export interface SavedQuote {
  id: string;
  quoteNumber: string;
  jobId: string;
  customerId: string;
  status: "draft" | "sent" | "accepted" | "rejected" | "expired";
  materialCost: number;
  edgeCost: number;
  laborCost: number;
  subtotal: number;
  taxRate: number;
  taxAmount: number;
  total: number;
  currency: string;
  notes: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
  job?: { id: string; orderNumber: string; title: string };
  customer?: { id: string; name: string };
}

export const quotesApi = {
  list: (params?: { status?: string; customerId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.customerId) qs.set("customerId", params.customerId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ quotes: SavedQuote[] }>(`/api/quotes${suffix}`);
  },
  create: (payload: {
    jobId: string;
    materialCost?: number;
    edgeCost?: number;
    laborCost?: number;
    subtotal?: number;
    taxRate?: number;
    taxAmount?: number;
    total?: number;
    currency?: string;
    notes?: string;
    validUntil?: string;
  }) =>
    request<{ quote: SavedQuote }>("/api/quotes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<{ status: string; notes: string; validUntil: string }>) =>
    request<{ quote: SavedQuote }>(`/api/quotes/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/quotes/${id}`, { method: "DELETE" }),
};

/* ---------------- Inventory ---------------- */
export interface InventoryCategory {
  id: string;
  name: string;
  description: string | null;
  itemCount?: number;
  createdAt: string;
  updatedAt: string;
}

export interface InventoryItem {
  id: string;
  name: string;
  code: string | null;
  material: string;
  thickness: string | null;
  unit: string;
  stockLevel: number | string;
  minStock: number | string;
  reorderPoint: number | string;
  unitCost: number | string;
  supplier: string | null;
  categoryId: string | null;
  status: string; // active | disposed | inactive
  notes: string | null;
  lastRestocked: string | null;
  createdAt: string;
  updatedAt: string;
  category?: InventoryCategory | null;
  stockLots?: Array<{ id: string; warehouseId: string; quantity: number | string }>;
}

export interface InventoryStats {
  total: number;
  lowStock: number;
  outOfStock: number;
}

export const inventoryApi = {
  list: () =>
    request<{ items: InventoryItem[]; stats: InventoryStats }>("/api/inventory"),
  create: (payload: Partial<InventoryItem>) =>
    request<{ item: InventoryItem }>("/api/inventory", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<InventoryItem> & { status?: string }) =>
    request<{ item: InventoryItem }>(`/api/inventory/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/inventory/${id}`, { method: "DELETE" }),
};

export const inventoryCategoriesApi = {
  list: () =>
    request<{ categories: InventoryCategory[] }>("/api/inventory-categories"),
  create: (payload: { name: string; description?: string }) =>
    request<{ category: InventoryCategory }>("/api/inventory-categories", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: { name?: string; description?: string | null }) =>
    request<{ category: InventoryCategory }>(`/api/inventory-categories/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/inventory-categories/${id}`, { method: "DELETE" }),
};

/* ---------------- Warehouses ---------------- */
export interface Warehouse {
  id: string;
  code: string;
  name: string;
  location: string | null;
  type: string; // main | site | temporary
  isActive: boolean;
  itemCount?: number;
  _count?: Record<string, number>;
  stockLots?: Array<{
    id: string;
    itemId: string;
    warehouseId: string;
    quantity: number | string;
    batchNo: string | null;
    receivedDate: string;
    notes: string | null;
    item: InventoryItem;
  }>;
  createdAt: string;
  updatedAt: string;
}

export const warehousesApi = {
  list: () => request<{ warehouses: Warehouse[] }>("/api/warehouses"),
  get: (id: string) => request<{ warehouse: Warehouse }>(`/api/warehouses/${id}`),
  create: (payload: {
    code: string;
    name: string;
    location?: string;
    type?: string;
    isActive?: boolean;
  }) =>
    request<{ warehouse: Warehouse }>("/api/warehouses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<Warehouse>) =>
    request<{ warehouse: Warehouse }>(`/api/warehouses/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/warehouses/${id}`, { method: "DELETE" }),
};

/* ---------------- Stock Transfers ---------------- */
export interface StockTransferItem {
  id: string;
  transferId: string;
  itemId: string;
  quantity: number | string;
  batchNo: string | null;
  item?: InventoryItem;
}

export interface StockTransfer {
  id: string;
  transferNo: string;
  fromWarehouseId: string;
  toWarehouseId: string;
  status: string; // draft | in_transit | received | cancelled
  notes: string | null;
  createdBy: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  fromWarehouse?: Warehouse;
  toWarehouse?: Warehouse;
  items: StockTransferItem[];
  itemCount?: number;
}

export const stockTransfersApi = {
  list: (params?: { status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ transfers: StockTransfer[] }>(`/api/stock-transfers${suffix}`);
  },
  get: (id: string) =>
    request<{ transfer: StockTransfer }>(`/api/stock-transfers/${id}`),
  create: (payload: {
    fromWarehouseId: string;
    toWarehouseId: string;
    status?: string;
    notes?: string;
    reason?: string;
    items: Array<{ itemId: string; quantity: number; batchNo?: string }>;
  }) =>
    request<{ transfer: StockTransfer }>("/api/stock-transfers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: { status?: string; notes?: string; reason?: string }) =>
    request<{ transfer: StockTransfer }>(`/api/stock-transfers/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/stock-transfers/${id}`, { method: "DELETE" }),
};

/* ---------------- Stock Adjustments ---------------- */
export interface StockAdjustment {
  id: string;
  adjNo: string;
  itemId: string;
  warehouseId: string;
  jobId: string | null;
  type: string; // set | add | remove | dispose
  oldQty: number | string;
  newQty: number | string;
  diff: number | string;
  reason: string | null;
  notes: string | null;
  adjustedBy: string | null;
  createdAt: string;
  item?: InventoryItem;
  warehouse?: Warehouse;
  job?: { id: string; orderNumber: string; title: string } | null;
}

export const stockAdjustmentsApi = {
  list: (params?: { warehouseId?: string; itemId?: string; jobId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.warehouseId) qs.set("warehouseId", params.warehouseId);
    if (params?.itemId) qs.set("itemId", params.itemId);
    if (params?.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ adjustments: StockAdjustment[] }>(`/api/stock-adjustments${suffix}`);
  },
  create: (payload: {
    itemId: string;
    warehouseId: string;
    type: string;
    quantity: number;
    reason: string;
    notes?: string;
    batchNo?: string;
    jobId?: string | null;
  }) =>
    request<{ adjustment: StockAdjustment }>("/api/stock-adjustments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

/* ---------------- Stock Takes ---------------- */
export interface StockTakeLine {
  id: string;
  takeId: string;
  itemId: string;
  systemQty: number | string;
  countedQty: number | string;
  diff: number | string;
  notes: string | null;
  item?: InventoryItem;
}

export interface StockTake {
  id: string;
  takeNo: string;
  warehouseId: string;
  period: string;
  status: string; // open | counting | completed | closed
  notes: string | null;
  createdBy: string | null;
  closedAt: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: Warehouse;
  lines?: StockTakeLine[];
  lineCount?: number;
}

export const stockTakesApi = {
  list: (params?: { warehouseId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.warehouseId) qs.set("warehouseId", params.warehouseId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ stockTakes: StockTake[] }>(`/api/stock-takes${suffix}`);
  },
  get: (id: string) => request<{ stockTake: StockTake }>(`/api/stock-takes/${id}`),
  create: (payload: { warehouseId: string; period: string; notes?: string }) =>
    request<{ stockTake: StockTake }>("/api/stock-takes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (
    id: string,
    patch: {
      status?: string;
      notes?: string;
      lines?: Array<{ lineId: string; countedQty: number }>;
    }
  ) =>
    request<{ stockTake: StockTake }>(`/api/stock-takes/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/stock-takes/${id}`, { method: "DELETE" }),
};

/* ---------------- Stock Requests ---------------- */
export interface StockRequestLine {
  id: string;
  requestId: string;
  itemId: string;
  quantity: number | string;
  item?: InventoryItem;
}

export interface StockRequest {
  id: string;
  reqNo: string;
  jobId: string | null;
  warehouseId: string;
  requestedBy: string | null;
  status: string; // pending | approved | rejected | issued | cancelled
  notes: string | null;
  approvedAt: string | null;
  approvedBy: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: Warehouse;
  job?: { id: string; orderNumber: string; title: string } | null;
  lines: StockRequestLine[];
  lineCount?: number;
}

export const stockRequestsApi = {
  list: (params?: { status?: string; warehouseId?: string; jobId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.warehouseId) qs.set("warehouseId", params.warehouseId);
    if (params?.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ requests: StockRequest[] }>(`/api/stock-requests${suffix}`);
  },
  get: (id: string) => request<{ request: StockRequest }>(`/api/stock-requests/${id}`),
  create: (payload: {
    warehouseId: string;
    jobId?: string | null;
    notes?: string;
    lines: Array<{ itemId: string; quantity: number }>;
  }) =>
    request<{ request: StockRequest }>("/api/stock-requests", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: { status: string }) =>
    request<{ request: StockRequest }>(`/api/stock-requests/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/stock-requests/${id}`, { method: "DELETE" }),
};

/* ---------------- Goods Issues ---------------- */
export interface GoodsIssueLine {
  id: string;
  issueId: string;
  itemId: string;
  quantity: number | string;
  batchNo: string | null;
  item?: InventoryItem;
}

export interface GoodsIssue {
  id: string;
  issueNo: string;
  jobId: string | null;
  warehouseId: string;
  requestId: string | null;
  issuedBy: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: Warehouse;
  job?: { id: string; orderNumber: string; title: string } | null;
  lines: GoodsIssueLine[];
  lineCount?: number;
}

export const goodsIssuesApi = {
  list: (params?: { warehouseId?: string; jobId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.warehouseId) qs.set("warehouseId", params.warehouseId);
    if (params?.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ issues: GoodsIssue[] }>(`/api/goods-issues${suffix}`);
  },
  create: (payload: {
    warehouseId: string;
    jobId?: string | null;
    requestId?: string | null;
    notes?: string;
    lines: Array<{ itemId: string; quantity: number; batchNo?: string }>;
  }) =>
    request<{ issue: GoodsIssue }>("/api/goods-issues", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

/* ---------------- Goods Returns ---------------- */
export interface GoodsReturnLine {
  id: string;
  returnId: string;
  itemId: string;
  quantity: number | string;
  batchNo: string | null;
  item?: InventoryItem;
}

export interface GoodsReturn {
  id: string;
  returnNo: string;
  jobId: string | null;
  warehouseId: string;
  issueId: string | null;
  returnedBy: string | null;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  warehouse?: Warehouse;
  job?: { id: string; orderNumber: string; title: string } | null;
  lines: GoodsReturnLine[];
  lineCount?: number;
}

export const goodsReturnsApi = {
  list: (params?: { warehouseId?: string; jobId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.warehouseId) qs.set("warehouseId", params.warehouseId);
    if (params?.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ returns: GoodsReturn[] }>(`/api/goods-returns${suffix}`);
  },
  create: (payload: {
    warehouseId: string;
    jobId?: string | null;
    issueId?: string | null;
    notes?: string;
    lines: Array<{ itemId: string; quantity: number; batchNo?: string }>;
  }) =>
    request<{ return: GoodsReturn }>("/api/goods-returns", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
};

/* ---------------- Outside Purchases ---------------- */
export interface OutsidePurchaseLine {
  id: string;
  purchaseId: string;
  itemId: string | null;
  itemName: string;
  quantity: number | string;
  unit: string;
  notes: string | null;
  item?: InventoryItem | null;
}

export interface OutsidePurchase {
  id: string;
  poNo: string;
  jobId: string | null;
  warehouseId: string | null;
  supplier: string | null;
  purchasedBy: string | null;
  status: string; // draft | received | cancelled
  notes: string | null;
  receivedAt: string | null;
  createdAt: string;
  updatedAt: string;
  job?: { id: string; orderNumber: string; title: string } | null;
  warehouse?: Warehouse | null;
  lines: OutsidePurchaseLine[];
  lineCount?: number;
}

export const outsidePurchasesApi = {
  list: (params?: { status?: string; jobId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ purchases: OutsidePurchase[] }>(`/api/outside-purchases${suffix}`);
  },
  get: (id: string) =>
    request<{ purchase: OutsidePurchase }>(`/api/outside-purchases/${id}`),
  create: (payload: {
    jobId?: string | null;
    warehouseId?: string | null;
    supplier?: string;
    status?: string;
    notes?: string;
    lines: Array<{
      itemId?: string | null;
      itemName: string;
      quantity: number;
      unit?: string;
      notes?: string;
    }>;
  }) =>
    request<{ purchase: OutsidePurchase }>("/api/outside-purchases", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: { status?: string; notes?: string; supplier?: string }) =>
    request<{ purchase: OutsidePurchase }>(`/api/outside-purchases/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/outside-purchases/${id}`, { method: "DELETE" }),
};

/* ---------------- Inventory Reports ---------------- */
export interface InventoryReportResult {
  type: string;
  title: string;
  headers: string[];
  rows: Record<string, unknown>[];
  generatedAt: string;
}

export const inventoryReportsApi = {
  get: (params: {
    type: "stock-level" | "movement" | "job-wise" | "low-stock";
    format?: "json" | "csv";
    from?: string;
    to?: string;
    warehouseId?: string;
  }) => {
    const qs = new URLSearchParams();
    qs.set("type", params.type);
    if (params.format) qs.set("format", params.format);
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.warehouseId) qs.set("warehouseId", params.warehouseId);
    return request<InventoryReportResult>(`/api/inventory-reports?${qs.toString()}`);
  },
  csv: (params: {
    type: "stock-level" | "movement" | "job-wise" | "low-stock";
    from?: string;
    to?: string;
    warehouseId?: string;
  }) => {
    const qs = new URLSearchParams();
    qs.set("type", params.type);
    qs.set("format", "csv");
    if (params.from) qs.set("from", params.from);
    if (params.to) qs.set("to", params.to);
    if (params.warehouseId) qs.set("warehouseId", params.warehouseId);
    return fetch(`/api/inventory-reports?${qs.toString()}`).then((r) => r.text());
  },
};

/* ---------------- Customer Statement ---------------- */
export interface CustomerStatement {
  customer: {
    id: string;
    name: string;
    email: string | null;
    phone: string | null;
    address: string | null;
    createdAt: string;
  };
  jobs: Array<{
    id: string;
    orderNumber: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    deliveryDate: string | null;
    archived: boolean;
    _count: { measurements: number; cuttingLists: number };
  }>;
  quotes: SavedQuote[];
  summary: {
    totalJobs: number;
    activeJobs: number;
    completedJobs: number;
    totalQuotes: number;
    acceptedQuotes: number;
    pendingQuotes: number;
    totalQuoted: number;
    totalAccepted: number;
  };
}

export const statementsApi = {
  get: (customerId: string) =>
    request<CustomerStatement>(`/api/customers/${customerId}/statement`),
};

/* ---------------- Purchase Orders ---------------- */
export interface PurchaseOrderItem {
  id: string;
  purchaseOrderId: string;
  inventoryItemId: string | null;
  itemName: string;
  quantity: number;
  unit: string;
  unitCost: number;
  lineTotal: number;
}

export interface PurchaseOrder {
  id: string;
  poNumber: string;
  supplier: string;
  status: "draft" | "sent" | "received" | "cancelled";
  notes: string | null;
  totalCost: number;
  currency: string;
  expectedDate: string | null;
  receivedDate: string | null;
  createdAt: string;
  updatedAt: string;
  items: PurchaseOrderItem[];
}

export const purchaseOrdersApi = {
  list: (params?: { status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ orders: PurchaseOrder[] }>(`/api/purchase-orders${suffix}`);
  },
  create: (payload: {
    supplier: string;
    status?: string;
    notes?: string;
    expectedDate?: string;
    items: Array<{
      inventoryItemId?: string;
      itemName: string;
      quantity: number;
      unit?: string;
      unitCost: number;
    }>;
  }) =>
    request<{ order: PurchaseOrder }>("/api/purchase-orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: { status?: string; notes?: string; expectedDate?: string }) =>
    request<{ order: PurchaseOrder }>(`/api/purchase-orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/purchase-orders/${id}`, { method: "DELETE" }),
};

/* ---------------- Suppliers ---------------- */
export interface Supplier {
  id: string;
  name: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  address: string | null;
  website: string | null;
  paymentTerms: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  inventoryCount?: number;
  poCount?: number;
}

export const suppliersApi = {
  list: () => request<{ suppliers: Supplier[] }>("/api/suppliers"),
  create: (payload: Partial<Supplier>) =>
    request<{ supplier: Supplier }>("/api/suppliers", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<Supplier>) =>
    request<{ supplier: Supplier }>(`/api/suppliers/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/suppliers/${id}`, { method: "DELETE" }),
};

/* ---------------- Reports ---------------- */
export interface ConsumptionReport {
  type: "consumption";
  dateRange: { from: string; to: string };
  sheetSizeSqm: number;
  summary: Array<{
    material: string;
    totalAreaSqm: number;
    totalSheets: number;
    cuttingListCount: number;
    jobCount: number;
  }>;
  details: Array<{
    id: string;
    orderNumber: string;
    jobTitle: string;
    customerName: string;
    material: string;
    panelName: string | null;
    areaSqm: number;
    sheets: number;
    createdAt: string;
  }>;
  totals: {
    totalAreaSqm: number;
    totalSheets: number;
    totalCuttingLists: number;
    totalJobs: number;
  };
}

export const reportsApi = {
  consumption: (params?: { from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    qs.set("type", "consumption");
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    return request<ConsumptionReport>(`/api/reports?${qs.toString()}`);
  },
};

/* ---------------- Job Time Logs ---------------- */
export type WorkType = "factory" | "onsite" | "travel" | "meeting" | "other";

export interface JobTimeLog {
  id: string;
  jobId: string;
  userId: string | null;
  workerName: string;
  workDate: string;
  workType: string;
  clockIn: string | null;
  clockOut: string | null;
  hoursWorked: number;
  hourlyRate: number;
  laborCost: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  user?: { id: string; fullName: string; role: string } | null;
}

export const jobTimeLogsApi = {
  list: (params?: { jobId?: string; userId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.userId) qs.set("userId", params.userId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ logs: JobTimeLog[] }>(`/api/job-time-logs${suffix}`);
  },
  create: (payload: {
    jobId: string;
    workerName: string;
    userId?: string | null;
    workDate?: string;
    workType?: string;
    clockIn?: string | null;
    clockOut?: string | null;
    hoursWorked?: number;
    notes?: string;
  }) =>
    request<{ log: JobTimeLog }>("/api/job-time-logs", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<{
    workerName: string;
    workType: string;
    userId: string | null;
    workDate: string;
    clockIn: string | null;
    clockOut: string | null;
    hoursWorked: number;
    notes: string | null;
  }>) =>
    request<{ log: JobTimeLog }>(`/api/job-time-logs/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/job-time-logs/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Transports ---------------- */
export type TransportPurpose =
  | "material_delivery"
  | "worker_transport"
  | "site_visit"
  | "other";

export interface JobTransport {
  id: string;
  jobId: string;
  date: string;
  vehicleNo: string | null;
  driverName: string | null;
  fromLocation: string | null;
  toLocation: string | null;
  purpose: string;
  distanceKm: number;
  cost: number;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const jobTransportsApi = {
  list: (params?: { jobId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ transports: JobTransport[] }>(`/api/job-transports${suffix}`);
  },
  create: (payload: {
    jobId: string;
    date?: string;
    vehicleNo?: string;
    driverName?: string;
    fromLocation?: string;
    toLocation?: string;
    purpose?: string;
    distanceKm?: number;
    notes?: string;
  }) =>
    request<{ transport: JobTransport }>("/api/job-transports", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<{
    date: string;
    vehicleNo: string | null;
    driverName: string | null;
    fromLocation: string | null;
    toLocation: string | null;
    purpose: string;
    distanceKm: number;
    notes: string | null;
  }>) =>
    request<{ transport: JobTransport }>(`/api/job-transports/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/job-transports/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Food & Beverages ---------------- */
export type MealType = "breakfast" | "lunch" | "dinner" | "snacks" | "tea" | "water";

export interface JobFoodBeverage {
  id: string;
  jobId: string;
  date: string;
  mealType: string;
  personCount: number;
  cost: number;
  description: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const jobFoodBeveragesApi = {
  list: (params?: { jobId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ items: JobFoodBeverage[] }>(`/api/job-food-beverages${suffix}`);
  },
  create: (payload: {
    jobId: string;
    date?: string;
    mealType?: string;
    personCount?: number;
    description?: string;
    notes?: string;
  }) =>
    request<{ item: JobFoodBeverage }>("/api/job-food-beverages", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<{
    date: string;
    mealType: string;
    personCount: number;
    description: string | null;
    notes: string | null;
  }>) =>
    request<{ item: JobFoodBeverage }>(`/api/job-food-beverages/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/job-food-beverages/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Tools Catalog ---------------- */
export type ToolCategory =
  | "power_tool"
  | "hand_tool"
  | "measuring"
  | "safety"
  | "ladder"
  | "other";
export type ToolStatus = "available" | "issued" | "lost" | "damaged" | "retired";

export interface JobTool {
  id: string;
  name: string;
  code: string | null;
  category: string;
  description: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
  _count?: { issueLines: number; returnLines: number };
}

export const jobToolsApi = {
  list: (params?: { category?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ tools: JobTool[] }>(`/api/job-tools${suffix}`);
  },
  create: (payload: {
    name: string;
    code?: string | null;
    category?: string;
    description?: string;
    status?: string;
  }) =>
    request<{ tool: JobTool }>("/api/job-tools", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<{
    name: string;
    code: string | null;
    category: string;
    description: string | null;
    status: string;
  }>) =>
    request<{ tool: JobTool }>(`/api/job-tools/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/job-tools/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Tool Issues ---------------- */
export interface JobToolIssueLine {
  id: string;
  issueId: string;
  toolId: string;
  quantity: number;
  condition: string; // good | fair | damaged
  tool?: JobTool;
}

export interface JobToolIssue {
  id: string;
  issueNo: string;
  jobId: string;
  issuedBy: string | null;
  issuedTo: string | null;
  date: string;
  status: string; // issued | partial | returned | lost
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  job?: { id: string; orderNumber: string; title: string };
  lines: JobToolIssueLine[];
  lineCount?: number;
}

export const jobToolIssuesApi = {
  list: (params?: { jobId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ issues: JobToolIssue[] }>(`/api/job-tool-issues${suffix}`);
  },
  get: (id: string) =>
    request<{ issue: JobToolIssue }>(`/api/job-tool-issues/${id}`),
  create: (payload: {
    jobId: string;
    issuedTo?: string;
    date?: string;
    notes?: string;
    lines: Array<{ toolId: string; quantity: number; condition?: string }>;
  }) =>
    request<{ issue: JobToolIssue }>("/api/job-tool-issues", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/job-tool-issues/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Tool Returns ---------------- */
export interface JobToolReturnLine {
  id: string;
  returnId: string;
  toolId: string;
  quantity: number;
  condition: string; // good | fair | damaged | lost
  tool?: JobTool;
}

export interface JobToolReturn {
  id: string;
  returnNo: string;
  jobId: string;
  issueId: string | null;
  returnedBy: string | null;
  returnedFrom: string | null;
  date: string;
  status: string;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  job?: { id: string; orderNumber: string; title: string };
  lines: JobToolReturnLine[];
  lineCount?: number;
}

export const jobToolReturnsApi = {
  list: (params?: { jobId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ returns: JobToolReturn[] }>(`/api/job-tool-returns${suffix}`);
  },
  get: (id: string) =>
    request<{ ret: JobToolReturn }>(`/api/job-tool-returns/${id}`),
  create: (payload: {
    jobId: string;
    issueId?: string | null;
    returnedFrom?: string;
    date?: string;
    notes?: string;
    lines: Array<{ toolId: string; quantity: number; condition?: string }>;
  }) =>
    request<{ return: JobToolReturn }>("/api/job-tool-returns", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/job-tool-returns/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Expenses ---------------- */
export type ExpenseCategory =
  | "fnb"
  | "transport"
  | "fuel"
  | "tools"
  | "materials"
  | "labor"
  | "parking"
  | "equipment_rental"
  | "miscellaneous"
  | "other";

export interface JobExpense {
  id: string;
  jobId: string;
  date: string;
  category: string;
  amount: number;
  currency: string;
  description: string | null;
  receiptNo: string | null;
  paidBy: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export const EXPENSE_CATEGORIES: { value: ExpenseCategory; label: string }[] = [
  { value: "fnb", label: "Food & Beverage" },
  { value: "transport", label: "Transport" },
  { value: "fuel", label: "Fuel" },
  { value: "tools", label: "Tools" },
  { value: "materials", label: "Materials" },
  { value: "labor", label: "Labor" },
  { value: "parking", label: "Parking" },
  { value: "equipment_rental", label: "Equipment Rental" },
  { value: "miscellaneous", label: "Miscellaneous" },
  { value: "other", label: "Other" },
];

export const jobExpensesApi = {
  list: (jobId?: string, category?: string) => {
    const params = new URLSearchParams();
    if (jobId) params.set("jobId", jobId);
    if (category) params.set("category", category);
    const suffix = params.toString() ? `?${params}` : "";
    return request<{
      expenses: JobExpense[];
      summary: { total: number; byCategory: Record<string, number>; count: number };
    }>(`/api/job-expenses${suffix}`);
  },
  create: (payload: Partial<JobExpense> & { jobId: string; amount: number }) =>
    request<{ expense: JobExpense }>("/api/job-expenses", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<JobExpense>) =>
    request<{ expense: JobExpense }>(`/api/job-expenses/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/job-expenses/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Insights ---------------- */
export interface JobInsights {
  job: {
    id: string;
    orderNumber: string;
    title: string;
    status: string;
    priority: string;
    createdAt: string;
    updatedAt: string;
    deliveryDate: string | null;
  };
  timeLogs: {
    total: number;
    totalHours: number;
    hoursByWorker: Array<{ workerName: string; hours: number; logCount: number }>;
    hoursByWorkType: Array<{ workType: string; hours: number }>;
  };
  transports: {
    total: number;
    totalDistance: number;
    byPurpose: Record<string, number>;
  };
  foodBeverage: {
    total: number;
    totalMeals: number;
    mealsByType: Array<{ mealType: string; count: number }>;
  };
  tools: {
    issuesCount: number;
    returnsCount: number;
    totalIssuedQty: number;
    totalReturnedQty: number;
    totalLostQty: number;
    totalDamagedQty: number;
    utilization: Array<{
      toolId: string;
      toolName: string;
      toolCode: string | null;
      issued: number;
      returned: number;
      lost: number;
      damaged: number;
    }>;
  };
  stock: {
    requestsCount: number;
    issuesCount: number;
    returnsCount: number;
    outsidePurchasesCount: number;
    totalIssuedQty: number;
    totalReturnedQty: number;
    totalPurchasedQty: number;
  };
  expenses: {
    total: number;
    count: number;
    byCategory: Array<{ category: string; total: number; count: number }>;
  };
  attendance: {
    total: number;
    totalHours: number;
    byWorker: Array<{ workerName: string; hours: number; days: number }>;
  };
  costSummary: {
    labor: number;
    transport: number;
    foodBeverage: number;
    expenses: number;
    grandTotal: number;
  };
  timeline: Array<{
    id: string;
    action: string;
    summary: string;
    actorName: string | null;
    createdAt: string;
  }>;
  progress: {
    percent: number;
    pipeline: string[];
    currentIndex: number;
  };
}

export const jobInsightsApi = {
  get: (jobId: string) =>
    request<JobInsights>(`/api/job-orders/${jobId}/insights`),
};

/* ---------------- Workers & Attendance ---------------- */
export interface Worker {
  id: string;
  code: string | null;
  name: string;
  phone: string | null;
  role: string | null;
  type: string; // factory | onsite | both
  status: string; // active | inactive
  hourlyRate: number;
  createdAt: string;
  updatedAt: string;
}

export interface AttendanceRecord {
  id: string;
  workerId: string;
  date: string;
  jobId: string | null;
  status: string; // present | absent | half_day | short_leave | full_leave | sick | holiday
  clockIn: string | null;
  clockOut: string | null;
  breakStart: string | null;
  breakEnd: string | null;
  hoursWorked: number;
  workLocation: string | null;
  notes: string | null;
  worker?: Worker | null;
  job?: { id: string; orderNumber: string; title: string } | null;
}

export interface AttendanceSummary {
  workerId: string;
  workerName: string;
  present: number;
  absent: number;
  halfDay: number;
  shortLeave: number;
  fullLeave: number;
  sick: number;
  holiday: number;
  totalHours: number;
  totalDays: number;
}

export const ATTENDANCE_STATUSES: {
  value: string;
  label: string;
  symbol: string;
  color: string;
}[] = [
  { value: "present", label: "Present", symbol: "P", color: "bg-green-500/15 text-green-700 border-green-500/30" },
  { value: "absent", label: "Absent", symbol: "A", color: "bg-red-500/15 text-red-700 border-red-500/30" },
  { value: "half_day", label: "Half Day", symbol: "H", color: "bg-amber-500/15 text-amber-700 border-amber-500/30" },
  { value: "short_leave", label: "Short Leave", symbol: "SL", color: "bg-sky-500/15 text-sky-700 border-sky-500/30" },
  { value: "full_leave", label: "Full Leave", symbol: "FL", color: "bg-purple-500/15 text-purple-700 border-purple-500/30" },
  { value: "sick", label: "Sick", symbol: "S", color: "bg-orange-500/15 text-orange-700 border-orange-500/30" },
  { value: "holiday", label: "Holiday", symbol: "HO", color: "bg-slate-500/15 text-slate-700 border-slate-500/30" },
];

export const workersApi = {
  list: (params?: { status?: string; type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.status) qs.set("status", params.status);
    if (params?.type) qs.set("type", params.type);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ workers: Worker[] }>(`/api/workers${suffix}`);
  },
  create: (payload: Partial<Worker> & { name: string }) =>
    request<{ worker: Worker }>("/api/workers", { method: "POST", body: JSON.stringify(payload) }),
  update: (id: string, patch: Partial<Worker>) =>
    request<{ worker: Worker }>(`/api/workers/${id}`, { method: "PUT", body: JSON.stringify(patch) }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/workers/${id}`, { method: "DELETE" }),
};

export const attendanceApi = {
  list: (params: { workerId?: string; jobId?: string; month?: string; date?: string }) => {
    const qs = new URLSearchParams();
    if (params.workerId) qs.set("workerId", params.workerId);
    if (params.jobId) qs.set("jobId", params.jobId);
    if (params.month) qs.set("month", params.month);
    if (params.date) qs.set("date", params.date);
    return request<{ records: AttendanceRecord[]; summary: AttendanceSummary[] }>(`/api/attendance?${qs.toString()}`);
  },
  upsert: (payload: Partial<AttendanceRecord> & { workerId: string; date: string }) =>
    request<{ record: AttendanceRecord }>("/api/attendance", { method: "POST", body: JSON.stringify(payload) }),
  bulkUpsert: (updates: Array<Partial<AttendanceRecord> & { workerId: string; date: string }>) =>
    request<{ updated: number }>("/api/attendance", { method: "PUT", body: JSON.stringify({ updates }) }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/attendance/${id}`, { method: "DELETE" }),
};

/* ---------------- Backup / Restore ---------------- */
export const backupApi = {
  export: () =>
    request<Response>("/api/backup/export", { method: "GET" }),
  list: () =>
    request<{ backups: Array<{ filename: string; date: string; type: string; size: number }>; current: string }>(
      "/api/backup/export?action=list"
    ),
  import: (data: unknown) =>
    request<{ ok: true; totalImported: number; totalSkipped: number }>("/api/backup/import", {
      method: "POST",
      body: JSON.stringify({ data }),
    }),
};

/* ---------------- Production Schedules ---------------- */
export interface ProductionSchedule {
  id: string;
  jobId: string;
  stage: string; // Cutting | Edge Banding | Assembly | Painting | Packing | Ready
  workstation: string | null;
  scheduledDate: string;
  endDate: string | null;
  assignedToId: string | null;
  status: string; // scheduled | in_progress | completed | delayed
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
    customerName?: string | null;
  } | null;
}

export const productionSchedulesApi = {
  list: (params?: { jobId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ schedules: ProductionSchedule[] }>(
      `/api/production-schedules${suffix}`
    );
  },
  create: (payload: {
    jobId: string;
    stage: string;
    workstation?: string | null;
    scheduledDate?: string;
    endDate?: string | null;
    assignedToId?: string | null;
    status?: string;
    notes?: string | null;
  }) =>
    request<{ schedule: ProductionSchedule }>("/api/production-schedules", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<ProductionSchedule>) =>
    request<{ schedule: ProductionSchedule }>(`/api/production-schedules/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/production-schedules/${id}`, {
      method: "DELETE",
    }),
};

/* ---------------- QC Checkpoints ---------------- */
export interface QcChecklistItem {
  item: string;
  checked?: boolean;
  note?: string;
}

export interface QcCheckpoint {
  id: string;
  jobId: string;
  stage: string; // Cutting | Assembly | Finishing | Installation
  inspector: string | null;
  status: string; // pending | passed | failed | rework
  checklist: string | null; // JSON string of QcChecklistItem[]
  photos: string | null;
  notes: string | null;
  inspectedAt: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
}

export const qcCheckpointsApi = {
  list: (params?: { jobId?: string; status?: string; stage?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.status) qs.set("status", params.status);
    if (params?.stage) qs.set("stage", params.stage);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ checkpoints: QcCheckpoint[] }>(
      `/api/qc-checkpoints${suffix}`
    );
  },
  create: (payload: {
    jobId: string;
    stage: string;
    inspector?: string;
    status?: string;
    checklist?: QcChecklistItem[] | string;
    notes?: string;
    inspectedAt?: string;
  }) =>
    request<{ checkpoint: QcCheckpoint }>("/api/qc-checkpoints", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<QcCheckpoint> & { checklist?: QcChecklistItem[] | string }) =>
    request<{ checkpoint: QcCheckpoint }>(`/api/qc-checkpoints/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/qc-checkpoints/${id}`, { method: "DELETE" }),
};

/* ---------------- Deliveries & Installation ---------------- */
export interface DeliveryRecord {
  id: string;
  jobId: string;
  type: string; // delivery | installation
  scheduledDate: string;
  completedDate: string | null;
  driverName: string | null;
  vehicleNo: string | null;
  installTeam: string | null;
  status: string; // scheduled | in_transit | delivered | installed | cancelled
  preChecklist: string | null;
  postChecklist: string | null;
  photos: string | null;
  customerSignoff: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
}

export const deliveriesApi = {
  list: (params?: { jobId?: string; status?: string; type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.status) qs.set("status", params.status);
    if (params?.type) qs.set("type", params.type);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ deliveries: DeliveryRecord[] }>(`/api/deliveries${suffix}`);
  },
  create: (payload: {
    jobId: string;
    type?: string;
    scheduledDate?: string;
    completedDate?: string | null;
    driverName?: string;
    vehicleNo?: string;
    installTeam?: string;
    status?: string;
    notes?: string;
  }) =>
    request<{ delivery: DeliveryRecord }>("/api/deliveries", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<DeliveryRecord>) =>
    request<{ delivery: DeliveryRecord }>(`/api/deliveries/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/deliveries/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Documents ---------------- */
export interface JobDocument {
  id: string;
  jobId: string;
  name: string;
  type: string; // document | contract | drawing | permit | warranty | other
  fileType: string | null;
  fileSize: number;
  dataUrl: string;
  version: number;
  notes: string | null;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
}

export const jobDocumentsApi = {
  list: (params?: { jobId?: string; type?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.type) qs.set("type", params.type);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ documents: JobDocument[] }>(`/api/job-documents${suffix}`);
  },
  create: (payload: {
    jobId: string;
    name: string;
    type?: string;
    fileType?: string;
    fileSize?: number;
    dataUrl: string;
    notes?: string;
  }) =>
    request<{ document: JobDocument }>("/api/job-documents", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/job-documents/${id}`, { method: "DELETE" }),
};

/* ---------------- Job Templates ---------------- */
export interface JobTemplate {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  defaultCuttingList: string | null;
  defaultHardware: string | null;
  defaultBoM: string | null;
  estimatedHours: number;
  estimatedDays: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export const jobTemplatesApi = {
  list: (params?: { category?: string; active?: boolean }) => {
    const qs = new URLSearchParams();
    if (params?.category) qs.set("category", params.category);
    if (params?.active !== undefined) qs.set("active", String(params.active));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ templates: JobTemplate[] }>(`/api/job-templates${suffix}`);
  },
  create: (payload: {
    name: string;
    description?: string;
    category?: string;
    estimatedHours?: number;
    estimatedDays?: number;
    isActive?: boolean;
  }) =>
    request<{ template: JobTemplate }>("/api/job-templates", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<JobTemplate>) =>
    request<{ template: JobTemplate }>(`/api/job-templates/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/job-templates/${id}`, { method: "DELETE" }),
};

/* ---------------- Warranty Claims ---------------- */
export interface WarrantyClaim {
  id: string;
  jobId: string | null;
  claimNo: string;
  claimDate: string;
  issueType: string; // defect | damage | adjustment | replacement
  description: string | null;
  status: string; // open | in_progress | resolved | rejected
  resolvedAt: string | null;
  resolution: string | null;
  partsUsed: string | null;
  photos: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
    customerName?: string | null;
  } | null;
}

export const warrantyClaimsApi = {
  list: (params?: { jobId?: string; status?: string; issueType?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.status) qs.set("status", params.status);
    if (params?.issueType) qs.set("issueType", params.issueType);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ claims: WarrantyClaim[] }>(`/api/warranty-claims${suffix}`);
  },
  create: (payload: {
    jobId?: string | null;
    issueType: string;
    description?: string;
    status?: string;
  }) =>
    request<{ claim: WarrantyClaim }>("/api/warranty-claims", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (
    id: string,
    patch: Partial<WarrantyClaim> & { resolution?: string }
  ) =>
    request<{ claim: WarrantyClaim }>(`/api/warranty-claims/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/warranty-claims/${id}`, { method: "DELETE" }),
};

/* ---------------- Barcode / QR Labels ---------------- */
export interface BarcodeLabel {
  id: string;
  itemId: string | null;
  jobId: string | null;
  code: string;
  type: string; // qr | barcode
  label: string | null;
  printed: boolean;
  createdAt: string;
}

export const barcodesApi = {
  list: (params?: {
    itemId?: string;
    jobId?: string;
    type?: string;
    printed?: boolean;
  }) => {
    const qs = new URLSearchParams();
    if (params?.itemId) qs.set("itemId", params.itemId);
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.type) qs.set("type", params.type);
    if (params?.printed !== undefined)
      qs.set("printed", String(params.printed));
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ labels: BarcodeLabel[] }>(`/api/barcodes${suffix}`);
  },
  create: (payload: {
    itemId?: string | null;
    jobId?: string | null;
    type?: string;
    label?: string;
    printed?: boolean;
  }) =>
    request<{ label: BarcodeLabel }>("/api/barcodes", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<BarcodeLabel>) =>
    request<{ label: BarcodeLabel }>(`/api/barcodes/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/barcodes/${id}`, { method: "DELETE" }),
};

/* ---------------- Global Search ---------------- */
export interface GlobalSearchResults {
  jobs: Array<{
    id: string;
    orderNumber: string;
    title: string;
    status: string;
    priority: string;
    customerId: string;
    customerName: string | null;
  }>;
  customers: Array<{
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
  }>;
  inventory: Array<{
    id: string;
    name: string;
    code: string | null;
    material: string;
    thickness: string | null;
    unit: string;
    stockLevel: number;
    status: string;
  }>;
  suppliers: Array<{
    id: string;
    name: string;
    contactName: string | null;
    phone: string | null;
    email: string | null;
  }>;
  workers: Array<{
    id: string;
    name: string;
    code: string | null;
    role: string | null;
    type: string;
    status: string;
  }>;
  templates: Array<{
    id: string;
    name: string;
    category: string | null;
    description: string | null;
    estimatedDays: number;
    isActive: boolean;
  }>;
}

export const globalSearchApi = {
  search: (q: string, limit = 5) =>
    request<GlobalSearchResults>(
      `/api/global-search?q=${encodeURIComponent(q)}&limit=${limit}`
    ),
};

/* ---------------- Site Visits ---------------- */
export interface SiteVisit {
  id: string;
  jobId: string | null;
  visitorName: string;
  visitDate: string;
  purpose: string; // inspection | measurement | meeting | handover | other
  observations: string | null;
  photos: string | null;
  actionItems: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
}

export const siteVisitsApi = {
  list: (params?: { jobId?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ visits: SiteVisit[] }>(`/api/site-visits${suffix}`);
  },
  create: (payload: {
    jobId?: string | null;
    visitorName: string;
    visitDate?: string;
    purpose?: string;
    observations?: string;
    notes?: string;
    actionItems?: unknown | string;
  }) =>
    request<{ visit: SiteVisit }>("/api/site-visits", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<SiteVisit>) =>
    request<{ visit: SiteVisit }>(`/api/site-visits/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/site-visits/${id}`, { method: "DELETE" }),
};

/* ---------------- Punch Items ---------------- */
export interface PunchItem {
  id: string;
  jobId: string;
  title: string;
  description: string | null;
  category: string; // door | drawer | finish | alignment | hardware | damage | general | other
  status: string; // open | assigned | fixed | verified | closed
  assignedTo: string | null;
  photos: string | null;
  resolvedAt: string | null;
  resolution: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
}

export const punchItemsApi = {
  list: (params?: { jobId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ items: PunchItem[] }>(`/api/punch-items${suffix}`);
  },
  create: (payload: {
    jobId: string;
    title: string;
    description?: string;
    category?: string;
    status?: string;
    assignedTo?: string;
  }) =>
    request<{ item: PunchItem }>("/api/punch-items", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<PunchItem>) =>
    request<{ item: PunchItem }>(`/api/punch-items/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/punch-items/${id}`, { method: "DELETE" }),
};

/* ---------------- Change Orders ---------------- */
export interface ChangeOrder {
  id: string;
  jobId: string;
  changeNo: string;
  title: string;
  description: string | null;
  changeType: string; // modification | addition | deletion | material_change
  affectedItems: string | null;
  status: string; // pending | approved | rejected | implemented
  requestedBy: string | null;
  approvedBy: string | null;
  approvedAt: string | null;
  impactNotes: string | null;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
}

export const changeOrdersApi = {
  list: (params?: { jobId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ changeOrders: ChangeOrder[] }>(
      `/api/change-orders${suffix}`
    );
  },
  create: (payload: {
    jobId: string;
    title: string;
    description?: string;
    changeType?: string;
    affectedItems?: unknown | string;
    status?: string;
    requestedBy?: string;
    impactNotes?: string;
    notes?: string;
  }) =>
    request<{ changeOrder: ChangeOrder }>("/api/change-orders", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<ChangeOrder>) =>
    request<{ changeOrder: ChangeOrder }>(`/api/change-orders/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/change-orders/${id}`, { method: "DELETE" }),
};

/* ---------------- Communications ---------------- */
export interface CommunicationLog {
  id: string;
  jobId: string | null;
  customerId: string | null;
  type: string; // call | email | meeting | site_visit | message
  subject: string;
  summary: string | null;
  actionItems: string | null;
  communicatedBy: string | null;
  communicatedAt: string;
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
  customer?: {
    id: string;
    name: string;
    phone: string | null;
    email: string | null;
  } | null;
}

export const communicationsApi = {
  list: (params?: {
    jobId?: string;
    customerId?: string;
    type?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.customerId) qs.set("customerId", params.customerId);
    if (params?.type) qs.set("type", params.type);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ communications: CommunicationLog[] }>(
      `/api/communications${suffix}`
    );
  },
  create: (payload: {
    jobId?: string | null;
    customerId?: string | null;
    type?: string;
    subject: string;
    summary?: string;
    actionItems?: unknown | string;
    communicatedBy?: string;
    communicatedAt?: string;
    notes?: string;
  }) =>
    request<{ communication: CommunicationLog }>("/api/communications", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/communications/${id}`, { method: "DELETE" }),
};

/* ---------------- Subcontractors ---------------- */
export interface Subcontractor {
  id: string;
  name: string;
  trade: string; // painter | tiler | electrician | plumber | installer | other
  contactName: string | null;
  phone: string | null;
  email: string | null;
  rating: number; // 1-5
  status: string; // active | inactive
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { assignments: number };
}

export interface SubcontractorAssignment {
  id: string;
  subcontractorId: string;
  jobId: string;
  task: string;
  scheduledDate: string;
  completedDate: string | null;
  status: string; // scheduled | in_progress | completed | cancelled
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  subcontractor?: {
    id: string;
    name: string;
    trade: string;
    phone: string | null;
    email: string | null;
    status: string;
  } | null;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
}

export const subcontractorsApi = {
  list: (params?: { trade?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.trade) qs.set("trade", params.trade);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ subcontractors: Subcontractor[] }>(
      `/api/subcontractors${suffix}`
    );
  },
  create: (payload: {
    name: string;
    trade: string;
    contactName?: string;
    phone?: string;
    email?: string;
    rating?: number;
    status?: string;
    notes?: string;
  }) =>
    request<{ subcontractor: Subcontractor }>("/api/subcontractors", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<Subcontractor>) =>
    request<{ subcontractor: Subcontractor }>(`/api/subcontractors/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/subcontractors/${id}`, { method: "DELETE" }),
};

export const subcontractorAssignmentsApi = {
  list: (params?: {
    jobId?: string;
    subcontractorId?: string;
    status?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.subcontractorId) qs.set("subcontractorId", params.subcontractorId);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ assignments: SubcontractorAssignment[] }>(
      `/api/subcontractor-assignments${suffix}`
    );
  },
  create: (payload: {
    subcontractorId: string;
    jobId: string;
    task: string;
    scheduledDate?: string;
    status?: string;
    notes?: string;
  }) =>
    request<{ assignment: SubcontractorAssignment }>(
      "/api/subcontractor-assignments",
      { method: "POST", body: JSON.stringify(payload) }
    ),
  update: (id: string, patch: Partial<SubcontractorAssignment>) =>
    request<{ assignment: SubcontractorAssignment }>(
      `/api/subcontractor-assignments/${id}`,
      { method: "PUT", body: JSON.stringify(patch) }
    ),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/subcontractor-assignments/${id}`, {
      method: "DELETE",
    }),
};

/* ---------------- Equipment ---------------- */
export interface Equipment {
  id: string;
  name: string;
  code: string | null;
  type: string; // cnc | panel_saw | edge_bander | drill | sander | press | other
  manufacturer: string | null;
  model: string | null;
  status: string; // operational | maintenance | broken | retired
  location: string | null;
  capacityPerDay: number;
  lastServiceDate: string | null;
  nextServiceDate: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { assignments: number };
}

export interface EquipmentAssignment {
  id: string;
  equipmentId: string;
  jobId: string | null;
  scheduledDate: string;
  endDate: string | null;
  status: string; // scheduled | in_use | completed | cancelled
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  equipment?: {
    id: string;
    name: string;
    code: string | null;
    type: string;
    status: string;
    location: string | null;
    capacityPerDay: number;
  } | null;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
}

export const equipmentApi = {
  list: (params?: { type?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.type) qs.set("type", params.type);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ equipment: Equipment[] }>(`/api/equipment${suffix}`);
  },
  create: (payload: {
    name: string;
    type: string;
    code?: string | null;
    manufacturer?: string;
    model?: string;
    status?: string;
    location?: string;
    capacityPerDay?: number;
    lastServiceDate?: string;
    nextServiceDate?: string;
    notes?: string;
  }) =>
    request<{ equipment: Equipment }>("/api/equipment", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<Equipment>) =>
    request<{ equipment: Equipment }>(`/api/equipment/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/equipment/${id}`, { method: "DELETE" }),
};

export const equipmentAssignmentsApi = {
  list: (params?: {
    jobId?: string;
    equipmentId?: string;
    status?: string;
  }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.equipmentId) qs.set("equipmentId", params.equipmentId);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ assignments: EquipmentAssignment[] }>(
      `/api/equipment-assignments${suffix}`
    );
  },
  create: (payload: {
    equipmentId: string;
    jobId?: string | null;
    scheduledDate?: string;
    endDate?: string | null;
    status?: string;
    notes?: string;
  }) =>
    request<{ assignment: EquipmentAssignment }>("/api/equipment-assignments", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<EquipmentAssignment>) =>
    request<{ assignment: EquipmentAssignment }>(
      `/api/equipment-assignments/${id}`,
      { method: "PUT", body: JSON.stringify(patch) }
    ),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/equipment-assignments/${id}`, {
      method: "DELETE",
    }),
};

/* ---------------- Milestones ---------------- */
export interface Milestone {
  id: string;
  jobId: string;
  name: string;
  targetDate: string;
  achievedDate: string | null;
  status: string; // pending | achieved | delayed
  notes: string | null;
  createdBy: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
}

export const milestonesApi = {
  list: (params?: { jobId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ milestones: Milestone[] }>(`/api/milestones${suffix}`);
  },
  create: (payload: {
    jobId: string;
    name: string;
    targetDate?: string;
    achievedDate?: string;
    status?: string;
    notes?: string;
  }) =>
    request<{ milestone: Milestone }>("/api/milestones", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<Milestone>) =>
    request<{ milestone: Milestone }>(`/api/milestones/${id}`, {
      method: "PUT",
      body: JSON.stringify(patch),
    }),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/milestones/${id}`, { method: "DELETE" }),
};

/* ---------------- Material Requirements ---------------- */
export interface MaterialRequirement {
  id: string;
  jobId: string;
  cuttingListId: string | null;
  material: string;
  requiredQty: number;
  availableQty: number;
  shortage: number;
  unit: string;
  status: string; // pending | fulfilled | shortage | ordered
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  job?: {
    id: string;
    orderNumber: string;
    title: string;
    customerId: string;
  } | null;
}

export interface MaterialRequirementSummary {
  jobId: string;
  cuttingListsProcessed: number;
  materials: number;
  totalShortage: number;
}

export const materialRequirementsApi = {
  list: (params?: { jobId?: string; status?: string }) => {
    const qs = new URLSearchParams();
    if (params?.jobId) qs.set("jobId", params.jobId);
    if (params?.status) qs.set("status", params.status);
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    return request<{ requirements: MaterialRequirement[] }>(
      `/api/material-requirements${suffix}`
    );
  },
  generate: (payload: {
    jobId: string;
    cuttingListId?: string;
    regenerate?: boolean;
  }) =>
    request<{
      requirements: MaterialRequirement[];
      summary?: MaterialRequirementSummary;
      message?: string;
    }>("/api/material-requirements", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  update: (id: string, patch: Partial<MaterialRequirement>) =>
    request<{ requirement: MaterialRequirement }>(
      `/api/material-requirements/${id}`,
      { method: "PUT", body: JSON.stringify(patch) }
    ),
  remove: (id: string) =>
    request<{ ok: true }>(`/api/material-requirements/${id}`, {
      method: "DELETE",
    }),
};

// ===== User Permissions API =====
export const userPermissionsApi = {
  list: (userId?: string) =>
    request<{ permissions: Array<{ id: string; userId: string; moduleId: string; allowed: boolean }> }>(
      `/api/user-permissions${userId ? `?userId=${userId}` : ""}`,
    ),
  set: (userId: string, moduleId: string, allowed: boolean) =>
    request<{ permission: { id: string; userId: string; moduleId: string; allowed: boolean } }>(
      "/api/user-permissions",
      { method: "PUT", body: JSON.stringify({ userId, moduleId, allowed }) },
    ),
  reset: (userId: string, moduleId: string) =>
    request<{ success: boolean }>(
      `/api/user-permissions?userId=${userId}&moduleId=${moduleId}`,
      { method: "DELETE" },
    ),
};
