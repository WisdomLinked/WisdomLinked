const MOBILE_WEB_OVERRIDES = [
    "config.disableDeepLinking=true",
    "config.deeplinking.disabled=true",
    "interfaceConfig.MOBILE_APP_PROMO=true",
    "config.whiteboard.enabled=true",
];

export const appendJitsiMobileWebOverrides = (url: string, returnUrl?: string): string => {
    const base = String(url || "").trim();
    if (!base) return base;
    const overrides = [...MOBILE_WEB_OVERRIDES];
    const normalizedReturnUrl = String(returnUrl || "").trim();
    if (normalizedReturnUrl) {
        // Prefer app fallback instead of landing on Jitsi home after hangup.
        overrides.push("config.enableClosePage=false");
        overrides.push(`config.welcomePage.customUrl=${encodeURIComponent(normalizedReturnUrl)}`);
    }
    const hash = overrides.join("&");
    if (!base.includes("#")) return `${base}#${hash}`;
    if (base.endsWith("#")) return `${base}${hash}`;
    return `${base}&${hash}`;
};

