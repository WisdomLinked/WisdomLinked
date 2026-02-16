# API Reference

This document provides a detailed catalog of the REST API endpoints in `WisdomLinked/chat`.
Request bodies must be JSON unless otherwise specified (e.g., `multipart/form-data` for image uploads).

## 1. Authentication & Profile (`/api/auth`)

| Method | Endpoint | Auth | Request Body | Response | Description |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **POST** | `/register` | No | `email` (string), `username` (string), `password` (string), `role` (string), `title`, `description`, `keywords`, `services`, `image` (file) | JSON `{ status: 'SUCCESS' }` | Registers a `PendingUser`. Sends OTP. |
| **POST** | `/verifyRegistration` | No | `email`, `confirmCode` | JSON `{ status: 'SUCCESS' }` | Verifies OTP, moves user to `User` collection. |
| **POST** | `/login` | No | `email`, `password` | JSON `{ status: 'SUCCESS' }` | Validation -> Triggers 2FA OTP email. |
| **POST** | `/confirmLoginByCode` | No | `email`, `password`, `code` | JSON `{ status: 'SUCCESS', userDetails: {...} }` | Validates 2FA. Sets `accessToken` cookie. |
| **POST** | `/updateProfile` | Yes | `username`, `title`, `description`, `services` (array), `keywords` (array containing `{value, label, new}`), `price`, etc. | JSON `{ result: UpdatedUser }` | Updates user profile. |
| **POST** | `/updateResume` | No | `email`, `file` (Multipart) | JSON `{ newResume: path }` | Uploads/Replaces resume. |
| **GET** | `/me` | Yes | - | JSON `{ me: { ...user } }` | Get current user's full data. |
| **POST** | `/passwordResetRequest` | No | `email`, `password` | JSON `{ status: 'SUCCESS' }` | Initiates pwd reset flow. |
| **POST** | `/confirmPasswordResetByCode` | No | `email`, `password`, `code` | JSON `{ status: 'SUCCESS' }` | Completes pwd reset. |

## 2. Admin Actions (`/api/admin`)
**Auth**: Requires `admin` check middleware.

| Method | Endpoint | Description |
| :--- | :--- | :--- |
| **POST** | `/filterUsers` | Search/Paginate users. |
| **POST** | `/filterPaymentHistories` | Search financial records. |
| **POST** | `/sendPaymentLinkToUser` | Generate & email a Stripe payment link for retries. |
| **POST** | `/sendAdHocPaymentLink` | Create a one-off payment request for any user. |
| **POST** | `/processRefund` | Process full/partial refund via Stripe & email customer. |
| **POST** | `/setStripeMode` | Switch between 'test' and 'live' Stripe modes (Global). |
| **POST** | `/updateProfileOfUser` | Admin force-update of user profile. |
| **POST** | `/getDirectChatHistory` | View private chat logs. |
| **POST** | `/getGroupChatHistory` | View group chat logs. |
| **POST** | `/registerUserByAdmin` | Manually create user (skip verification). |
| **POST** | `/convertPendingUserToUserByAdmin` | Force approve a pending user. |

## 3. Events & Appointments (`/api/event` via various routes)

These endpoints are scattered but primarily handled by `event.controller.js`.

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/createEvent` | Expert | Creates 1-on-1 session. |
| **POST** | `/appendEvent` | Customer | Customer books/pays for an event. |
| **POST** | `/acceptEvent` | Expert | Expert confirms event. |
| **POST** | `/cancelEvent` | Any | Cancels event & triggers refund if paid. |

## 4. Group Chats & Seminars (`/api/group-chat`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/` | Expert | Create paid seminar/group. |
| **POST** | `/add-to-pending` | User | User "buys ticket" to seminar. |
| **POST** | `/add` | Expert | Admin approves pending user join. |
| **POST** | `/joinGeneralChat` | Any | Joins an expert's free "General Chat". |
| **POST** | `/joinPrivateChat` | Any | Opens a 1:1 chat with another user. |
| **POST** | `/create-community-chat` | Any | Create a new community channel. |
| **POST** | `/join-community-chat` | Any | Join an open community channel. |
| **POST** | `/add-participants-to-community-chat` | Admin | Add users to community chat. |
| **POST** | `/get-all-community-chats`| Any | List all available community channels. |

## 5. Customer Tools (`/api/customer`)

| Method | Endpoint | Auth | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/filterExperts` | Public | Search experts by keyword/service. |
| **POST** | `/filterSeminars` | Public | Search active seminars. |
| **GET** | `/getUser/:id` | Public | Get public profile of expert. |

## 5. AI ChatBot (`/api/chatbot-qa`)

**Auth**: Requires `admin` for write operations; any user for read.
| Method | Endpoint | Body | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/getChatBotAnswer` | `question`, `role` | Fuzzy search for an answer. Auto-saves unknown questions for review. |
| **POST** | `/createChatBotQA` | `question`, `answer`, `role` | Admin: Add new Q&A pair. |
| **GET** | `/getChatBotQA` | `page`, `limit` | Admin: List all Q&A pairs. |
| **PUT** | `/updateChatBotQA/:id` | `question`, `answer`, `role` | Admin: Edit Q&A pair. |
| **DELETE** | `/deleteChatBotQA/:id` | - | Admin: Delete Q&A pair. |

## 6. Friend Invitations (`/api/friend-invitation`)

| Method | Endpoint | Body | Description |
| :--- | :--- | :--- | :--- |
| **POST** | `/invite` | `email` | Send connection request. |
| **POST** | `/accept` | `invitationId` | Accept connection. |
| **POST** | `/reject` | `invitationId` | Reject connection. |

## 6. Misc Endpoints

- **`GET /api/fetchImage`**: `?file=path&folder=dir` - Secure file retrieval.
- **`POST /api/image-upload/upload`**: Single file upload to memory/disk.
- **`POST /api/contact/send-contact`**: Public "Contact Us" form submission.
