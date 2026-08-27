const SENSITIVE_KEY = /^(token|accesstoken|refreshtoken|idtoken|jwt|password|passwd|secret|client_secret|clientsecret|apikey|api_key|authorization|auth|credential|credentials|privatekey|private_key)$/i;

export function stripSensitiveFields<T>(value: T, depth = 0): T {
  if (depth > 6 || value == null || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    return value.map((v) => stripSensitiveFields(v, depth + 1)) as unknown as T;
  }
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    if (SENSITIVE_KEY.test(k)) continue;
    out[k] = stripSensitiveFields(v, depth + 1);
  }
  return out as unknown as T;
}

export function persistUserDetails(storage: Storage, key: string, user: unknown): void {
  storage.setItem(key, JSON.stringify(stripSensitiveFields(user)));
}

export interface PendingBookingDetails {
  kind?: string;
  groupChatId?: string;
  /** Seat request being settled — wallets always redirect, so this must survive. */
  requestId?: string;
  requiresApproval?: boolean;
  paymentMode?: string;
  expert?: string;
  name?: string;
  description?: string;
  services?: string[];
  purposeOther?: string;
  start?: string;
  end?: string;
  duration?: number;
  price?: number;
}

const str = (v: unknown): string | undefined => (v == null ? undefined : String(v));
const num = (v: unknown): number | undefined => {
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
};

export function sanitizePendingDetails(details: unknown): PendingBookingDetails {
  const d = (details ?? {}) as Record<string, unknown>;
  const out: PendingBookingDetails = {};
  if (d.kind != null) out.kind = str(d.kind);
  if (d.groupChatId != null) out.groupChatId = str(d.groupChatId);
  if (d.requestId != null) out.requestId = str(d.requestId);
  if (d.requiresApproval != null) out.requiresApproval = !!d.requiresApproval;
  if (d.paymentMode != null) out.paymentMode = d.paymentMode === 'wallet' ? 'wallet' : 'card';
  if (d.expert != null) out.expert = str(d.expert);
  if (d.name != null) out.name = str(d.name);
  if (d.description != null) out.description = str(d.description);
  if (Array.isArray(d.services)) out.services = d.services.map((s) => String(s));
  if (d.purposeOther != null) out.purposeOther = str(d.purposeOther);
  if (d.start != null) out.start = str(d.start);
  if (d.end != null) out.end = str(d.end);
  if (d.duration != null) out.duration = num(d.duration);
  if (d.price != null) out.price = num(d.price);
  return out;
}

export function persistPendingDetails(storage: Storage, details: unknown): void {
  storage.setItem('pendingDetails', JSON.stringify(sanitizePendingDetails(details)));
}
