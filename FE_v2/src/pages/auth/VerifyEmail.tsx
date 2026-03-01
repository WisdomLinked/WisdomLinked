import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import axios from "axios";
import { useSetAtom } from "jotai";
import { tokenAtom, userAtom } from "@/atoms/authAtoms";
import { authApi } from "@/api/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from "lucide-react";

// ── Helpers ────────────────────────────────────────────────────────────────

function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === "string") return msg;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

// ── Page states ────────────────────────────────────────────────────────────

type PageState =
  | { readonly kind: "form" }
  | { readonly kind: "success" }
  | { readonly kind: "error"; readonly message: string };

// ── Main component ─────────────────────────────────────────────────────────

export default function VerifyEmail() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const setToken = useSetAtom(tokenAtom);
  const setUser = useSetAtom(userAtom);

  // Email can come from URL query param ?email=xxx or be entered manually
  const emailFromUrl = searchParams.get("email") ?? "";

  const [email, setEmail] = useState(emailFromUrl);
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [emailError, setEmailError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [pageState, setPageState] = useState<PageState>({ kind: "form" });

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();

    const trimmedEmail = email.trim();
    const trimmedCode = code.trim();

    let hasError = false;

    if (!trimmedEmail) {
      setEmailError("Email is required.");
      hasError = true;
    } else {
      setEmailError("");
    }

    if (trimmedCode.length !== 6) {
      setCodeError("Please enter the 6-digit code from your email.");
      hasError = true;
    } else {
      setCodeError("");
    }

    if (hasError) return;

    setIsSubmitting(true);

    try {
      const response = await authApi.confirmEmailVerification({
        email: trimmedEmail,
        code: trimmedCode,
      });

      setToken(response.token);
      setUser(response.user);

      setPageState({ kind: "success" });

      if (window.toast) {
        window.toast({
          title: "Email Verified",
          description: "Your account is confirmed. Welcome to WisdomLinked!",
        });
      }

      // Redirect to dashboard after brief success display
      setTimeout(() => {
        navigate("/dashboard/customer");
      }, 1500);
    } catch (err: unknown) {
      setPageState({
        kind: "error",
        message: getApiErrorMessage(err),
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pageState.kind === "success") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-background">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Email Verified!</h2>
          <p className="text-muted-foreground leading-relaxed">
            Your registration is confirmed. Redirecting you to your
            dashboard...
          </p>
        </div>
      </div>
    );
  }

  if (pageState.kind === "error") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-background">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center text-destructive mx-auto mb-6">
            <AlertCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Verification Failed</h2>
          <p className="text-muted-foreground mb-2 leading-relaxed">
            {pageState.message}
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            Please check your code and try again.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              onClick={() => setPageState({ kind: "form" })}
              variant="outline"
            >
              Try Again
            </Button>
            <Link to="/register/customer">
              <Button variant="ghost" className="w-full">
                Start Registration Over
              </Button>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
            <Mail className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Verify Your Email</h1>
          <p className="text-muted-foreground">
            Enter the 6-digit verification code from your email.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Email Verification</CardTitle>
            <CardDescription>
              Check your inbox for the verification code we sent you.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              {/* Email — pre-filled from URL if available */}
              {!emailFromUrl && (
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email Address</Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="you@example.com"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setEmailError("");
                    }}
                    className={cn(emailError ? "border-destructive" : "")}
                    autoComplete="email"
                  />
                  {emailError && (
                    <p className="text-xs text-destructive">{emailError}</p>
                  )}
                </div>
              )}

              {emailFromUrl && (
                <div className="px-3 py-2.5 rounded-md bg-muted text-sm">
                  Verifying for:{" "}
                  <span className="font-medium text-foreground">{emailFromUrl}</span>
                </div>
              )}

              {/* Code input */}
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
                    setCode(val);
                    setCodeError("");
                  }}
                  className={cn(
                    "text-center text-2xl tracking-widest font-mono",
                    codeError ? "border-destructive" : ""
                  )}
                  autoComplete="one-time-code"
                />
                {codeError && (
                  <p className="text-xs text-destructive">{codeError}</p>
                )}
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting || code.length !== 6}
              >
                {isSubmitting ? "Verifying..." : "Verify Email"}
              </Button>

              <div className="text-center">
                <Link
                  to="/login"
                  className="text-sm text-muted-foreground hover:text-foreground transition-colors inline-flex items-center gap-1"
                >
                  <ArrowLeft className="h-3.5 w-3.5" />
                  Back to Login
                </Link>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
