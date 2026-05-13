(function () {
  var BUTTON_ID = "wl-copy-meeting-id-button";
  var STORAGE_KEY = "wlCopyMeetingId";

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
    return Boolean(payload && (payload.moderator === true || (user && (user.moderator === true || user.role === "moderator"))));
  }

  var cachedMeetingId = hashValue("config.wisdomlinkedMeetingId") || window.sessionStorage.getItem(STORAGE_KEY) || "";
  if (cachedMeetingId) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, cachedMeetingId);
    } catch (e) {
      // Ignore private-mode/session-storage failures; the in-memory value still works.
    }
  }
  var cachedModerator = isModerator();

  function fallbackCopy(text) {
    var el = document.createElement("textarea");
    el.value = text;
    el.setAttribute("readonly", "readonly");
    el.style.position = "fixed";
    el.style.opacity = "0";
    document.body.appendChild(el);
    el.select();
    try {
      document.execCommand("copy");
    } finally {
      document.body.removeChild(el);
    }
  }

  function copyMeetingId(meetingId, button) {
    var done = function () {
      var original = button.textContent;
      button.textContent = "Meeting ID copied";
      window.setTimeout(function () { button.textContent = original; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(meetingId).then(done).catch(function () {
        fallbackCopy(meetingId);
        done();
      });
      return;
    }
    fallbackCopy(meetingId);
    done();
  }

  function findMuteAllButton() {
    var buttons = Array.prototype.slice.call(document.querySelectorAll("button"));
    return buttons.find(function (button) {
      var text = (button.textContent || "").replace(/\s+/g, " ").trim().toLowerCase();
      var label = (button.getAttribute("aria-label") || "").replace(/\s+/g, " ").trim().toLowerCase();
      return text === "mute all" || label === "mute all";
    }) || null;
  }

  function stylePaneButton(button) {
    button.style.border = "0";
    button.style.borderRadius = "6px";
    button.style.background = "#234C6A";
    button.style.color = "#fff";
    button.style.padding = "8px 12px";
    button.style.font = "600 12px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif";
    button.style.cursor = "pointer";
    button.style.marginRight = "8px";
    button.style.whiteSpace = "nowrap";
  }

  function syncButton() {
    var meetingId = hashValue("config.wisdomlinkedMeetingId") || cachedMeetingId;
    if (meetingId && meetingId !== cachedMeetingId) {
      cachedMeetingId = meetingId;
      try {
        window.sessionStorage.setItem(STORAGE_KEY, meetingId);
      } catch (e) {
        // Ignore private-mode/session-storage failures; the in-memory value still works.
      }
    }
    var existing = document.getElementById(BUTTON_ID);
    if (!meetingId || !cachedModerator) {
      if (existing) existing.remove();
      return;
    }
    var muteAllButton = findMuteAllButton();
    if (!muteAllButton || !muteAllButton.parentElement) {
      if (existing) existing.remove();
      return;
    }
    if (existing) {
      if (existing.parentElement !== muteAllButton.parentElement) {
        existing.remove();
      } else {
        return;
      }
    }
    var button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Copy Meeting ID";
    button.title = "Copy WisdomLinked meeting ID";
    stylePaneButton(button);
    button.addEventListener("click", function () { copyMeetingId(meetingId, button); });
    muteAllButton.parentElement.insertBefore(button, muteAllButton);
  }

  window.addEventListener("hashchange", syncButton);
  window.addEventListener("load", syncButton);
  window.setInterval(syncButton, 1500);
  syncButton();
})();
