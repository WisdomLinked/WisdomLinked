(function () {
  var BUTTON_ID = "wl-copy-meeting-id-button";
  var STYLE_ID = "wl-copy-meeting-id-style";

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

  function ensureStyle() {
    if (document.getElementById(STYLE_ID)) return;
    var style = document.createElement("style");
    style.id = STYLE_ID;
    style.textContent = "#" + BUTTON_ID + "{position:fixed;right:16px;bottom:92px;z-index:2147483647;border:0;border-radius:10px;background:#234C6A;color:#fff;padding:10px 14px;font:600 13px/1.2 system-ui,-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;box-shadow:0 8px 24px rgba(0,0,0,.25);cursor:pointer}#" + BUTTON_ID + ":hover{filter:brightness(1.08)}#" + BUTTON_ID + ":active{transform:translateY(1px)}";
    document.head.appendChild(style);
  }

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

  function syncButton() {
    var meetingId = hashValue("config.wisdomlinkedMeetingId");
    var existing = document.getElementById(BUTTON_ID);
    if (!meetingId || !isModerator()) {
      if (existing) existing.remove();
      return;
    }
    ensureStyle();
    if (existing) return;
    var button = document.createElement("button");
    button.id = BUTTON_ID;
    button.type = "button";
    button.textContent = "Copy Meeting ID";
    button.title = "Copy WisdomLinked meeting ID";
    button.addEventListener("click", function () { copyMeetingId(meetingId, button); });
    document.body.appendChild(button);
  }

  window.addEventListener("hashchange", syncButton);
  window.addEventListener("load", syncButton);
  window.setInterval(syncButton, 1500);
  syncButton();
})();
