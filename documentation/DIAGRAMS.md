# Technical Diagrams

## 0. Visual Database Schema
> [!NOTE]
> Please open `VISUAL_DIAGRAMS.html` in the browser


## 1. System Architecture Diagram

```mermaid
graph TD
    subgraph Client [Frontend (React + Redux)]
        UI[User Interface]
        Redux[Redux Store]
        SocketClient[Socket.io Client]
        WebRTC[WebRTC Peer]
    end

    subgraph Server [Backend (Node.js + Express)]
        API[REST API Handlers]
        SocketServer[Socket.io Server]
        Auth[Auth Middleware]
        ChatBot[ChatBot Controller]
    end

    subgraph Database [Storage]
        MongoDB[(MongoDB)]
    end

    subgraph External [External Services]
        Stripe[Stripe Payments]
        Email[Nodemailer/SMTP]
        AWS[AWS S3 Images]
    end

    UI --> Redux
    Redux --> SocketClient
    SocketClient -- "WebSocket Events" --> SocketServer
    UI -- "REST Requests" --> API
    API --> Auth
    Auth --> MongoDB
    SocketServer --> MongoDB
    API --> ChatBot
    ChatBot --> MongoDB
    API --> Stripe
    API --> Email
    WebRTC -. "P2P Stream" .- WebRTC
    SocketClient -. "Signaling" .- SocketServer
```

## 2. Database Schema (Detailed ERD)

```mermaid
erDiagram
    %% Core Users
    User ||--o{ Conversation : "participants (M:N)"
    User ||--o{ GroupChat : "joins (M:N)"
    User ||--o{ GroupChat : "admin (1:N)"
    User ||--o{ Event : "expert/customer (1:N)"
    User ||--o{ FriendInvitation : "sender/receiver (1:N)"
    User ||--o{ PaymentHistory : "payments (1:N)"
    User {
        string _id PK
        string email
        string username
        string role "expert|customer|admin"
        string password
        boolean isVerified
    }

    %% Authentication Temp Tables
    PendingUser {
        string email
        string verificationCode
    }
    PendingLogin {
        string email
        string otpCode
    }

    %% Chat System
    Conversation ||--o{ Message : "contains (1:N)"
    GroupChat ||--o{ Message : "contains (1:N)"
    Conversation {
        string _id PK
        ObjectId[] participants
    }
    GroupChat {
        string _id PK
        string name
        string description
        string type "seminar|individual|community"
        boolean isOpenToAll
        ObjectId admin
        ObjectId[] participants
        number price
    }
    ChatBotQA {
        string _id PK
        string question
        string answer
        string role "user|expert|customer"
    }
    Message {
        string _id PK
        string content
        string type "DIRECT|GROUP"
        ObjectId author
        Date createdAt
    }

    %% Scheduling & Events
    Event ||--o{ MeetingAnalytics : "has (1:1)"
    Event {
        string _id PK
        string title
        ObjectId expert
        ObjectId customer
        Date start
        Date end
        number duration
        number price
        string status "booked|completed"
    }

    %% Finances
    PaymentHistory {
        string _id PK
        ObjectId userId
        number amount
        string paymentIntentId
        string stripeMode "test|live"
        string status "pending|completed|failed"
        string paymentType "charge|adhoc|retry"
    }

    %% Relationships not directly linked but logical
    FriendInvitation {
        ObjectId senderId
        ObjectId receiverId
    }
```
