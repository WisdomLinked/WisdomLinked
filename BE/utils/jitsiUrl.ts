const MOBILE_WEB_OVERRIDES = [
    "config.disableDeepLinking=true",
    "config.deeplinking.disabled=true",
    "interfaceConfig.MOBILE_APP_PROMO=true",
];

export const appendJitsiMobileWebOverrides = (url: string): string => {
    const base = String(url || "").trim();
    if (!base) return base;
    const hash = MOBILE_WEB_OVERRIDES.join("&");
    if (!base.includes("#")) return `${base}#${hash}`;
    if (base.endsWith("#")) return `${base}${hash}`;
    return `${base}&${hash}`;
};

