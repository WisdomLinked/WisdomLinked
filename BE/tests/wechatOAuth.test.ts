import test from "node:test";
import assert from "node:assert/strict";

const {
  buildWeChatAuthUrl,
  exchangeCodeForUser,
  findOrCreateWeChatUser,
  isWeChatPlaceholderEmail,
  parseWeChatEmailBind,
  resolveWeChatDefaultRole,
  isOAuthProfileIncomplete,
  needsOAuthRolePick,
  buildOAuthCallbackParams,
} = require("../services/wechatOAuth");

// fetch stub that returns a queue of JSON bodies (WeChat replies 200 + JSON text).
function fakeFetch(bodies: any[]) {
  let i = 0;
  return async (_url: string) => ({
    text: async () => JSON.stringify(bodies[i++]),
  });
}

// A stand-in for the Mongoose User model: constructable + static findOne.
function makeFakeUserModel(existing: any) {
  const created: any[] = [];
  function FakeUser(this: any, doc: any) {
    Object.assign(this, doc);
    this._id = "fake-user-id";
    this.save = async () => this;
    created.push(this);
  }
  (FakeUser as any).findOne = async () => existing;
  (FakeUser as any)._created = created;
  return FakeUser as any;
}

test("isWeChatPlaceholderEmail detects synthetic addresses only", () => {
  assert.equal(isWeChatPlaceholderEmail("wechat_abc@wechat.local"), true);
  assert.equal(isWeChatPlaceholderEmail("WECHAT_ABC@WECHAT.LOCAL"), true);
  assert.equal(isWeChatPlaceholderEmail("real@gmail.com"), false);
  assert.equal(isWeChatPlaceholderEmail(""), false);
  assert.equal(isWeChatPlaceholderEmail(null), false);
});

test("parseWeChatEmailBind skips non-placeholder accounts and empty input", () => {
  assert.deepEqual(parseWeChatEmailBind("real@gmail.com", "other@gmail.com"), { action: "skip" });
  assert.deepEqual(parseWeChatEmailBind("wechat_x@wechat.local", ""), { action: "skip" });
  assert.deepEqual(parseWeChatEmailBind("wechat_x@wechat.local", "   "), { action: "skip" });
  assert.deepEqual(parseWeChatEmailBind("wechat_x@wechat.local", "wechat_y@wechat.local"), {
    action: "skip",
  });
});

test("parseWeChatEmailBind validates and normalizes a real email for placeholder accounts", () => {
  assert.deepEqual(parseWeChatEmailBind("wechat_x@wechat.local", "Warren18522@yahoo.com"), {
    action: "bind",
    newEmail: "warren18522@yahoo.com",
  });
  const invalid = parseWeChatEmailBind("wechat_x@wechat.local", "not-an-email");
  assert.equal(invalid.action, "invalid");
  assert.match(invalid.error, /valid email/i);
});

test("resolveWeChatDefaultRole maps register roles and defaults login to customer", () => {
  assert.equal(resolveWeChatDefaultRole("expert"), "expert");
  assert.equal(resolveWeChatDefaultRole("customer"), "customer");
  assert.equal(resolveWeChatDefaultRole("login"), "customer");
  assert.equal(resolveWeChatDefaultRole(null), "customer");
});

test("needsOAuthRolePick is only true for brand-new WeChat users from login", () => {
  assert.equal(needsOAuthRolePick(true, "login", "wechat"), true);
  assert.equal(needsOAuthRolePick(true, null, "wechat"), true);
  assert.equal(needsOAuthRolePick(true, "customer", "wechat"), false);
  assert.equal(needsOAuthRolePick(true, "expert", "wechat"), false);
  assert.equal(needsOAuthRolePick(false, "login", "wechat"), false);
  assert.equal(needsOAuthRolePick(true, "login", "google"), false);
});

test("buildOAuthCallbackParams adds needsRole and needsProfile flags for login signup", () => {
  const params = buildOAuthCallbackParams({
    token: "jwt-token",
    userRole: "customer",
    isNew: true,
    roleFromState: "login",
    oauthProvider: "wechat",
    isProfileIncomplete: true,
    redirectPath: "/foo",
  });
  assert.equal(params.get("token"), "jwt-token");
  assert.equal(params.get("role"), "customer");
  assert.equal(params.get("needsRole"), "true");
  assert.equal(params.get("needsProfile"), "true");
  assert.equal(params.get("redirect"), "/foo");
});

test("buildOAuthCallbackParams skips needsRole for expert register", () => {
  const params = buildOAuthCallbackParams({
    token: "jwt-token",
    userRole: "expert",
    isNew: true,
    roleFromState: "expert",
    oauthProvider: "wechat",
    isProfileIncomplete: true,
  });
  assert.equal(params.get("needsRole"), null);
  assert.equal(params.get("needsProfile"), "true");
  assert.equal(params.get("role"), "expert");
});

test("buildOAuthCallbackParams skips profile flags for returning users", () => {
  const params = buildOAuthCallbackParams({
    token: "jwt-token",
    userRole: "customer",
    isNew: false,
    roleFromState: "login",
    oauthProvider: "wechat",
    isProfileIncomplete: false,
  });
  assert.equal(params.get("needsRole"), null);
  assert.equal(params.get("needsProfile"), null);
});

test("isOAuthProfileIncomplete requires real email and role-specific fields", () => {
  const base = {
    email: "wechat_x@wechat.local",
    keywords: ["k1"],
    services: ["s1"],
    title: "Dr",
    description: "Bio long enough",
  };
  assert.equal(isOAuthProfileIncomplete(base), true);

  const customerReady = {
    email: "student@gmail.com",
    role: "customer",
    keywords: ["k1"],
    services: ["s1"],
  };
  assert.equal(isOAuthProfileIncomplete(customerReady), false);

  const expertMissingBio = {
    email: "expert@gmail.com",
    role: "expert",
    keywords: ["k1"],
    services: ["s1"],
    title: "Dr",
    description: "",
  };
  assert.equal(isOAuthProfileIncomplete(expertMissingBio), true);

  const expertReady = {
    ...expertMissingBio,
    description: "I help students with aerospace applications and interviews.",
  };
  assert.equal(isOAuthProfileIncomplete(expertReady), false);
});

test("buildWeChatAuthUrl builds a qrconnect URL with encoded callback + state", () => {
  const prevApp = process.env.WECHAT_APP_ID;
  const prevFe = process.env.FE_URL;
  process.env.WECHAT_APP_ID = "wx_test_appid";
  process.env.FE_URL = "https://staging.wisdomlinked.com";

  const url = buildWeChatAuthUrl("STATE123");
  assert.ok(url.startsWith("https://open.weixin.qq.com/connect/qrconnect?"));
  assert.ok(url.includes("appid=wx_test_appid"));
  assert.ok(url.includes("response_type=code"));
  assert.ok(url.includes("scope=snsapi_login"));
  assert.ok(url.includes("state=STATE123"));
  assert.ok(url.endsWith("#wechat_redirect"));
  // redirect_uri is URL-encoded and points at the BE callback.
  assert.ok(
    url.includes(
      "redirect_uri=" +
        encodeURIComponent("https://staging.wisdomlinked.com/api/auth/wechat/callback"),
    ),
  );

  process.env.WECHAT_APP_ID = prevApp;
  process.env.FE_URL = prevFe;
});

test("exchangeCodeForUser prefers unionid and returns profile fields", async () => {
  const fetchFn = fakeFetch([
    { access_token: "tok", openid: "openid_1" },
    { openid: "openid_1", unionid: "union_1", nickname: "小明", headimgurl: "https://wx.example/a.png" },
  ]);

  const profile = await exchangeCodeForUser("the_code", { fetchFn });
  assert.equal(profile.oauthId, "union_1"); // unionid preferred over openid
  assert.equal(profile.nickname, "小明");
  assert.equal(profile.headimgurl, "https://wx.example/a.png");
});

test("exchangeCodeForUser falls back to openid when no unionid", async () => {
  const fetchFn = fakeFetch([
    { access_token: "tok", openid: "openid_2" },
    { openid: "openid_2", nickname: "No Union", headimgurl: "" },
  ]);
  const profile = await exchangeCodeForUser("code2", { fetchFn });
  assert.equal(profile.oauthId, "openid_2");
});

test("exchangeCodeForUser throws on access_token errcode", async () => {
  const fetchFn = fakeFetch([{ errcode: 40029, errmsg: "invalid code" }]);
  await assert.rejects(() => exchangeCodeForUser("bad", { fetchFn }), /40029/);
});

test("exchangeCodeForUser throws on userinfo errcode", async () => {
  const fetchFn = fakeFetch([
    { access_token: "tok", openid: "openid_3" },
    { errcode: 40003, errmsg: "invalid openid" },
  ]);
  await assert.rejects(() => exchangeCodeForUser("code3", { fetchFn }), /40003/);
});

test("findOrCreateWeChatUser returns existing user (isNew=false) when oauthId matches", async () => {
  const existing = { _id: "u1", email: "real@gmail.com", oauthProvider: "wechat", oauthId: "union_1" };
  let photoImported = false;
  const UserModel = makeFakeUserModel(existing);

  const result = await findOrCreateWeChatUser(
    { oauthId: "union_1", nickname: "x", headimgurl: "https://wx/p.png" },
    {
      UserModel,
      importPhoto: async () => { photoImported = true; },
    },
  );

  assert.equal(result.isNew, false);
  assert.equal(result.user, existing);
  assert.equal(photoImported, true);
  assert.equal(UserModel._created.length, 0); // nothing created
});

test("findOrCreateWeChatUser creates a placeholder-email user (isNew=true) and runs side effects", async () => {
  const UserModel = makeFakeUserModel(null); // no existing user
  let chatUserId: any = null;
  let approvalUsername = "";
  let photoUrl = "";

  const result = await findOrCreateWeChatUser(
    { oauthId: "union_new", nickname: "Jane", headimgurl: "https://wx/jane.png" },
    {
      UserModel,
      importPhoto: async (_u: any, url: string) => { photoUrl = url; },
      createGeneralChat: async (id: any) => { chatUserId = id; },
      sendApprovalEmail: (name: string) => { approvalUsername = name; },
    },
  );

  assert.equal(result.isNew, true);
  assert.equal(result.user.oauthProvider, "wechat");
  assert.equal(result.user.oauthId, "union_new");
  assert.equal(result.user.email, "wechat_union_new@wechat.local"); // synthetic placeholder
  assert.equal(result.user.username, "Jane");
  assert.equal(result.user.role, "customer");
  assert.equal(result.user.status, "review");
  // side effects fired
  assert.equal(chatUserId, "fake-user-id");
  assert.equal(approvalUsername, "Jane");
  assert.equal(photoUrl, "https://wx/jane.png");
});

test("findOrCreateWeChatUser creates expert when defaultRole is expert", async () => {
  const UserModel = makeFakeUserModel(null);
  const result = await findOrCreateWeChatUser(
    { oauthId: "union_expert", nickname: "Expert", headimgurl: "" },
    {
      UserModel,
      importPhoto: async () => {},
      createGeneralChat: async () => {},
      sendApprovalEmail: () => {},
      defaultRole: "expert",
    },
  );
  assert.equal(result.user.role, "expert");
});

test("findOrCreateWeChatUser falls back to 'WeChat User' when nickname is empty", async () => {
  const UserModel = makeFakeUserModel(null);
  const result = await findOrCreateWeChatUser(
    { oauthId: "u_noname", nickname: "", headimgurl: "" },
    { UserModel, importPhoto: async () => {}, createGeneralChat: async () => {}, sendApprovalEmail: () => {} },
  );
  assert.equal(result.user.username, "WeChat User");
});
