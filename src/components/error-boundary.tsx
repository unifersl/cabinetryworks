"use client";

import * as React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryProps {
  children: React.ReactNode;
  fallbackTitle?: string;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

/**
 * React Error Boundary — wraps dashboard tabs and core workspaces so a single
 * view crash never blanks the whole application.
 */
export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("[ErrorBoundary]", error, info.componentStack);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[40vh] flex-col items-center justify-center gap-4 p-8 text-center fade-in">
          <div className="rounded-full bg-destructive/10 p-4">
            <AlertTriangle className="h-8 w-8 text-destructive" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold">
              {this.props.fallbackTitle ?? "Something went wrong"}
            </h3>
            <p className="max-w-md text-sm text-muted-foreground">
              {this.state.error?.message ??
                "An unexpected error occurred while rendering this view."}
            </p>
          </div>
          <div className="flex gap-2">
            <Button onClick={this.handleReset} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Try again
            </Button>
            <Button onClick={() => window.location.reload()} variant="ghost">
              Reload page
            </Button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
