# Database Schema Reference

This document provides a comprehensive detail of the MongoDB data models (Mongoose Schemas) used in the WisdomLinked Chat application.

## 1. User and Authentication Models

### **User** (`User.js`)
The central entity for the system. Stores both Customers and Experts.
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `email` | String | Yes | Unique identifier. |
| `username` | String | No | Display name. |
| `phoneNumber` | String | No | Contact number. |
| `password` | String | Yes | Hashed password (excluded by default). |
| `role` | String | Yes | Default: `'customer'`. |
| `token` | String | No | JWT Token (excluded by default). |
| `image` | String | No | URL to profile picture. |
| `country`, `state`, `city` | Mixed | No | Location data. |
| **Relationships** | | | |
| `friends` | [ObjectId] | No | Ref: `User`. |
| `groupChats` | [ObjectId] | No | Ref: `GroupChat`. |
| `events` | [ObjectId] | No | Ref: `Event`. |
| `keywords` | [ObjectId] | No | Ref: `Keyword`. |
| `services` | [ObjectId] | No | Ref: `Service`. |
| **Expert Fields** | | | Only populated if `role` is Expert. |
| `title` | String | No | Professional title. |
| `resume` | String | No | URL/Path to resume. |
| `price` | [Number] | No | Pricing tiers (Default: [5]). |
| `rating` | Number | No | Default: 0. |

### **PendingUser** (`PendingUser.js`)
Temporary storage for users during the registration verification process.
- **Fields**: Mirrors `User` schema + `confirmCode` (String).
- **Purpose**: Holds data until email is verified.

### **PendingLogin** (`PendingLogin.js`)
Stores OTP codes for 2FA/Login verification.
| Field | Type | Description |
| :--- | :--- | :--- |
| `email` | String | User email. |
| `code` | Number | The OTP code sent to email. |

### **PendingPasswordReset** (`PendingPasswordReset.js`)
Stores ephemeral data for password reset flows.
| Field | Type | Description |
| :--- | :--- | :--- |
| `email` | String | User email. |
| `password` | String | New password (temporarily stored). |
| `code` | Number | Verification code. |

---

## 2. Chat and Communication

### **Conversation** (`Conversation.js`)
Direct messaging (1-on-1) container.
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `participants` | [ObjectId] | Yes | Ref: `User` (Array of 2). |
| `messages` | [ObjectId] | Yes | Ref: `Message`. |

### 5. GroupChat
Represents a text/video chat session. Can be a 1-on-1 consultation or a group seminar.
| Field | Type | Description |
| :--- | :--- | :--- |
| `_id` | ObjectId | Unique ID. |
| `name` | String | Chat title. |
| `description` | String | Topic/Agenda. |
| `keywords` | ObjectId[] | Refs to `Keyword`. |
| `services` | ObjectId[] | Refs to `Service`. |
| `admin` | ObjectId | Ref to `User` (Expert/Host). |
| `participants` | ObjectId[] | Refs to `User` (Attendees). |
| `type` | String | `individual`, `seminar`, or `community`. |
| `status` | String | `pending`, `active`, `cancelled`. |
| `isOpenToAll` | Boolean | If true, anyone can join (Community Chat). |
| `start` | Date | Scheduled start time. |
| `end` | Date | Scheduled end time. |
| `duration` | Number | Duration in minutes. |
| `price` | Number | Cost to join (USD). |
| `totalTimeSpent` | Number | Tracks call duration. |
| `messages` | ObjectId[] | Refs to `Message` history. |

### 6. PaymentHistory
Tracks all financial transactions via Stripe.
| Field | Type | Description |
| :--- | :--- | :--- |
| `_id` | ObjectId | Unique ID. |
| `stripeMode` | String | `test` or `live`. |
| `paymentType` | String | `charge`, `retry`, `adhoc`, `refund`. |
| `amount` | Number | Amount in cents. |
| `status` | String | `pending`, `completed`, `failed`, `refunded`. |
| `paymentIntent` | String | Stripe PaymentIntent ID. |
| `customer` | ObjectId | Ref to `User` (Payer). |
| `expert` | ObjectId | Ref to `User` (Payee). |
| `groupChat` | ObjectId | Ref to `GroupChat` (if applicable). |

### 7. PendingAppointmentToGroup
Temporary state when a user pays but hasn't fully joined the group (rare edge case).
| Field | Type | Description |
| :--- | :--- | :--- |
| `customerId` | ObjectId | Ref to `User`. |
| `groupChatId` | ObjectId | Ref to `GroupChat`. |
| `paidBy` | String | `test` or `live`. |

### **ChatBotQA** (`chatBotQA.js`) (New)
Knowledge base for the AI ChatBot.
| Field | Type | Description |
| :--- | :--- | :--- |
| `question` | String | Indexed for Text Search. |
| `answer` | String | The bot's response. |
| `role` | String | Target audience (`user`, `expert`, `customer`). |

### **Message** (`Message.js`)
Individual text messages.
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `author` | ObjectId | Yes | Ref: `User`. |
| `content` | String | Yes | Message text. |
| `type` | String | No | Message type (e.g., text, image). |

### **FriendInvitation** (`FriendInvitation.js`)
Pending connection requests.
| Field | Type | Required | Description |
| :--- | :--- | :--- | :--- |
| `senderId` | ObjectId | Yes | Ref: `User`. |
| `receiverId` | ObjectId | Yes | Ref: `User`. |

---

## 3. Business Logic & Events

### **Event** (`Event.js`)
A booked session (1-on-1 meeting) between an Expert and Customer.
| Field | Type | Default | Description |
| :--- | :--- | :--- | :--- |
| `expert` | ObjectId | - | Ref: `User`. |
| `customer` | ObjectId | - | Ref: `User`. |
| `status` | String | `'pending'` | `pending`, `accepted`, `rejected`? |
| `price` | Number | - | Agreed price. |
| `start`/`end` | Date | - | Time window. |

### **PaymentHistory** (`PaymentHistory.js`)
Record of Stripe transactions.
| Field | Type | Description |
| :--- | :--- | :--- |
| `stripeMode` | String | 'test' or 'live'. |
| `amount` | Number | Transaction value. |
| `paymentIntent` | String | Stripe Intent ID. |
| `customer`/`expert` | ObjectId | Linked users. |

### **MeetingAnalytics** (`MeetingAnalytics.js`)
Post-meeting data and feedback.
| Field | Type | Description |
| :--- | :--- | :--- |
| `type` | String | `event` or `groupchat`. |
| `admin` | ObjectId | Host. |
| `participantsFeedback` | [Schema] | Array of ratings/comments. |

---

## 4. Miscellaneous

- **AppState**: Config store (e.g., current Stripe mode).
- **Keyword**: Tags for searching experts (`value`, `label`).
- **Service**: Categories of services offered (`value`, `label`).
- **ContactedUs**: Form submissions from the "Contact Us" page.
