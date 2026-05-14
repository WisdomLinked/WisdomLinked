(function () {
  /*
   * WisdomLinked — mirror Jitsi in-meeting **text** chat to WisdomLinked Messenger (Rocket.Chat).
   *
   * Deploy like `wisdomlinked-copy-meeting-id.js` (mounted custom web on the Jitsi host).
   * Requires the meet URL hash to include (set by the WisdomLinked backend):
   *   - config.wisdomlinkedMeetingId
   *   - config.wisdomlinkedChatSyncToken  (JWT from GET join / guest resolve / start)
   *   - config.wisdomlinkedChatSyncApiBase  (API origin, e.g. https://app.example.com — no trailing slash)
   *
   * Only messages considered “local own” are posted (one POST per line from the sender’s tab).
   * Polls and non-text chat features are not captured (see jitsi/MEETING_CHAT_HOOKS.md).
   */
  var STORAGE_MEETING = "wlMeetingChatMeetingId";
  var STORAGE_TOKEN = "wlMeetingChatSyncToken";
  var STORAGE_API = "wlMeetingChatSyncApiBase";
  var seenMessageIds = Object.create(null);
  var baselineDone = false;

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

  function persistFromHash() {
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
  }

  function readConfig() {
    persistFromHash();
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

  function pickChatMessages(state) {
    if (!state || typeof state !== "object") return [];
    var chat = state["features/chat"];
    if (!chat || typeof chat !== "object") return [];
    if (Array.isArray(chat.messages)) return chat.messages;
    if (chat.messages && typeof chat.messages === "object") return Object.values(chat.messages);
    if (Array.isArray(chat.messageList)) return chat.messageList;
    if (Array.isArray(chat.recent)) return chat.recent;
    return [];
  }

  function textFromMessage(m) {
    if (!m || typeof m !== "object") return "";
    var t = m.message || m.messageText || m.body || m.content || "";
    if (typeof t !== "string") t = String(t);
    return t.replace(/\s+/g, " ").trim();
  }

  function messageDedupeKey(m, idx) {
    if (!m || typeof m !== "object") return "";
    var id = m.messageId || m.id || m.stamp || m.timestamp || "";
    var txt = textFromMessage(m);
    return String(id) + "|" + txt + "|" + String(idx);
  }

  function isLikelyOwnMessage(m) {
    if (!m || typeof m !== "object") return false;
    if (m.messageType === "error") return false;
    if (m.lobbyChat === true || m.privateMessage === true) return false;
    if (m.own === true || m.isOwn === true) return true;
    /* jitsi-meet Redux IMessage uses messageType "local" | "remote" | "error" (not isOwn). */
    if (m.messageType === "local") return true;
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      var getId =
        app &&
        app.conference &&
        (app.conference.getParticipantId || app.conference._getParticipantId);
      var localId = typeof getId === "function" ? getId.call(app.conference) : "";
      var mid =
        m.participantId ||
        m.fromId ||
        (m.participant && (m.participant.id || m.participant._id)) ||
        m.userId;
      if (localId && mid && String(localId) === String(mid)) return true;
    } catch (e) {}
    return false;
  }

  function postSync(content) {
    var cfg = readConfig();
    if (!cfg.meetingThreadId || !cfg.token || !cfg.apiBase || !content) return;
    var url = String(cfg.apiBase).replace(/\/$/, "") + "/api/meeting/chat-sync";
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.token,
      },
      body: JSON.stringify({ meetingThreadId: cfg.meetingThreadId, content: content }),
      credentials: "omit",
    }).catch(function () {});
  }

  function scanStoreOnce() {
    var cfg = readConfig();
    if (!cfg.token || !cfg.meetingThreadId) return;
    var app = typeof APP !== "undefined" ? APP : null;
    if (!app || !app.store || typeof app.store.getState !== "function") return;
    var state = app.store.getState();
    var msgs = pickChatMessages(state);
    var i;
    if (!baselineDone) {
      for (i = 0; i < msgs.length; i++) {
        if (!isLikelyOwnMessage(msgs[i])) continue;
        var kb = messageDedupeKey(msgs[i], i);
        if (kb) seenMessageIds[kb] = 1;
      }
      baselineDone = true;
      return;
    }
    for (i = 0; i < msgs.length; i++) {
      var m = msgs[i];
      if (!isLikelyOwnMessage(m)) continue;
      if (m.isReaction === true) continue;
      var txt = textFromMessage(m);
      if (!txt) continue;
      var k = messageDedupeKey(m, i);
      if (!k) continue;
      if (seenMessageIds[k]) continue;
      seenMessageIds[k] = 1;
      postSync(txt);
    }
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("hashchange", persistFromHash);
    window.addEventListener("load", persistFromHash);
    window.setInterval(function () {
      persistFromHash();
      scanStoreOnce();
    }, 1200);
    persistFromHash();
  }
})();
