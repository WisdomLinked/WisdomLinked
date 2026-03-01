# WisdomLinked Backend Feature Inventory
**Category:** analysis  
**Date:** 2026-03-01  
**Purpose:** Complete API + Socket + Model map for full rewrite planning onto TypeScript/Elysia

---

## Table of Contents
1. [REST API Routes](#1-rest-api-routes)
2. [Mongoose Models](#2-mongoose-models)
3. [Socket.IO Events](#3-socketio-events)
4. [Socket State — In-Memory Stores](#4-socket-state--in-memory-stores)
5. [Services & Middleware](#5-services--middleware)
6. [Third-Party Integrations](#6-third-party-integrations)
7. [Database Seed / Init](#7-database-seed--init)
8. [Environment Variables](#8-environment-variables)
9. [Key Architectural Observations & Rewrite Concerns](#9-key-architectural-observations--rewrite-concerns)

---

## 1. REST API Routes

All routes are mounted in `server.js`. Auth middleware variants:
- **`requireAuth(restrictUnderReview)`** — any authenticated user; when `true`, blocks `status=review` users
- **`customerAuth(restrictUnderReview)`** — `role=customer` only
- **`expertAuth(restrictUnderReview)`** — `role=expert` only
- **`adminAuth`** — `role=admin` only
- **none** — public endpoint

All auth middleware verifies a JWT `accessToken` cookie AND the server-side stored `user.token` (double-token pattern). On success it re-issues a new cookie and refreshes the stored token.

---

### 1.1 Auth Routes — `/api/auth`

| Method | Path | Auth | Controller | Description |
|--------|------|------|------------|-------------|
| POST | `/register` | none | `auth.register` | Creates `PendingUser`, uploads resume to DO Spaces S3, sends verification email via SendGrid |
| POST | `/resendConfirmEmail` | none | `auth.resendConfirmEmail` | Resends email-verification link to pending user |
| POST | `/verifyRegistration` | none | `auth.verifyRegistration` | Confirms email code, promotes `PendingUser` → `User`, creates general chats, notifies admin |
| POST | `/login` | `validateLoginSchema` | `auth.login` | Validates credentials, creates `PendingLogin` with OTP code (currently hardcoded `123456`), sends OTP email |
| POST | `/confirmLoginByCode` | none | `auth.confirmLoginByCode` | Verifies OTP, issues JWT cookie, updates timezone |
| POST | `/passwordResetRequest` | none | `auth.passwordResetRequest` | Creates `PendingPasswordReset`, sends OTP email |
| POST | `/confirmPasswordResetByCode` | none | `auth.confirmPasswordResetByCode` | Verifies OTP, updates user password |
| GET | `/getKeywordsAndServices` | none | `auth.getKeywordsAndServices` | Returns all `Keyword` and `Service` documents |
| POST | `/updateMissedChats` | `requireAuth(false)` | `auth.updateMissedChats` | Updates `user.missedChats[id]` count |
| POST | `/updateProfile` | `requireAuth(false)` | `auth.updateProfile` | Updates profile fields (username, title, description, image, keywords, services, country, state, city, phone, price, joinPopupBlocked) |
| POST | `/updateResume` | `requireAuth(false)` + multer | `auth.updateResume` | Replaces resume file in DO Spaces S3 |
| POST | `/uploadChatFile` | `requireAuth(false)` + multer | `auth.uploadChatFile` | Uploads a chat attachment to DO Spaces S3; returns URL |
| GET | `/me` | `requireAuth(false)` | `auth.getMe` | Returns fully-populated current user |
| GET | `/getMyEvents` | `requireAuth(false)` | `event.getMyEvents` | Returns current user's events (via full user data) |
| POST | `/getEventsBetweenCustomerAndExpert` | `requireAuth(false)` | `event.getEventsBetweenCustomerAndExpert` | Body: `{expertId, customerId, isOngoing}` |
| POST | `/submit` | `requireAuth(false)` + multer | `auth.handleSubmit` | Saves uploaded file to `uploads/docs/` directory (local FS) |
| POST | `/leaveFeedback` | `requireAuth(false)` | `auth.leaveFeedback` | Appends feedback to target user's `feedbacks[]`, recalculates rating |
| POST | `/stripePay` | `requireAuth(false)` | `stripe.stripePay` | Legacy Stripe charge (test mode only) |
| POST | `/createStripePaymentIntent` | `requireAuth(false)` | `stripe.createStripePaymentIntent` | Body: `{stripeMode, amount}`; returns `client_secret` |
| POST | `/getStripeMode` | `requireAuth(false)` | `stripe.getStripeMode` | Returns `AppState.stripeMode` |
| GET | `/healthCheck` | none | `auth.healthCheck` | Returns "OK Ready" |
| GET | `/getTimezone` | none | `auth.getTimeZone` | Query: `{lat, lng}`; proxies to TimezoneDB API |
| POST | `/contact-form` | none | `auth.submitContactForm` | Saves `ContactedUs` document |
| POST | `/sendEmailToAdmin` | none | `auth.sendEmailToAdmin` | Sends arbitrary message to admin via SendGrid |
| POST | `/getChatBotAnswer` | `requireAuth(true)` | `chatBotQA.getChatBotAnswer` | Full-text search chatbot Q&A, saves unanswered questions |
| POST | `/stripe-webhook` | none (raw body) | `stripe.handleStripeWebhook` | Stripe signed webhook — handles `checkout.session.completed` for retry and ad-hoc payments |

---

### 1.2 Friend Invitation Routes — `/api/invite-friend`

| Method | Path | Auth | Body | Controller | Description |
|--------|------|------|------|------------|-------------|
| POST | `/invite` | `requireAuth(false)` | `{email}` (Joi validated) | `friendInvitation.inviteFriend` | Creates `FriendInvitation`, pushes real-time socket update |
| POST | `/accept` | `requireAuth(false)` | `{invitationId}` (Joi) | `friendInvitation.acceptInvitation` | Deletes invitation, adds to each user's `friends[]`, socket updates |
| POST | `/reject` | `requireAuth(false)` | `{invitationId}` (Joi) | `friendInvitation.rejectInvitation` | Deletes invitation, socket update |
| POST | `/remove` | `requireAuth(false)` | `{friendId}` (Joi) | `friendInvitation.removeFriend` | Removes from both users' `friends[]`, socket updates |

---

### 1.3 Group Chat Routes — `/api/group-chat`

| Method | Path | Auth | Body / Params | Controller | Description |
|--------|------|------|---------------|------------|-------------|
| GET | `/get-all-community-chats` | `requireAuth(false)` | — | `groupChat.getAllCommunityChats` | Returns community chats (open or user is participant) with `isJoined` flag |
| GET | `/:groupChatId` | `requireAuth(true)` | — | `groupChat.getGroupChat` | Fetches single group chat by ID (24-char ObjectId) |
| POST | `/join` | `requireAuth(true)` | `{groupChatId, payment_intent}` | `groupChat.joinGroupChat` | Joins active seminar; validates payment; schedules email reminder |
| POST | `/` | `expertAuth(true)` | `{name, description, services, keywords, start, end, duration, price, type, status, customerId}` | `groupChat.createGroupChat` | Expert creates seminar/individual chat; notifies customer by email if individual |
| POST | `/create-by-user` | `requireAuth(true)` | `{name, description, services, keywords, start, end, duration, price, expert, payment_intent}` | `groupChat.createGroupChatByUser` | Customer creates individual chat with expert; validates payment; emails expert |
| POST | `/accept-individual-appointment` | `requireAuth(true)` | `{groupChatId, payment_intent}` | `groupChat.acceptIndividualAppointment` | Activates a pending individual chat; sends acceptance/reminder emails |
| POST | `/update` | `expertAuth(false)` | `{groupId, name, description, services, keywords, start, end, duration, price, totalTimeSpent, type}` | `groupChat.updateGroupChat` | Expert updates group chat fields |
| POST | `/add` | `expertAuth(true)` | `{_id, friendId, groupChatId}` | `groupChat.addMemberToGroup` | Expert accepts a pending appointment; moves customer from pending → active participant |
| POST | `/add-to-pending` | `requireAuth(true)` | `{groupChatId, payment_intent, price}` | `groupChat.addMemberToPendingGroup` | User requests to join seminar with payment; creates `PendingAppointmentToGroup` |
| POST | `/joinGeneralChat` | `requireAuth(false)` | `{adminId}` | `groupChat.joinGeneralChat` | Joins expert's "general chat" room |
| POST | `/joinPrivateChat` | `requireAuth(false)` | `{personId}` | `groupChat.joinPrivateChat` | Opens or creates a 1:1 individual chat between two users |
| POST | `/create-community-chat` | `requireAuth(false)` | `{name, description, participants, isOpenToAll}` | `groupChat.createCommunityChat` | Creates a community chat; adds all participants |
| POST | `/join-community-chat` | `requireAuth(false)` | `{communityChatId}` | `groupChat.joinCommunityChat` | Joins an open community chat |
| POST | `/add-participants-to-community-chat` | `requireAuth(false)` | `{communityChatId, participantIds[]}` | `groupChat.addParticipantsToCommunityChat` | Admin adds new participants to community chat |
| POST | `/cancel-individual-appointment` | `requireAuth(false)` | `{groupChatId}` | `groupChat.cancelIndividualAppointment` | Cancels pending individual chat; triggers Stripe refund if paid |
| POST | `/delete` | `expertAuth(false)` | `{groupChatId}` | `groupChat.deleteGroup` | Expert deletes a group; removes from all participants |

---

### 1.4 Expert Routes — `/api/expert`

| Method | Path | Auth | Body | Controller | Description |
|--------|------|------|------|------------|-------------|
| POST | `/updateDailyTimeSlots` | `expertAuth(false)` | `{newSlots, startTime, endTime}` | `expert.updateDailyTimeSlots` | Replaces slots in a time range, preserves others |
| POST | `/getDailyTimeSlots` | `requireAuth(false)` | `{startTime, endTime, userId?}` | `expert.getDailyTimeSlots` | Returns time slots within range for a user |
| POST | `/updateTimeSlots` | `expertAuth(false)` | `{timeSlots}` | `expert.updateTimeSlots` | Replaces expert's recurring time slot array |
| POST | `/acceptEvent` | `expertAuth(true)` | `{eventId}` | `event.acceptEvent` | Sets event to `accepted`; makes friends if invitation; sends acceptance + reminder emails |
| POST | `/updateEvent` | `expertAuth(true)` | `{eventId, updates}` | `event.updateEvent` | Updates event fields; sends email to expert if status changes |
| POST | `/declineEvent` | `expertAuth(false)` | `{eventId}` | `event.declineEvent` | Sets event to `declined`; deletes invitation |
| POST | `/cancelInvitation` | `expertAuth(false)` | `{eventId}` | `event.cancelInvitation` | Deletes event and invitation from all users |
| POST | `/filterCustomers` | `expertAuth(false)` | `{_id?, username?, keywords?, services?, sortBy?}` | `expert.filterCustomers` | Expert searches customers with filters |
| GET | `/getUser/:id` | `expertAuth(false)` | — | `expert.getCustomerById` | Returns customer by ID |
| POST | `/createEvent` | `expertAuth(true)` | `{title, start, end, duration, price, expert, customer, createdBy}` | `event.createEventByExpert` | Expert creates event for customer; creates FriendInvitation if needed |
| POST | `/createEventFeedback` | `expertAuth(true)` | `{_id, updateData}` | `event.createFeedback` | Adds/updates expert feedback on event |
| POST | `/shareMeetingViaEmail` | `expertAuth(true)` | `{email, groupchatId}` | `expert.shareMeetingViaEmail` | Sends meeting ID via email |

---

### 1.5 Customer Routes — `/api/customer`

| Method | Path | Auth | Body | Controller | Description |
|--------|------|------|------|------------|-------------|
| POST | `/filterExperts` | `customerAuth(false)` | `{_id?, username?, keywords?, services?, sortBy?}` | `customer.filterExperts` | Customer searches experts with filters (excludes blocked) |
| GET | `/getUser/:id` | `customerAuth(false)` | — | `customer.getExpertById` | Returns expert by ID |
| POST | `/filterSeminars` | `customerAuth(false)` | `{name?, keywords?, services?, sortBy?}` | `customer.filterSeminars` | Finds active/upcoming seminars user isn't in |
| POST | `/appendEvent` | `customerAuth(true)` | `{title, start, end, duration, price, paidBy, expert, customer, payment_intent, eventId?, createdBy}` | `event.appendEvent` | Books/confirms event; validates Stripe payment; creates PaymentHistory; handles friend invitation |
| POST | `/updateEvent` | `customerAuth(true)` | `{eventId, updates}` | `event.updateEvent` | Updates event |
| POST | `/cancelEvent` | `customerAuth(false)` | `{eventId}` | `event.cancelEvent` | Cancels event; triggers Stripe refund; creates refund PaymentHistory |
| POST | `/cancelPendingSeminar` | `customerAuth(false)` | `{pendingSeminarId}` | `groupChat.cancelPendingSeminar` | Cancels pending seminar join request; refunds |
| POST | `/leftSeminar` | `customerAuth(false)` | `{seminarId}` | `groupChat.leftSeminar` | Customer leaves active seminar (pre-start only); refunds |
| POST | `/createEventFeedback` | `customerAuth(true)` | `{_id, updateData}` | `event.createFeedback` | Customer feedback on event |

---

### 1.6 Admin Routes — `/api/admin`

| Method | Path | Auth | Body | Controller | Description |
|--------|------|------|------|------------|-------------|
| POST | `/setStripeMode` | `adminAuth` | `{stripeMode}` | `stripe.setStripeMode` | Sets `AppState.stripeMode` to `test` or `live` |
| POST | `/sendPaymentLinkToUser` | `adminAuth` | `{paymentHistoryId, customerEmail, customAmount?, customDescription?}` | `stripe.sendPaymentLinkToUser` | Creates Stripe payment link for a failed payment; sends email; creates pending PaymentHistory |
| POST | `/processRefund` | `adminAuth` | `{paymentHistoryId, refundAmount, refundReason}` | `stripe.processRefund` | Issues Stripe refund; creates refund PaymentHistory; emails customer |
| POST | `/sendAdHocPaymentLink` | `adminAuth` | `{amount, description, customerEmail, customerName?}` | `stripe.sendAdHocPaymentLink` | Creates ad-hoc Stripe payment link; creates user if needed (isAdHocCustomer=true) |
| POST | `/filterUsers` | `adminAuth` | `{username?, email?, role?, sortBy?, sortOrder?, numPerPage, currentPage}` | `admin.filterUsers` | Paginated user search (excludes admins) |
| POST | `/filterPaymentHistories` | `adminAuth` | `{email?, sortBy?, stripeMode?, paymentType?, status?, dateFrom?, dateTo?, numPerPage, currentPage}` | `admin.filterPaymentHistories` | Paginated payment history search |
| POST | `/getFullUserDataByEmail` | `adminAuth` | `{email}` | `admin.getFullUserDataByEmail` | Returns deeply populated user |
| POST | `/updateProfileOfUser` | `adminAuth` | `{email, username?, title?, description?, image?, keywords?, services?, country?, state?, city?, phoneNumber?, price?, joinPopupBlocked?, status?}` | `admin.updateProfileOfUser` | Admin updates any user; sends approval email if status → active |
| POST | `/getDirectChatHistory` | `adminAuth` | `{senderId, receiverId, currentPage}` | `admin.getDirectChatHistory` | Returns paginated direct messages between two users |
| POST | `/getGroupChatHistory` | `adminAuth` | `{groupChatId, currentPage}` | `admin.getGroupChatHistory` | Returns paginated group messages |
| GET | `/getEventFeedback` | `adminAuth` | — | `event.getFeedback` | Returns event feedback (requires `_id` in body — inconsistent: GET with body) |
| POST | `/getUserFeedbacks` | `adminAuth` | `{userId}` | `admin.getUserFeedbacks` | Returns enriched feedback list for a user (populates event/groupChat/otherUser) |
| POST | `/getContactedUs` | `adminAuth` | `{name?, email?, dateFrom?, dateTo?, sortBy?, sortOrder?, actioned?}` | `admin.getContactedUs` | Filtered contact form submissions |
| POST | `/toggleActionedStatus` | `adminAuth` | `{id}` | `admin.toggleActionedStatus` | Toggles `ContactedUs.actioned` between Yes/No |
| POST | `/sendEmailToUser` | `adminAuth` | `{email, message}` | `admin.sendEmailToUser` | Sends custom email to user via SendGrid |
| POST | `/sendWelcomeEmail` | `adminAuth` | `{email, password}` | `admin.sendWelcomeEmail` | Sends welcome email with credentials |
| GET | `/getPendingUsers` | `adminAuth` | — | `admin.getPendingUsers` | Returns all `PendingUser` documents |
| GET | `/getPendingLogins` | `adminAuth` | — | `admin.getPendingLogins` | Returns all `PendingLogin` documents |
| POST | `/deletePendingUser` | `adminAuth` | `{pendingUserId}` | `admin.deletePendingUser` | Deletes a pending user |
| POST | `/deletePendingLogin` | `adminAuth` | `{pendingLoginId}` | `admin.deletePendingLogin` | Deletes a pending login record |
| POST | `/convertPendingUserToUserByAdmin` | `adminAuth` | `{pendingUserId}` | `admin.convertPendingUserToUserByAdmin` | Promotes PendingUser → User with `status=active` |
| POST | `/registerUserByAdmin` | `adminAuth` | `{role, username, title, description, keywords, services, country, state, city, phoneNumber, email, password, timeSlots}` | `admin.registerUserByAdmin` | Admin directly creates a new User (status=active, no email verification) |
| POST | `/createChatBotQA` | `adminAuth` | `{question, answer, role}` | `chatBotQA.createChatBotQA` | Creates chatbot Q&A entry |
| GET | `/getChatBotQA` | `adminAuth` | Query: `{page, limit}` | `chatBotQA.getChatBotQA` | Paginated chatbot Q&A list |
| POST | `/updateChatBotQA/:id` | `adminAuth` | `{question?, answer?, role?}` | `chatBotQA.updateChatBotQA` | Updates chatbot Q&A by ID |
| POST | `/deleteChatBotQA/:id` | `adminAuth` | — | `chatBotQA.deleteChatBotQA` | Deletes chatbot Q&A by ID |

---

### 1.7 Image Routes

| Method | Full Path | Auth | Description |
|--------|-----------|------|-------------|
| POST | `/api/image-upload/upload` | none | Multer memory → DO Serverless imageUpload + imageResize |
| GET | `/api/image-fetch?file=&folder=` | none | Proxy to DO Serverless imageFetch; returns binary with cache headers |

---

### 1.8 Contact Routes — `/api`

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/send-contact` | none | `{targetEmail, name, email, demand}` | Sends contact details email via SendGrid `sendContactDetails` |

---

### 1.9 Meeting Analytics Routes — `/api/meeting-analytics`

| Method | Path | Auth | Body | Description |
|--------|------|------|------|-------------|
| POST | `/create` | `requireAuth()` | `{type, _id, admin}` | Creates `MeetingAnalytics` doc if not exists (ID = event/groupChat ID) |
| POST | `/update` | `requireAuth()` | `{_id, userId, role, rating, feedback}` | Adds or updates participant feedback |
| POST | `/get` | `requireAuth()` | `{_id}` | Returns analytics doc with admin + feedback users populated |

---

## 2. Mongoose Models

### 2.1 User

**File:** `BE/models/User.js`

| Field | Type | Notes |
|-------|------|-------|
| email | String | unique, required |
| username | String | — |
| phoneNumber | String | — |
| country | Mixed | — |
| state | Mixed | — |
| city | Mixed | — |
| image | String | URL to profile image |
| role | String | default `'customer'`; values: `customer`, `expert`, `admin` |
| friends | [ObjectId → User] | — |
| groupChats | [ObjectId → GroupChat] | Seminars/individual meetings |
| generalChats | [ObjectId → GroupChat] | Community/general chats |
| pendingGroupChats | [ObjectId → PendingAppointmentToGroup] | — |
| missedChats | Mixed | `{[chatId]: count}` map |
| events | [ObjectId → Event] | 1:1 meeting events |
| keywords | [ObjectId → Keyword] | Expert specializations |
| services | [ObjectId → Service] | Services offered/sought |
| joinPopupBlocked | Boolean | UI preference |
| feedbacks | [Mixed] | Received feedback objects |
| status | String | default `'review'`; values: `review`, `active`, `blocked` |
| timeZone | String | default `'UTC'` |
| isActive | Boolean | default `true` |
| isAdHocCustomer | Boolean | default `false`; flag for payment-only accounts |
| token | String | select: false; server-side stored JWT (double-token auth) |
| password | String | select: false; bcrypt hash |
| title | String | Expert: professional title |
| resume | String | Expert: S3 URL |
| description | String | Expert: bio |
| timeSlots | [Number] | Expert: recurring availability slots |
| dailyTimeSlots | [Number] | Expert: per-day availability |
| price | [Number] | Expert: price array; default 5 |
| rating | Number | Expert: calculated average; default 0 |

**Methods:**
- `generateAuthToken()` — Signs JWT `{ email }`, saves token to self, returns token. Expiry from `COOKIE_EXPIRED_TIME` env or `'24h'`.

---

### 2.2 PendingUser

**File:** `BE/models/PendingUser.js`

Mirror of User schema (no `token`, `timeZone`, `isActive`, `isAdHocCustomer`) plus:

| Field | Type | Notes |
|-------|------|-------|
| confirmCode | String | UUID for email verification |
| status | String | default `'review'` |

Used as a staging area before email confirmation. Deleted on `verifyRegistration`.

---

### 2.3 PendingLogin

**File:** `BE/models/PendingLogin.js`

| Field | Type | Notes |
|-------|------|-------|
| email | String | unique, required |
| code | Number | 6-digit OTP |
| validUntil | Date | default: now + 60 seconds; TTL index `expires: 0` auto-deletes |

---

### 2.4 PendingPasswordReset

**File:** `BE/models/PendingPasswordReset.js`

| Field | Type | Notes |
|-------|------|-------|
| email | String | unique, required |
| password | String | bcrypt-hashed new password (stored until confirmed) |
| code | Number | 6-digit OTP |

Model name in Mongoose: `"PasswordReset"` (file name vs model name mismatch).

---

### 2.5 Event

**File:** `BE/models/Event.js`

| Field | Type | Notes |
|-------|------|-------|
| expert | ObjectId → User | — |
| customer | ObjectId → User | — |
| start | Date | — |
| end | Date | — |
| duration | Number | minutes |
| totalTimeSpent | Number | default 0; accumulated |
| title | String | — |
| status | String | default `'pending'`; values: `pending`, `accepted`, `declined`, `cancelled` |
| paidBy | String | `'test'`, `'live'`, `'none'` |
| price | Number | — |
| createdBy | ObjectId → User | — |
| feedbacks | [Mixed] | Array of feedback objects |

---

### 2.6 GroupChat

**File:** `BE/models/GroupChat.js`

| Field | Type | Notes |
|-------|------|-------|
| name | String | required |
| description | String | — |
| keywords | [ObjectId → Keyword] | — |
| services | [ObjectId → Service] | — |
| start | Date | — |
| end | Date | — |
| duration | Number | minutes |
| price | Number | — |
| paidBy | String | — |
| type | String | enum: `seminar`, `individual`, `community`; default `seminar` |
| status | String | enum: `pending`, `active`, `cancelled`; default `pending` |
| createdBy | ObjectId → User | required |
| totalTimeSpent | Number | default 0 |
| participants | [ObjectId → User] | — |
| admin | ObjectId → User | required; typically the expert |
| isOpenToAll | Boolean | default false; for community chats |
| messages | [ObjectId → Message] | — |

---

### 2.7 Conversation

**File:** `BE/models/Conversation.js`

| Field | Type | Notes |
|-------|------|-------|
| participants | [ObjectId → User] | required |
| messages | [ObjectId → Message] | required |

Used exclusively for direct (1:1) messages. Has a `type: "DIRECT"` filter used in queries (but `type` is not in the schema — effectively unset).

---

### 2.8 Message

**File:** `BE/models/Message.js`

| Field | Type | Notes |
|-------|------|-------|
| author | ObjectId → User | required |
| content | String | required |
| type | String | `'DIRECT'` or `'GROUP'` |

Shared between `Conversation.messages` and `GroupChat.messages`.

---

### 2.9 FriendInvitation

**File:** `BE/models/FriendInvitation.js`

| Field | Type | Notes |
|-------|------|-------|
| senderId | ObjectId → User | required |
| receiverId | ObjectId → User | required |
| events | [ObjectId → Event] | Associated meeting events |

Dual purpose: both a "connect with me" invitation AND an event-negotiation container (expert-created events attach here until accepted/declined).

---

### 2.10 PaymentHistory

**File:** `BE/models/PaymentHistory.js`

| Field | Type | Notes |
|-------|------|-------|
| stripeMode | String | default `'test'` |
| paymentType | String | default `'charge'`; values: `charge`, `refund`, `retry`, `adhoc` |
| amount | Number | in cents (Stripe convention) |
| currency | String | default `'usd'` |
| description | String | — |
| paymentIntent | String | Stripe paymentIntent ID |
| status | String | enum: `pending`, `completed`, `failed`, `refunded`; default `'completed'` |
| customer | ObjectId → User | — |
| expert | ObjectId → User | — |
| pendingAppointmentToGroup | ObjectId → PendingAppointmentToGroup | — |
| groupChat | ObjectId → GroupChat | — |
| event | ObjectId → Event | — |

Refunds create a new record with `paymentType: 'refund'` and negative `amount`.

---

### 2.11 PendingAppointmentToGroup

**File:** `BE/models/PendingAppointmentToGroup.js`

| Field | Type | Notes |
|-------|------|-------|
| customerId | ObjectId → User | required |
| groupChatId | ObjectId → GroupChat | required |
| paidBy | String | `'test'` or `'live'` |

Staging area for seminar join requests awaiting expert approval.

---

### 2.12 AppState

**File:** `BE/models/AppState.js`

| Field | Type | Notes |
|-------|------|-------|
| stripeMode | String | default `'test'`; `'test'` or `'live'` |

Singleton global state for the application. Only one document expected.

---

### 2.13 MeetingAnalytics

**File:** `BE/models/MeetingAnalytics.js`

| Field | Type | Notes |
|-------|------|-------|
| _id | ObjectId | Custom — equals the Event or GroupChat ID |
| type | String | required; enum: `event`, `groupchat` |
| admin | ObjectId → User | required; meeting host |
| participantsFeedback | [feedbackSchema] | See sub-schema below |

**feedbackSchema sub-document:**

| Field | Type | Notes |
|-------|------|-------|
| userId | ObjectId → User | — |
| role | String | required; enum: `expert`, `customer` |
| rating | Number | default 0 |
| feedback | String | default `""` |

---

### 2.14 ChatBotQA

**File:** `BE/models/chatBotQA.js`

| Field | Type | Notes |
|-------|------|-------|
| question | String | — |
| answer | String | — |
| role | String | enum: `customer`, `expert`, `user`; default `user` |

**Indexes:** `{ question: "text" }` — MongoDB full-text search index.

---

### 2.15 ContactedUs

**File:** `BE/models/ContactedUs.js`

| Field | Type | Notes |
|-------|------|-------|
| name | String | required |
| email | String | required |
| countryCode | String | — |
| contactNumber | String | — |
| issue | String | — |
| actioned | String | default `'No'`; toggled `Yes`/`No` by admin |
| createdAt | Date | default `Date.now` (no `timestamps: true` used) |

---

### 2.16 Keyword

**File:** `BE/models/Keyword.js`

| Field | Type | Notes |
|-------|------|-------|
| value | String | — |
| label | String | — |

Tag/skill labels for expert filtering.

---

### 2.17 Service

**File:** `BE/models/Service.js`

| Field | Type | Notes |
|-------|------|-------|
| value | String | — |
| label | String | — |

Service category labels. 4 defaults seeded on startup.

---

## 3. Socket.IO Events

**Setup:** `socket/socketServer.js` → `createSocketServer(httpServer)`  
**Auth:** `requireSocketAuth` middleware on `io.use(...)`. Looks up user by `socket.handshake.auth.email`, verifies stored JWT. Sets `socket.user = { email, userId, username }`.  
**CORS:** `process.env.FE_URL` only.

---

### 3.1 Incoming Events (Client → Server)

| Event | Data | Handler | Auth Required | Description |
|-------|------|---------|---------------|-------------|
| `connection` | — | `newConnectionHandler` | yes | Registers connection, emits online-users, friend/group/room lists |
| `direct-message` | `{receiverUserId, message}` | `directMessageHandler` | yes | Creates `Message`, finds or creates `Conversation`, notifies participants |
| `group-message` | `{groupChatId, message}` | `groupMessageHandler` | yes | Creates `Message`, appends to `GroupChat.messages`, notifies participants |
| `direct-chat-history` | `{receiverUserId, currentPage}` | `directChatHistoryHandler` | yes | Finds conversation, emits paginated history (20/page) to requesting socket |
| `group-chat-history` | `{groupChatId, currentPage}` | `groupChatHistoryHandler` | yes | Fetches paginated group messages (20/page), emits to requesting socket |
| `notify-typing` | `{chatId?, receiverId?, typing}` | `notifyTypingHandler` | yes | Broadcasts typing status to 1:1 receiver or all group participants |
| `call-request` | `{receiverUserId, callerName, audioOnly, signal, eventId}` | `callRequestHandler` | yes | Verifies event is ongoing; forwards WebRTC call request to receiver |
| `call-response` | `{callerId, accepted, signal}` | `callResponseHandler` | yes | Relays accept/reject to caller's sockets |
| `notify-chat-left` | `{receiverUserId, fromOngoing}` | `notifyChatLeft` | yes | Notifies receiver that peer left the chat |
| `setRemoteVideoAudioStatus` | `{otherUserId, ...}` | inline | yes | Relays video/audio status to target user |
| `cancelCallRequest` | `{otherUserId}` | inline | yes | Cancels outgoing call request |
| `room-create` | `{groupId}` | `roomCreateHandler` | yes | Creates in-memory room entry, emits `room-create` to creator, updates room lists for group participants |
| `room-join` | `{roomId}` | `roomJoinHandler` | yes | Validates not kicked; adds to room; emits `conn-prepare` to existing participants |
| `room-leave` | `{roomId}` | `roomLeaveHandler` | yes | Removes from room; notifies remaining participants |
| `kickCustomerFromRoom` | `{customerId, roomId}` | `kickCustomerFromRoomHandler` | yes | Expert-only; adds to kicked list, sends `kicked-off-by-expert` |
| `forceMuteCustomerFromRoom` | `{customerId, roomId}` | `forceMuteCustomerFromRoomHandler` | yes | Expert adds to muted list, sends `muted-by-expert` |
| `enableAudioCustomerFromRoom` | `{customerId, roomId}` | `enableAudioCustomerFromRoomHandler` | yes | Expert removes from muted, sends `enabled-audio-by-expert` |
| `setAudioStatusInRoom` | `{customerId, roomId, audioStatus}` | `setAudioStatusInRoomHandler` | yes | User toggles self-mute state |
| `conn-init` | `{connUserSocketId}` | `roomInitializeConnectionHandler` | yes | WebRTC step 3: sends `conn-init` back to peer |
| `conn-signal` | `{connUserSocketId, signal}` | `roomSignalingDataHandler` | yes | WebRTC step 5: relays signaling data to peer |
| `log-out` | — | `disconnectHandler` | yes | Graceful logout: removes from connectedUsers, notifies rooms |
| `disconnect` | — | `disconnectHandler` | yes | Same as log-out |

---

### 3.2 Outgoing Events (Server → Client)

| Event | Emitter | Payload | Description |
|-------|---------|---------|-------------|
| `online-users` | `newConnectionHandler`, `disconnectHandler` | `[{userId, socketId}]` | Full list of connected users |
| `friend-invitations` | `updateUsersInvitations` | `[FriendInvitation]` (populated) | Pending incoming invitations for user |
| `friends-list` | `updateUsersFriendsList` | `[User + conversationMeta]` | Friends with last chat date, missed chat count |
| `groupChats-list` | `updateUsersGroupChatList` | `[groupChatSummary]` | User's seminars/individual/community chats |
| `direct-chat-history` | `directChatHistoryHandler`, `updateChatHistory` | `{messages[], participants[]}` | Paginated direct message history |
| `direct-message` | `sendNewDirectMessage` | `{newMessage, participants[]}` | Single new direct message |
| `group-chat-history` | `groupChatHistoryHandler` | `{messages[], groupChatId}` | Paginated group message history |
| `group-message` | `sendNewGroupMessage` | `{newMessage, groupChatId}` | Single new group message |
| `notify-typing` | `notifyTypingHandler` | `{chatId, senderUserId, typing}` | Typing indicator |
| `call-request` | `callRequestHandler` | `{callerName, callerUserId, audioOnly, signal}` | Incoming WebRTC call |
| `cancelCallRequest` | `callRequestHandler`, inline | — | Call cancelled |
| `call-response` | `callResponseHandler` | `{otherUserId, accepted, signal}` | Call accept/reject |
| `notify-chat-left` | `notifyChatLeft` | `{userId, fromOngoing}` | Peer left the chat |
| `setRemoteVideoAudioStatus` | inline | `{...data}` | Remote video/audio status |
| `active-rooms` | `updateRooms` | `{activeRooms[]}` | Updated room list (broadcast or targeted) |
| `active-rooms-initial` | `initialRoomsUpdate` | `{activeRooms[]}` | Rooms visible to user (own rooms + friends' rooms) |
| `room-create` | `roomCreateHandler` | `{roomDetails}` | Room created confirmation to creator |
| `room-participant-left` | `roomLeaveHandler`, `disconnectHandler` | `{connUserSocketId}` | Participant left the WebRTC room |
| `conn-prepare` | `roomJoinHandler` | `{connUserSocketId}` | WebRTC: prepare for incoming connection |
| `conn-init` | `roomInitializeConnectionHandler` | `{connUserSocketId}` | WebRTC: initiate peer connection |
| `conn-signal` | `roomSignalingDataHandler` | `{signal, connUserSocketId}` | WebRTC: exchange SDP/ICE |
| `kicked-off-by-expert` | `kickCustomerFromRoomHandler`, `roomJoinHandler` | — | Customer was/is kicked |
| `muted-by-expert` | `forceMuteCustomerFromRoomHandler` | — | Expert forced mute |
| `enabled-audio-by-expert` | `enableAudioCustomerFromRoomHandler` | — | Expert enabled audio |

---

## 4. Socket State — In-Memory Stores

### 4.1 `connectedUsers` (socket/connectedUsers.js)

A plain mutable array `[{userId, socketId}]`. **No upper bound.** Supports multiple socket entries per user (multi-tab).

Key functions:
- `addNewConnectedUser({socketId, userId})` — push
- `removeConnectedUser({socketId})` — splice by socketId
- `getActiveConnections(userId)` — filter by userId → `socketId[]`
- `getOnlineUsers()` — returns full array
- `setServerSocketInstance(io)` / `getServerSocketInstance()` — io singleton

### 4.2 `activeRooms` (socket/activeRooms.js)

A plain mutable array. Room shape:
```
{
  roomId: uuid-v4,
  groupId: string (GroupChat._id),
  roomCreator: { userId, socketId, username },
  participants: [{ userId, socketId, username }],
  kickedParticipants: [userId],
  mutedParticipants: [userId],
  selfMutedParticipants: [userId],
}
```

Key functions: `addNewActiveRoom`, `getActiveRoom` (by roomId or groupId), `joinActiveRoom`, `leaveActiveRoom`, `leaveAllRooms`, `appendKickedParticipant`, `appendMutedParticipant`, `removeMutedParticipant`, `appendSelfMutedParticipant`, `removeSelfMutedParticipant`, `updateActiveRoomsOfUsers`.

---

## 5. Services & Middleware

### 5.1 services/global.js

```
checkTitleNameInvalid(title, str) → string | false
```
Guards reserved words: `"general chat"`, `"admin"`, `"global chat"` (case-insensitive).

---

### 5.2 services/notifications.js (SendGrid)

All emails sent from `noreply@wisdomlinked.com`.

| Function | Recipient | Trigger |
|----------|-----------|---------|
| `sendEmailNewUserAccountApproval(userName)` | `admin@wisdomlinked.com`, `xbwang@tamu.edu` | New user completes email verification |
| `sendEmailUserAccountApproved(targetEmail, userName)` | User | Admin sets status → `active` |
| `scheduleEmailReminder(targetEmail, userName, title, start, duration, timeZone)` | User | Meeting accepted; uses SendGrid `sendAt` (15 min before meeting) |
| `sendEmailMeetingAcceptance(targetEmail, userName, title, start, duration, timeZone)` | Customer/expert | Meeting accepted |
| `sendEmailMeetingRequestToExpert(targetEmail, expertName, name, start, duration, price, newEvent, timeZone)` | Expert | New or updated meeting request |
| `sendEmailMeetingRequestToCustomer(targetEmail, name, customerName, start, duration, price, timeZone)` | Customer | Expert-created meeting |
| `shareMeetingId(targetEmail, name, meetingId, title)` | Arbitrary email | Expert calls shareMeetingViaEmail |
| `sendNotificationEmail(targetEmails, subject, html, scheduledTime?)` | Any | Internal helper; supports scheduled delivery |

---

### 5.3 services/utils.js (SendGrid utilities)

| Function | Description |
|----------|-------------|
| `getCurrentDateString()` | Returns `DD-MM-YYYY` |
| `sendOTP(targetEmail, dateStr, html)` | Sends OTP email (registration, login, password reset) |
| `sendContactDetails(targetEmail, name, email, demand)` | Sends contact form email |

---

### 5.4 services/fetchImageService.js

```
getImage(file, folder) → { data: Buffer, contentType: string }
```
Proxies to DigitalOcean Serverless Function `imageFetch`. Does not use S3 directly.

---

### 5.5 services/imageUploadService.js

```
uploadImageToStorage(file) → response.data
```
1. POSTs file to DO Serverless `imageUpload`
2. GETs DO Serverless `imageResize?key=originals/{filename}` to trigger resize

---

### 5.6 middlewares/requireAuth.js

Four exported middleware factories. Common algorithm:
1. Extract `accessToken` from cookies
2. Decode access token JWT (check expiry)
3. Find user by email, select `+token`
4. Check `user.status !== 'blocked'`
5. Optionally check `status !== 'review'` if `restrictUnderReview=true`
6. Verify stored `user.token` against decoded email + expiry (double-token check)
7. Re-issue new token and set new cookie (rolling sessions)
8. Populate `req.user` with user document (password/token nulled)

Also exports: `getFullUserData(email)` — deeply populated user for business logic.

---

### 5.7 middlewares/requireSocketAuth.js

Uses `socket.handshake.auth.email` (not cookie). Finds user, verifies stored token. Sets `socket.user = { email, userId }`. Note: error handling has a bug — `return error` instead of `return next(error)`.

---

### 5.8 middlewares/validator.js

Two Express middleware functions using regex + length checks:
- `validateRegisterSchema` — email regex, username ≥ 3, password ≥ 6
- `validateLoginSchema` — email regex, password ≥ 6

No Zod/Joi used here (friendInvitationRoutes uses express-joi-validation separately).

---

### 5.9 middlewares/multerConfig.js

```
uploads = multer({ storage: memoryStorage }).single("media")
```
Single file upload for field `"media"`. Used for register, updateResume, uploadChatFile, handleSubmit.

---

### 5.10 turn.js (TURN Server)

Self-hosted `node-turn` TURN server:
- Port: `3480`
- IPs: `0.0.0.0`
- Auth: `long-term` with hardcoded credential
- Used for WebRTC peer connection traversal

---

## 6. Third-Party Integrations

### 6.1 Stripe

| Aspect | Detail |
|--------|--------|
| Package | `stripe@^14.11.0` |
| Env vars | `STRIPE_SECRET_KEY_TEST`, `STRIPE_SECRET_KEY_LIVE`, `STRIPE_WEBHOOK_SECRET` |
| Two modes | Test / Live, switchable at runtime via `AppState.stripeMode` |
| Features used | Payment Intents, Charges, Payment Links, Refunds, Webhook (checkout.session.completed) |
| Webhook | Mounted **before** `express.json()` with raw body for signature verification |
| Security | Validates amount + authorized email on payment link completion |
| Special flows | Retry payment (admin sends link for failed payment), Ad-hoc payment (admin sends link to any email) |

---

### 6.2 SendGrid

| Aspect | Detail |
|--------|--------|
| Packages | `@sendgrid/mail@^8.1.4`, `@sendgrid/client` |
| Env var | `SENDGRID_API_KEY` |
| From address | `noreply@wisdomlinked.com` |
| Features | Transactional email, scheduled email (`sendAt` Unix timestamp), HTML templates |
| Use cases | OTP codes (login, register, password reset), meeting notifications, welcome emails, admin alerts, refund confirmations, payment links |

---

### 6.3 AWS SDK / DigitalOcean Spaces

| Aspect | Detail |
|--------|--------|
| Package | `aws-sdk@^2.1692.0` |
| Env vars | `DO_SPACES_ENDPOINT`, `DO_SPACES_KEY`, `DO_SPACES_SECRET`, `DO_SPACES_BUCKET` |
| Usage | `s3.upload()`, `s3.deleteObject()` |
| Folders | `resumes/` (expert resume PDFs), `chatFiles/` (chat attachments) |
| ACL | `public-read` |
| URL pattern | `https://{bucket}.{endpoint}/{key}` |

---

### 6.4 DigitalOcean Serverless Functions

| Aspect | Detail |
|--------|--------|
| Base URL | `https://faas-nyc1-2ef2e6cc.doserverless.co/api/v1/web/fn-de24ea01-bfb2-4672-9e1c-82d2f1b3000a/package1/` |
| Functions | `imageFetch`, `imageUpload`, `imageResize` |
| Used by | `fetchImageService.js` (fetch), `imageUploadService.js` (upload + resize) |
| Note | These are separate from S3 Spaces; used for profile/group images |

---

### 6.5 TimezoneDB API

| Aspect | Detail |
|--------|--------|
| URL | `https://api.timezonedb.com/v2.1/get-time-zone` |
| Env var | `TIMEZONE_API_KEY` |
| Usage | `GET /getTimezone?lat=&lng=` endpoint proxies to this API |

---

### 6.6 TURN/STUN (WebRTC)

| Aspect | Detail |
|--------|--------|
| Package | `node-turn@^0.0.6` |
| Port | `3480` |
| Auth | Long-term, single hardcoded credential |
| Purpose | TURN relay for WebRTC peer connections through NAT/firewalls |
| Started separately | `turn.js` run as a separate process |

---

## 7. Database Seed / Init

**File:** `BE/initDB.js` — called at server startup after MongoDB connects.

### `appendDefaultServices()`
Seeds 4 services if `Service.count() === 0`:
1. "Study abroad consultation"
2. "Scientific paper guidance"
3. "Overseas work consultation"
4. "Overseas life sharing"

### `appendAdminUserAndGroupChat()`
- Creates admin user if not exists:
  - `email: "admin@wisdomlinked.com"`
  - `password: "no9x@mhc#z11l<k"` (bcrypt hashed)
  - `role: "admin"`
- Creates `"Global Chat"` GroupChat (admin as admin + participant)
- Creates `"Admin"` GroupChat (admin as admin + participant)
- Adds both to `admin.generalChats`

### `initAppStates()`
Creates `AppState{ stripeMode: 'test' }` if none exists.

---

## 8. Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `MONGO_URI` | yes | MongoDB connection string (no database name — appended separately) |
| `JWT_SECRET` | yes | Secret for signing/verifying JWTs |
| `COOKIE_EXPIRED_TIME` | no | JWT/cookie expiry (default: `'24h'`) |
| `PORT` | no | HTTP server port (default: `5000`) |
| `FE_URL` | yes | Frontend URL (CORS + email links) |
| `MAX_REQUEST_BODY_SIZE` | no | Express body size limit (default: `'1mb'`) |
| `STRIPE_SECRET_KEY_TEST` | yes | Stripe test secret key |
| `STRIPE_SECRET_KEY_LIVE` | yes | Stripe live secret key |
| `STRIPE_WEBHOOK_SECRET` | yes | Stripe webhook endpoint signing secret |
| `SENDGRID_API_KEY` | yes | SendGrid API key |
| `DO_SPACES_ENDPOINT` | yes | DigitalOcean Spaces endpoint (e.g., `https://nyc3.digitaloceanspaces.com`) |
| `DO_SPACES_KEY` | yes | DO Spaces access key ID |
| `DO_SPACES_SECRET` | yes | DO Spaces secret key |
| `DO_SPACES_BUCKET` | yes | DO Spaces bucket name |
| `TIMEZONE_API_KEY` | yes | TimezoneDB API key |
| `NODE_ENV` | no | Environment (development/production) |

---

## 9. Key Architectural Observations & Rewrite Concerns

### Critical Issues

1. **OTP hardcoded to `"123456"`** — `login()` and `passwordResetRequest()` contain `const code = "123456"` (commented-out `randomize()` call). All users can log in or reset passwords with this static code. Must generate real random OTPs.

2. **Socket auth bug** — `requireSocketAuth.js` line 40: `return error` instead of `return next(error)`. Errors are silently swallowed; malformed auth continues.

3. **`Conversation` missing `type` field** — The schema has no `type` field, but queries filter `type: "DIRECT"`. This means the filter never matches, breaking direct chat history retrieval. In practice the first `Conversation` found is used.

4. **Unbounded in-memory arrays** — `connectedUsers[]` and `activeRooms[]` have no eviction policy. Server restart wipes them (breaking active sessions).

5. **Admin password in source code** — `initDB.js` has plaintext admin password `"no9x@mhc#z11l<k"` committed to source.

6. **`event.getFeedback`** — `GET /admin/getEventFeedback` reads `_id` from `req.body`, but GET requests typically have no body. Works only if client sends a body with GET (non-standard).

7. **Model name mismatch** — `PendingPasswordReset.js` registers as `"PasswordReset"` not `"PendingPasswordReset"`.

8. **`leaveGroup` is never exposed via a route** — `groupChat.leaveGroup` is exported but no route calls it. `leftSeminar` handles seminar-specific leave; general group leave may be missing.

9. **Stripe mode in `appendEvent`** — passes `'live'` string but checks `paymentIntentSucceeded_live` which is set to `checkPaymentIntentSucceeded(payment_intent, 'live')` — the second argument should match `AppState.stripeMode`.

10. **`filterSeminars` ignores `type`** — returns all GroupChats that aren't in the past and don't include the user, regardless of `type`. Should filter `type: 'seminar'`.

### Features to Rebuild

| Feature Area | Complexity | Notes |
|---|---|---|
| Auth (register/verify/login/OTP/password-reset) | High | 2-step flows with TTL documents |
| User profiles (expert vs customer) | Medium | Unified schema with role-specific fields |
| Friend system | Medium | Invitation → friends list |
| Event scheduling | High | States: pending/accepted/declined/cancelled; payment gates; email triggers |
| Group chats (seminar/individual/community) | High | 3 types, pending-approval flow for seminars |
| Direct messaging | Medium | Conversation-based, paginated |
| Group messaging | Medium | GroupChat-embedded messages, paginated |
| Real-time (Socket.IO) | High | 20+ events, in-memory state |
| WebRTC rooms | High | Full signaling relay + room management (kick/mute) |
| Stripe payments | High | 4 payment flows + webhook + refunds + ad-hoc |
| Admin panel | Medium | User management, chat inspection, contact management |
| ChatBot Q&A | Low | Full-text search, admin CRUD, user query |
| Meeting analytics | Low | Feedback collection per meeting |
| File storage (S3 + DO Functions) | Medium | Two separate storage paths |
| Email notifications | Medium | 10+ email types including scheduled |
| TURN server | Low | Self-hosted, needs credentials management |

### State to Migrate

The following application state must survive the rewrite:
- All `User` documents (with friends, groupChats, events arrays)
- All `Event` documents
- All `GroupChat` documents
- All `Conversation` + `Message` documents
- All `PaymentHistory` documents
- `AppState` (stripeMode)
- `Keyword` and `Service` reference data

The following can be dropped (pending/ephemeral):
- `PendingLogin` (TTL — auto-expires)
- `PendingPasswordReset`
- `PendingUser` (pre-verification staging)
- `PendingAppointmentToGroup` (complete or refund before migration)
- `FriendInvitation` (resolve before migration)
