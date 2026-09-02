const TRUSTED_HOST_ENV_KEYS = [
  "REACT_APP_API_BASE_URL",
  "REACT_APP_SERVER_URL",
  "REACT_APP_DO_SPACES_ENDPOINT",
  "REACT_APP_S3_PUBLIC_BASE_URL",
];

const hostFromValue = (value: unknown): string => {
  const raw = String(value ?? "").trim();
  if (!raw) return "";
  try {
    const withProtocol = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    return new URL(withProtocol).host.toLowerCase();
  } catch {
    return "";
  }
};

const trustedHosts = (): Set<string> => {
  const out = new Set<string>();
  if (typeof window !== "undefined") out.add(window.location.host.toLowerCase());
  TRUSTED_HOST_ENV_KEYS.forEach((key) => {
    const host = hostFromValue(process.env[key]);
    if (host) out.add(host);
  });
  return out;
};

export function resolveSafeChatFileUrl(raw: unknown): string | null {
  const value = String(raw ?? "").trim();
  if (!value) return null;
  if (value.startsWith("/")) return value;

  try {
    const url = new URL(value, typeof window !== "undefined" ? window.location.origin : undefined);
    if (!["http:", "https:"].includes(url.protocol)) return null;
    const host = url.host.toLowerCase();
    const allowed = trustedHosts();
    if (!allowed.has(host) && !host.endsWith(".digitaloceanspaces.com")) return null;
    return url.href;
  } catch {
    return null;
  }
}
