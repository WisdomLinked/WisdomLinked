(function () {
  /*
   * WisdomLinked — whiteboard display initials + view-only for non-moderators.
   * Requires hash keys from backend join URL:
   *   config.wisdomlinkedWhiteboardInitials
   *   config.wisdomlinkedWhiteboardDebug (optional, "true" for console.debug)
   */
  var STORAGE_INITIALS = "wlWhiteboardInitials";
  var STORAGE_MOD = "wlWhiteboardIsModerator";
  var VIEW_ONLY_STYLE_ID = "wl-whiteboard-view-only";
  var hookedApis = new WeakSet();

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

  function base64UrlJson(part) {
    try {
      var normalized = part.replace(/-/g, "+").replace(/_/g, "/");
      while (normalized.length % 4) normalized += "=";
      return JSON.parse(window.atob(normalized));
    } catch (e) {
      return null;
    }
  }

  function jwtPayload() {
    var token = new URLSearchParams(window.location.search).get("jwt") || "";
    var parts = token.split(".");
    if (parts.length < 2) return null;
    return base64UrlJson(parts[1]);
  }

  function conferenceIsModerator() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (app && app.conference && typeof app.conference.isModerator === "function") {
        return app.conference.isModerator() === true;
      }
    } catch (e) {}
    return null;
  }

  function jwtModeratorState() {
    var payload = jwtPayload();
    if (!payload) return null;
    var user = payload.context && payload.context.user;
    if (payload.moderator === true || (user && user.moderator === true)) return true;
    if (user && user.role === "moderator") return true;
    if (payload.moderator === false || (user && user.moderator === false)) return false;
    if (user && user.role === "participant") return false;
    if (user && user.role === "guest") return false;
    return null;
  }

  function isModerator() {
    var conf = conferenceIsModerator();
    if (conf === true) return true;
    var jwt = jwtModeratorState();
    if (jwt === true) return true;
    if (conf === false && jwt === false) return false;
    if (conf === false) return false;
    if (jwt === false) return false;
    return false;
  }

  function shouldApplyViewOnly() {
    if (isModerator()) return false;
    var conf = conferenceIsModerator();
    if (conf === false) return true;
    var jwt = jwtModeratorState();
    if (jwt === false) return true;
    return false;
  }

  function persistFromHash() {
    var initials = hashValue("config.wisdomlinkedWhiteboardInitials") || "";
    if (initials) {
      try {
        window.sessionStorage.setItem(STORAGE_INITIALS, initials);
      } catch (e) {}
    }
    var conf = conferenceIsModerator();
    var jwt = jwtModeratorState();
    if (conf === true || jwt === true) {
      try {
        window.sessionStorage.setItem(STORAGE_MOD, "1");
      } catch (e) {}
    } else if (conf === false || jwt === false) {
      try {
        window.sessionStorage.setItem(STORAGE_MOD, "0");
      } catch (e) {}
    }
  }

  function cachedInitials() {
    persistFromHash();
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
    if (!shouldApplyViewOnly() || typeof document === "undefined") return;
    if (document.getElementById(VIEW_ONLY_STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = VIEW_ONLY_STYLE_ID;
    style.textContent =
      "#whiteboard-container .excalidraw .excalidraw-canvas, " +
      "#whiteboard-container .excalidraw canvas, " +
      '[data-testid="whiteboard"] .excalidraw .excalidraw-canvas, ' +
      '[data-testid="whiteboard"] .excalidraw canvas {' +
      "pointer-events: none !important; user-select: none !important; }";
    document.head.appendChild(style);
  }

  function removeViewOnlyStyles() {
    var el = typeof document !== "undefined" && document.getElementById(VIEW_ONLY_STYLE_ID);
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  function applyViewOnly(excalidrawApi) {
    if (!excalidrawApi || !shouldApplyViewOnly()) return;
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
          if (shouldApplyViewOnly()) applyViewOnly(excalidrawApi);
        });
      }
      wlDebug("view-only applied");
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
    if (isModerator() || !shouldApplyViewOnly()) {
      removeViewOnlyStyles();
      return;
    }
    var wb = getWhiteboardSlice();
    if (!wb || !wb.isOpen) return;
    ensureViewOnlyStyles();
    if (typeof wb.getExcalidrawAPI === "function") {
      var api = wb.getExcalidrawAPI();
      if (api) applyViewOnly(api);
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
          wlDebug("whiteboard opened", {
            mod: isModerator(),
            viewOnly: shouldApplyViewOnly(),
          });
          pollExcalidrawViewOnly();
        }
        prevOpen = open;
      });
    } catch (e) {}
  }

  function hookConferenceModerator() {
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.conference || app.conference._wlWbModHooked) return;
      app.conference._wlWbModHooked = true;
      app.conference.addListener("conferenceJoined", persistFromHash);
    } catch (e) {}
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("hashchange", persistFromHash);
    window.addEventListener("load", function () {
      persistFromHash();
      patchWhiteboardStateInUrl();
      hookWhiteboardOpen();
      hookConferenceModerator();
    });
    window.setInterval(function () {
      persistFromHash();
      patchWhiteboardStateInUrl();
      hookWhiteboardOpen();
      hookConferenceModerator();
      pollExcalidrawViewOnly();
    }, 400);
    persistFromHash();
    hookWhiteboardOpen();
    hookConferenceModerator();
  }
})();
