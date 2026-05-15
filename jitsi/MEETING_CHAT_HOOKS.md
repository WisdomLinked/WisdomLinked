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

Hard-refresh meet clients after deploy. **Also deploy staging/production BE** so join URLs include `config.wisdomlinkedIsMeetingModerator`.

## Scripts on the server

| File | Purpose |
|------|---------|
| `wisdomlinked-copy-meeting-id.js` | Moderator “Copy Meeting ID” control |
| `wisdomlinked-meeting-chat-sync.js` | In-call text chat → `POST /api/meeting/chat-sync` |
| `wisdomlinked-whiteboard-initials.js` | Whiteboard initials; view-only when hash says non-moderator |
| `wisdomlinked-meeting-end-on-hangup.js` | `POST /api/meeting/end-call` when last participant leaves |

## Meeting end (last leaver)

- Tracks `aloneInRoom` via `conferenceJoined`, `participantJoined`, `participantLeft`, and live/Redux participant counts.
- On `participantLeft`, sets `aloneInRoom` when remote count is `0` or live count `<= 1` (does not end until the remaining user hangs up).
- Persists `sessionStorage.wlAloneInRoom = "1"` when alone so Messenger can end on return if hangup `fetch` missed.
- Ends on `videoConferenceLeft` / `readyToClose` when `aloneInRoom` or live count `<= 1`. **Unknown count never ends the meeting.**
- `pagehide` / `beforeunload` call end **only if** `aloneInRoom` is already true.
- Body: `{ meetingThreadId, endReason: "last_participant" }`.
- Debug: `config.wisdomlinkedMeetingEndDebug=true`.
- **Messenger return:** if `wlAloneInRoom` is set, FE calls `POST /api/meeting/end` with `endReason: "last_participant_return"` (session cookie).

## Hash keys (backend join URL)

| Hash key | Purpose |
|----------|---------|
| `config.wisdomlinkedMeetingId` | Mongo `MeetingThread` id |
| `config.wisdomlinkedChatSyncToken` | Bearer JWT for chat sync / end-call |
| `config.wisdomlinkedChatSyncApiBase` | API origin for cross-origin `fetch` from meet |
| `config.wisdomlinkedWhiteboardInitials` | Initials on Excalidraw cursors |
| `config.wisdomlinkedIsMeetingModerator` | **`true`** = starter/admin may draw; **`false`** = view-only whiteboard |
| `config.wisdomlinkedWhiteboardDebug` | Optional whiteboard `console.debug` |
| `config.wisdomlinkedMeetingEndDebug` | Optional hangup `console.debug` |

## Whiteboard view-only

- **Authoritative:** `config.wisdomlinkedIsMeetingModerator` from backend (not `APP.conference.isModerator()`, which Prosody may set true for everyone).
- Persisted as `sessionStorage.wlIsMeetingModerator` (`"1"` / `"0"`).
- `"0"` → Excalidraw view mode + `pointer-events: none` on `body .excalidraw` while board is open.
- `"1"` → full draw access.
- If hash not yet present (old join URL), draw is allowed until a new join URL is issued.

## Staging API for end-call

Set on staging BE: `MEETING_CHAT_SYNC_PUBLIC_API_BASE=https://staging.wisdomlinked.com` (no trailing path beyond site origin; scripts append `/api/meeting/end-call`).

## Prosody / JWT

See [`wisdomlinked-moderator.env.snippet`](./wisdomlinked-moderator.env.snippet) and [`BE/env.rocket.template`](../BE/env.rocket.template). Required: `WAIT_FOR_HOST_DISABLE_AUTO_OWNERS=1`, `token_affiliation` in `XMPP_MUC_MODULES`.
