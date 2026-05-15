(function () {
  /*
   * POST /api/meeting/end-call when the last participant leaves Jitsi.
   * Optional hash: config.wisdomlinkedMeetingEndDebug=true
   */
  var STORAGE_MEETING = "wlMeetingChatMeetingId";
  var STORAGE_TOKEN = "wlMeetingChatSyncToken";
  var STORAGE_API = "wlMeetingChatSyncApiBase";
  var endedMeetings = Object.create(null);
  var trackedRemoteCount = -1;
  var trackedTotalCount = -1;
  var aloneInRoom = false;

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

  function reduxParticipantCount() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.store || typeof app.store.getState !== "function") return -1;
      var participants = app.store.getState()["features/base/participants"];
      if (!participants) return -1;
      if (typeof participants.size === "number") return participants.size;
      return Object.keys(participants).length;
    } catch (e) {
      return -1;
    }
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
    var redux = reduxParticipantCount();
    return redux >= 0 ? redux : -1;
  }

  function refreshTrackedCounts() {
    var live = liveParticipantCount();
    if (live >= 0) {
      trackedTotalCount = live;
      trackedRemoteCount = Math.max(0, live - 1);
      if (trackedRemoteCount === 0) aloneInRoom = true;
    }
    wlDebug("counts", {
      live: live,
      total: trackedTotalCount,
      remote: trackedRemoteCount,
      aloneInRoom: aloneInRoom,
    });
  }

  function isLastParticipantLeaving() {
    if (aloneInRoom) return true;
    var live = liveParticipantCount();
    if (live >= 0) return live <= 1;
    if (trackedRemoteCount >= 0) return trackedRemoteCount === 0;
    if (trackedTotalCount >= 0) return trackedTotalCount <= 1;
    return false;
  }

  function endCallOnce() {
    refreshTrackedCounts();
    if (!isLastParticipantLeaving()) {
      wlDebug("skip end — not last participant", {
        aloneInRoom: aloneInRoom,
        live: liveParticipantCount(),
        remote: trackedRemoteCount,
        total: trackedTotalCount,
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
    })
      .then(function (res) {
        if (!res.ok) wlDebug("end-call failed", res.status, cfg.meetingThreadId);
      })
      .catch(function (err) {
        wlDebug("end-call error", err);
      });
  }

  function onParticipantLeft() {
    if (trackedRemoteCount > 0) trackedRemoteCount -= 1;
    refreshTrackedCounts();
    if (trackedRemoteCount === 0) aloneInRoom = true;
  }

  function onParticipantJoined() {
    aloneInRoom = false;
    refreshTrackedCounts();
  }

  function hookConferenceLeave() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.conference) return;
      if (app.conference._wlEndHooked) return;
      app.conference._wlEndHooked = true;

      app.conference.addListener("conferenceJoined", function () {
        aloneInRoom = false;
        refreshTrackedCounts();
        if (trackedRemoteCount === 0 || trackedTotalCount <= 1) aloneInRoom = true;
      });
      app.conference.addListener("participantJoined", onParticipantJoined);
      app.conference.addListener("participantLeft", onParticipantLeft);

      app.conference.addListener("readyToClose", endCallOnce);
      app.conference.addListener("videoConferenceLeft", endCallOnce);

      refreshTrackedCounts();
    } catch (e) {}
  }

  function onPageHideIfAlone() {
    if (!aloneInRoom) return;
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
