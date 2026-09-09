-- CabinetryWorks Database Migration for Supabase PostgreSQL
-- Run this in Supabase SQL Editor

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'Technician',
    "status" TEXT NOT NULL DEFAULT 'active',
    "phone" TEXT,
    "email" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserPermission" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "allowed" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserPermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Customer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobOrder" (
    "id" TEXT NOT NULL,
    "orderNumber" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'Pending',
    "priority" TEXT NOT NULL DEFAULT 'Normal',
    "jobType" TEXT NOT NULL DEFAULT 'New',
    "parentJobId" TEXT,
    "assignedToId" TEXT,
    "description" TEXT,
    "deliveryDate" TIMESTAMP(3),
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteMeasurement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "takenById" TEXT,
    "roomType" TEXT,
    "wallLength" TEXT,
    "ceilingHt" TEXT,
    "notes" TEXT,
    "photoUrls" TEXT,
    "blueprint" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteMeasurement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CuttingList" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "createdById" TEXT,
    "panelName" TEXT,
    "material" TEXT,
    "items" TEXT,
    "status" TEXT NOT NULL DEFAULT 'Draft',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CuttingList_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialPrice" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "material" TEXT NOT NULL,
    "thickness" TEXT,
    "pricePerSqm" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'sqm',
    "edgeBandingPricePerM" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "laborRatePerHour" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedHours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialPrice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SavedQuote" (
    "id" TEXT NOT NULL,
    "quoteNumber" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "materialCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "edgeCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "subtotal" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "taxAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "notes" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SavedQuote_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryCategory" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InventoryItem" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "material" TEXT NOT NULL,
    "thickness" TEXT,
    "unit" TEXT NOT NULL DEFAULT 'sheet',
    "stockLevel" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "minStock" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reorderPoint" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "supplier" TEXT,
    "categoryId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "lastRestocked" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Warehouse" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location" TEXT,
    "type" TEXT NOT NULL DEFAULT 'main',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Warehouse_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockLot" (
    "id" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "batchNo" TEXT,
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "StockLot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransfer" (
    "id" TEXT NOT NULL,
    "transferNo" TEXT NOT NULL,
    "fromWarehouseId" TEXT NOT NULL,
    "toWarehouseId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "StockTransfer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTransferItem" (
    "id" TEXT NOT NULL,
    "transferId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "batchNo" TEXT,

    CONSTRAINT "StockTransferItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockAdjustment" (
    "id" TEXT NOT NULL,
    "adjNo" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "jobId" TEXT,
    "type" TEXT NOT NULL,
    "oldQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "newQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "diff" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "reason" TEXT,
    "notes" TEXT,
    "adjustedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StockAdjustment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTake" (
    "id" TEXT NOT NULL,
    "takeNo" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "period" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "closedAt" TIMESTAMP(3),

    CONSTRAINT "StockTake_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockTakeLine" (
    "id" TEXT NOT NULL,
    "takeId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "systemQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "countedQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "diff" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,

    CONSTRAINT "StockTakeLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRequest" (
    "id" TEXT NOT NULL,
    "reqNo" TEXT NOT NULL,
    "jobId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "requestedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "approvedAt" TIMESTAMP(3),
    "approvedBy" TEXT,

    CONSTRAINT "StockRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StockRequestLine" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "StockRequestLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsIssue" (
    "id" TEXT NOT NULL,
    "issueNo" TEXT NOT NULL,
    "jobId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "requestId" TEXT,
    "issuedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsIssueLine" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "batchNo" TEXT,

    CONSTRAINT "GoodsIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReturn" (
    "id" TEXT NOT NULL,
    "returnNo" TEXT NOT NULL,
    "jobId" TEXT,
    "warehouseId" TEXT NOT NULL,
    "issueId" TEXT,
    "returnedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'returned',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GoodsReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GoodsReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "batchNo" TEXT,

    CONSTRAINT "GoodsReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutsidePurchase" (
    "id" TEXT NOT NULL,
    "poNo" TEXT NOT NULL,
    "jobId" TEXT,
    "warehouseId" TEXT,
    "supplier" TEXT,
    "purchasedBy" TEXT,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "receivedAt" TIMESTAMP(3),

    CONSTRAINT "OutsidePurchase_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OutsidePurchaseLine" (
    "id" TEXT NOT NULL,
    "purchaseId" TEXT NOT NULL,
    "itemId" TEXT,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "notes" TEXT,

    CONSTRAINT "OutsidePurchaseLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactName" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "website" TEXT,
    "paymentTerms" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL,
    "poNumber" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT,
    "totalCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "expectedDate" TIMESTAMP(3),
    "receivedDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PurchaseOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL,
    "purchaseOrderId" TEXT NOT NULL,
    "inventoryItemId" TEXT,
    "itemName" TEXT NOT NULL,
    "quantity" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'sheet',
    "unitCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lineTotal" DECIMAL(12,2) NOT NULL DEFAULT 0,

    CONSTRAINT "PurchaseOrderItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "actorId" TEXT,
    "actorName" TEXT,
    "summary" TEXT NOT NULL,
    "details" TEXT,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTimeLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "userId" TEXT,
    "workerName" TEXT NOT NULL,
    "workDate" TIMESTAMP(3) NOT NULL,
    "workType" TEXT NOT NULL DEFAULT 'onsite',
    "clockIn" TIMESTAMP(3),
    "clockOut" TIMESTAMP(3),
    "hoursWorked" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "hourlyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "laborCost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTimeLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTransport" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vehicleNo" TEXT,
    "driverName" TEXT,
    "fromLocation" TEXT,
    "toLocation" TEXT,
    "purpose" TEXT NOT NULL DEFAULT 'material_delivery',
    "distanceKm" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTransport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobFoodBeverage" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "mealType" TEXT NOT NULL DEFAULT 'lunch',
    "personCount" INTEGER NOT NULL DEFAULT 1,
    "cost" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "description" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobFoodBeverage_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTool" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "category" TEXT NOT NULL DEFAULT 'hand_tool',
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'available',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTool_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobToolIssue" (
    "id" TEXT NOT NULL,
    "issueNo" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "issuedBy" TEXT,
    "issuedTo" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'issued',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobToolIssue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobToolIssueLine" (
    "id" TEXT NOT NULL,
    "issueId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT NOT NULL DEFAULT 'good',

    CONSTRAINT "JobToolIssueLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobToolReturn" (
    "id" TEXT NOT NULL,
    "returnNo" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "issueId" TEXT,
    "returnedBy" TEXT,
    "returnedFrom" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'returned',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobToolReturn_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobToolReturnLine" (
    "id" TEXT NOT NULL,
    "returnId" TEXT NOT NULL,
    "toolId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "condition" TEXT NOT NULL DEFAULT 'good',

    CONSTRAINT "JobToolReturnLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobExpense" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" TEXT NOT NULL DEFAULT 'miscellaneous',
    "amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'LKR',
    "description" TEXT,
    "receiptNo" TEXT,
    "paidBy" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobExpense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Worker" (
    "id" TEXT NOT NULL,
    "code" TEXT,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "role" TEXT,
    "type" TEXT NOT NULL DEFAULT 'factory',
    "status" TEXT NOT NULL DEFAULT 'active',
    "hourlyRate" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Worker_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceRecord" (
    "id" TEXT NOT NULL,
    "workerId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "jobId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'present',
    "clockIn" TEXT,
    "clockOut" TEXT,
    "breakStart" TEXT,
    "breakEnd" TEXT,
    "hoursWorked" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "workLocation" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AttendanceRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProductionSchedule" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "workstation" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "assignedToId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ProductionSchedule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QCCheckpoint" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "stage" TEXT NOT NULL,
    "inspector" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "checklist" TEXT,
    "photos" TEXT,
    "notes" TEXT,
    "inspectedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QCCheckpoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeliveryRecord" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'delivery',
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "driverName" TEXT,
    "vehicleNo" TEXT,
    "installTeam" TEXT,
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "preChecklist" TEXT,
    "postChecklist" TEXT,
    "photos" TEXT,
    "customerSignoff" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeliveryRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobDocument" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'document',
    "fileType" TEXT,
    "fileSize" INTEGER NOT NULL DEFAULT 0,
    "dataUrl" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "notes" TEXT,
    "uploadedBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobDocument_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobTemplate" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT,
    "defaultCuttingList" TEXT,
    "defaultHardware" TEXT,
    "defaultBoM" TEXT,
    "estimatedHours" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "estimatedDays" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobTemplate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WarrantyClaim" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "claimNo" TEXT NOT NULL,
    "claimDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "issueType" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "partsUsed" TEXT,
    "photos" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WarrantyClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BarcodeLabel" (
    "id" TEXT NOT NULL,
    "itemId" TEXT,
    "jobId" TEXT,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL DEFAULT 'qr',
    "label" TEXT,
    "printed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BarcodeLabel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SiteVisit" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "visitorName" TEXT NOT NULL,
    "visitDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "purpose" TEXT NOT NULL DEFAULT 'inspection',
    "observations" TEXT,
    "photos" TEXT,
    "actionItems" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SiteVisit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PunchItem" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "status" TEXT NOT NULL DEFAULT 'open',
    "assignedTo" TEXT,
    "photos" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolution" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PunchItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ChangeOrder" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "changeNo" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "changeType" TEXT NOT NULL DEFAULT 'modification',
    "affectedItems" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "requestedBy" TEXT,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "impactNotes" TEXT,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChangeOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommunicationLog" (
    "id" TEXT NOT NULL,
    "jobId" TEXT,
    "customerId" TEXT,
    "type" TEXT NOT NULL DEFAULT 'call',
    "subject" TEXT NOT NULL,
    "summary" TEXT,
    "actionItems" TEXT,
    "communicatedBy" TEXT,
    "communicatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Subcontractor" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "trade" TEXT NOT NULL,
    "contactName" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "rating" INTEGER NOT NULL DEFAULT 3,
    "status" TEXT NOT NULL DEFAULT 'active',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subcontractor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SubcontractorAssignment" (
    "id" TEXT NOT NULL,
    "subcontractorId" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "task" TEXT NOT NULL,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "completedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SubcontractorAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Equipment" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT,
    "type" TEXT NOT NULL,
    "manufacturer" TEXT,
    "model" TEXT,
    "status" TEXT NOT NULL DEFAULT 'operational',
    "location" TEXT,
    "capacityPerDay" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "lastServiceDate" TIMESTAMP(3),
    "nextServiceDate" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Equipment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EquipmentAssignment" (
    "id" TEXT NOT NULL,
    "equipmentId" TEXT NOT NULL,
    "jobId" TEXT,
    "scheduledDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'scheduled',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EquipmentAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Milestone" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "achievedDate" TIMESTAMP(3),
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Milestone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MaterialRequirement" (
    "id" TEXT NOT NULL,
    "jobId" TEXT NOT NULL,
    "cuttingListId" TEXT,
    "material" TEXT NOT NULL,
    "requiredQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "availableQty" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "shortage" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "unit" TEXT NOT NULL DEFAULT 'sheet',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MaterialRequirement_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE INDEX "UserPermission_userId_idx" ON "UserPermission"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "UserPermission_userId_moduleId_key" ON "UserPermission"("userId", "moduleId");

-- CreateIndex
CREATE UNIQUE INDEX "JobOrder_orderNumber_key" ON "JobOrder"("orderNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SystemSetting_key_key" ON "SystemSetting"("key");

-- CreateIndex
CREATE UNIQUE INDEX "MaterialPrice_name_key" ON "MaterialPrice"("name");

-- CreateIndex
CREATE UNIQUE INDEX "SavedQuote_quoteNumber_key" ON "SavedQuote"("quoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryCategory_name_key" ON "InventoryCategory"("name");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryItem_name_key" ON "InventoryItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Warehouse_code_key" ON "Warehouse"("code");

-- CreateIndex
CREATE INDEX "StockLot_itemId_warehouseId_idx" ON "StockLot"("itemId", "warehouseId");

-- CreateIndex
CREATE INDEX "StockLot_warehouseId_idx" ON "StockLot"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTransfer_transferNo_key" ON "StockTransfer"("transferNo");

-- CreateIndex
CREATE INDEX "StockTransfer_fromWarehouseId_idx" ON "StockTransfer"("fromWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransfer_toWarehouseId_idx" ON "StockTransfer"("toWarehouseId");

-- CreateIndex
CREATE INDEX "StockTransferItem_transferId_idx" ON "StockTransferItem"("transferId");

-- CreateIndex
CREATE UNIQUE INDEX "StockAdjustment_adjNo_key" ON "StockAdjustment"("adjNo");

-- CreateIndex
CREATE INDEX "StockAdjustment_itemId_idx" ON "StockAdjustment"("itemId");

-- CreateIndex
CREATE INDEX "StockAdjustment_warehouseId_idx" ON "StockAdjustment"("warehouseId");

-- CreateIndex
CREATE INDEX "StockAdjustment_jobId_idx" ON "StockAdjustment"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "StockTake_takeNo_key" ON "StockTake"("takeNo");

-- CreateIndex
CREATE INDEX "StockTake_warehouseId_idx" ON "StockTake"("warehouseId");

-- CreateIndex
CREATE INDEX "StockTakeLine_takeId_idx" ON "StockTakeLine"("takeId");

-- CreateIndex
CREATE UNIQUE INDEX "StockRequest_reqNo_key" ON "StockRequest"("reqNo");

-- CreateIndex
CREATE INDEX "StockRequest_jobId_idx" ON "StockRequest"("jobId");

-- CreateIndex
CREATE INDEX "StockRequest_warehouseId_idx" ON "StockRequest"("warehouseId");

-- CreateIndex
CREATE INDEX "StockRequestLine_requestId_idx" ON "StockRequestLine"("requestId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsIssue_issueNo_key" ON "GoodsIssue"("issueNo");

-- CreateIndex
CREATE INDEX "GoodsIssue_jobId_idx" ON "GoodsIssue"("jobId");

-- CreateIndex
CREATE INDEX "GoodsIssue_warehouseId_idx" ON "GoodsIssue"("warehouseId");

-- CreateIndex
CREATE INDEX "GoodsIssueLine_issueId_idx" ON "GoodsIssueLine"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "GoodsReturn_returnNo_key" ON "GoodsReturn"("returnNo");

-- CreateIndex
CREATE INDEX "GoodsReturn_jobId_idx" ON "GoodsReturn"("jobId");

-- CreateIndex
CREATE INDEX "GoodsReturn_warehouseId_idx" ON "GoodsReturn"("warehouseId");

-- CreateIndex
CREATE INDEX "GoodsReturnLine_returnId_idx" ON "GoodsReturnLine"("returnId");

-- CreateIndex
CREATE UNIQUE INDEX "OutsidePurchase_poNo_key" ON "OutsidePurchase"("poNo");

-- CreateIndex
CREATE INDEX "OutsidePurchase_jobId_idx" ON "OutsidePurchase"("jobId");

-- CreateIndex
CREATE INDEX "OutsidePurchaseLine_purchaseId_idx" ON "OutsidePurchaseLine"("purchaseId");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_name_key" ON "Supplier"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_poNumber_key" ON "PurchaseOrder"("poNumber");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");

-- CreateIndex
CREATE INDEX "JobTimeLog_jobId_idx" ON "JobTimeLog"("jobId");

-- CreateIndex
CREATE INDEX "JobTimeLog_workDate_idx" ON "JobTimeLog"("workDate");

-- CreateIndex
CREATE INDEX "JobTimeLog_userId_idx" ON "JobTimeLog"("userId");

-- CreateIndex
CREATE INDEX "JobTransport_jobId_idx" ON "JobTransport"("jobId");

-- CreateIndex
CREATE INDEX "JobTransport_date_idx" ON "JobTransport"("date");

-- CreateIndex
CREATE INDEX "JobFoodBeverage_jobId_idx" ON "JobFoodBeverage"("jobId");

-- CreateIndex
CREATE INDEX "JobFoodBeverage_date_idx" ON "JobFoodBeverage"("date");

-- CreateIndex
CREATE UNIQUE INDEX "JobTool_name_key" ON "JobTool"("name");

-- CreateIndex
CREATE UNIQUE INDEX "JobTool_code_key" ON "JobTool"("code");

-- CreateIndex
CREATE UNIQUE INDEX "JobToolIssue_issueNo_key" ON "JobToolIssue"("issueNo");

-- CreateIndex
CREATE INDEX "JobToolIssue_jobId_idx" ON "JobToolIssue"("jobId");

-- CreateIndex
CREATE INDEX "JobToolIssueLine_issueId_idx" ON "JobToolIssueLine"("issueId");

-- CreateIndex
CREATE UNIQUE INDEX "JobToolReturn_returnNo_key" ON "JobToolReturn"("returnNo");

-- CreateIndex
CREATE INDEX "JobToolReturn_jobId_idx" ON "JobToolReturn"("jobId");

-- CreateIndex
CREATE INDEX "JobToolReturnLine_returnId_idx" ON "JobToolReturnLine"("returnId");

-- CreateIndex
CREATE INDEX "JobExpense_jobId_idx" ON "JobExpense"("jobId");

-- CreateIndex
CREATE INDEX "JobExpense_date_idx" ON "JobExpense"("date");

-- CreateIndex
CREATE INDEX "JobExpense_category_idx" ON "JobExpense"("category");

-- CreateIndex
CREATE UNIQUE INDEX "Worker_code_key" ON "Worker"("code");

-- CreateIndex
CREATE INDEX "AttendanceRecord_workerId_date_idx" ON "AttendanceRecord"("workerId", "date");

-- CreateIndex
CREATE INDEX "AttendanceRecord_jobId_idx" ON "AttendanceRecord"("jobId");

-- CreateIndex
CREATE INDEX "AttendanceRecord_date_idx" ON "AttendanceRecord"("date");

-- CreateIndex
CREATE INDEX "ProductionSchedule_jobId_idx" ON "ProductionSchedule"("jobId");

-- CreateIndex
CREATE INDEX "ProductionSchedule_scheduledDate_idx" ON "ProductionSchedule"("scheduledDate");

-- CreateIndex
CREATE INDEX "ProductionSchedule_status_idx" ON "ProductionSchedule"("status");

-- CreateIndex
CREATE INDEX "QCCheckpoint_jobId_idx" ON "QCCheckpoint"("jobId");

-- CreateIndex
CREATE INDEX "QCCheckpoint_status_idx" ON "QCCheckpoint"("status");

-- CreateIndex
CREATE INDEX "DeliveryRecord_jobId_idx" ON "DeliveryRecord"("jobId");

-- CreateIndex
CREATE INDEX "DeliveryRecord_scheduledDate_idx" ON "DeliveryRecord"("scheduledDate");

-- CreateIndex
CREATE INDEX "DeliveryRecord_status_idx" ON "DeliveryRecord"("status");

-- CreateIndex
CREATE INDEX "JobDocument_jobId_idx" ON "JobDocument"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "JobTemplate_name_key" ON "JobTemplate"("name");

-- CreateIndex
CREATE UNIQUE INDEX "WarrantyClaim_claimNo_key" ON "WarrantyClaim"("claimNo");

-- CreateIndex
CREATE INDEX "WarrantyClaim_jobId_idx" ON "WarrantyClaim"("jobId");

-- CreateIndex
CREATE INDEX "WarrantyClaim_status_idx" ON "WarrantyClaim"("status");

-- CreateIndex
CREATE UNIQUE INDEX "BarcodeLabel_code_key" ON "BarcodeLabel"("code");

-- CreateIndex
CREATE INDEX "SiteVisit_jobId_idx" ON "SiteVisit"("jobId");

-- CreateIndex
CREATE INDEX "SiteVisit_visitDate_idx" ON "SiteVisit"("visitDate");

-- CreateIndex
CREATE INDEX "PunchItem_jobId_idx" ON "PunchItem"("jobId");

-- CreateIndex
CREATE INDEX "PunchItem_status_idx" ON "PunchItem"("status");

-- CreateIndex
CREATE UNIQUE INDEX "ChangeOrder_changeNo_key" ON "ChangeOrder"("changeNo");

-- CreateIndex
CREATE INDEX "ChangeOrder_jobId_idx" ON "ChangeOrder"("jobId");

-- CreateIndex
CREATE INDEX "ChangeOrder_status_idx" ON "ChangeOrder"("status");

-- CreateIndex
CREATE INDEX "CommunicationLog_jobId_idx" ON "CommunicationLog"("jobId");

-- CreateIndex
CREATE INDEX "CommunicationLog_customerId_idx" ON "CommunicationLog"("customerId");

-- CreateIndex
CREATE INDEX "CommunicationLog_communicatedAt_idx" ON "CommunicationLog"("communicatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "Subcontractor_name_key" ON "Subcontractor"("name");

-- CreateIndex
CREATE INDEX "SubcontractorAssignment_subcontractorId_idx" ON "SubcontractorAssignment"("subcontractorId");

-- CreateIndex
CREATE INDEX "SubcontractorAssignment_jobId_idx" ON "SubcontractorAssignment"("jobId");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_name_key" ON "Equipment"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Equipment_code_key" ON "Equipment"("code");

-- CreateIndex
CREATE INDEX "EquipmentAssignment_equipmentId_idx" ON "EquipmentAssignment"("equipmentId");

-- CreateIndex
CREATE INDEX "EquipmentAssignment_jobId_idx" ON "EquipmentAssignment"("jobId");

-- CreateIndex
CREATE INDEX "Milestone_jobId_idx" ON "Milestone"("jobId");

-- CreateIndex
CREATE INDEX "Milestone_status_idx" ON "Milestone"("status");

-- CreateIndex
CREATE INDEX "MaterialRequirement_jobId_idx" ON "MaterialRequirement"("jobId");

-- CreateIndex
CREATE INDEX "MaterialRequirement_status_idx" ON "MaterialRequirement"("status");

-- AddForeignKey
ALTER TABLE "UserPermission" ADD CONSTRAINT "UserPermission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOrder" ADD CONSTRAINT "JobOrder_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOrder" ADD CONSTRAINT "JobOrder_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobOrder" ADD CONSTRAINT "JobOrder_parentJobId_fkey" FOREIGN KEY ("parentJobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMeasurement" ADD CONSTRAINT "SiteMeasurement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteMeasurement" ADD CONSTRAINT "SiteMeasurement_takenById_fkey" FOREIGN KEY ("takenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingList" ADD CONSTRAINT "CuttingList_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CuttingList" ADD CONSTRAINT "CuttingList_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedQuote" ADD CONSTRAINT "SavedQuote_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SavedQuote" ADD CONSTRAINT "SavedQuote_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InventoryItem" ADD CONSTRAINT "InventoryItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "InventoryCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockLot" ADD CONSTRAINT "StockLot_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_fromWarehouseId_fkey" FOREIGN KEY ("fromWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransfer" ADD CONSTRAINT "StockTransfer_toWarehouseId_fkey" FOREIGN KEY ("toWarehouseId") REFERENCES "Warehouse"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_transferId_fkey" FOREIGN KEY ("transferId") REFERENCES "StockTransfer"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTransferItem" ADD CONSTRAINT "StockTransferItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockAdjustment" ADD CONSTRAINT "StockAdjustment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTake" ADD CONSTRAINT "StockTake_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTakeLine" ADD CONSTRAINT "StockTakeLine_takeId_fkey" FOREIGN KEY ("takeId") REFERENCES "StockTake"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockTakeLine" ADD CONSTRAINT "StockTakeLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequest" ADD CONSTRAINT "StockRequest_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequestLine" ADD CONSTRAINT "StockRequestLine_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "StockRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StockRequestLine" ADD CONSTRAINT "StockRequestLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssue" ADD CONSTRAINT "GoodsIssue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssue" ADD CONSTRAINT "GoodsIssue_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssueLine" ADD CONSTRAINT "GoodsIssueLine_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "GoodsIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsIssueLine" ADD CONSTRAINT "GoodsIssueLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReturn" ADD CONSTRAINT "GoodsReturn_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReturn" ADD CONSTRAINT "GoodsReturn_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReturnLine" ADD CONSTRAINT "GoodsReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "GoodsReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GoodsReturnLine" ADD CONSTRAINT "GoodsReturnLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutsidePurchase" ADD CONSTRAINT "OutsidePurchase_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutsidePurchase" ADD CONSTRAINT "OutsidePurchase_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "Warehouse"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutsidePurchaseLine" ADD CONSTRAINT "OutsidePurchaseLine_purchaseId_fkey" FOREIGN KEY ("purchaseId") REFERENCES "OutsidePurchase"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OutsidePurchaseLine" ADD CONSTRAINT "OutsidePurchaseLine_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "InventoryItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PurchaseOrderItem" ADD CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTimeLog" ADD CONSTRAINT "JobTimeLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTimeLog" ADD CONSTRAINT "JobTimeLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobTransport" ADD CONSTRAINT "JobTransport_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobFoodBeverage" ADD CONSTRAINT "JobFoodBeverage_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobToolIssue" ADD CONSTRAINT "JobToolIssue_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobToolIssueLine" ADD CONSTRAINT "JobToolIssueLine_issueId_fkey" FOREIGN KEY ("issueId") REFERENCES "JobToolIssue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobToolIssueLine" ADD CONSTRAINT "JobToolIssueLine_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "JobTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobToolReturn" ADD CONSTRAINT "JobToolReturn_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobToolReturnLine" ADD CONSTRAINT "JobToolReturnLine_returnId_fkey" FOREIGN KEY ("returnId") REFERENCES "JobToolReturn"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobToolReturnLine" ADD CONSTRAINT "JobToolReturnLine_toolId_fkey" FOREIGN KEY ("toolId") REFERENCES "JobTool"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobExpense" ADD CONSTRAINT "JobExpense_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_workerId_fkey" FOREIGN KEY ("workerId") REFERENCES "Worker"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProductionSchedule" ADD CONSTRAINT "ProductionSchedule_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QCCheckpoint" ADD CONSTRAINT "QCCheckpoint_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeliveryRecord" ADD CONSTRAINT "DeliveryRecord_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "JobDocument" ADD CONSTRAINT "JobDocument_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WarrantyClaim" ADD CONSTRAINT "WarrantyClaim_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SiteVisit" ADD CONSTRAINT "SiteVisit_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PunchItem" ADD CONSTRAINT "PunchItem_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ChangeOrder" ADD CONSTRAINT "ChangeOrder_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommunicationLog" ADD CONSTRAINT "CommunicationLog_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractorAssignment" ADD CONSTRAINT "SubcontractorAssignment_subcontractorId_fkey" FOREIGN KEY ("subcontractorId") REFERENCES "Subcontractor"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SubcontractorAssignment" ADD CONSTRAINT "SubcontractorAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_equipmentId_fkey" FOREIGN KEY ("equipmentId") REFERENCES "Equipment"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EquipmentAssignment" ADD CONSTRAINT "EquipmentAssignment_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Milestone" ADD CONSTRAINT "Milestone_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MaterialRequirement" ADD CONSTRAINT "MaterialRequirement_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "JobOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;

