// WeChat website (QR / web) OAuth — server-side flow.
//
// WeChat does NOT use a passport strategy here; it is two plain HTTP calls:
//   1. exchange `code` -> access_token (+ openid / unionid)
//   2. fetch userinfo (nickname, headimgurl, unionid)
// We then find-or-create a local user keyed on oauthProvider:'wechat' + oauthId.
//
// WeChat returns no email, but the app's auth/session layer is email-keyed
// (JWT { email }, requireAuth/getMe look up by email). So new WeChat users are
// created with a synthetic placeholder email (wechat_<oauthId>@wechat.local) and
// sent to the complete-profile / bind-email step to add a real email later.

const WECHAT_QRCONNECT_URL = "https://open.weixin.qq.com/connect/qrconnect";
const WECHAT_ACCESS_TOKEN_URL = "https://api.weixin.qq.com/sns/oauth2/access_token";
const WECHAT_USERINFO_URL = "https://api.weixin.qq.com/sns/userinfo";

const WECHAT_PLACEHOLDER_EMAIL_DOMAIN = "wechat.local";

export type WeChatProfile = {
  oauthId: string;
  nickname: string;
  headimgurl: string;
};

type FindOrCreateDeps = {
  UserModel?: any;
  importPhoto?: (user: any, url: string | null | undefined) => Promise<unknown>;
  createGeneralChat?: (userId: any) => Promise<unknown>;
  sendApprovalEmail?: (username: string) => unknown;
  /** customer | expert — only applied when creating a new user */
  defaultRole?: "customer" | "expert";
};

// True for emails minted for WeChat-only accounts that still need a real email.
export function isWeChatPlaceholderEmail(email: string | undefined | null): boolean {
  return String(email || "").toLowerCase().endsWith(`@${WECHAT_PLACEHOLDER_EMAIL_DOMAIN}`);
}

function wechatPlaceholderEmail(oauthId: string): string {
  return `wechat_${oauthId}@${WECHAT_PLACEHOLDER_EMAIL_DOMAIN}`;
}

// Mirror the OAUTH_BASE logic in config/passport.ts (handles nginx SSL termination).
function oauthBase(): string {
  const feUrl = (process.env.FE_URL || "").replace(/\/$/, "");
  const isLocal = feUrl.includes("localhost") || feUrl.includes("127.0.0.1");
  return isLocal
    ? feUrl
    : feUrl.replace(/:\d+$/, "").replace("http://", "https://");
}

// Build the WeChat QR-connect redirect URL. `state` is already encodeURIComponent'd
// by the route (same as the Google flow); WeChat echoes it back verbatim.
export function buildWeChatAuthUrl(state: string): string {
  const appid = process.env.WECHAT_APP_ID || "";
  const redirectUri = encodeURIComponent(`${oauthBase()}/api/auth/wechat/callback`);
  return (
    `${WECHAT_QRCONNECT_URL}?appid=${appid}` +
    `&redirect_uri=${redirectUri}` +
    `&response_type=code&scope=snsapi_login&state=${state}#wechat_redirect`
  );
}

async function getJson(url: string, fetchFn: typeof fetch): Promise<any> {
  const res = await fetchFn(url, { signal: AbortSignal.timeout(15000) });
  // WeChat returns 200 with a JSON body (sometimes text/plain content-type).
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    throw new Error(`WeChat returned a non-JSON response: ${text.slice(0, 200)}`);
  }
}

// Exchange the OAuth `code` for the user's WeChat profile.
// Throws on WeChat error bodies (errcode/errmsg) from either call.
export async function exchangeCodeForUser(
  code: string,
  deps: { fetchFn?: typeof fetch } = {},
): Promise<WeChatProfile> {
  const fetchFn = deps.fetchFn || globalThis.fetch;
  const appid = process.env.WECHAT_APP_ID || "";
  const secret = process.env.WECHAT_APP_SECRET || "";

  const tokenUrl =
    `${WECHAT_ACCESS_TOKEN_URL}?appid=${encodeURIComponent(appid)}` +
    `&secret=${encodeURIComponent(secret)}` +
    `&code=${encodeURIComponent(code)}&grant_type=authorization_code`;
  const tokenRes = await getJson(tokenUrl, fetchFn);
  if (tokenRes.errcode) {
    throw new Error(`WeChat access_token error ${tokenRes.errcode}: ${tokenRes.errmsg}`);
  }

  const { access_token: accessToken, openid } = tokenRes;
  if (!accessToken || !openid) {
    throw new Error("WeChat access_token response missing access_token/openid");
  }

  const userinfoUrl =
    `${WECHAT_USERINFO_URL}?access_token=${encodeURIComponent(accessToken)}` +
    `&openid=${encodeURIComponent(openid)}&lang=en`;
  const info = await getJson(userinfoUrl, fetchFn);
  if (info.errcode) {
    throw new Error(`WeChat userinfo error ${info.errcode}: ${info.errmsg}`);
  }

  // Prefer unionid (stable across the open platform) over openid (per-app).
  return {
    oauthId: info.unionid || info.openid || openid,
    nickname: info.nickname || "",
    headimgurl: info.headimgurl || "",
  };
}

// Find an existing WeChat user by oauthId, or create a new one with a placeholder email.
// Returns { user, isNew } in the same shape as findOrCreateOAuthUser (config/passport.ts).
export async function findOrCreateWeChatUser(
  profile: WeChatProfile,
  deps: FindOrCreateDeps = {},
): Promise<{ user: any; isNew: boolean }> {
  const User = deps.UserModel || require("../models/User");
  const importPhoto =
    deps.importPhoto || require("./oauthProfilePhoto").importOAuthProfilePhoto;

  let user = await User.findOne({ oauthProvider: "wechat", oauthId: profile.oauthId });
  if (user) {
    await importPhoto(user, profile.headimgurl);
    return { user, isNew: false };
  }

  user = new User({
    email: wechatPlaceholderEmail(profile.oauthId),
    username: profile.nickname || "WeChat User",
    oauthProvider: "wechat",
    oauthId: profile.oauthId,
    role: deps.defaultRole === "expert" ? "expert" : "customer",
    status: "review", // OAuth users still need admin approval
  });
  await user.save();

  // Same new-user side effects as the Google flow (lazy-required to avoid cycles).
  try {
    const createGeneralChat =
      deps.createGeneralChat ||
      require("../controllers/groupChat.controller").createGeneralChatAndJoinGlobalChat;
    await createGeneralChat(user._id);
  } catch (e: any) {
    console.error("[WeChat OAuth] createGeneralChat error:", e.message);
  }

  try {
    const sendApprovalEmail =
      deps.sendApprovalEmail ||
      require("./notifications").sendEmailNewUserAccountApproval;
    sendApprovalEmail(user.username);
  } catch (e: any) {
    console.error("[WeChat OAuth] sendEmail error:", e.message);
  }

  await importPhoto(user, profile.headimgurl);

  return { user, isNew: true };
}

module.exports = {
  buildWeChatAuthUrl,
  exchangeCodeForUser,
  findOrCreateWeChatUser,
  isWeChatPlaceholderEmail,
};
