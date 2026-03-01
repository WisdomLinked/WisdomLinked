import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import { useSetAtom } from "jotai";
import { tokenAtom, userAtom } from "@/atoms/authAtoms";
import { authApi } from "@/api/authApi";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { Eye, EyeOff, UserPlus, ArrowLeft } from "lucide-react";

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

// ── Step 1 form state ──────────────────────────────────────────────────────

interface Step1Form {
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
}

interface Step1Errors {
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
}

function validateStep1(form: Step1Form): Step1Errors {
  return {
    username:
      form.username.trim().length < 3
        ? "Username must be at least 3 characters."
        : "",
    email: !isValidEmail(form.email) ? "Please enter a valid email address." : "",
    password:
      form.password.length < 6 ? "Password must be at least 6 characters." : "",
    confirmPassword:
      form.password !== form.confirmPassword ? "Passwords do not match." : "",
  };
}

function hasErrors(errors: Step1Errors | { code: string }): boolean {
  return Object.values(errors).some((e) => e.length > 0);
}

// ── Discord icon ───────────────────────────────────────────────────────────

function DiscordIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057c.002.022.015.043.03.054a19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994.021-.041.001-.09-.041-.106a13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z" />
    </svg>
  );
}

// ── Register flow ──────────────────────────────────────────────────────────

type RegisterStep =
  | { readonly kind: "step1" }
  | { readonly kind: "step2"; readonly email: string };

export default function RegisterCustomer() {
  const navigate = useNavigate();
  const setToken = useSetAtom(tokenAtom);
  const setUser = useSetAtom(userAtom);

  const [step, setStep] = useState<RegisterStep>({ kind: "step1" });

  // Step 1 state
  const [step1Form, setStep1Form] = useState<Step1Form>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [step1Errors, setStep1Errors] = useState<Step1Errors>({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [step1Touched, setStep1Touched] = useState<
    Record<keyof Step1Form, boolean>
  >({ username: false, email: false, password: false, confirmPassword: false });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [step1Submitting, setStep1Submitting] = useState(false);
  const [step1Error, setStep1Error] = useState("");

  // Step 2 state
  const [code, setCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [step2Submitting, setStep2Submitting] = useState(false);
  const [step2Error, setStep2Error] = useState("");

  // ── Step 1 handlers ───────────────────────────────────────────

  function handleStep1Change(field: keyof Step1Form, value: string): void {
    const updated = { ...step1Form, [field]: value };
    setStep1Form(updated);
    setStep1Error("");
    if (step1Touched[field]) {
      const errs = validateStep1(updated);
      setStep1Errors((prev) => ({ ...prev, [field]: errs[field] }));
    }
  }

  function handleStep1Blur(field: keyof Step1Form): void {
    setStep1Touched((prev) => ({ ...prev, [field]: true }));
    const errs = validateStep1(step1Form);
    setStep1Errors((prev) => ({ ...prev, [field]: errs[field] }));
  }

  async function handleStep1Submit(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();
    setStep1Touched({
      username: true,
      email: true,
      password: true,
      confirmPassword: true,
    });

    const errs = validateStep1(step1Form);
    setStep1Errors(errs);
    if (hasErrors(errs)) return;

    setStep1Submitting(true);
    setStep1Error("");

    try {
      await authApi.requestEmailVerification({
        username: step1Form.username.trim(),
        email: step1Form.email.trim(),
        password: step1Form.password,
        role: "customer",
      });
      setStep({ kind: "step2", email: step1Form.email.trim() });
    } catch (err: unknown) {
      setStep1Error(getApiErrorMessage(err));
    } finally {
      setStep1Submitting(false);
    }
  }

  // ── Step 2 handlers ───────────────────────────────────────────

  async function handleStep2Submit(
    e: React.FormEvent<HTMLFormElement>
  ): Promise<void> {
    e.preventDefault();
    const trimmedCode = code.trim();

    if (trimmedCode.length !== 6) {
      setCodeError("Please enter the 6-digit code from your email.");
      return;
    }

    if (step.kind !== "step2") return;

    setStep2Submitting(true);
    setStep2Error("");

    try {
      const response = await authApi.confirmEmailVerification({
        email: step.email,
        code: trimmedCode,
      });

      setToken(response.token);
      setUser(response.user);

      if (window.toast) {
        window.toast({
          title: "Account Created",
          description: "Welcome to WisdomLinked!",
        });
      }

      navigate("/dashboard/customer");
    } catch (err: unknown) {
      setStep2Error(getApiErrorMessage(err));
    } finally {
      setStep2Submitting(false);
    }
  }

  async function handleDiscordRegister(): Promise<void> {
    try {
      const { authUrl } = await authApi.getDiscordAuthUrl();
      window.location.href = authUrl;
    } catch (err: unknown) {
      setStep1Error(getApiErrorMessage(err));
    }
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">Create Account</h1>
          <p className="text-muted-foreground">
            {step.kind === "step1"
              ? "Register as a customer to start consulting with experts"
              : "Check your email for the verification code"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div
            className={cn(
              "flex-1 h-1.5 rounded-full transition-colors",
              "bg-primary"
            )}
          />
          <div
            className={cn(
              "flex-1 h-1.5 rounded-full transition-colors",
              step.kind === "step2" ? "bg-primary" : "bg-border"
            )}
          />
        </div>

        <Card>
          {step.kind === "step1" ? (
            <>
              <CardHeader className="pb-4">
                <CardTitle className="text-lg">
                  Step 1 — Your Details
                </CardTitle>
                <CardDescription>
                  Create your customer account
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-5">
                {/* Discord option */}
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={handleDiscordRegister}
                >
                  <DiscordIcon className="h-4 w-4 mr-2 text-foreground/70" />
                  Continue with Discord
                </Button>

                <div className="flex items-center gap-3">
                  <Separator className="flex-1" />
                  <span className="text-xs text-muted-foreground">or</span>
                  <Separator className="flex-1" />
                </div>

                <form onSubmit={handleStep1Submit} noValidate className="space-y-4">
                  {/* Username */}
                  <div className="space-y-1.5">
                    <Label htmlFor="username">
                      Username <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="username"
                      type="text"
                      placeholder="Choose a username"
                      value={step1Form.username}
                      onChange={(e) => handleStep1Change("username", e.target.value)}
                      onBlur={() => handleStep1Blur("username")}
                      className={cn(
                        step1Touched.username && step1Errors.username
                          ? "border-destructive"
                          : ""
                      )}
                      autoComplete="username"
                    />
                    {step1Touched.username && step1Errors.username && (
                      <p className="text-xs text-destructive">
                        {step1Errors.username}
                      </p>
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
                      value={step1Form.email}
                      onChange={(e) => handleStep1Change("email", e.target.value)}
                      onBlur={() => handleStep1Blur("email")}
                      className={cn(
                        step1Touched.email && step1Errors.email
                          ? "border-destructive"
                          : ""
                      )}
                      autoComplete="email"
                    />
                    {step1Touched.email && step1Errors.email && (
                      <p className="text-xs text-destructive">
                        {step1Errors.email}
                      </p>
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
                        value={step1Form.password}
                        onChange={(e) => handleStep1Change("password", e.target.value)}
                        onBlur={() => handleStep1Blur("password")}
                        className={cn(
                          "pr-10",
                          step1Touched.password && step1Errors.password
                            ? "border-destructive"
                            : ""
                        )}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowPassword((prev) => !prev)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {step1Touched.password && step1Errors.password && (
                      <p className="text-xs text-destructive">
                        {step1Errors.password}
                      </p>
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
                        value={step1Form.confirmPassword}
                        onChange={(e) =>
                          handleStep1Change("confirmPassword", e.target.value)
                        }
                        onBlur={() => handleStep1Blur("confirmPassword")}
                        className={cn(
                          "pr-10",
                          step1Touched.confirmPassword &&
                            step1Errors.confirmPassword
                            ? "border-destructive"
                            : ""
                        )}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        onClick={() => setShowConfirmPassword((prev) => !prev)}
                        tabIndex={-1}
                      >
                        {showConfirmPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                    {step1Touched.confirmPassword &&
                      step1Errors.confirmPassword && (
                        <p className="text-xs text-destructive">
                          {step1Errors.confirmPassword}
                        </p>
                      )}
                  </div>

                  {/* API error */}
                  {step1Error && (
                    <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                      {step1Error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={step1Submitting}
                  >
                    {step1Submitting ? (
                      "Sending verification..."
                    ) : (
                      <>
                        <UserPlus className="h-4 w-4 mr-2" />
                        Create Account
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
          ) : (
            <>
              <CardHeader className="pb-4">
                <div className="flex items-center gap-2 mb-1">
                  <button
                    type="button"
                    onClick={() => setStep({ kind: "step1" })}
                    className="text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <ArrowLeft className="h-4 w-4" />
                  </button>
                  <CardTitle className="text-lg">
                    Step 2 — Verify Email
                  </CardTitle>
                </div>
                <CardDescription>
                  We sent a 6-digit code to{" "}
                  <span className="text-foreground font-medium">
                    {step.email}
                  </span>
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleStep2Submit} noValidate className="space-y-4">
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
                        const val = e.target.value.replace(/[^0-9]/g, "").slice(0, 6);
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

                  {/* API error */}
                  {step2Error && (
                    <p className="text-sm text-destructive bg-destructive/10 px-3 py-2 rounded-md">
                      {step2Error}
                    </p>
                  )}

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={step2Submitting || code.length !== 6}
                  >
                    {step2Submitting ? "Verifying..." : "Verify & Continue"}
                  </Button>

                  <p className="text-xs text-center text-muted-foreground">
                    Didn't receive a code?{" "}
                    <button
                      type="button"
                      className="text-primary hover:underline"
                      onClick={() => setStep({ kind: "step1" })}
                    >
                      Go back and try again
                    </button>
                  </p>
                </form>
              </CardContent>
            </>
          )}
        </Card>
      </div>
    </div>
  );
}
