# Frontend Deep Dive

This document provides a technical overview of the React frontend (`FE`) architecture.

## 1. Tech Stack
*   **Framework**: React 17
*   **Build Tool**: **Create React App (CRA)** using `react-scripts` v5.0.0.
*   **Language**: TypeScript (`.tsx` / `.ts`)
*   **State Management**: Redux Toolkit (`FE/src/store`)
*   **Routing**: `react-router-dom` v6
*   **UI Library**: Material UI (MUI) v5 + TailwindCSS
*   **Real-time**: `socket.io-client` + `simple-peer` (WebRTC)
    - `Dashboard/`: Main authenticated view. Contains sub-dashboards (`_CustomerDashboard`, `_ExpertDashboard`, `_AdminDashboard`).
    - `Landing.tsx`, `logIn.tsx`, `Register.tsx`: Public pages.
- **`reducers`**: Redux reducer logic.
- **`socket`**: Client-side Socket.io wrappers (`socketConnection.ts`).
- **`store`**: Redux store configuration.
- **`utils`**: Helper functions (validators, API wrappers).

## 2. State Management (Redux)

The application uses `redux-thunk` for async actions (API calls).

### Redux Store Slices (`store/index.ts`)
| Slice | Description | Key State Properties |
| :--- | :--- | :--- |
| `auth` | User session | `userDetails` (id, email, token, role), `error`, `isLoading` |
| `friends` | Social graph | `friends` (list), `pendingInvitations`, `onlineUsers`, `groupChatList` |
| `chat` | Messaging | `chosenChatDetails`, `messages` (history), `typing` status, `chosenGroupChatDetails` |
| `videoChat` | 1-on-1 Calls | `localStream`, `remoteStream`, `callStatus` (ringing/active), `audioOnly` |
| `room` | Group Seminars | `activeRooms`, `roomDetails` (participants, selfMuted), `isUserInRoom`, `screenSharingStream` |
| `alert` | Global Toasts | `showAlert` (bool), `alertMessage` |

### Key Types (`actions/types.ts`)
- **`CurrentUser`**: `{ _id, email, username, token }`
- **`Friend`**: `{ id, username, email, missedChats, lastChatDate }`
- **`Message`**: `{ _id, content, author, type, date }`
- **`ActiveRoom`**: `{ roomId, participants: [], roomCreator }`

## 3. Core Workflows

### Authentication
1.  **Login**: Dispatch `login(email, pwd)` -> API POST -> Cookie set -> Store updates `auth`.
2.  **Socket Connect**: `Dashboard` mounts -> `connectWithSocketServer(userDetails)` -> Socket Auth Handshake.

### Real-Time Chat
1.  **Selection**: User clicks friend/group -> `setChosenChatDetails`.
2.  **History Fetch**: `chatActions.getChatHistory` emits `direct-chat-history`.
3.  **Sending**: `chatActions.sendDirectMessage` emits `direct-message`.
4.  **Receiving**: Socket listener `direct-message` dispatches `addNewMessage` to store.

### Video-Calls (WebRTC)
1.  **Initiation**: `videoChatActions.callRequest` -> Get Local Stream -> Emit `call-request` (with SDP).
2.  **Signaling**: `simple-peer` handles signal exchange via socket events (`call-request`, `call-response`).
3.  **Streams**: `localStream` and `remoteStream` stored in Redux are bound to `<video>` elements in `VideoRequest/VideoChat` components.

## 4. Routing
- **Public**: `/login`, `/register`, `/landing`
- **Protected**: `/dashboard` (Guarded by `auth` state).
- **Sub-Dashboard**: Dynamic rendering based on `user.role` (Customer vs Expert vs Admin).
