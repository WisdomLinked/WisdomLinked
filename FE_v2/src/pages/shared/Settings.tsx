/**
 * SharedSettings — account settings page accessible by all authenticated roles.
 *
 * Sections:
 *   1. Security     — change password form (placeholder until API is wired)
 *   2. Sessions     — active sessions via SessionManagement component
 *   3. Appearance   — ThemeToggle + current theme label
 *   4. Account      — email, username, role badge, delete account (AlertDialog)
 */

import { useState } from "react";

import { useAtomValue } from "jotai";
import { Eye, EyeOff, Lock, Palette, Shield, Trash2, User } from "lucide-react";

import { userAtom } from "@/atoms/authAtoms";
import { SessionManagement } from "@/components/SessionManagement";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/themes/ThemeProvider";

// ── Change password form ──────────────────────────────────────────────────────

interface PasswordFormState {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

const EMPTY_PASSWORD_FORM: PasswordFormState = {
  currentPassword: "",
  newPassword: "",
  confirmPassword: "",
};

function SecuritySection() {
  const [form, setForm] = useState<PasswordFormState>(EMPTY_PASSWORD_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const validationError: string | null = (() => {
    if (form.newPassword.length > 0 && form.newPassword.length < 8) {
      return "New password must be at least 8 characters.";
    }
    if (
      form.newPassword.length > 0 &&
      form.confirmPassword.length > 0 &&
      form.newPassword !== form.confirmPassword
    ) {
      return "New passwords do not match.";
    }
    return null;
  })();

  const canSubmit =
    form.currentPassword.length > 0 &&
    form.newPassword.length >= 8 &&
    form.confirmPassword === form.newPassword &&
    !submitting;

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!canSubmit) return;

    setSubmitting(true);
    try {
      // Password change API not yet available. Show placeholder toast.
      // When POST /api/v1/auth/change-password is implemented on the backend,
      // replace this block with the actual API call.
      await new Promise<void>((resolve) => {
        setTimeout(resolve, 400);
      });

      if (window.toast) {
        window.toast({
          title: "Not yet available",
          description:
            "Password change endpoint is not yet configured. Please contact support.",
          variant: "destructive",
        });
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Security
        </CardTitle>
        <CardDescription>Update your password to keep your account secure.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 max-w-sm">
          {/* Current password */}
          <div className="space-y-1.5">
            <Label htmlFor="currentPassword">Current Password</Label>
            <div className="relative">
              <Input
                id="currentPassword"
                type={showCurrent ? "text" : "password"}
                autoComplete="current-password"
                value={form.currentPassword}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    currentPassword: e.target.value,
                  }));
                }}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setShowCurrent((v) => !v);
                }}
                aria-label={showCurrent ? "Hide password" : "Show password"}
              >
                {showCurrent ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* New password */}
          <div className="space-y-1.5">
            <Label htmlFor="newPassword">New Password</Label>
            <div className="relative">
              <Input
                id="newPassword"
                type={showNew ? "text" : "password"}
                autoComplete="new-password"
                value={form.newPassword}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    newPassword: e.target.value,
                  }));
                }}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setShowNew((v) => !v);
                }}
                aria-label={showNew ? "Hide password" : "Show password"}
              >
                {showNew ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Confirm password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">Confirm New Password</Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirm ? "text" : "password"}
                autoComplete="new-password"
                value={form.confirmPassword}
                onChange={(e) => {
                  setForm((prev) => ({
                    ...prev,
                    confirmPassword: e.target.value,
                  }));
                }}
                className="pr-10"
              />
              <button
                type="button"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                onClick={() => {
                  setShowConfirm((v) => !v);
                }}
                aria-label={showConfirm ? "Hide password" : "Show password"}
              >
                {showConfirm ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
          </div>

          {/* Validation error */}
          {validationError !== null && (
            <p className="text-sm text-destructive">{validationError}</p>
          )}

          <Button type="submit" disabled={!canSubmit} size="sm">
            {submitting ? "Saving…" : "Update Password"}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

// ── Appearance section ────────────────────────────────────────────────────────

function AppearanceSection() {
  const { theme } = useTheme();

  const themeLabel: Record<string, string> = {
    midnight: "🌑 Midnight",
    ocean: "🌊 Ocean",
  };

  const currentLabel = themeLabel[theme] ?? theme;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Palette className="h-5 w-5" />
          Appearance
        </CardTitle>
        <CardDescription>Choose a color theme for your dashboard.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="space-y-1">
            <p className="text-sm font-medium">Theme</p>
            <p className="text-xs text-muted-foreground">
              Currently: <span className="font-medium">{currentLabel}</span>
            </p>
          </div>
          <ThemeToggle />
        </div>
      </CardContent>
    </Card>
  );
}

// ── Account section ───────────────────────────────────────────────────────────

function AccountSection() {
  const user = useAtomValue(userAtom);
  const { logout } = useAuth();

  const roleBadgeVariant = (
    role: string,
  ): "default" | "secondary" | "destructive" | "outline" => {
    if (role === "admin") return "destructive";
    if (role === "expert") return "default";
    return "secondary";
  };

  const handleDeleteAccount = async () => {
    // Placeholder: delete account API not yet wired
    if (window.toast) {
      window.toast({
        title: "Not yet available",
        description:
          "Account deletion is not yet available. Please contact support.",
        variant: "destructive",
      });
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <User className="h-5 w-5" />
          Account
        </CardTitle>
        <CardDescription>Your account information and identity.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Info grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Username
            </p>
            <p className="text-sm font-semibold">{user?.username ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Email
            </p>
            <p className="text-sm font-semibold break-all">{user?.email ?? "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">
              Role
            </p>
            <div className="flex items-center gap-2">
              {user?.role === "admin" && (
                <Shield className="h-4 w-4 text-destructive" />
              )}
              <Badge
                variant={roleBadgeVariant(user?.role ?? "customer")}
                className="capitalize"
              >
                {user?.role ?? "—"}
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        {/* Danger zone */}
        <div className="space-y-3">
          <div>
            <p className="text-sm font-medium text-destructive">Danger Zone</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Irreversible account actions.
            </p>
          </div>

          <div className="flex flex-col sm:flex-row gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                logout();
              }}
            >
              Sign Out
            </Button>

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button variant="destructive" size="sm">
                  <Trash2 className="h-4 w-4 mr-1.5" />
                  Delete Account
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete Account</AlertDialogTitle>
                  <AlertDialogDescription>
                    This will permanently delete your account and all associated
                    data. This action{" "}
                    <span className="font-semibold text-foreground">
                      cannot be undone
                    </span>
                    .
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    onClick={() => {
                      handleDeleteAccount();
                    }}
                  >
                    Delete My Account
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main page ────────────────────────────────────────────────────────────────

export default function SharedSettings() {
  return (
    <div className="flex flex-col gap-6 p-6 max-w-3xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold">Account Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your security, appearance, and account preferences.
        </p>
      </div>

      {/* 1. Security */}
      <SecuritySection />

      <Separator />

      {/* 2. Active Sessions */}
      <section>
        <h2 className="text-lg font-semibold mb-4">Active Sessions</h2>
        <SessionManagement />
      </section>

      <Separator />

      {/* 3. Appearance */}
      <AppearanceSection />

      <Separator />

      {/* 4. Account */}
      <AccountSection />
    </div>
  );
}
