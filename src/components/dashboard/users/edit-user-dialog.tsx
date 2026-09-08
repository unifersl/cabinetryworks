"use client";

import * as React from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { usersApi } from "@/lib/api";
import type { Role, User, UserStatus } from "@/lib/types";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { X, Save, Loader2, UserCog, KeyRound } from "lucide-react";

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function EditUserDialog({
  user,
  open,
  onOpenChange,
}: EditUserDialogProps) {
  const queryClient = useQueryClient();
  const [fullName, setFullName] = React.useState("");
  const [role, setRole] = React.useState<Role>("Technician");
  const [email, setEmail] = React.useState("");
  const [phone, setPhone] = React.useState("");
  const [active, setActive] = React.useState(true);
  const [resetPwd, setResetPwd] = React.useState(false);
  const [password, setPassword] = React.useState("");

  React.useEffect(() => {
    if (user) {
      setFullName(user.fullName);
      setRole(user.role);
      setEmail(user.email ?? "");
      setPhone(user.phone ?? "");
      setActive(user.status === "active");
      setResetPwd(false);
      setPassword("");
    }
  }, [user]);

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("No user selected");
      const patch: Record<string, unknown> = {
        fullName: fullName.trim(),
        role,
        email: email.trim() || null,
        phone: phone.trim() || null,
        status: active ? "active" : "suspended",
      };
      if (resetPwd && password.length >= 6) patch.password = password;
      return usersApi.update(user.id, patch);
    },
    onSuccess: (data) => {
      toast.success("User updated", {
        description: `${data.user.fullName} (@${data.user.username}) saved.`,
      });
      queryClient.invalidateQueries({ queryKey: ["users"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      onOpenChange(false);
    },
    onError: (err: Error) => {
      toast.error("Update failed", { description: err.message });
    },
  });

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="sm:max-w-[460px]">
        <DialogHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="rounded-lg bg-primary/10 p-2">
                <UserCog className="h-5 w-5 text-primary" />
              </div>
              <div>
                <DialogTitle>Edit User</DialogTitle>
                <DialogDescription className="mt-0.5">
                  @{user.username} · joined{" "}
                  {user.createdAt
                    ? new Date(user.createdAt).toLocaleDateString()
                    : "—"}
                </DialogDescription>
              </div>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            updateMutation.mutate();
          }}
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="eu-fullname">Full Name</Label>
            <Input
              id="eu-fullname"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              required
              disabled={updateMutation.isPending}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label htmlFor="eu-email">Email</Label>
              <Input
                id="eu-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={updateMutation.isPending}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="eu-phone">Phone</Label>
              <Input
                id="eu-phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={updateMutation.isPending}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-2">
              <Label>Role</Label>
              <Select
                value={role}
                onValueChange={(v) => setRole(v as Role)}
                disabled={updateMutation.isPending}
              >
                <SelectTrigger id="eu-role">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="SuperAdmin">Super Admin</SelectItem>
                  <SelectItem value="Admin">Admin</SelectItem>
                  <SelectItem value="Manager">Manager</SelectItem>
                  <SelectItem value="Storekeeper">Storekeeper</SelectItem>
                  <SelectItem value="Auditor">Auditor</SelectItem>
                  <SelectItem value="Technician">Technician</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Account status</Label>
              <div className="flex h-9 items-center gap-2 rounded-md border border-input px-3">
                <Switch
                  checked={active}
                  onCheckedChange={setActive}
                  disabled={updateMutation.isPending}
                  id="eu-active"
                />
                <Label
                  htmlFor="eu-active"
                  className="cursor-pointer text-sm font-normal"
                >
                  {active ? "Active" : "Suspended"}
                </Label>
              </div>
            </div>
          </div>

          <div className="space-y-3 rounded-lg border border-border bg-muted/30 p-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <KeyRound className="h-4 w-4 text-muted-foreground" />
                <Label
                  htmlFor="eu-reset"
                  className="cursor-pointer text-sm font-medium"
                >
                  Reset password
                </Label>
              </div>
              <Switch
                id="eu-reset"
                checked={resetPwd}
                onCheckedChange={setResetPwd}
                disabled={updateMutation.isPending}
              />
            </div>
            {resetPwd && (
              <Input
                type="password"
                placeholder="New password (min. 6 chars)"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={updateMutation.isPending}
              />
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={updateMutation.isPending}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={
                updateMutation.isPending ||
                (resetPwd && password.length < 6)
              }
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving…
                </>
              ) : (
                <>
                  <Save className="mr-2 h-4 w-4" />
                  Save Changes
                </>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
