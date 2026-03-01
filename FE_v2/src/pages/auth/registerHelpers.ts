import axios from "axios";

// ── Shared helpers for Register pages ─────────────────────────────────────

export function getApiErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const msg = error.response?.data?.message;
    if (typeof msg === "string") return msg;
    return error.message;
  }
  if (error instanceof Error) return error.message;
  return "Something went wrong. Please try again.";
}

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

// ── Step 1 form types shared by both expert and customer registration ──────

export interface Step1Form {
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
}

export interface Step1Errors {
  readonly username: string;
  readonly email: string;
  readonly password: string;
  readonly confirmPassword: string;
}

export function validateStep1(form: Step1Form): Step1Errors {
  return {
    username:
      form.username.trim().length < 3
        ? "Username must be at least 3 characters."
        : "",
    email: !isValidEmail(form.email)
      ? "Please enter a valid email address."
      : "",
    password:
      form.password.length < 6
        ? "Password must be at least 6 characters."
        : "",
    confirmPassword:
      form.password !== form.confirmPassword ? "Passwords do not match." : "",
  };
}

export function hasStep1Errors(errors: Step1Errors): boolean {
  return Object.values(errors).some((e) => e.length > 0);
}
