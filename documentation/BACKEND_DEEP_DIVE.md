# Backend Deep Dive & Architecture

## 1. High-Level Architecture
The backend is a **Monolithic Node.js/Express Application** that serves as the central orchestrator for the WisdomLinked platform.
*   **Runtime**: Node.js
*   **Framework**: Express.js
*   **Database**: MongoDB (via Mongoose ODM)
*   **Real-time Engine**: Socket.io (integrated with the HTTP server)
*   **External Services**: Stripe (Payments), SendGrid (Email), DigitalOcean Spaces + FaaS (Storage).

---

## 2. Authentication & Security Layer
Authentication is handled via **JWT (JSON Web Tokens)** stored in **HTTP-Only Cookies**.

### **The "Rolling Session" Pattern**
Located in `BE/middlewares/requireAuth.js`.
1.  **Verification**: Every protected request verifies `req.cookies.accessToken`.
2.  **Double Check**: It checks if the user exists in DB and if the `user.token` matches the cookie (Server-side session invalidation capability).
3.  **Refresh**: On *every* successful authenticated request, a **new** token is generated and sent back as a cookie (`res.cookie`), extending the session.

### **Authorization Middleware**
*   `requireAuth`: Basic login check.
*   `customerAuth`: Enforces `role === 'customer'`.
*   `expertAuth`: Enforces `role === 'expert'`.
*   `adminAuth`: Enforces `role === 'admin'`.

---

## 3. Real-Time Logic (Socket.io)
Located in `BE/socket/socketServer.js`.
The application uses a **Modular Socket Architecture**. The main `io` instance routes events to specific handlers in `BE/socketControllers/`.

| Key Event | Handler | Purpose |
| :--- | :--- | :--- |
| `connection` | `newConnectionHandler` | Registers `socket.id` to `userId` in memory. |
| `direct-message` | `directMessageHandler` | Saves Msg to DB -> Emits to Receiver. |
| `call-request` | `callRequestHandler` | Initiates WebRTC signaling for 1:1 calls. |
| `room-create` | `roomCreateHandler` | Creates a group video room. |
| `conn-signal` | `roomSignalingDataHandler` | Relays WebRTC SDP/ICE candidates between peers. |

**Critical Note**: The socket server enforces authentication using `requireSocketAuth`, reusing the same JWT logic as the REST API.

---

## 4. Boot & Initialization Logic
Located in `BE/initDB.js`.
When the server starts (`server-https.js` -> `mongoose.connect`), it runs specific initialization routines:
1.  **`appendDefaultServices`**: Ensures default expert services (e.g., "Study abroad consultation") exist in the DB.
2.  **`appendAdminUser`**: Checks if `admin@toe.com` exists. If not, creates it with a hardcoded default password (⚠️ Security Risk).
3.  **`initAppStates`**: Ensures the `AppState` collection has a `stripeMode` entry (defaults to 'test').

---

## 5. File Usage & Storage (Hybrid)
**Critical Observation**: The system uses two completely different methods for file storage.
1.  **Profile Images**:
    *   **Service**: `BE/services/imageUploadService.js`
    *   **Method**: Proxies to a **DigitalOcean Serverless Function** (`https://faas-nyc1...`).
2.  **Resumes**:
    *   **Service**: `BE/controllers/auth.controller.js` (see `uploadFileToS3`)
    *   **Method**: Uses `AWS-SDK` configured with **DigitalOcean Spaces** endpoints (`DO_SPACES_ENDPOINT`).
*   **Risk**: Logic is split. `imageUploadService` depends on an external FaaS URL, while `auth` controller depends on local `.env` vars for DO Spaces keys.

---

## 6. Payment Architecture (Stripe)
The system supports multiple payment flows, handled in `stripe.controller.js`.

### A. Seminar Purchase Flow
1.  **Selection**: User clicks "Pay" on a seminar.
2.  **Intent**: `createStripePaymentIntent` is called with `amount` and `groupChatId`.
3.  **Client-Side**: Stripe Elements confirms the payment.
4.  **Completion**: `appendEvent` or `addMemberToPendingGroup` is called with the `paymentIntentId`.
5.  **Verification**: Backend retrieves the Intent from Stripe to verify status `succeeded` before adding the user.

### B. Ad-Hoc & Retry Payments
*   **Ad-Hoc**: Admin can generate a custom link (`sendAdHocPaymentLink`) for any amount.
*   **Retry**: If a payment fails, Admin can trigger `sendPaymentLinkToUser` to email a new checkout link.
*   **Refunds**: Admin can issue partial/full refunds via `processRefund`.

### C. Environment Toggling
*   The controller checks an `AppState` variable (`stripeMode`) to switch between `STRIPE_SECRET_KEY_TEST` and `STRIPE_SECRET_KEY_LIVE`.
*   **Risk**: This runtime toggle is unusual and prone to errors if keys aren't perfectly synced.

---

## 7. Community Chat Logic
Located in `groupChat.controller.js`.
*   **Type**: `groupChat.type === 'community'`.
*   **Visibility**: If `isOpenToAll: true`, the chat appears in the public "Browse Communities" list.
*   **Access Control**:
    *   **Open**: Anyone can join via `joinCommunityChat`.
    *   **Closed**: Requires Admin invitation (`addParticipantsToCommunityChat`).
*   **General Chats**: Every Expert has a default "General Chat" (free) that users can join via `joinGeneralChat`.

---

## 8. AI ChatBot Logic
Located in `BE/controllers/chatBotQA.controller.js` and `BE/models/chatBotQA.js`.
*   **Mechanism**: MongoDB Text Search.
*   **Flow**:
    1.  User asks a question.
    2.  `getChatBotAnswer` searches the `ChatBotQA` collection using `$text` search on the `question` field.
    3.  **Hit**: Returns the answer with the highest text score.
    4.  **Miss**: If no match is found, it **creates a new entry** with `answer: "Pending answer..."`.
*   **Purpose**: This allows Admins to see what users are asking and provide answers later, effectively building a knowledge base over time.

---

## 9. Directory Structure Reference
*   `controllers/`: REST API business logic (e.g., `auth.controller.js`).
*   `socketControllers/`: Socket.io event logic (e.g., `directMessageHandler.js`).
*   `models/`: Mongoose Schemas.
*   `middlewares/`: Express middlewares (Auth, Validation).
*   `services/`: Helper logic (Emails, Image Proxy).
*   `routes/`: API Route definitions.
*   `cert/`: SSL Certificates (Required for HTTPS).
