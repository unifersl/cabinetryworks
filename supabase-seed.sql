-- CabinetryWorks Seed Users for Supabase PostgreSQL
-- Run this AFTER the migration SQL
-- Logins: admin/admin123, manager/manager123, storekeeper/store123, auditor/audit123, technician/tech123

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

INSERT INTO "User" ("id", "username", "fullName", "password", "role", "status", "email", "phone", "createdAt", "updatedAt")
VALUES
  (gen_random_uuid(), 'admin', 'System Administrator', '$2b$10$6yYEgmBz96DocLYkBAuCGOBsAh9qZG7rnheoxOeimTOMTBPtxmsgu', 'SuperAdmin', 'active', 'admin@kcm.local', '+1 555 0100', NOW(), NOW()),
  (gen_random_uuid(), 'manager', 'Operations Manager', '$2b$10$qXOvUXEAjLq6vJm.yZFRwOUDPbVx9xDEJuNk2Rmc0vNw.Cja3mhL.', 'Manager', 'active', 'manager@kcm.local', '+1 555 0200', NOW(), NOW()),
  (gen_random_uuid(), 'storekeeper', 'Warehouse Storekeeper', '$2b$10$Sdd7zb3WP/WVgBOxYn6BguHUMNZxFRpiHHPpFcobw1y6tug0oeIYm', 'Storekeeper', 'active', 'store@kcm.local', '+1 555 0300', NOW(), NOW()),
  (gen_random_uuid(), 'auditor', 'Compliance Auditor', '$2b$10$biU/mcpFHks01PMwdPsdx.BLisQQtIpYtGxW3CmyOL7LuKCmGUy/K', 'Auditor', 'active', 'audit@kcm.local', '+1 555 0400', NOW(), NOW()),
  (gen_random_uuid(), 'technician', 'Site Technician', '$2b$10$Rc8QG8dueCK7P4hDbIHSXOqL6jz3kJIHccoPrzCswe6pnCnGgnyBy', 'Technician', 'active', 'tech@kcm.local', '+1 555 0500', NOW(), NOW())
ON CONFLICT ("username") DO NOTHING;
