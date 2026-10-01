"use client";

import * as React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import type { SessionUser } from "@/lib/types";

interface AuthContextValue {
  user: SessionUser | null;
  loading: boolean;
  login: (username: string, password: string) => Promise<SessionUser>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = React.createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = React.useState<SessionUser | null>(null);
  const [loading, setLoading] = React.useState(true);

  const refresh = React.useCallback(async () => {
    try {
      const { user } = await authApi.me();
      setUser(user);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  const login = React.useCallback(
    async (username: string, password: string) => {
      const { user } = await authApi.login(username, password);
      setUser(user);
      return user;
    },
    []
  );

  const logout = React.useCallback(async () => {
    await authApi.logout();
    setUser(null);
  }, []);

  const value = React.useMemo(
    () => ({ user, loading, login, logout, refresh }),
    [user, loading, login, logout, refresh]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = React.useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/**
 * Applies the saved `kcm-theme` preference to <html> on mount and whenever the
 * value changes in another tab/window. Hoisted to the Providers level so the
 * theme applies globally — including the login screen — before the AppShell
 * mounts. This eliminates the light-mode flash dark-mode users would
 * otherwise see on the login screen.
 */
function GlobalThemeBoot() {
  React.useEffect(() => {
    const apply = () => {
      try {
        const stored = localStorage.getItem("kcm-theme");
        const isDark = stored === "dark";
        document.documentElement.classList.toggle("dark", isDark);
      } catch {
        // localStorage may be unavailable (private mode, etc.) — fall back
        // to the default light theme.
      }
    };
    apply();
    window.addEventListener("storage", apply);
    return () => window.removeEventListener("storage", apply);
  }, []);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = React.useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
          },
        },
      })
  );

  return (
    <QueryClientProvider client={queryClient}>
      <GlobalThemeBoot />
      <AuthProvider>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
