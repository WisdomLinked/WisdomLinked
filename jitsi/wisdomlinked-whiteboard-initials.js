(function () {
  /*
   * WisdomLinked — whiteboard display initials + view-only for non-moderators.
   * Requires hash keys from backend join URL:
   *   config.wisdomlinkedWhiteboardInitials
   * Deploy via jitsi/install-custom-web.sh (see MEETING_CHAT_HOOKS.md).
   */
  var STORAGE_INITIALS = "wlWhiteboardInitials";
  var STORAGE_MOD = "wlWhiteboardIsModerator";

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

  function isModerator() {
    var payload = jwtPayload();
    var user = payload && payload.context && payload.context.user;
    return Boolean(
      payload &&
        (payload.moderator === true ||
          (user && (user.moderator === true || user.role === "moderator"))),
    );
  }

  function persistFromHash() {
    var initials = hashValue("config.wisdomlinkedWhiteboardInitials") || "";
    if (initials) {
      try {
        window.sessionStorage.setItem(STORAGE_INITIALS, initials);
      } catch (e) {}
    }
    try {
      window.sessionStorage.setItem(STORAGE_MOD, isModerator() ? "1" : "0");
    } catch (e) {}
  }

  function cachedInitials() {
    persistFromHash();
    try {
      return window.sessionStorage.getItem(STORAGE_INITIALS) || "";
    } catch (e) {
      return "";
    }
  }

  function cachedIsModerator() {
    persistFromHash();
    try {
      return window.sessionStorage.getItem(STORAGE_MOD) === "1";
    } catch (e) {
      return isModerator();
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

  function applyViewOnly(excalidrawApi) {
    if (!excalidrawApi || cachedIsModerator()) return;
    try {
      if (typeof excalidrawApi.updateScene === "function") {
        excalidrawApi.updateScene({ appState: { viewModeEnabled: true } });
      }
      if (typeof excalidrawApi.setViewModeEnabled === "function") {
        excalidrawApi.setViewModeEnabled(true);
      }
    } catch (e) {}
  }

  function pollExcalidrawViewOnly() {
    if (cachedIsModerator()) return;
    try {
      var app = typeof APP !== "undefined" ? APP : null;
      if (!app || !app.store || typeof app.store.getState !== "function") return;
      var state = app.store.getState();
      var wb = state && state["features/whiteboard"];
      if (!wb || !wb.isOpen) return;
      if (typeof wb.getExcalidrawAPI === "function") {
        var api = wb.getExcalidrawAPI();
        if (api) applyViewOnly(api);
      }
    } catch (e) {}
  }

  if (typeof window !== "undefined" && window.addEventListener) {
    window.addEventListener("hashchange", persistFromHash);
    window.addEventListener("load", function () {
      persistFromHash();
      patchWhiteboardStateInUrl();
    });
    window.setInterval(function () {
      persistFromHash();
      patchWhiteboardStateInUrl();
      pollExcalidrawViewOnly();
    }, 800);
    persistFromHash();
  }
})();
