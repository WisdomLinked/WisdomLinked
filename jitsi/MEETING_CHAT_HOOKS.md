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

Hard-refresh meet clients after deploy. **Also deploy staging/production BE** so join URLs include `config.wisdomlinkedMessengerOrigin` and chat-sync hashes.

## Scripts on the server

| File | Purpose |
|------|---------|
| `wisdomlinked-copy-meeting-id.js` | Moderator “Copy Meeting ID” control |
| `wisdomlinked-meeting-chat-sync.js` | In-call text chat → `POST /api/meeting/chat-sync` |
| `wisdomlinked-whiteboard-initials.js` | Whiteboard initials; view-only when hash says non-moderator |
| `wisdomlinked-meeting-end-on-hangup.js` | `POST /api/meeting/end-call` when last participant hangs up |

## Meeting end (last leaver)

- **`remoteJoinCount`** (event-based): `0` on `conferenceJoined`; `+1` on `participantJoined`; `-1` on `participantLeft`. Does **not** rely on Jitsi `getParticipantCount()` (often returns `-1`).
- **`aloneInRoom`**: `true` when `remoteJoinCount === 0`. Set on `participantLeft` but **does not** call end until hangup — first leaver must not end for others.
- Ends on `videoConferenceLeft` / `readyToClose` only when `remoteJoinCount === 0` and `aloneInRoom`.
- `POST /api/meeting/heartbeat` every 30s with `{ meetingThreadId, remoteJoinCount, aloneInRoom }`. BE auto-ends if alone heartbeats stop for ~90s (tab closed without hangup).
- Body for end-call: `{ meetingThreadId, endReason: "last_participant" }`.
- Debug: `config.wisdomlinkedMeetingEndDebug=true` → `[wl-meeting-end]` in console.
- **Messenger bridge:** `postMessage` to `config.wisdomlinkedMessengerOrigin` (SPA origin, not API host). Types: `wl-meeting-alone`, `wl-meeting-ended`.
- **UI reconcile:** Messenger polls `GET /api/meeting/:id` every 45s for in-progress cards; shows “Meet ended” when Mongo `status === ended`.

## Manual test checklist

| Step | Expected |
|------|----------|
| A and B join | Both see Meet in progress |
| A leaves | B still sees in progress |
| B hangs up | Both see Meet ended within ~5s |
| Solo join + hangup | Meet ended |
| Debug hash on URL | Console shows `ending meeting` + `POST .../end-call` 200 |

## Hash keys (backend join URL)

| Hash key | Purpose |
|----------|---------|
| `config.wisdomlinkedMeetingId` | Mongo `MeetingThread` id |
| `config.wisdomlinkedChatSyncToken` | Bearer JWT for chat sync / end-call / heartbeat |
| `config.wisdomlinkedChatSyncApiBase` | API origin for cross-origin `fetch` from meet |
| `config.wisdomlinkedMessengerOrigin` | Messenger SPA origin for `postMessage` target |
| `config.wisdomlinkedWhiteboardInitials` | Initials on Excalidraw cursors |
| `config.wisdomlinkedIsMeetingModerator` | **`true`** = draw; **`false`** = view-only whiteboard |
| `config.wisdomlinkedMeetingEndDebug` | Optional hangup `console.debug` |

## Staging env

- `MEETING_CHAT_SYNC_PUBLIC_API_BASE=https://staging.wisdomlinked.com` (site origin; scripts append `/api/meeting/...`)
- `FE_URL` or `FRONTEND_BASE_URL=https://staging.wisdomlinked.com` (for `wisdomlinkedMessengerOrigin` hash)

## Prosody / JWT

See [`wisdomlinked-moderator.env.snippet`](./wisdomlinked-moderator.env.snippet) and [`BE/env.rocket.template`](../BE/env.rocket.template). Required: `WAIT_FOR_HOST_DISABLE_AUTO_OWNERS=1`, `token_affiliation` in `XMPP_MUC_MODULES`.
