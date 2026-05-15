(function () {
  /*
   * POST /api/meeting/end-call when the last participant leaves Jitsi.
   * Optional hash: config.wisdomlinkedMeetingEndDebug=true
   */
  var STORAGE_MEETING = "wlMeetingChatMeetingId";
  var STORAGE_TOKEN = "wlMeetingChatSyncToken";
  var STORAGE_API = "wlMeetingChatSyncApiBase";
  var STORAGE_ALONE = "wlAloneInRoom";
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

  function setAloneInRoom(alone) {
    aloneInRoom = alone;
    try {
      if (alone) {
        window.sessionStorage.setItem(STORAGE_ALONE, "1");
      } else {
        window.sessionStorage.removeItem(STORAGE_ALONE);
      }
    } catch (e) {}
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
      if (trackedRemoteCount === 0 || live <= 1) setAloneInRoom(true);
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

  function endCallOnce() {
    var live = liveParticipantCount();
    if (live >= 0 && live <= 1) setAloneInRoom(true);
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
    try {
      window.sessionStorage.removeItem(STORAGE_ALONE);
    } catch (e) {}
    wlDebug("ending meeting", cfg.meetingThreadId);
    postEndCall(cfg)
      .then(function (res) {
        if (res && !res.ok) wlDebug("end-call failed", res.status, cfg.meetingThreadId);
      })
      .catch(function (err) {
        wlDebug("end-call error", err);
      });
  }

  function onParticipantLeft() {
    refreshTrackedCounts();
    var live = liveParticipantCount();
    if (trackedRemoteCount === 0 || (live >= 0 && live <= 1)) {
      setAloneInRoom(true);
    }
  }

  function onParticipantJoined() {
    setAloneInRoom(false);
    refreshTrackedCounts();
  }

  function hookConferenceLeave() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.conference) return;
      if (app.conference._wlEndHooked) return;
      app.conference._wlEndHooked = true;

      app.conference.addListener("conferenceJoined", function () {
        setAloneInRoom(false);
        refreshTrackedCounts();
        if (trackedRemoteCount === 0 || trackedTotalCount <= 1) setAloneInRoom(true);
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
