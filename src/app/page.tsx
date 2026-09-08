"use client";

import * as React from "react";
import { useAuth } from "@/components/providers";
import { LoginScreen } from "@/components/auth/login-screen";
import { AppShell } from "@/components/dashboard/app-shell";
import { Loader2 } from "lucide-react";

export default function Page() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">
            Loading CabinetryWorks…
          </p>
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;
  return <AppShell user={user} />;
}
