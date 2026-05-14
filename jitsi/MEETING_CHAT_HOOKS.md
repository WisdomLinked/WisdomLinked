# Jitsi web: meeting chat capture (spike)

This documents how WisdomLinked’s custom bundle (`wisdomlinked-meeting-chat-sync.js`) ties into Jitsi Meet **full-page** clients. Jitsi upgrades can change internals; treat this as integration notes, not a stable API.

## Goals

- Read `config.wisdomlinkedMeetingId` and `config.wisdomlinkedChatSyncToken` from the URL hash (same pattern as `wisdomlinked-copy-meeting-id.js`).
- Detect **new** in-meeting **text** chat lines and `POST` them to WisdomLinked `POST /api/meeting/chat-sync` with `Authorization: Bearer <token>`.

## Polls

Jitsi polls are usually **not** emitted as normal MUC text messages. A text-only listener will not capture poll create/vote events unless your build exposes a dedicated hook. MVP: text only; poll support requires a separate spike on your exact `jitsi-meet` revision.

## Hook strategies (in order of preference)

### 1) Redux store (`APP.store`) — used in `wisdomlinked-meeting-chat-sync.js`

Many `jitsi-meet` builds expose `window.APP.store`. The chat subsystem often lives under `state['features/chat']` (shape varies: `messages`, `messageMap`, `recent`, etc.). The bundled script subscribes to the store, diffs message keys, and dedupes by id.

**Pros:** No iframe; works with current “open meet in new tab” flow.  
**Cons:** State shape changes between Jitsi versions; subscribe handler must stay defensive.

### 2) `APP.conference` / lib-jitsi-meet room

Some versions expose `APP.conference._room` or similar with `addListener('message', ...)`. If Redux is unavailable, the script can try attaching there once per conference join.

**Pros:** Closer to wire events.  
**Cons:** Private fields; breaks more often on upgrades.

### 3) Iframe + External API (fallback)

Host a WisdomLinked page that embeds Jitsi and uses `new JitsiMeetExternalAPI(...)` with `incomingMessage` listeners. Use when full-page hooks are not viable.

**Pros:** Documented External API surface.  
**Cons:** Changes navigation / return-URL behaviour; more FE work.

## Configuration passed in the hash

| Hash key | Purpose |
|----------|---------|
| `config.wisdomlinkedMeetingId` | Mongo `MeetingThread` id |
| `config.wisdomlinkedChatSyncToken` | Short-lived JWT for `POST /api/meeting/chat-sync` |
| `config.wisdomlinkedChatSyncApiBase` | Origin for API (e.g. `https://app.example.com`) so `fetch` works from the meet origin |

## References in-repo

- [`wisdomlinked-copy-meeting-id.js`](./wisdomlinked-copy-meeting-id.js) — hash + `sessionStorage` caching pattern.
- [`wisdomlinked-meeting-chat-sync.js`](./wisdomlinked-meeting-chat-sync.js) — implementation.

## Deploy on the Jitsi web container

Mount both scripts from `custom/` and add two tags in `custom/index.html` (order: copy-meeting-id first, then meeting-chat-sync), for example:

```html
<script src="custom/wisdomlinked-copy-meeting-id.js" defer></script>
<script src="custom/wisdomlinked-meeting-chat-sync.js" defer></script>
```

Rebuild/restart the `web` container and hard-refresh clients after changes.
