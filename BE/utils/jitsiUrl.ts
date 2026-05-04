const MOBILE_WEB_OVERRIDES = [
    "config.disableDeepLinking=true",
    "config.deeplinking.disabled=true",
    "interfaceConfig.MOBILE_APP_PROMO=true",
];

export const appendJitsiMobileWebOverrides = (
    url: string,
    returnUrl?: string,
    whiteboardEnabled: boolean = true,
): string => {
    const base = String(url || "").trim();
    if (!base) return base;
    const overrides = [
        ...MOBILE_WEB_OVERRIDES,
        `config.whiteboard.enabled=${whiteboardEnabled ? "true" : "false"}`,
    ];
    const normalizedReturnUrl = String(returnUrl || "").trim();
    if (normalizedReturnUrl) {
        // Let server-side close-page config handle post-hangup redirect.
        overrides.push(`config.welcomePage.customUrl=${encodeURIComponent(normalizedReturnUrl)}`);
    }
    const hash = overrides.join("&");
    if (!base.includes("#")) return `${base}#${hash}`;
    if (base.endsWith("#")) return `${base}${hash}`;
    return `${base}&${hash}`;
};

