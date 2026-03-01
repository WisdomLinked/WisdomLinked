import { ArrowLeft } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

// ── Verify Email Card ──────────────────────────────────────────────────────

export interface VerifyEmailCardProps {
  email: string;
  code: string;
  codeError: string;
  step2Error: string;
  submitting: boolean;
  onBack: () => void;
  onCodeChange: (val: string) => void;
  onSubmit: (e: React.FormEvent<HTMLFormElement>) => Promise<void>;
}

export function VerifyEmailCard({
  email,
  code,
  codeError,
  step2Error,
  submitting,
  onBack,
  onCodeChange,
  onSubmit,
}: VerifyEmailCardProps) {
  return (
    <>
      <CardHeader className="pb-4">
        <div className="flex items-center gap-2 mb-1">
          <button
            type="button"
            onClick={onBack}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <CardTitle className="text-lg">Step 2 — Verify Email</CardTitle>
        </div>
        <CardDescription>
          We sent a 6-digit code to{" "}
          <span className="text-foreground font-medium">{email}</span>
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} noValidate className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="code">Verification Code</Label>
            <Input
              id="code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              value={code}
              onChange={(e) => {
                const val = e.target.value
                  .replace(/[^0-9]/g, "")
                  .slice(0, 6);
                onCodeChange(val);
              }}
              className={cn(
                "text-center text-2xl tracking-widest font-mono",
                codeError ? "border-destructive" : "",
              )}
              autoComplete="one-time-code"
            />
            {codeError && (
              <p className="text-xs text-destructive">{codeError}</p>
            )}
          </div>

          {/* API error */}
          {step2Error && (
            <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
              {step2Error}
            </p>
          )}

          <Button
            type="submit"
            className="w-full"
            disabled={submitting || code.length !== 6}
          >
            {submitting ? "Verifying..." : "Verify & Continue"}
          </Button>

          <p className="text-xs text-center text-muted-foreground">
            Didn&apos;t receive a code?{" "}
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={onBack}
            >
              Go back and try again
            </button>
          </p>
        </form>
      </CardContent>
    </>
  );
}
