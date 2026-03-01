import { useState } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import { authApi } from "@/api/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Mail, ArrowLeft, CheckCircle } from "lucide-react";

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

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── ForgotPassword states ──────────────────────────────────────────────────

type PageState =
  | { readonly kind: "form" }
  | { readonly kind: "success"; readonly email: string };

// ── Main component ─────────────────────────────────────────────────────────

export default function ForgotPassword() {
  const [pageState, setPageState] = useState<PageState>({ kind: "form" });
  const [email, setEmail] = useState("");
  const [emailTouched, setEmailTouched] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const emailError =
    emailTouched && !isValidEmail(email) && email.length > 0
      ? "Please enter a valid email address."
      : emailTouched && email.trim().length === 0
      ? "Email is required."
      : "";

  async function handleSubmit(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();
    setEmailTouched(true);

    if (!isValidEmail(email)) return;

    setIsSubmitting(true);
    setErrorMessage("");

    try {
      await authApi.forgotPassword({ email: email.trim() });
      setPageState({ kind: "success", email: email.trim() });
    } catch (err: unknown) {
      setErrorMessage(getApiErrorMessage(err));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (pageState.kind === "success") {
    return (
      <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-background">
        <div className="w-full max-w-md text-center">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-primary mx-auto mb-6">
            <CheckCircle className="h-8 w-8" />
          </div>
          <h2 className="text-2xl font-bold mb-3">Check Your Email</h2>
          <p className="text-muted-foreground mb-2 leading-relaxed">
            We've sent password reset instructions to:
          </p>
          <p className="font-semibold text-foreground mb-6">{pageState.email}</p>
          <p className="text-sm text-muted-foreground mb-8 leading-relaxed">
            If that email address is in our system, you'll receive a reset link
            within a few minutes. Check your spam folder if you don't see it.
          </p>
          <div className="flex flex-col gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setPageState({ kind: "form" });
                setEmail("");
                setEmailTouched(false);
              }}
            >
              Try a different email
            </Button>
            <Link to="/login">
              <Button variant="ghost" className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Login
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
          <h1 className="text-3xl font-bold mb-2">Forgot Password?</h1>
          <p className="text-muted-foreground">
            Enter your email and we'll send you reset instructions.
          </p>
        </div>

        <Card>
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Reset Password</CardTitle>
            <CardDescription>
              We'll email you a link to reset your password.
            </CardDescription>
          </CardHeader>

          <CardContent>
            <form onSubmit={handleSubmit} noValidate className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="email">Email Address</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="you@example.com"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    setErrorMessage("");
                  }}
                  onBlur={() => setEmailTouched(true)}
                  className={cn(emailError ? "border-destructive" : "")}
                  autoComplete="email"
                />
                {emailError && (
                  <p className="text-xs text-destructive">{emailError}</p>
                )}
              </div>

              {errorMessage && (
                <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                  {errorMessage}
                </p>
              )}

              <Button
                type="submit"
                className="w-full"
                disabled={isSubmitting}
              >
                {isSubmitting ? "Sending..." : "Send Reset Link"}
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
