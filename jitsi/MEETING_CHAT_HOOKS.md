# Jitsi web custom scripts (server-only)

WisdomLinked Meet injects small browser scripts on the **Jitsi host** (`wisdomlinked-comms`), not in this application repo. They are copied to:

`/root/.jitsi-meet-cfg/web/custom/`

and bind-mounted into `/usr/share/jitsi-meet/` in `docker-jitsi-meet` (see `docker-compose.yml` on the server).

## Scripts on the server

| File | Purpose |
|------|---------|
| `wisdomlinked-copy-meeting-id.js` | Moderator “Copy Meeting ID” control |
| `wisdomlinked-meeting-chat-sync.js` | In-call text chat → `POST /api/meeting/chat-sync` |
| `wisdomlinked-whiteboard-initials.js` | Whiteboard cursor initials; view-only for non-moderators |
| `wisdomlinked-meeting-end-on-hangup.js` | `POST /api/meeting/end-call` on hangup |

`custom/index.html` must load them from the app root (not `/custom/`):

```html
<script src="wisdomlinked-copy-meeting-id.js" defer></script>
<script src="wisdomlinked-meeting-chat-sync.js" defer></script>
<script src="wisdomlinked-whiteboard-initials.js" defer></script>
<script src="wisdomlinked-meeting-end-on-hangup.js" defer></script>
```

After changes: `docker compose up -d --force-recreate web` and hard-refresh meet clients.

## Hash keys (set by backend join URL)

| Hash key | Purpose |
|----------|---------|
| `config.wisdomlinkedMeetingId` | Mongo `MeetingThread` id |
| `config.wisdomlinkedChatSyncToken` | Bearer JWT for meeting chat sync / end-call |
| `config.wisdomlinkedChatSyncApiBase` | API origin for cross-origin `fetch` from meet |
| `config.wisdomlinkedWhiteboardInitials` | Initials on Excalidraw cursors only |

## Prosody / JWT

See [`wisdomlinked-moderator.env.snippet`](./wisdomlinked-moderator.env.snippet) and [`BE/env.rocket.template`](../BE/env.rocket.template).
