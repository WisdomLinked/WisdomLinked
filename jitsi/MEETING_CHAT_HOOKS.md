# Jitsi web custom scripts (server-only)

WisdomLinked Meet injects small browser scripts on the **Jitsi host** (`wisdomlinked-comms`), not in the main app bundle. **Source copies** for deploy live in [`server-scripts/`](./server-scripts/). Copy them to the server at:

`/root/.jitsi-meet-cfg/web/custom/`

They bind-mount into `/usr/share/jitsi-meet/` in `docker-jitsi-meet` (see `docker-compose.yml` on the server).

## Deploy from repo

```bash
scp jitsi/server-scripts/wisdomlinked-meeting-end-on-hangup.js \
    jitsi/server-scripts/wisdomlinked-whiteboard-initials.js \
    jitsi/server-scripts/wisdomlinked-poll-moderator.js \
    jitsi/server-scripts/wisdomlinked-expert-labels.js \
    jitsi/branding/wisdomlinked-branding.json \
    jitsi/branding/wisdomlinked-labels-en.json \
    wisdomlinked-comms:/root/.jitsi-meet-cfg/web/custom/
ssh wisdomlinked-comms 'cd /root/wisdomlinked-comms/jitsi/docker-jitsi-meet && docker compose up -d --force-recreate web'
```

Hard-refresh meet clients after deploy (incognito if labels look cached). **Also deploy staging/production BE** so join URLs include `config.wisdomlinkedMessengerOrigin` and chat-sync hashes.

**New custom `.js` files:** copy to `/root/.jitsi-meet-cfg/web/custom/`, add a `<script src="…" defer></script>` line in custom `index.html`, and add an explicit bind mount in `/root/wisdomlinked-comms/jitsi/docker-jitsi-meet/docker-compose.yml` under the `web` service (same pattern as `wisdomlinked-whiteboard-initials.js`). Then `docker compose up -d --force-recreate web`.

Add docker-compose volume mounts on `wisdomlinked-comms` (paths must be under `lang/`, not `/custom/`, because nginx treats `custom` as a room subdomain):

```yaml
- ${HOME}/.jitsi-meet-cfg/web/custom/wisdomlinked-branding.json:/usr/share/jitsi-meet/lang/wisdomlinked-branding.json:ro
- ${HOME}/.jitsi-meet-cfg/web/custom/wisdomlinked-labels-en.json:/usr/share/jitsi-meet/lang/wisdomlinked-labels-en.json:ro
```

## UI labels: Moderator → Expert

English Meet copy is overridden via **dynamic branding** (not `lang/main.json` edits). Source files in [`branding/`](./branding/):

| File | Served as |
|------|-----------|
| `wisdomlinked-branding.json` | Points `labels.en` at the labels bundle URL |
| `wisdomlinked-labels-en.json` | Partial i18n overrides (`videothumbnail.moderator` → **Expert**, grant menu → **Grant expert rights**, etc.) |

On the server, enable branding once in `/root/.jitsi-meet-cfg/web/custom-config.js` (or docker `.env`):

```javascript
config.brandingDataUrl = 'https://meet.wisdomlinked.com/lang/wisdomlinked-branding.json';
```

Verify in browser DevTools: fetches `wisdomlinked-branding.json` and `wisdomlinked-labels-en.json` return 200. JWT/API still use internal `moderator` claims; only UI text changes.

`wisdomlinked-expert-labels.js` is also loaded from `index.html` as a fallback (direct `i18next.addResourceBundle`) if branding fetch is slow or blocked.

## Scripts on the server

| File | Purpose |
|------|---------|
| `wisdomlinked-copy-meeting-id.js` | Expert/host “Copy Meeting ID” control |
| `wisdomlinked-meeting-chat-sync.js` | In-call text chat → `POST /api/meeting/chat-sync` |
| `wisdomlinked-whiteboard-initials.js` | Whiteboard initials; live permissions poll; Jitsi grant → delegate sync |
| `wisdomlinked-poll-moderator.js` | Poll creation restricted to meeting moderators (guests/students can vote only) |
| `wisdomlinked-meeting-end-on-hangup.js` | `POST /api/meeting/end-call` when last participant hangs up |
| `wisdomlinked-expert-labels.js` | UI fallback: Moderator → Expert i18n overrides |

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

## Whiteboard draw permission

- **Initial:** `config.wisdomlinkedIsMeetingModerator` on join URL → `sessionStorage.wlIsMeetingModerator` (`"0"` = view-only).
- **Live (authoritative):** Poll `GET /api/meeting/permissions?meetingThreadId=` every 5s with meeting-chat Bearer token. Updates draw access when `delegatedModerators` changes — **no rejoin**.
- **Jitsi “Grant expert rights”** (UI; event `grant-moderator`): On the **granter’s** tab, `PARTICIPANT_ROLE_CHANGED` (and aliases) calls `POST /api/meeting/delegate-moderator` / `revoke-delegate-moderator` with the target’s Mongo user id from JWT `context.user.id` (`participant.getIdentity()`).
- Ignores `APP.conference.isModerator()` (Prosody may mark everyone moderator).
- Debug: `config.wisdomlinkedWhiteboardDebug=true` → `[wl-whiteboard]` in console.

### Whiteboard test checklist

| Step | Expected |
|------|----------|
| Host + guest in call | Guest whiteboard view-only |
| Host: Jitsi Grant expert rights on guest | Within ~5–10s guest can draw |
| Host revokes expert rights | Guest returns to view-only |

## Poll creation (moderators only)

- **Policy:** Only meeting moderators (host / group admin / delegated expert) may **create** polls in the Meet chat panel. Guests and students may **view and vote** on existing polls.
- **Authoritative:** Poll `GET /api/meeting/permissions` → `canCreatePoll` (same as `canDrawWhiteboard`). Script polls every 5s.
- **Initial:** `config.wisdomlinkedIsMeetingModerator` on join URL → sessionStorage.
- **UI:** `wisdomlinked-poll-moderator.js` hides “Create poll” controls when `canCreatePoll` is false (CSS + DOM observer).
- Debug: `config.wisdomlinkedPollDebug=true` → `[wl-poll]` in console.

### Poll test checklist

| Step | Expected |
|------|----------|
| Expert host opens polls tab | “Create poll” visible |
| Guest/student joins same call | No create poll button; can vote if poll exists |
| Host grants expert rights to guest | Within ~5–10s guest may create polls |

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
