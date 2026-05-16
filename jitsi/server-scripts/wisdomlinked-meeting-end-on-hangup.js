(function () {
  /*
   * POST /api/meeting/end-call when the last participant hangs up.
   * Uses event-based remoteJoinCount (works when Jitsi live count APIs return -1).
   * Notifies window.opener via postMessage using config.wisdomlinkedMessengerOrigin.
   * Optional: config.wisdomlinkedMeetingEndDebug=true
   */
  var STORAGE_MEETING = "wlMeetingChatMeetingId";
  var STORAGE_TOKEN = "wlMeetingChatSyncToken";
  var STORAGE_API = "wlMeetingChatSyncApiBase";
  var STORAGE_MESSENGER = "wlMeetingMessengerOrigin";
  var STORAGE_ALONE = "wlAloneInRoom";
  var endedMeetings = Object.create(null);
  var remoteJoinCount = 0;
  var conferenceJoined = false;
  var aloneInRoom = false;
  var heartbeatTimer = null;

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
    return hashValue("config.wisdomlinkedMeetingEndDebug") === "true";
  }

  function wlDebug() {
    if (!debugEnabled() || typeof console === "undefined" || !console.debug) return;
    console.debug.apply(console, ["[wl-meeting-end]"].concat([].slice.call(arguments)));
  }

  function messengerOrigin() {
    var fromHash = hashValue("config.wisdomlinkedMessengerOrigin") || "";
    if (fromHash) {
      try {
        window.sessionStorage.setItem(STORAGE_MESSENGER, fromHash);
      } catch (e) {}
      return fromHash;
    }
    try {
      return window.sessionStorage.getItem(STORAGE_MESSENGER) || "";
    } catch (e) {
      return "";
    }
  }

  function notifyOpener(payload) {
    try {
      if (!window.opener || window.opener.closed) return;
      var origin = messengerOrigin();
      if (!origin) {
        var cfg = readConfig();
        try {
          origin = new URL(String(cfg.apiBase || "")).origin;
        } catch (e2) {
          origin = "";
        }
      }
      if (!origin) return;
      window.opener.postMessage(payload, origin);
    } catch (e) {}
  }

  function setAloneInRoom(alone) {
    aloneInRoom = alone;
    try {
      if (alone) {
        window.sessionStorage.setItem(STORAGE_ALONE, "1");
      } else {
        window.sessionStorage.removeItem(STORAGE_ALONE);
      }
    } catch (e) {}
    if (alone) {
      var cfg = readConfig();
      if (cfg.meetingThreadId) {
        notifyOpener({ type: "wl-meeting-alone", meetingThreadId: cfg.meetingThreadId });
      }
    }
  }

  function readConfig() {
    var mid = hashValue("config.wisdomlinkedMeetingId") || "";
    var tok = hashValue("config.wisdomlinkedChatSyncToken") || "";
    var api = hashValue("config.wisdomlinkedChatSyncApiBase") || "";
    var msgOrigin = hashValue("config.wisdomlinkedMessengerOrigin") || "";
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
    if (msgOrigin) {
      try {
        window.sessionStorage.setItem(STORAGE_MESSENGER, msgOrigin);
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

  function isLastParticipantLeaving() {
    if (!conferenceJoined) return false;
    if (remoteJoinCount > 0) return false;
    return aloneInRoom || remoteJoinCount === 0;
  }

  function postEndCall(cfg) {
    var url = String(cfg.apiBase).replace(/\/$/, "") + "/api/meeting/end-call";
    var body = JSON.stringify({
      meetingThreadId: cfg.meetingThreadId,
      endReason: "last_participant",
    });
    return fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.token,
      },
      body: body,
      credentials: "omit",
      keepalive: true,
    });
  }

  function postHeartbeat(cfg) {
    if (!cfg.meetingThreadId || !cfg.token || !cfg.apiBase) return;
    var url = String(cfg.apiBase).replace(/\/$/, "") + "/api/meeting/heartbeat";
    var body = JSON.stringify({
      meetingThreadId: cfg.meetingThreadId,
      remoteJoinCount: remoteJoinCount,
      aloneInRoom: aloneInRoom,
    });
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.token,
      },
      body: body,
      credentials: "omit",
      keepalive: true,
    }).catch(function () {});
  }

  function startHeartbeat() {
    if (heartbeatTimer) return;
    heartbeatTimer = window.setInterval(function () {
      var cfg = readConfig();
      postHeartbeat(cfg);
    }, 30000);
    var cfg = readConfig();
    postHeartbeat(cfg);
  }

  function endCallOnce() {
    if (!isLastParticipantLeaving()) {
      wlDebug("skip end — not last participant", {
        aloneInRoom: aloneInRoom,
        remoteJoinCount: remoteJoinCount,
        conferenceJoined: conferenceJoined,
      });
      return;
    }
    var cfg = readConfig();
    if (!cfg.meetingThreadId || !cfg.token || !cfg.apiBase) {
      wlDebug("skip end — missing config", cfg);
      return;
    }
    if (endedMeetings[cfg.meetingThreadId]) return;
    endedMeetings[cfg.meetingThreadId] = 1;
    wlDebug("ending meeting", cfg.meetingThreadId);
    postEndCall(cfg)
      .then(function (res) {
        if (res && res.ok) {
          try {
            window.sessionStorage.removeItem(STORAGE_ALONE);
          } catch (e) {}
        } else {
          wlDebug("end-call failed", res && res.status, cfg.meetingThreadId);
        }
        notifyOpener({
          type: "wl-meeting-ended",
          meetingThreadId: cfg.meetingThreadId,
        });
      })
      .catch(function (err) {
        wlDebug("end-call error", err);
        notifyOpener({
          type: "wl-meeting-ended",
          meetingThreadId: cfg.meetingThreadId,
        });
      });
  }

  function onConferenceJoined() {
    conferenceJoined = true;
    remoteJoinCount = 0;
    setAloneInRoom(true);
    startHeartbeat();
    wlDebug("conferenceJoined", { remoteJoinCount: remoteJoinCount });
  }

  function onParticipantJoined() {
    remoteJoinCount = Math.max(0, remoteJoinCount) + 1;
    setAloneInRoom(false);
    wlDebug("participantJoined", { remoteJoinCount: remoteJoinCount });
  }

  function onParticipantLeft() {
    remoteJoinCount = Math.max(0, remoteJoinCount - 1);
    if (remoteJoinCount === 0) {
      setAloneInRoom(true);
    }
    wlDebug("participantLeft", { remoteJoinCount: remoteJoinCount, aloneInRoom: aloneInRoom });
  }

  function hookConferenceLeave() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.conference) return;
      if (app.conference._wlEndHooked) return;
      app.conference._wlEndHooked = true;

      app.conference.addListener("conferenceJoined", onConferenceJoined);
      app.conference.addListener("participantJoined", onParticipantJoined);
      app.conference.addListener("participantLeft", onParticipantLeft);
      app.conference.addListener("readyToClose", endCallOnce);
      app.conference.addListener("videoConferenceLeft", endCallOnce);

      if (app.conference.isJoined && app.conference.isJoined()) {
        onConferenceJoined();
      }
    } catch (e) {}
  }

  function onPageHideIfAlone() {
    if (!aloneInRoom || remoteJoinCount > 0) return;
    endCallOnce();
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("pagehide", onPageHideIfAlone);
    window.addEventListener("beforeunload", onPageHideIfAlone);
    window.setInterval(function () {
      readConfig();
      hookConferenceLeave();
    }, 1500);
  }
})();
