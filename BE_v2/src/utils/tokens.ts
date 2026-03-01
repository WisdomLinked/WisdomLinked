import { randomBytes } from "crypto";

export function generateResetToken(): string {
  return randomBytes(32).toString("hex");
}

export function generatePasswordResetExpiry(): Date {
  const expiry = new Date();
  expiry.setHours(expiry.getHours() + 24); // 24 hours from now
  return expiry;
}

