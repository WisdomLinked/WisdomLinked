# Jitsi web custom scripts (server-only)

WisdomLinked Meet injects small browser scripts on the **Jitsi host** (`wisdomlinked-comms`), not in the main app bundle. **Source copies** for deploy live in [`server-scripts/`](./server-scripts/). Copy them to the server at:

`/root/.jitsi-meet-cfg/web/custom/`

They bind-mount into `/usr/share/jitsi-meet/` in `docker-jitsi-meet` (see `docker-compose.yml` on the server).

## Deploy from repo

```bash
scp jitsi/server-scripts/wisdomlinked-meeting-end-on-hangup.js \
    jitsi/server-scripts/wisdomlinked-whiteboard-initials.js \
    wisdomlinked-comms:/root/.jitsi-meet-cfg/web/custom/
ssh wisdomlinked-comms 'cd /root/wisdomlinked-comms/jitsi/docker-jitsi-meet && docker compose up -d --force-recreate web'
```

Hard-refresh meet clients after deploy.

## Scripts on the server

| File | Purpose |
|------|---------|
| `wisdomlinked-copy-meeting-id.js` | Moderator “Copy Meeting ID” control |
| `wisdomlinked-meeting-chat-sync.js` | In-call text chat → `POST /api/meeting/chat-sync` |
| `wisdomlinked-whiteboard-initials.js` | Whiteboard cursor initials; view-only for non-moderators |
| `wisdomlinked-meeting-end-on-hangup.js` | `POST /api/meeting/end-call` when **last** participant leaves |

`custom/index.html` must load them from the app root (not `/custom/`):

```html
<script src="wisdomlinked-copy-meeting-id.js" defer></script>
<script src="wisdomlinked-meeting-chat-sync.js" defer></script>
<script src="wisdomlinked-whiteboard-initials.js" defer></script>
<script src="wisdomlinked-meeting-end-on-hangup.js" defer></script>
```

## Meeting end (last leaver)

- Hangup script ends the meeting **only** when participant count is known and indicates this user is the last one leaving.
- Uses live `APP.conference.getParticipantCount()` when available; tracks `participantJoined` / `participantLeft` / `conferenceJoined` as fallback.
- **Unknown count never ends the meeting** (no default to 1). `pagehide` / `beforeunload` are **not** used (conference is often torn down → false positives).
- End runs on `videoConferenceLeft` and `readyToClose` only.
- Body includes `endReason: "last_participant"`. Backend ends the `MeetingThread` and posts `__MEETING_ENDED__` to Rocket.Chat.
- Leaving while others are still in the call does **not** end the meeting for the chat.
- Optional debug: hash `config.wisdomlinkedMeetingEndDebug=true` → `[wl-meeting-end]` in console.
- Returning from Jitsi to Messenger only clears `sessionStorage` (`wl_active_meeting_thread_id`); it does not call `/api/meeting/end`.

## Hash keys (set by backend join URL)

| Hash key | Purpose |
|----------|---------|
| `config.wisdomlinkedMeetingId` | Mongo `MeetingThread` id |
| `config.wisdomlinkedChatSyncToken` | Bearer JWT for meeting chat sync / end-call |
| `config.wisdomlinkedChatSyncApiBase` | API origin for cross-origin `fetch` from meet |
| `config.wisdomlinkedWhiteboardInitials` | Initials on Excalidraw cursors only |
| `config.wisdomlinkedWhiteboardDebug` | Optional `"true"` → `console.debug` for whiteboard script |
| `config.wisdomlinkedMeetingEndDebug` | Optional `"true"` → `console.debug` for hangup script |

## Whiteboard view-only

- **Moderator detection:** `APP.conference.isModerator()` first, then JWT `moderator` / `context.user.role`.
- View-only applies only when the user is **definitely** a non-moderator (JWT or conference says so). **Unknown role = no lockout** (moderators can always draw).
- Non-moderators get Excalidraw `viewModeEnabled` plus scoped CSS `pointer-events: none` on `#whiteboard-container` / `[data-testid="whiteboard"]` canvas only (not global `.excalidraw`).
- Moderators: no view-only styles; full draw access.

## Prosody / JWT

See [`wisdomlinked-moderator.env.snippet`](./wisdomlinked-moderator.env.snippet) and [`BE/env.rocket.template`](../BE/env.rocket.template).
