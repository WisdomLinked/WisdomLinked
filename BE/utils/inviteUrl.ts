const normalizeBase = (base: string): string => String(base || "").trim().replace(/\/$/, "");

export const resolvePublicAppBaseUrl = (
    configuredBaseUrl: string,
    headers?: { origin?: string; host?: string; xForwardedHost?: string; xForwardedProto?: string },
): string => {
    const configured = normalizeBase(configuredBaseUrl);
    if (configured) return configured;

    const origin = normalizeBase(String(headers?.origin || ""));
    if (origin) return origin;

    const host = String(headers?.xForwardedHost || headers?.host || "").trim();
    if (!host) return "";
    const proto = String(headers?.xForwardedProto || "").trim() || "https";
    return `${proto}://${host}`.replace(/\/$/, "");
};

export const buildMeetingInviteUrl = (baseUrl: string, token: string): string => {
    const path = `/meeting/invite/${encodeURIComponent(String(token || "").trim())}`;
    const base = normalizeBase(baseUrl);
    return base ? `${base}${path}` : path;
};

