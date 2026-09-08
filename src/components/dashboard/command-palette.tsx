"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { searchApi, globalSearchApi } from "@/lib/api";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import {
  ClipboardList,
  Building2,
  Users,
  Search,
  CornerDownLeft,
  ArrowRight,
  Package,
  Truck,
  CalendarCheck,
  LayoutTemplate,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onNavigate: (view: string, entityId?: string) => void;
}

export function CommandPalette({
  open,
  onOpenChange,
  onNavigate,
}: CommandPaletteProps) {
  const [query, setQuery] = React.useState("");

  // Use the existing search API (jobs + customers + users)
  const { data: legacyData } = useQuery({
    queryKey: ["search", query],
    queryFn: () => searchApi.search(query),
    enabled: query.length >= 2 && open,
    staleTime: 10_000,
  });

  // Use the new global search API (inventory + suppliers + workers + templates)
  const { data: globalData } = useQuery({
    queryKey: ["global-search", query],
    queryFn: () => globalSearchApi.search(query),
    enabled: query.length >= 2 && open,
    staleTime: 10_000,
  });

  const legacy = legacyData ?? { jobs: [], customers: [], users: [] };
  const global = globalData ?? { inventory: [], suppliers: [], workers: [], templates: [] };

  const hasResults =
    legacy.jobs.length > 0 ||
    legacy.customers.length > 0 ||
    legacy.users.length > 0 ||
    (global.inventory?.length ?? 0) > 0 ||
    (global.suppliers?.length ?? 0) > 0 ||
    (global.workers?.length ?? 0) > 0 ||
    (global.templates?.length ?? 0) > 0;

  function handleSelect(target: string, id?: string) {
    onNavigate(target, id);
    onOpenChange(false);
    setQuery("");
  }

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange}>
      <CommandInput
        placeholder="Search jobs, customers, inventory, workers… (or type to navigate)"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        <CommandEmpty>
          {query.length < 2
            ? "Start typing to search across the entire system…"
            : "No matches found."}
        </CommandEmpty>

        {/* Quick navigation */}
        {query.length < 2 && (
          <CommandGroup heading="Quick Navigation">
            <CommandItem onSelect={() => handleSelect("overview")}>
              <Search className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Go to Overview</span>
              <CornerDownLeft className="ml-auto h-3 w-3 text-muted-foreground" />
            </CommandItem>
            <CommandItem onSelect={() => handleSelect("job-orders")}>
              <ClipboardList className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Go to Job Orders</span>
              <CornerDownLeft className="ml-auto h-3 w-3 text-muted-foreground" />
            </CommandItem>
            <CommandItem onSelect={() => handleSelect("inventory")}>
              <Package className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Go to Inventory</span>
              <CornerDownLeft className="ml-auto h-3 w-3 text-muted-foreground" />
            </CommandItem>
            <CommandItem onSelect={() => handleSelect("attendance")}>
              <CalendarCheck className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Go to Attendance</span>
              <CornerDownLeft className="ml-auto h-3 w-3 text-muted-foreground" />
            </CommandItem>
            <CommandItem onSelect={() => handleSelect("customers")}>
              <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Go to Customers</span>
              <CornerDownLeft className="ml-auto h-3 w-3 text-muted-foreground" />
            </CommandItem>
            <CommandItem onSelect={() => handleSelect("users")}>
              <Users className="mr-2 h-4 w-4 text-muted-foreground" />
              <span>Go to User Management</span>
              <CornerDownLeft className="ml-auto h-3 w-3 text-muted-foreground" />
            </CommandItem>
          </CommandGroup>
        )}

        {/* Job results */}
        {legacy.jobs.length > 0 && (
          <CommandGroup heading="Job Orders">
            {legacy.jobs.map((job) => (
              <CommandItem
                key={job.id}
                onSelect={() => handleSelect("job-orders", job.id)}
                className="group"
              >
                <ClipboardList className="mr-2 h-4 w-4 shrink-0 text-orange-500" />
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="font-mono text-xs text-primary">
                    {job.orderNumber}
                  </span>
                  <span className="truncate text-sm">{job.title}</span>
                </div>
                <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {/* Customer results */}
        {legacy.customers.length > 0 && (
          <>
            {legacy.jobs.length > 0 && <CommandSeparator />}
            <CommandGroup heading="Customers">
              {legacy.customers.map((c) => (
                <CommandItem
                  key={c.id}
                  onSelect={() => handleSelect("customers", c.id)}
                  className="group"
                >
                  <Building2 className="mr-2 h-4 w-4 shrink-0 text-teal-500" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {c.name}
                    </span>
                    {(c.email || c.phone) && (
                      <span className="truncate text-xs text-muted-foreground">
                        {c.email || c.phone}
                      </span>
                    )}
                  </div>
                  <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Inventory results */}
        {(global.inventory?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Inventory Items">
              {global.inventory.map((item: any) => (
                <CommandItem
                  key={item.id}
                  onSelect={() => handleSelect("inventory")}
                  className="group"
                >
                  <Package className="mr-2 h-4 w-4 shrink-0 text-indigo-500" />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium">{item.name}</span>
                    {item.code && <span className="font-mono text-xs text-muted-foreground">{item.code}</span>}
                  </div>
                  <span className="ml-auto text-xs text-muted-foreground">{item.stockLevel} {item.unit}</span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Supplier results */}
        {(global.suppliers?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Suppliers">
              {global.suppliers.map((s: any) => (
                <CommandItem
                  key={s.id}
                  onSelect={() => handleSelect("suppliers")}
                  className="group"
                >
                  <Truck className="mr-2 h-4 w-4 shrink-0 text-cyan-500" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{s.name}</span>
                    {s.contactName && <span className="truncate text-xs text-muted-foreground">{s.contactName}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Worker results */}
        {(global.workers?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Workers">
              {global.workers.map((w: any) => (
                <CommandItem
                  key={w.id}
                  onSelect={() => handleSelect("attendance")}
                  className="group"
                >
                  <CalendarCheck className="mr-2 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="flex min-w-0 flex-1 items-center gap-2">
                    <span className="truncate text-sm font-medium">{w.name}</span>
                    {w.role && <span className="text-xs text-muted-foreground">{w.role}</span>}
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* Template results */}
        {(global.templates?.length ?? 0) > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Job Templates">
              {global.templates.map((t: any) => (
                <CommandItem
                  key={t.id}
                  onSelect={() => handleSelect("templates")}
                  className="group"
                >
                  <LayoutTemplate className="mr-2 h-4 w-4 shrink-0 text-purple-500" />
                  <span className="truncate text-sm font-medium">{t.name}</span>
                  {t.category && <span className="ml-2 text-xs text-muted-foreground">{t.category}</span>}
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}

        {/* User results */}
        {legacy.users.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Users">
              {legacy.users.map((u) => (
                <CommandItem
                  key={u.id}
                  onSelect={() => handleSelect("users", u.id)}
                  className="group"
                >
                  <Users className="mr-2 h-4 w-4 shrink-0 text-amber-500" />
                  <div className="flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">
                      {u.fullName}
                    </span>
                    <span className="truncate text-xs text-muted-foreground">
                      @{u.username} · {u.role}
                    </span>
                  </div>
                  <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
