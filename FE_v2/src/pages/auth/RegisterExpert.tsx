import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useSetAtom } from "jotai";
import { ShieldCheck } from "lucide-react";

import { authApi } from "@/api/authApi";
import { tokenAtom, userAtom } from "@/atoms/authAtoms";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import { ExpertStep1Form } from "./ExpertStep1Form";
import {
  getApiErrorMessage,
  hasStep1Errors,
  validateStep1,
  type Step1Errors,
  type Step1Form,
} from "./registerHelpers";
import { VerifyEmailCard } from "./VerifyEmailCard";

// ── Register flow ──────────────────────────────────────────────────────────

type RegisterStep =
  | { readonly kind: "step1" }
  | { readonly kind: "step2"; readonly email: string };

export default function RegisterExpert() {
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
    if (hasStep1Errors(errs)) return;

    setStep1Submitting(true);
    setStep1Error("");

    try {
      await authApi.requestEmailVerification({
        username: step1Form.username.trim(),
        email: step1Form.email.trim(),
        password: step1Form.password,
        role: "expert",
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
          title: "Expert Account Created",
          description: "Welcome to WisdomLinked! Your expert profile is being set up.",
        });
      }

      navigate("/dashboard/expert");
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

  function handleCodeChange(val: string): void {
    setCode(val);
    setCodeError("");
  }

  // ── Render ─────────────────────────────────────────────────────

  return (
    <div className="min-h-[80vh] flex items-center justify-center px-4 py-12 bg-background">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mx-auto mb-4">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <h1 className="text-3xl font-bold mb-2">Join as Expert</h1>
          <p className="text-muted-foreground">
            {step.kind === "step1"
              ? "Share your expertise with clients around the world"
              : "Check your email for the verification code"}
          </p>
        </div>

        {/* Step indicator */}
        <div className="flex items-center gap-2 mb-6">
          <div className="flex-1 h-1.5 rounded-full bg-primary" />
          <div
            className={cn(
              "flex-1 h-1.5 rounded-full transition-colors",
              step.kind === "step2" ? "bg-primary" : "bg-border"
            )}
          />
        </div>

        <Card>
          {step.kind === "step1" ? (
            <ExpertStep1Form
              form={step1Form}
              errors={step1Errors}
              touched={step1Touched}
              showPassword={showPassword}
              showConfirmPassword={showConfirmPassword}
              submitting={step1Submitting}
              apiError={step1Error}
              onChange={handleStep1Change}
              onBlur={handleStep1Blur}
              onSubmit={handleStep1Submit}
              onTogglePassword={() => setShowPassword((p) => !p)}
              onToggleConfirmPassword={() => setShowConfirmPassword((p) => !p)}
              onDiscordRegister={handleDiscordRegister}
            />
          ) : (
            <VerifyEmailCard
              email={step.email}
              code={code}
              codeError={codeError}
              step2Error={step2Error}
              submitting={step2Submitting}
              onBack={() => setStep({ kind: "step1" })}
              onCodeChange={handleCodeChange}
              onSubmit={handleStep2Submit}
            />
          )}
        </Card>
      </div>
    </div>
  );
}
