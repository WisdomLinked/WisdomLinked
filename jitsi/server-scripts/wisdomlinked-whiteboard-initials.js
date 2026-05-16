(function () {
  /*
   * Whiteboard initials + view-only for non-moderators.
   * Authoritative draw permission: GET /api/meeting/permissions (poll).
   * Jitsi "Grant moderator" sync: granter listens PARTICIPANT_ROLE_CHANGED → delegate/revoke APIs.
   */
  var STORAGE_INITIALS = "wlWhiteboardInitials";
  var STORAGE_MOD = "wlIsMeetingModerator";
  var STORAGE_MEETING = "wlMeetingChatMeetingId";
  var STORAGE_TOKEN = "wlMeetingChatSyncToken";
  var STORAGE_API = "wlMeetingChatSyncApiBase";
  var VIEW_ONLY_STYLE_ID = "wl-whiteboard-view-only";
  var PERMISSIONS_POLL_MS = 5000;
  var JOIN_GRACE_MS = 3000;
  var hookedApis = new WeakSet();
  var conferenceJoinedAt = 0;
  var localParticipantId = "";
  var roleSyncDebounced = Object.create(null);
  var lastCanDraw = null;

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
    return hashValue("config.wisdomlinkedWhiteboardDebug") === "true";
  }

  function wlDebug() {
    if (!debugEnabled() || typeof console === "undefined" || !console.debug) return;
    console.debug.apply(console, ["[wl-whiteboard]"].concat([].slice.call(arguments)));
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
        window.sessionStorage.setItem(STORAGE_MOD, "1");
      } catch (e) {}
    } else if (modHash === "false") {
      try {
        window.sessionStorage.setItem(STORAGE_MOD, "0");
      } catch (e) {}
    }
  }

  function setCanDrawFromApi(canDraw) {
    try {
      window.sessionStorage.setItem(STORAGE_MOD, canDraw ? "1" : "0");
    } catch (e) {}
    if (lastCanDraw !== canDraw) {
      wlDebug("permissions updated", { canDraw: canDraw });
      lastCanDraw = canDraw;
    }
  }

  function canDrawOnWhiteboard() {
    persistModeratorFromHash();
    try {
      var v = window.sessionStorage.getItem(STORAGE_MOD);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch (e) {}
    return true;
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
        if (!data || typeof data.canDrawWhiteboard !== "boolean") return;
        setCanDrawFromApi(data.canDrawWhiteboard);
        pollExcalidrawViewOnly();
      })
      .catch(function () {});
  }

  function postDelegateApi(path, targetUserId) {
    var cfg = readConfig();
    if (!cfg.meetingThreadId || !cfg.token || !cfg.apiBase || !targetUserId) return;
    var url = String(cfg.apiBase).replace(/\/$/, "") + "/api/meeting/" + path;
    fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + cfg.token,
      },
      body: JSON.stringify({
        meetingThreadId: cfg.meetingThreadId,
        targetUserId: targetUserId,
      }),
      credentials: "omit",
    })
      .then(function (res) {
        wlDebug(path, res && res.status, targetUserId);
      })
      .catch(function (err) {
        wlDebug(path, "error", err);
      });
  }

  function wlUserIdFromParticipant(participant) {
    if (!participant) return "";
    try {
      if (typeof participant.getIdentity === "function") {
        var identity = String(participant.getIdentity() || "").trim();
        if (/^[a-f0-9]{24}$/i.test(identity)) return identity;
      }
      if (participant._identity && /^[a-f0-9]{24}$/i.test(String(participant._identity))) {
        return String(participant._identity);
      }
      if (typeof participant.getId === "function") {
        var pid = String(participant.getId() || "");
        var match = pid.match(/([a-f0-9]{24})/i);
        if (match) return match[1];
      }
    } catch (e) {}
    return "";
  }

  function isModeratorRole(role) {
    var r = String(role || "").toLowerCase();
    return r === "moderator" || r === "owner";
  }

  function onParticipantRoleChanged(participantId, role) {
    if (!conferenceJoinedAt || Date.now() - conferenceJoinedAt < JOIN_GRACE_MS) return;
    if (!participantId || String(participantId) === String(localParticipantId)) return;
    if (!canDrawOnWhiteboard()) return;

    var app = typeof APP !== "undefined" ? APP : null;
    if (!app || !app.conference) return;
    var participant = null;
    try {
      if (typeof app.conference.getParticipantById === "function") {
        participant = app.conference.getParticipantById(participantId);
      }
    } catch (e) {}
    var targetUserId = wlUserIdFromParticipant(participant);
    if (!targetUserId) {
      wlDebug("role change — no WL user id", participantId, role);
      return;
    }

    var debounceKey = targetUserId + ":" + String(role);
    if (roleSyncDebounced[debounceKey]) return;
    roleSyncDebounced[debounceKey] = window.setTimeout(function () {
      delete roleSyncDebounced[debounceKey];
    }, 2000);

    if (isModeratorRole(role)) {
      postDelegateApi("delegate-moderator", targetUserId);
    } else {
      postDelegateApi("revoke-delegate-moderator", targetUserId);
    }
  }

  function hookConferenceRoleSync() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.conference) return;
      if (app.conference._wlWhiteboardRoleHooked) return;
      app.conference._wlWhiteboardRoleHooked = true;

      app.conference.addListener("conferenceJoined", function () {
        conferenceJoinedAt = Date.now();
        try {
          if (typeof app.conference.myUserId === "function") {
            localParticipantId = app.conference.myUserId();
          } else if (app.conference.myUserId) {
            localParticipantId = app.conference.myUserId;
          }
        } catch (e) {}
        pollPermissions();
      });

      var roleEvents = [
        "PARTICIPANT_ROLE_CHANGED",
        "USER_ROLE_CHANGED",
        "participant.role.changed",
      ];
      roleEvents.forEach(function (evt) {
        try {
          app.conference.addListener(evt, onParticipantRoleChanged);
        } catch (e) {}
      });
    } catch (e) {}
  }

  function persistInitialsFromHash() {
    var initials = hashValue("config.wisdomlinkedWhiteboardInitials") || "";
    if (initials) {
      try {
        window.sessionStorage.setItem(STORAGE_INITIALS, initials);
      } catch (e) {}
    }
  }

  function cachedInitials() {
    persistInitialsFromHash();
    try {
      return window.sessionStorage.getItem(STORAGE_INITIALS) || "";
    } catch (e) {
      return "";
    }
  }

  function patchWhiteboardStateInUrl() {
    var initials = cachedInitials();
    if (!initials) return;
    try {
      var href = String(window.location.href || "");
      if (href.indexOf("state=") < 0) return;
      var u = new URL(href);
      var stateParam = u.searchParams.get("state");
      if (!stateParam) return;
      var json = JSON.parse(
        decodeURIComponent(
          atob(stateParam.replace(/-/g, "+").replace(/_/g, "/")),
        ),
      );
      if (!json || typeof json !== "object") return;
      if (json.localParticipantName === initials) return;
      json.localParticipantName = initials;
      var encoded = btoa(unescape(encodeURIComponent(JSON.stringify(json))))
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=+$/, "");
      u.searchParams.set("state", encoded);
      window.history.replaceState(null, "", u.toString());
    } catch (e) {}
  }

  function ensureViewOnlyStyles() {
    if (canDrawOnWhiteboard() || typeof document === "undefined") return;
    if (document.getElementById(VIEW_ONLY_STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = VIEW_ONLY_STYLE_ID;
    style.textContent =
      "body .excalidraw .excalidraw-canvas, body .excalidraw canvas, " +
      "body .excalidraw .layer-ui__wrapper .ToolIcon, body .excalidraw .App-menu {" +
      "pointer-events: none !important; user-select: none !important; }";
    document.head.appendChild(style);
  }

  function removeViewOnlyStyles() {
    var el = typeof document !== "undefined" && document.getElementById(VIEW_ONLY_STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function applyViewOnly(excalidrawApi) {
    if (!excalidrawApi || canDrawOnWhiteboard()) return;
    ensureViewOnlyStyles();
    try {
      if (typeof excalidrawApi.updateScene === "function") {
        excalidrawApi.updateScene({ appState: { viewModeEnabled: true } });
      }
      if (typeof excalidrawApi.setViewModeEnabled === "function") {
        excalidrawApi.setViewModeEnabled(true);
      }
      if (!hookedApis.has(excalidrawApi) && typeof excalidrawApi.onChange === "function") {
        hookedApis.add(excalidrawApi);
        excalidrawApi.onChange(function () {
          if (!canDrawOnWhiteboard()) applyViewOnly(excalidrawApi);
        });
      }
      wlDebug("view-only applied");
    } catch (e) {}
  }

  function enableDrawOnExcalidraw(excalidrawApi) {
    if (!excalidrawApi || !canDrawOnWhiteboard()) return;
    removeViewOnlyStyles();
    try {
      if (typeof excalidrawApi.updateScene === "function") {
        excalidrawApi.updateScene({ appState: { viewModeEnabled: false } });
      }
      if (typeof excalidrawApi.setViewModeEnabled === "function") {
        excalidrawApi.setViewModeEnabled(false);
      }
      wlDebug("draw enabled");
    } catch (e) {}
  }

  function getWhiteboardSlice() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.store || typeof app.store.getState !== "function") return null;
      var state = app.store.getState();
      return (state && state["features/whiteboard"]) || null;
    } catch (e) {
      return null;
    }
  }

  function pollExcalidrawViewOnly() {
    var wb = getWhiteboardSlice();
    if (!wb || !wb.isOpen) {
      if (!canDrawOnWhiteboard()) removeViewOnlyStyles();
      return;
    }
    if (typeof wb.getExcalidrawAPI === "function") {
      var api = wb.getExcalidrawAPI();
      if (api) {
        if (canDrawOnWhiteboard()) {
          enableDrawOnExcalidraw(api);
        } else {
          applyViewOnly(api);
        }
        return;
      }
    }
    if (canDrawOnWhiteboard()) {
      removeViewOnlyStyles();
    } else {
      ensureViewOnlyStyles();
    }
  }

  function hookWhiteboardOpen() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.store || app.store._wlWhiteboardHooked) return;
      if (typeof app.store.subscribe !== "function") return;
      app.store._wlWhiteboardHooked = true;
      var prevOpen = false;
      app.store.subscribe(function () {
        var wb = getWhiteboardSlice();
        var open = Boolean(wb && wb.isOpen);
        if (open && !prevOpen) {
          wlDebug("whiteboard opened", { canDraw: canDrawOnWhiteboard() });
          pollPermissions();
          pollExcalidrawViewOnly();
        }
        if (!open && prevOpen) removeViewOnlyStyles();
        prevOpen = open;
      });
    } catch (e) {}
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("hashchange", function () {
      persistModeratorFromHash();
      persistInitialsFromHash();
    });
    window.addEventListener("load", function () {
      persistModeratorFromHash();
      persistInitialsFromHash();
      patchWhiteboardStateInUrl();
      hookWhiteboardOpen();
      hookConferenceRoleSync();
      pollPermissions();
    });
    window.setInterval(function () {
      persistModeratorFromHash();
      persistInitialsFromHash();
      patchWhiteboardStateInUrl();
      hookWhiteboardOpen();
      hookConferenceRoleSync();
      pollExcalidrawViewOnly();
    }, 400);
    window.setInterval(pollPermissions, PERMISSIONS_POLL_MS);
    persistModeratorFromHash();
    persistInitialsFromHash();
    hookWhiteboardOpen();
    hookConferenceRoleSync();
    pollPermissions();
  }
})();
