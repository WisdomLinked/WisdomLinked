const LEGACY_APP_BASE_URL = "https://wisdomlinked.com";

export const resolveAppBaseUrl = (env: Record<string, string | undefined> = process.env): string => {
    const configured = String(
        env.FRONTEND_BASE_URL || env.FE_URL || env.REACT_APP_URL || "",
    )
        .trim()
        .replace(/\/+$/, "");
    return configured || LEGACY_APP_BASE_URL;
};

export const appAssetUrl = (
    path: string,
    env: Record<string, string | undefined> = process.env,
): string => `${resolveAppBaseUrl(env)}/${String(path || "").replace(/^\/+/, "")}`;
