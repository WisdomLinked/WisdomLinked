const MOBILE_WEB_OVERRIDES = [
    "config.disableDeepLinking=true",
    "config.deeplinking.disabled=true",
    // We use app-managed guest invites; hide Jitsi's native invite actions.
    "config.disableInviteFunctions=true",
    // Hide meeting password/security entry points; WL does not use room passwords.
    "config.securityUi.enabled=false",
    // Older interface flag to hide "invite more" affordance in some builds.
    "interfaceConfig.HIDE_INVITE_MORE_HEADER=true",
    "interfaceConfig.MOBILE_APP_PROMO=true",
];

export const appendJitsiMobileWebOverrides = (
    url: string,
    returnUrl?: string,
    whiteboardEnabled: boolean = true,
    wisdomlinkedMeetingId?: string,
    wisdomlinkedChatSyncToken?: string,
    wisdomlinkedChatSyncApiBase?: string,
    wisdomlinkedWhiteboardInitials?: string,
    wisdomlinkedIsMeetingModerator?: boolean,
    wisdomlinkedMessengerOrigin?: string,
): string => {
    const base = String(url || "").trim();
    if (!base) return base;
    const overrides = [
        ...MOBILE_WEB_OVERRIDES,
        `config.whiteboard.enabled=${whiteboardEnabled ? "true" : "false"}`,
    ];
    const meetingId = String(wisdomlinkedMeetingId || "").trim();
    if (meetingId) {
        overrides.push(`config.wisdomlinkedMeetingId=${encodeURIComponent(meetingId)}`);
    }
    const chatTok = String(wisdomlinkedChatSyncToken || "").trim();
    if (chatTok) {
        overrides.push(`config.wisdomlinkedChatSyncToken=${encodeURIComponent(chatTok)}`);
    }
    const apiBase = String(wisdomlinkedChatSyncApiBase || "").trim();
    if (apiBase) {
        overrides.push(`config.wisdomlinkedChatSyncApiBase=${encodeURIComponent(apiBase)}`);
    }
    const wbInitials = String(wisdomlinkedWhiteboardInitials || "").trim();
    if (wbInitials) {
        overrides.push(`config.wisdomlinkedWhiteboardInitials=${encodeURIComponent(wbInitials)}`);
    }
    if (typeof wisdomlinkedIsMeetingModerator === "boolean") {
        overrides.push(
            `config.wisdomlinkedIsMeetingModerator=${wisdomlinkedIsMeetingModerator ? "true" : "false"}`,
        );
    }
    const messengerOrigin = String(wisdomlinkedMessengerOrigin || "").trim();
    if (messengerOrigin) {
        overrides.push(`config.wisdomlinkedMessengerOrigin=${encodeURIComponent(messengerOrigin)}`);
    }
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

