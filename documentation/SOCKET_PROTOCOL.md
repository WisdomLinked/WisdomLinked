# Socket.io Protocol Reference

This document details the real-time event protocol used between the Client (`FE`) and Server (`BE`).
All events are namespaced under the default `/` namespace.

## 1. Connection & Auth
- **Middleware**: `requireSocketAuth` extracts user from JWT in cookies.
- **Connection**: On connect, the server maps `socket.id` to `userId`.

## 2. Client -> Server Events (Emitters)

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `direct-message` | `{ receiverUserId, message }` | Send a 1-on-1 message. |
| `group-message` | `{ groupChatId, message }` | Send a message to a group. |
| `direct-chat-history` | `{ receiverUserId, currentPage }` | Request paged history for DM. |
| `group-chat-history` | `{ groupChatId, currentPage }` | Request paged history for Group. |
| `call-request` | `{ receiverUserId, callerName, audioOnly, signal, eventId }` | Initiate WebRTC call. `signal` is SDP data. |
| `call-response` | `{ callerId, accepted, signal }` | Accept/Reject call. |
| `notify-typing` | `{ receiverUserId, typing }` | Send typing indicator boolean. |
| `room-create` | `{ ... }` | Create a video room (deprecated logic?). |
| `room-join` | `{ roomId }` | Join a video room. |
| `room-leave` | `{ roomId }` | Leave a video room. |
| `conn-signal` | `{ signal, connUserSocketId }` | WebRTC Mesh signaling (for multi-user rooms). |
| `setRemoteVideoAudioStatus` | `{ otherUserId, ... }` | Toggle Mic/Camera status in call. |

## 3. Server -> Client Events (Listeners)

| Event Name | Payload | Description |
| :--- | :--- | :--- |
| `friends-list` | `[User Objects]` | Updates the list of friends (live status/profile). |
| `groupChats-list` | `[Group Objects]` | Updates the list of active/pending group chats. |
| `friend-invitations`| `[Invitation Objects]` | Updates pending friend requests. |
| `direct-message` | `{ newMessage, participants }` | Incoming DM. |
| `group-message` | `{ newMessage, groupChatId }` | Incoming Group message. |
| `direct-chat-history`| `{ messages: [], participants }` | Response to history request. |
| `call-request` | `{ callerName, callerUserId, signal }` | Incoming call alert. |
| `call-response` | `{ otherUserId, accepted, signal }` | Answer to outgoing call. |
| `active-rooms` | `{ activeRooms: [] }` | List of active video rooms (for dashboard). |
| `room-participant-left`| `{ ... }` | Notification that peer left the room. |
| `kicked-off-by-expert` | `{ roomId }` | Force-remove user from seminar. |
| `muted-by-expert` | `{ roomId }` | Force-mute user's microphone. |
| `enabled-audio-by-expert`| `{ roomId }` | Admin un-muted user. |
| `setAudioStatusInRoom` | `{ customerId, roomId, audioStatus }` | Broadcast mute state changes to all peers. |

## 4. WebRTC Signaling Flow (1-on-1)
1.  **Caller** generates SDP Offer. Emits `call-request` with `signal`.
2.  **Server** relays `call-request` to `receiverUserId`.
3.  **Receiver** generates SDP Answer. Emits `call-response` with `signal`.
4.  **Server** relays `call-response` to `callerUserId`.
5.  **P2P Connection** established directly (Mesh).

## 5. WebRTC Signaling Flow (Rooms)
Uses a Mesh network topology where every client connects to every other client.
1.  **Joiner** emits `room-join`.
2.  **Server** tells existing participants (`conn-prepare`) to prepare for new connection.
3.  **Clients** exchange `conn-init` and `conn-signal` through server to establish distinct P2P links for every pair.
