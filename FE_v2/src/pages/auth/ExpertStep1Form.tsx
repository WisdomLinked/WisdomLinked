import { Eye, EyeOff, ShieldCheck } from "lucide-react";
import { Link } from "react-router-dom";

import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

import { DiscordIcon } from "./DiscordIcon";
import { type Step1Errors, type Step1Form } from "./registerHelpers";

// ── Expert Step 1 Form ─────────────────────────────────────────────────────

export interface ExpertStep1FormProps {
  form: Step1Form;
  errors: Step1Errors;
  touched: Record<keyof Step1Form, boolean>;
  showPassword: boolean;
  showConfirmPassword: boolean;
  submitting: boolean;
  apiError: string;
  onChange: (field: keyof Step1Form, value: string) => void;
  onBlur: (field: keyof Step1Form) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
  onTogglePassword: () => void;
  onToggleConfirmPassword: () => void;
  onDiscordRegister: () => Promise<void>;
}

export function ExpertStep1Form({
  form,
  errors,
  touched,
  showPassword,
  showConfirmPassword,
  submitting,
  apiError,
  onChange,
  onBlur,
  onSubmit,
  onTogglePassword,
  onToggleConfirmPassword,
  onDiscordRegister,
}: ExpertStep1FormProps) {
  return (
    <>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg">Step 1 — Expert Details</CardTitle>
        <CardDescription>
          Create your expert account. Our team will verify your credentials
          after registration.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Discord option */}
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={onDiscordRegister}
        >
          <DiscordIcon className="h-4 w-4 mr-2 text-foreground/70" />
          Continue with Discord
        </Button>

        <div className="flex items-center gap-3">
          <Separator className="flex-1" />
          <span className="text-xs text-muted-foreground">or</span>
          <Separator className="flex-1" />
        </div>

        <form onSubmit={onSubmit} noValidate className="space-y-4">
          {/* Username */}
          <div className="space-y-1.5">
            <Label htmlFor="username">
              Username <span className="text-destructive">*</span>
            </Label>
            <Input
              id="username"
              type="text"
              placeholder="Choose a username"
              value={form.username}
              onChange={(e) => onChange("username", e.target.value)}
              onBlur={() => onBlur("username")}
              className={cn(
                touched.username && errors.username ? "border-destructive" : "",
              )}
              autoComplete="username"
            />
            {touched.username && errors.username && (
              <p className="text-xs text-destructive">{errors.username}</p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-1.5">
            <Label htmlFor="email">
              Email <span className="text-destructive">*</span>
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="you@example.com"
              value={form.email}
              onChange={(e) => onChange("email", e.target.value)}
              onBlur={() => onBlur("email")}
              className={cn(
                touched.email && errors.email ? "border-destructive" : "",
              )}
              autoComplete="email"
            />
            {touched.email && errors.email && (
              <p className="text-xs text-destructive">{errors.email}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <Label htmlFor="password">
              Password <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => onChange("password", e.target.value)}
                onBlur={() => onBlur("password")}
                className={cn(
                  "pr-10",
                  touched.password && errors.password
                    ? "border-destructive"
                    : "",
                )}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={onTogglePassword}
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {touched.password && errors.password && (
              <p className="text-xs text-destructive">{errors.password}</p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-1.5">
            <Label htmlFor="confirmPassword">
              Confirm Password <span className="text-destructive">*</span>
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                placeholder="Repeat your password"
                value={form.confirmPassword}
                onChange={(e) => onChange("confirmPassword", e.target.value)}
                onBlur={() => onBlur("confirmPassword")}
                className={cn(
                  "pr-10",
                  touched.confirmPassword && errors.confirmPassword
                    ? "border-destructive"
                    : "",
                )}
                autoComplete="new-password"
              />
              <button
                type="button"
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                onClick={onToggleConfirmPassword}
                tabIndex={-1}
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4" />
                ) : (
                  <Eye className="h-4 w-4" />
                )}
              </button>
            </div>
            {touched.confirmPassword && errors.confirmPassword && (
              <p className="text-xs text-destructive">
                {errors.confirmPassword}
              </p>
            )}
          </div>

          {/* API error */}
          {apiError && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {apiError}
            </p>
          )}

          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? (
              "Sending verification..."
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 mr-2" />
                Register as Expert
              </>
            )}
          </Button>
        </form>

        <div className="pt-2 border-t border-border text-center">
          <span className="text-sm text-muted-foreground">
            Already have an account?{" "}
            <Link to="/login" className="text-primary hover:underline">
              Sign in
            </Link>
          </span>
        </div>
      </CardContent>
    </>
  );
}
