// Shared domain types for the Custom Kitchen & Cabinetry Manufacturing System.

export type Role = "SuperAdmin" | "Admin" | "Manager" | "Storekeeper" | "Auditor" | "Technician";
export type UserStatus = "active" | "suspended" | "inactive";

export interface User {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  status: UserStatus;
  email?: string | null;
  phone?: string | null;
  createdAt?: string;
  updatedAt?: string;
}

export interface SessionUser {
  id: string;
  username: string;
  fullName: string;
  role: Role;
  status: UserStatus;
}

export type JobStatus =
  | "Pending"
  | "Measured"
  | "Design"
  | "In Production"
  | "Cutting"
  | "Assembly"
  | "Installation"
  | "Completed"
  | "Cancelled";

export type Priority = "Low" | "Normal" | "High" | "Urgent";

export interface Customer {
  id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  address?: string | null;
  notes?: string | null;
  createdAt?: string;
  _count?: { jobOrders: number };
}

export interface JobOrder {
  id: string;
  orderNumber: string;
  title: string;
  customerId: string;
  status: JobStatus;
  priority: Priority;
  assignedToId?: string | null;
  description?: string | null;
  deliveryDate?: string | null;
  archived?: boolean;
  createdAt?: string;
  updatedAt?: string;
  customer?: Pick<Customer, "id" | "name" | "phone">;
  assignedTo?: Pick<User, "id" | "fullName" | "role"> | null;
  _count?: { measurements: number; cuttingLists: number };
}

export interface SiteMeasurement {
  id: string;
  jobId: string;
  takenById: string;
  roomType?: string | null;
  wallLength?: string | null;
  ceilingHt?: string | null;
  notes?: string | null;
  photoUrls?: string | null;
  blueprint?: string | null;
  status: "Draft" | "Submitted" | "Approved";
  createdAt?: string;
  updatedAt?: string;
  job?: Pick<JobOrder, "id" | "title" | "orderNumber">;
  takenBy?: Pick<User, "id" | "fullName">;
}

export interface CuttingListItem {
  part: string;
  qty: number;
  length: string;
  width: string;
  thickness: string;
  edge?: string;
}

export interface CuttingList {
  id: string;
  jobId: string;
  createdById: string;
  panelName?: string | null;
  material?: string | null;
  items?: string | null;
  status: "Draft" | "Submitted" | "In Cutting" | "Done";
  createdAt?: string;
  updatedAt?: string;
  job?: Pick<JobOrder, "id" | "title" | "orderNumber">;
  createdBy?: Pick<User, "id" | "fullName">;
}

export interface Stats {
  counts: {
    users: number;
    activeUsers: number;
    jobOrders: number;
    pendingJobs: number;
    measurements: number;
    cuttingLists: number;
    customers: number;
  };
  jobStatusBreakdown: Record<string, number>;
  priorityBreakdown?: Record<string, number>;
  throughput?: { date: string; created: number; completed: number }[];
  materialBreakdown?: Record<string, number>;
  technicianWorkload?: { name: string; count: number }[];
  role: Role;
}

export interface JobDetail extends JobOrder {
  customer?: Customer;
  assignedTo?: Pick<User, "id" | "fullName" | "role"> | null;
  measurements: (SiteMeasurement & {
    takenBy?: Pick<User, "id" | "fullName">;
  })[];
  cuttingLists: (CuttingList & {
    createdBy?: Pick<User, "id" | "fullName">;
  })[];
}

export interface ApiError {
  error: string;
  fallback?: string;
  detail?: string;
}
