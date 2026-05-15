(function () {
  /*
   * POST /api/meeting/end-call when user leaves Jitsi (Bearer meeting-chat JWT).
   * Uses same sessionStorage keys as wisdomlinked-meeting-chat-sync.js.
   */
  var STORAGE_MEETING = "wlMeetingChatMeetingId";
  var STORAGE_TOKEN = "wlMeetingChatSyncToken";
  var STORAGE_API = "wlMeetingChatSyncApiBase";
  var endedMeetings = Object.create(null);

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

  function endCallOnce() {
    var cfg = readConfig();
    if (!cfg.meetingThreadId || !cfg.token || !cfg.apiBase) return;
    if (endedMeetings[cfg.meetingThreadId]) return;
    endedMeetings[cfg.meetingThreadId] = 1;
    var url = String(cfg.apiBase).replace(/\/$/, "") + "/api/meeting/end-call";
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.token,
      },
      body: JSON.stringify({ meetingThreadId: cfg.meetingThreadId }),
      credentials: "omit",
      keepalive: true,
    }).catch(function () {});
  }

  function hookConferenceLeave() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.conference) return;
      if (app.conference._wlEndHooked) return;
      app.conference._wlEndHooked = true;
      app.conference.addListener("readyToClose", endCallOnce);
      app.conference.addListener("videoConferenceLeft", endCallOnce);
    } catch (e) {}
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("pagehide", endCallOnce);
    window.addEventListener("beforeunload", endCallOnce);
    window.setInterval(function () {
      readConfig();
      hookConferenceLeave();
    }, 1500);
  }
})();
