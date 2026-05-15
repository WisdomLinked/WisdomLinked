(function () {
  /*
   * POST /api/meeting/end-call when the last participant leaves Jitsi.
   * Uses same sessionStorage keys as wisdomlinked-meeting-chat-sync.js.
   * Optional hash: config.wisdomlinkedMeetingEndDebug=true
   */
  var STORAGE_MEETING = "wlMeetingChatMeetingId";
  var STORAGE_TOKEN = "wlMeetingChatSyncToken";
  var STORAGE_API = "wlMeetingChatSyncApiBase";
  var endedMeetings = Object.create(null);
  var trackedRemoteCount = -1;
  var trackedTotalCount = -1;

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

  function liveParticipantCount() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.conference) return -1;
      if (typeof app.conference.getParticipantCount === "function") {
        return app.conference.getParticipantCount();
      }
      if (typeof app.conference.listMembers === "function") {
        var members = app.conference.listMembers() || [];
        return members.length;
      }
    } catch (e) {}
    return -1;
  }

  function refreshTrackedCounts() {
    var live = liveParticipantCount();
    if (live >= 0) {
      trackedTotalCount = live;
      trackedRemoteCount = Math.max(0, live - 1);
    }
    wlDebug("counts", {
      live: live,
      total: trackedTotalCount,
      remote: trackedRemoteCount,
    });
  }

  function isLastParticipantLeaving() {
    var live = liveParticipantCount();
    if (live >= 0) {
      return live <= 1;
    }
    if (trackedRemoteCount >= 0) {
      return trackedRemoteCount === 0;
    }
    if (trackedTotalCount >= 0) {
      return trackedTotalCount <= 1;
    }
    return false;
  }

  function endCallOnce() {
    refreshTrackedCounts();
    if (!isLastParticipantLeaving()) {
      wlDebug("skip end — not last participant", {
        live: liveParticipantCount(),
        remote: trackedRemoteCount,
        total: trackedTotalCount,
      });
      return;
    }
    var cfg = readConfig();
    if (!cfg.meetingThreadId || !cfg.token || !cfg.apiBase) return;
    if (endedMeetings[cfg.meetingThreadId]) return;
    endedMeetings[cfg.meetingThreadId] = 1;
    wlDebug("ending meeting", cfg.meetingThreadId);
    var url = String(cfg.apiBase).replace(/\/$/, "") + "/api/meeting/end-call";
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.token,
      },
      body: JSON.stringify({
        meetingThreadId: cfg.meetingThreadId,
        endReason: "last_participant",
      }),
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

      app.conference.addListener("conferenceJoined", function () {
        refreshTrackedCounts();
      });
      app.conference.addListener("participantJoined", function () {
        refreshTrackedCounts();
      });
      app.conference.addListener("participantLeft", function () {
        refreshTrackedCounts();
      });

      app.conference.addListener("readyToClose", endCallOnce);
      app.conference.addListener("videoConferenceLeft", endCallOnce);

      refreshTrackedCounts();
    } catch (e) {}
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.setInterval(function () {
      readConfig();
      hookConferenceLeave();
    }, 1500);
  }
})();
