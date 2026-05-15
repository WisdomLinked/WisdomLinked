(function () {
  /*
   * Whiteboard initials + view-only for non-moderators (hash from backend is authoritative).
   *   config.wisdomlinkedWhiteboardInitials
   *   config.wisdomlinkedIsMeetingModerator=true|false
   *   config.wisdomlinkedWhiteboardDebug=true (optional)
   */
  var STORAGE_INITIALS = "wlWhiteboardInitials";
  var STORAGE_MOD = "wlIsMeetingModerator";
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

  function canDrawOnWhiteboard() {
    persistModeratorFromHash();
    try {
      var v = window.sessionStorage.getItem(STORAGE_MOD);
      if (v === "0") return false;
      if (v === "1") return true;
    } catch (e) {}
    return true;
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
    if (canDrawOnWhiteboard()) {
      removeViewOnlyStyles();
      return;
    }
    var wb = getWhiteboardSlice();
    if (!wb || !wb.isOpen) {
      removeViewOnlyStyles();
      return;
    }
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
          wlDebug("whiteboard opened", { canDraw: canDrawOnWhiteboard() });
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
    });
    window.setInterval(function () {
      persistModeratorFromHash();
      persistInitialsFromHash();
      patchWhiteboardStateInUrl();
      hookWhiteboardOpen();
      pollExcalidrawViewOnly();
    }, 400);
    persistModeratorFromHash();
    persistInitialsFromHash();
    hookWhiteboardOpen();
  }
})();
