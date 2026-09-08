"use client";

import * as React from "react";
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import {
  X,
  Code2,
  Phone,
  Shield,
  User,
  Briefcase,
} from "lucide-react";

interface LegalModalProps {
  open: boolean;
  onOpenChange: (o: boolean) => void;
}

export function LegalModal({ open, onOpenChange }: LegalModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[520px] max-h-[calc(100vh-2rem)] overflow-y-auto scrollbar-warm">
        <DialogTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          System Ownership &amp; Licensing Information
        </DialogTitle>
        <DialogDescription className="sr-only">
          Developer credits and legal copyright notice
        </DialogDescription>

        {/* Close button with explicit X icon import */}
        <Button
          variant="ghost"
          size="icon"
          className="absolute right-4 top-4 h-7 w-7"
          onClick={() => onOpenChange(false)}
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </Button>

        {/* Developer Card */}
        <div className="rounded-lg border border-primary/30 bg-gradient-to-br from-primary/5 to-background p-4">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow">
              <Code2 className="h-6 w-6" />
            </div>
            <div className="flex-1 space-y-2">
              <div>
                <p className="text-[10px] font-medium uppercase text-muted-foreground">
                  Developer
                </p>
                <p className="text-lg font-bold">Prabhath Lokuge</p>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Briefcase className="h-4 w-4 shrink-0 text-primary" />
                <span>Idea, Design &amp; Developed By</span>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4 shrink-0 text-primary" />
                <a
                  href="https://wa.me/94770020223"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-medium hover:text-foreground hover:underline"
                >
                  +94 77 002 0223
                </a>
                <span className="text-xs">(WhatsApp / Contact)</span>
              </div>
            </div>
          </div>
        </div>

        <Separator />

        {/* Legal & Copyright Notice */}
        <div className="space-y-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Shield className="h-4 w-4 text-primary" />
            Legal &amp; Copyright Notice
          </h3>
          <div className="rounded-lg border border-border bg-muted/30 p-4">
            <p className="text-xs leading-relaxed text-muted-foreground">
              This proprietary Site Measurement, Elevation Blueprinting, and
              Cutting List Management Software is designed and developed
              specifically for custom cabinetry manufacturing workflows. All
              source code, algorithm workflows, cutting list parsers, and UI
              components are protected under intellectual property laws.
              Unauthorized duplication, reverse engineering, or redistributing
              without prior written consent from the developer is strictly
              prohibited.
            </p>
          </div>
          <p className="text-center text-xs font-medium text-muted-foreground">
            © 2026 Kitchen Workspace. All rights reserved.
          </p>
        </div>

        <DialogFooter>
          <Button onClick={() => onOpenChange(false)}>Close</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
