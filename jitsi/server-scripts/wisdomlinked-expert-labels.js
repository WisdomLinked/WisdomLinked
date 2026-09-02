(function () {
  /*
   * Fallback Expert labels when dynamic branding fetch is unavailable.
   * Merges partial main i18n overrides (Moderator → Expert).
   */
  var OVERRIDES = {
    closedCaptionsTab: {
      emptyState: "The closed captions content will be available once an expert starts it",
    },
    dialog: {
      WaitForHostNoAuthMsg:
        "The conference has not yet started because no experts have yet arrived. Please wait.",
      WaitingForHostButton: "Wait for expert",
      WaitingForHostTitle: "Waiting for an expert…",
      grantModeratorDialog:
        "Are you sure you want to grant expert rights to {{participantName}}?",
      grantModeratorTitle: "Grant expert rights",
      moderationAudioLabel: "Allow non-experts to unmute themselves",
      moderationDesktopLabel: "Allow non-experts to share their screen",
      moderationVideoLabel: "Allow non-experts to start their video",
    },
    fileSharing: {
      uploadDisabled:
        "Not allowed to upload files. Ask an expert for permission rights for that operation.",
    },
    lobby: {
      enableDialogText:
        "Lobby mode lets you protect your meeting by only allowing people to enter after a formal approval by an expert.",
      joinRejectedMessage: "Your join request was rejected by an expert.",
      waitForModerator:
        "The conference has not yet started because no experts have yet arrived. If you'd like to become an expert please log-in. Otherwise, please wait.",
    },
    localRecording: {
      messages: {
        finished:
          "Recording session {{token}} finished. Please send the recorded file to the expert.",
        notModerator: "You are not the expert. You cannot start or stop local recording.",
      },
      moderator: "Expert",
    },
    notify: {
      hostAskedUnmute: "The expert would like you to participate.",
      moderationInEffectCSTitle: "Screen sharing is blocked by the expert",
      moderationInEffectTitle: "Your microphone is muted by the expert",
      moderationInEffectVideoTitle: "Your camera is blocked by the expert",
      moderator: "You're now an expert",
    },
    participantsPane: {
      actions: {
        allow: "Allow non-experts to:",
      },
    },
    security: {
      aboutReadOnly:
        "Expert participants can add a $t(lockRoomPassword) to the meeting. Participants will need to provide the $t(lockRoomPassword) before they are allowed to join the meeting.",
    },
    settings: {
      chatWithPermissions: "Disable chat for non-experts",
      moderator: "Expert",
      moderatorOptions: "Expert options",
    },
    toolbar: {
      grantModerator: "Grant expert rights",
    },
    videothumbnail: {
      grantModerator: "Grant expert rights",
      moderator: "Expert",
    },
    visitors: {
      joinMeeting: {
        wishToSpeak:
          "If you wish to speak, please raise your hand below and wait for the expert's approval.",
      },
      notification: {
        requestToJoinDescription: "Your request was sent to the experts. Hang tight!",
      },
    },
    welcomepage: {
      moderatedMessage: "Or book a meeting URL in advance where you are the only expert.",
    },
  };

  function applyOverrides() {
    var i18n = window.i18next;
    if (!i18n || typeof i18n.addResourceBundle !== "function") return false;
    try {
      i18n.addResourceBundle("en", "main", OVERRIDES, true, true);
      return true;
    } catch (e) {
      return false;
    }
  }

  function boot() {
    if (applyOverrides()) return;
    var tries = 0;
    var timer = window.setInterval(function () {
      tries += 1;
      if (applyOverrides() || tries > 120) window.clearInterval(timer);
    }, 500);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
})();
