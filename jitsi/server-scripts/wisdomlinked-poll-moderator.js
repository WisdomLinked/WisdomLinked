(function () {
  /*
   * Restrict Jitsi in-call poll creation to WisdomLinked meeting moderators only.
   * Guests and students may vote on polls but cannot create them.
   * Authoritative: GET /api/meeting/permissions → canCreatePoll (same policy as whiteboard).
   */
  var STORAGE_MEETING = "wlMeetingChatMeetingId";
  var STORAGE_TOKEN = "wlMeetingChatSyncToken";
  var STORAGE_API = "wlMeetingChatSyncApiBase";
  var STORAGE_POLL = "wlCanCreatePoll";
  var STYLE_ID = "wl-poll-create-restrict-style";
  var PERMISSIONS_POLL_MS = 5000;
  var lastCanCreate = null;

  function hashValue(name) {
    var raw = window.location.hash ? window.location.hash.slice(1) : "";
    if (!raw) return "";
    return raw.split("&").reduce(function (found, part) {
      if (found) return found;
      var idx = part.indexOf("=");
      var key = idx >= 0 ? part.slice(0, idx) : part;
      if (key !== name) return "";
      var value = idx >= 0 ? part.slice(idx + 1) : "";
      try {
        return decodeURIComponent(value.replace(/\+/g, " "));
      } catch (e) {
        return value;
      }
    }, "");
  }

  function debugEnabled() {
    return hashValue("config.wisdomlinkedPollDebug") === "true";
  }

  function wlDebug() {
    if (!debugEnabled() || typeof console === "undefined" || !console.debug) return;
    console.debug.apply(console, ["[wl-poll]"].concat([].slice.call(arguments)));
  }

  function readConfig() {
    var mid = hashValue("config.wisdomlinkedMeetingId") || "";
    var tok = hashValue("config.wisdomlinkedChatSyncToken") || "";
    var api = hashValue("config.wisdomlinkedChatSyncApiBase") || "";
    if (mid) {
      try {
        window.sessionStorage.setItem(STORAGE_MEETING, mid);
      } catch (e) {}
    }
    if (tok) {
      try {
        window.sessionStorage.setItem(STORAGE_TOKEN, tok);
      } catch (e) {}
    }
    if (api) {
      try {
        window.sessionStorage.setItem(STORAGE_API, api);
      } catch (e) {}
    }
    return {
      meetingThreadId: (function () {
        try {
          return window.sessionStorage.getItem(STORAGE_MEETING) || "";
        } catch (e) {
          return "";
        }
      })(),
      token: (function () {
        try {
          return window.sessionStorage.getItem(STORAGE_TOKEN) || "";
        } catch (e) {
          return "";
        }
      })(),
      apiBase: (function () {
        try {
          return window.sessionStorage.getItem(STORAGE_API) || "";
        } catch (e) {
          return "";
        }
      })(),
    };
  }

  function persistModeratorFromHash() {
    var modHash = hashValue("config.wisdomlinkedIsMeetingModerator");
    if (modHash === "true") {
      try {
        window.sessionStorage.setItem(STORAGE_POLL, "1");
      } catch (e) {}
    } else if (modHash === "false") {
      try {
        window.sessionStorage.setItem(STORAGE_POLL, "0");
      } catch (e) {}
    }
  }

  function canCreatePollFromStorage() {
    persistModeratorFromHash();
    try {
      var v = window.sessionStorage.getItem(STORAGE_POLL);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch (e) {}
    return false;
  }

  function ensureRestrictStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent =
      'html[data-wl-can-create-poll="0"] [aria-label*="Create poll" i],' +
      'html[data-wl-can-create-poll="0"] [aria-label*="Create a poll" i],' +
      'html[data-wl-can-create-poll="0"] [data-testid*="create-poll" i],' +
      'html[data-wl-can-create-poll="0"] [data-testid*="polls-pane.create" i],' +
      'html[data-wl-can-create-poll="0"] .polls-create-button,' +
      'html[data-wl-can-create-poll="0"] .polls-panel-create {' +
      "display: none !important; pointer-events: none !important; visibility: hidden !important;" +
      "}";
    (document.head || document.documentElement).appendChild(style);
  }

  function hideCreatePollControls() {
    if (canCreatePollFromStorage()) return;
    ensureRestrictStyle();
    document.documentElement.setAttribute("data-wl-can-create-poll", "0");

    var candidates = document.querySelectorAll("button, [role='button'], a");
    for (var i = 0; i < candidates.length; i++) {
      var el = candidates[i];
      if (!el || el.getAttribute("data-wl-poll-hidden") === "1") continue;
      var label = (
        (el.getAttribute("aria-label") || "") +
        " " +
        (el.getAttribute("title") || "") +
        " " +
        (el.textContent || "")
      ).toLowerCase();
      if (
        label.indexOf("create poll") >= 0 ||
        label.indexOf("create a poll") >= 0 ||
        label.indexOf("new poll") >= 0
      ) {
        el.setAttribute("data-wl-poll-hidden", "1");
        el.style.display = "none";
        el.style.pointerEvents = "none";
        el.setAttribute("aria-hidden", "true");
        if (el.disabled !== undefined) el.disabled = true;
      }
    }
  }

  function applyCanCreatePoll(canCreate) {
    try {
      window.sessionStorage.setItem(STORAGE_POLL, canCreate ? "1" : "0");
    } catch (e) {}
    document.documentElement.setAttribute("data-wl-can-create-poll", canCreate ? "1" : "0");
    if (lastCanCreate !== canCreate) {
      wlDebug("canCreatePoll", canCreate);
      lastCanCreate = canCreate;
    }
    if (!canCreate) hideCreatePollControls();
  }

  function pollPermissions() {
    var cfg = readConfig();
    if (!cfg.meetingThreadId || !cfg.token || !cfg.apiBase) return;
    var url =
      String(cfg.apiBase).replace(/\/$/, "") +
      "/api/meeting/permissions?meetingThreadId=" +
      encodeURIComponent(cfg.meetingThreadId);
    fetch(url, {
      method: "GET",
      headers: { Authorization: "Bearer " + cfg.token },
      credentials: "omit",
    })
      .then(function (res) {
        if (!res || !res.ok) return null;
        return res.json();
      })
      .then(function (data) {
        if (!data) return;
        var canCreate =
          typeof data.canCreatePoll === "boolean"
            ? data.canCreatePoll
            : typeof data.canDrawWhiteboard === "boolean"
              ? data.canDrawWhiteboard
              : false;
        applyCanCreatePoll(canCreate);
      })
      .catch(function () {});
  }

  function installDomObserver() {
    if (typeof MutationObserver === "undefined") return;
    var obs = new MutationObserver(function () {
      if (!canCreatePollFromStorage()) hideCreatePollControls();
    });
    obs.observe(document.documentElement, { childList: true, subtree: true });
  }

  function init() {
    ensureRestrictStyle();
    persistModeratorFromHash();
    if (!canCreatePollFromStorage()) {
      document.documentElement.setAttribute("data-wl-can-create-poll", "0");
      hideCreatePollControls();
    }
    installDomObserver();
    pollPermissions();
    window.setInterval(pollPermissions, PERMISSIONS_POLL_MS);
    window.setInterval(function () {
      if (!canCreatePollFromStorage()) hideCreatePollControls();
    }, 2000);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
