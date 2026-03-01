/**
 * Email Service — SendGrid transactional email delivery.
 *
 * All send functions are fire-and-forget: failures are logged but never thrown.
 * Email is a notification mechanism — a failed send MUST NOT crash the calling
 * request.  Callers that need to know about delivery status should check logs.
 *
 * Env vars consumed (via getBackendEnvironmentConfig — both optional):
 *   SENDGRID_API_KEY    — absent → sendgridEnabled=false, all sends are no-ops
 *   SENDGRID_FROM_EMAIL — absent → sendgridEnabled=false, all sends are no-ops
 *
 * Config is read lazily on first use rather than at module-load time so that
 * the module can be imported before the test-runner preload has run.
 */

import sgMail from "@sendgrid/mail";
import { getBackendEnvironmentConfig } from "../config/env";

// ── Bootstrap ──────────────────────────────────────────────────────────────

// Lazy-initialised SendGrid state.  Computed once on the first _dispatch call
// so that the module can be safely imported before env vars are set.
interface EmailState {
  fromAddress: { email: string; name: string } | null;
}

let _emailState: EmailState | null = null;

function _getEmailState(): EmailState {
  if (_emailState !== null) {
    return _emailState;
  }

  const env = getBackendEnvironmentConfig();

  // Initialise SendGrid only when both credentials are present.
  // When sendgridEnabled is false all send functions are no-ops.
  if (env.sendgridApiKey !== undefined) {
    sgMail.setApiKey(env.sendgridApiKey);
  }

  const fromAddress: { email: string; name: string } | null =
    env.sendgridFromEmail !== undefined
      ? { email: env.sendgridFromEmail, name: "WisdomLinked" }
      : null;

  _emailState = { fromAddress };
  return _emailState;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface EventNotificationDetails {
  title: string;
  date: string;
  expertName: string;
  status: string;
}

export interface PaymentConfirmationDetails {
  amount: number;
  currency: string;
  description: string;
}

// ── Internal helper ────────────────────────────────────────────────────────

async function _dispatch(to: string, subject: string, html: string): Promise<void> {
  const { fromAddress } = _getEmailState();

  if (fromAddress === null) {
    // SendGrid not configured — log and skip silently so callers are unaffected.
    console.warn("[email] SendGrid not configured — skipping email send", { to, subject });
    return;
  }

  try {
    await sgMail.send({
      to,
      from: fromAddress,
      subject,
      html,
    });
  } catch (error) {
    // Intentionally non-throwing: email delivery failure must not surface as
    // an HTTP 500.  The structured log is the observable signal (Law 10).
    console.error("[email] Delivery failure", {
      to,
      subject,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

// ── Public API ─────────────────────────────────────────────────────────────

/**
 * Send an OTP verification code as part of the registration flow.
 */
export async function sendVerificationEmail(to: string, code: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">Verify your email</h2>
      <p>Welcome to <strong>WisdomLinked</strong>! Use the code below to complete your registration.</p>
      <div style="background:#f4f4f8;border-radius:8px;padding:20px 32px;text-align:center;margin:24px 0;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#4f46e5;">${code}</span>
      </div>
      <p style="color:#666;font-size:13px;">This code expires in 15 minutes. If you did not request this, you can safely ignore this email.</p>
    </div>`;
  await _dispatch(to, "Verify your email — WisdomLinked", html);
}

/**
 * Send an OTP for password-less login.
 */
export async function sendLoginOtpEmail(to: string, code: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">Your login code</h2>
      <p>Here is your one-time login code for <strong>WisdomLinked</strong>:</p>
      <div style="background:#f4f4f8;border-radius:8px;padding:20px 32px;text-align:center;margin:24px 0;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#4f46e5;">${code}</span>
      </div>
      <p style="color:#666;font-size:13px;">This code expires in 10 minutes. Never share it with anyone.</p>
    </div>`;
  await _dispatch(to, "Your WisdomLinked login code", html);
}

/**
 * Send a password reset OTP.
 */
export async function sendPasswordResetEmail(to: string, code: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">Reset your password</h2>
      <p>We received a request to reset the password for your <strong>WisdomLinked</strong> account.</p>
      <div style="background:#f4f4f8;border-radius:8px;padding:20px 32px;text-align:center;margin:24px 0;">
        <span style="font-size:32px;font-weight:700;letter-spacing:8px;color:#4f46e5;">${code}</span>
      </div>
      <p style="color:#666;font-size:13px;">This code expires in 15 minutes. If you did not request a password reset, please ignore this email.</p>
    </div>`;
  await _dispatch(to, "Reset your WisdomLinked password", html);
}

/**
 * Send a welcome email after successful registration.
 */
export async function sendWelcomeEmail(to: string, username: string): Promise<void> {
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">Welcome to WisdomLinked, ${username}!</h2>
      <p>We're thrilled to have you on board. WisdomLinked connects you with world-class experts so you can grow, learn, and achieve your goals.</p>
      <ul style="color:#333;line-height:1.8;">
        <li>Browse expert profiles and book sessions</li>
        <li>Join live seminars and group discussions</li>
        <li>Track your learning journey in your dashboard</li>
      </ul>
      <p style="margin-top:24px;">If you have any questions, our support team is always here to help.</p>
      <p style="color:#666;font-size:13px;margin-top:32px;">The WisdomLinked Team</p>
    </div>`;
  await _dispatch(to, `Welcome to WisdomLinked, ${username}!`, html);
}

/**
 * Notify a user of a change to one of their event bookings.
 */
export async function sendEventNotification(
  to: string,
  eventDetails: EventNotificationDetails
): Promise<void> {
  const { title, date, expertName, status } = eventDetails;
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">Event update</h2>
      <p>Your booking has been updated:</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;font-weight:600;color:#555;width:120px;">Event</td><td style="padding:8px;">${title}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:600;color:#555;">Expert</td><td style="padding:8px;">${expertName}</td></tr>
        <tr><td style="padding:8px;font-weight:600;color:#555;">Date</td><td style="padding:8px;">${date}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:600;color:#555;">Status</td><td style="padding:8px;text-transform:capitalize;font-weight:600;">${status}</td></tr>
      </table>
      <p style="color:#666;font-size:13px;">Log in to your WisdomLinked account to view full details.</p>
    </div>`;
  await _dispatch(to, `Event update: ${title} — ${status}`, html);
}

/**
 * Send a payment confirmation receipt.
 */
export async function sendPaymentConfirmation(
  to: string,
  payment: PaymentConfirmationDetails
): Promise<void> {
  const { amount, currency, description } = payment;
  const formattedAmount = (amount / 100).toFixed(2);
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;">
      <h2 style="color:#1a1a2e;">Payment confirmed</h2>
      <p>Your payment has been processed successfully.</p>
      <table style="width:100%;border-collapse:collapse;margin:16px 0;">
        <tr><td style="padding:8px;font-weight:600;color:#555;width:120px;">Amount</td><td style="padding:8px;">${formattedAmount} ${currency.toUpperCase()}</td></tr>
        <tr style="background:#f9f9f9;"><td style="padding:8px;font-weight:600;color:#555;">Description</td><td style="padding:8px;">${description}</td></tr>
      </table>
      <p style="color:#666;font-size:13px;">A detailed receipt is available in your WisdomLinked account under Billing.</p>
    </div>`;
  await _dispatch(to, "Payment confirmed — WisdomLinked", html);
}

/**
 * Send an alert to the configured admin address.
 * The from-address is used as the admin destination when no dedicated admin
 * address env var is configured.
 */
export async function sendAdminAlert(subject: string, body: string): Promise<void> {
  const { fromAddress } = _getEmailState();
  if (fromAddress === null) {
    console.warn("[email] SendGrid not configured — skipping admin alert", { subject });
    return;
  }
  const adminTo = fromAddress.email;
  const html = `
    <div style="font-family:monospace;max-width:700px;margin:0 auto;">
      <h2 style="color:#c0392b;">⚠ Admin Alert</h2>
      <pre style="background:#1a1a2e;color:#e8e8e8;padding:16px;border-radius:6px;white-space:pre-wrap;word-break:break-word;">${body}</pre>
    </div>`;
  await _dispatch(adminTo, `[ADMIN] ${subject}`, html);
}

/**
 * Send a fully custom email with arbitrary HTML — admin catch-all.
 */
export async function sendCustomEmail(
  to: string,
  subject: string,
  htmlContent: string
): Promise<void> {
  await _dispatch(to, subject, htmlContent);
}
