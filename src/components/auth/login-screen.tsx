"use client";

import * as React from "react";
import { useAuth } from "@/components/providers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { toast } from "sonner";
import {
  Hammer,
  Lock,
  User as UserIcon,
  Ruler,
  PanelTop,
  Loader2,
  ShieldCheck,
} from "lucide-react";

export function LoginScreen() {
  const { login } = useAuth();
  const [username, setUsername] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [showPwd, setShowPwd] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      const user = await login(username.trim(), password);
      toast.success(`Welcome back, ${user.fullName.split(" ")[0]}!`);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Login failed. Please try again."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-sidebar p-10 text-sidebar-foreground lg:flex wood-grain">
        <div className="relative z-10 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg">
            <Hammer className="h-6 w-6" />
          </div>
          <div>
            <p className="text-lg font-semibold tracking-tight">CabinetryWorks</p>
            <p className="text-xs text-sidebar-foreground/70">
              Kitchen &amp; Cabinetry Manufacturing Console
            </p>
          </div>
        </div>

        <div className="relative z-10 space-y-6">
          <h1 className="max-w-md text-3xl font-bold leading-tight">
            From site measurement to factory floor — one console.
          </h1>
          <p className="max-w-md text-sm text-sidebar-foreground/80">
            Manage job orders, capture on-site measurements with photo markup,
            generate elevation blueprints, and produce factory-ready cutting
            lists for your cabinetry production line.
          </p>
          <div className="grid grid-cols-3 gap-3 pt-4">
            {[
              { icon: Ruler, label: "Site Measurement" },
              { icon: PanelTop, label: "Elevation Blueprint" },
              { icon: Hammer, label: "Cutting Lists" },
            ].map(({ icon: Icon, label }) => (
              <div
                key={label}
                className="rounded-lg border border-sidebar-border/60 bg-sidebar-accent/40 p-3 text-center"
              >
                <Icon className="mx-auto mb-2 h-5 w-5 text-sidebar-primary" />
                <span className="text-[11px] font-medium leading-tight">
                  {label}
                </span>
              </div>
            ))}
          </div>
        </div>

        <p className="relative z-10 text-xs text-sidebar-foreground/60">
          © {new Date().getFullYear()} CabinetryWorks. Internal operations tool.
        </p>

        {/* decorative glow */}
        <div className="pointer-events-none absolute -right-24 top-1/3 h-72 w-72 rounded-full bg-primary/20 blur-3xl" />
      </div>

      {/* Right — login form */}
      <div className="flex items-center justify-center p-6 sm:p-10">
        <Card className="w-full max-w-sm border-border/60 shadow-sm">
          <CardHeader className="space-y-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 lg:hidden">
              <Hammer className="h-6 w-6 text-primary" />
            </div>
            <CardTitle className="text-2xl">Sign in</CardTitle>
            <CardDescription>
              Enter your credentials to access the operations console.
            </CardDescription>
          </CardHeader>
          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <div className="relative">
                  <UserIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="username"
                    autoComplete="username"
                    placeholder="e.g. admin"
                    className="pl-9"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Password</Label>
                  <button
                    type="button"
                    onClick={() => setShowPwd((s) => !s)}
                    className="text-xs text-muted-foreground transition-colors hover:text-foreground"
                  >
                    {showPwd ? "Hide" : "Show"}
                  </button>
                </div>
                <div className="relative">
                  <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="••••••••"
                    className="pl-9"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    disabled={submitting}
                  />
                </div>
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Signing in…
                  </>
                ) : (
                  "Sign in"
                )}
              </Button>
              <div className="w-full rounded-lg border border-border bg-muted/40 p-3">
                <div className="mb-1.5 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Secure Login
                </div>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  Contact your system administrator if you need an account or have forgotten your credentials.
                </p>
              </div>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
}
