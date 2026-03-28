# WisdomLinked — Chat Suite Evaluation Report

**Date:** March 27, 2026  
**Prepared for:** WisdomLinked Development Team  
**Purpose:** Evaluate and select a production-ready chat solution to replace the existing custom WebSocket (Socket.IO) implementation

---

## 1. Executive Summary

WisdomLinked currently uses a custom-built Socket.IO chat system that handles direct messaging, group messaging, typing indicators, and WebRTC-based calling. This implementation is fragile, difficult to scale, lacks offline message delivery, and does not provide enterprise-grade reliability.

This document evaluates **four paid chat suites** and **one open-source alternative** to determine the best path forward. Video calling is handled separately via Jitsi and is out of scope for this evaluation.

**Recommendation:** Rocket.Chat (self-hosted) as the primary option for its zero cost, enterprise-grade features, and full data ownership — with CometChat as the paid fallback if the team prefers a fully managed service.

---

## 2. Current Architecture — What We're Replacing

### Files & Components to Be Removed

| Directory / File | Purpose | Lines of Code |
|---|---|---|
| `BE/socket/socketServer.ts` | Socket.IO server initialization, event wiring | ~159 |
| `BE/socket/connectedUsers.ts` | In-memory connected user tracking | ~50 |
| `BE/socket/activeRooms.ts` | Active room/channel management | ~170 |
| `BE/socketControllers/directMessageHandler.ts` | 1:1 message handling | ~50 |
| `BE/socketControllers/groupMessageHandler.ts` | Group message handling | ~50 |
| `BE/socketControllers/directChatHistoryHandler.ts` | Fetch DM history from MongoDB | ~30 |
| `BE/socketControllers/groupChatHistoryHandler.ts` | Fetch group history from MongoDB | ~35 |
| `BE/socketControllers/notifyTypingHandler.ts` | Typing indicator broadcast | ~40 |
| `BE/socketControllers/notifyConnectedSockets.ts` | Presence/online status | ~300 |
| `BE/socketControllers/callRequestHandler.ts` | WebRTC call initiation | ~35 |
| `BE/socketControllers/callResponseHandler.ts` | WebRTC call response | ~30 |
| `BE/socketControllers/newConnectionHandler.ts` | New socket connection setup | ~35 |
| `BE/socketControllers/disconnectHandler.ts` | Cleanup on disconnect | ~25 |
| `BE/socketControllers/notifyChatLeft.ts` | Chat leave notification | ~25 |
| `BE/socketControllers/room/*` | WebRTC room management (create, join, leave, signaling) | ~200 |
| Frontend Socket.IO client code | All socket event listeners and emitters | ~varied |

**Total:** ~15+ files, ~1,200+ lines of custom socket code to be replaced by the chat suite's SDK.

### Current Limitations

- **No offline message delivery** — if a user is disconnected, messages are lost
- **No read receipts** — no way to know if a message was seen
- **No message search** — chat history is basic, no full-text search
- **No push notifications** — only works when app is open in browser
- **Single server bottleneck** — Socket.IO state is in-memory, cannot scale horizontally
- **No encryption** — messages transmitted without end-to-end encryption
- **No file/image preview** — basic file sharing only
- **Manual connection management** — reconnection logic is fragile

---

## 3. Evaluation Criteria

Each solution is evaluated on the following criteria, weighted by importance to WisdomLinked:

| Criteria | Weight | Description |
|---|---|---|
| **Cost** | ★★★★★ | Monthly/annual cost at various MAU tiers |
| **Feature Completeness** | ★★★★★ | 1:1 chat, group chat, history, typing, read receipts, file sharing, search |
| **Integration Effort** | ★★★★ | Time and complexity to integrate with React frontend + Node.js backend |
| **Scalability** | ★★★★ | Ability to handle growing user base without rearchitecting |
| **Security** | ★★★★ | Encryption, authentication, data ownership, compliance |
| **Reliability** | ★★★ | Uptime SLAs, message delivery guarantees |
| **Developer Experience** | ★★★ | Documentation quality, SDK quality, community support |

---

## 4. Paid Options

### 4.1 CometChat

**Website:** https://www.cometchat.com  
**G2 Rating:** ⭐ 4.7/5

#### Overview
CometChat is a dedicated in-app chat SDK platform offering drop-in UI kits for React, React Native, Angular, Vue, and Flutter. It handles the full chat stack — messaging infrastructure, storage, delivery, and pre-built UI components.

#### Features

| Feature | Available? | Notes |
|---|---|---|
| 1:1 Chat | ✅ | |
| Group Chat | ✅ | Unlimited members on paid plans |
| Chat History & Storage | ✅ | Fully managed, persistent, searchable |
| Typing Indicators | ✅ | |
| Read Receipts | ✅ | |
| File/Image Sharing | ✅ | With previews |
| Message Search | ✅ | Full-text search |
| Offline Messaging | ✅ | Messages queued and delivered on reconnect |
| Push Notifications | ✅ | FCM, APNs |
| Reactions & Threads | ✅ | |
| AI Smart Replies | ✅ | Advanced plan and above |
| AI Moderation | ✅ | Advanced plan and above |
| Voice/Video Calling | ✅ | Pay-as-you-go ($0.001/min voice, $0.003/min video) |
| Webhooks | ✅ | Real-time event callbacks to your server |
| REST API | ✅ | Full server-side API |
| Pre-built React UI Kit | ✅ | Production-ready, themeable |
| End-to-End Encryption | ❌ | In-transit encryption (TLS) only |

#### Pricing

| Plan | Monthly Cost | MAU Included | Overage | Key Features |
|---|---|---|---|---|
| **Build (Free)** | $0 | 100 | — | All core features, development only |
| **Basic** | $299/mo | 1,000 | $0.10/MAU | Full chat, no AI |
| **Advanced** | $449/mo | 1,000 | $0.10/MAU | + AI moderation, smart replies |
| **Enterprise** | From $1,249/mo | 10,000+ | Zero overage | + SSO, dedicated infra, priority support |

#### Projected Cost at Scale

| MAU | Estimated Monthly Cost |
|---|---|
| 500 | $0 (free tier) |
| 1,000 | $299 |
| 5,000 | $299 + (4,000 × $0.10) = **$699** |
| 10,000 | ~$1,249 (Enterprise) |

#### Pros
- Best React UI Kit in the market — production-ready out of the box
- Excellent documentation and quick-start guides
- REST API + Webhooks allow full backend integration
- Zero overage on Enterprise plans — predictable billing
- Voice/video available if you ever want to move off Jitsi

#### Cons
- $299/mo minimum for production use
- No end-to-end encryption (only TLS in-transit)
- Your data lives on CometChat's servers

---

### 4.2 TalkJS

**Website:** https://talkjs.com  
**G2 Rating:** ⭐ 4.5/5

#### Overview
TalkJS is designed for the fastest possible integration. It provides pre-built Inbox, Chatbox, and Popup UI components that can be embedded with just a few lines of JavaScript. Best MAU-to-price ratio at the entry level.

#### Features

| Feature | Available? | Notes |
|---|---|---|
| 1:1 Chat | ✅ | |
| Group Chat | ✅ | Capped at 100 (Basic) / 300 (Growth) participants |
| Chat History & Storage | ✅ | Fully managed |
| Typing Indicators | ✅ | |
| Read Receipts | ✅ | |
| File/Image Sharing | ✅ | |
| Message Search | ⚠️ | Growth plan only |
| Offline Messaging | ✅ | |
| Push Notifications | ✅ | Email, SMS, Push, Desktop |
| Reactions & Threads | ⚠️ | Limited |
| AI Features | ❌ | Basic profanity filter only |
| Voice/Video Calling | ❌ | Not available |
| Webhooks | ✅ | |
| REST API | ✅ | |
| Pre-built UI | ✅ | Inbox, Chatbox, Popup layouts — highly customizable |
| End-to-End Encryption | ❌ | |
| Email-Chat Sync | ✅ | Users can reply to chats via email |

#### Pricing

| Plan | Monthly Cost | MAU Included | Overage | Key Features |
|---|---|---|---|---|
| **Dev Mode** | $0 | Testing only | — | Full features, not for production |
| **Basic** | $279/mo | 10,000 | $0.04/MAU | Core chat, 100-person groups |
| **Growth** | $569/mo | 25,000 | $0.03/MAU | + Search, translation, 300-person groups |
| **Enterprise** | Custom | Custom | Custom | + On-premise, priority support |

#### Projected Cost at Scale

| MAU | Estimated Monthly Cost |
|---|---|
| 5,000 | $279 |
| 10,000 | $279 |
| 15,000 | $279 + (5,000 × $0.04) = **$479** |
| 25,000 | $569 |

#### Pros
- **Cheapest per-MAU** — 10K users for $279/mo
- Fastest integration of any option (literally minutes)
- Email-chat sync is unique and useful for expert consultations
- Clean, polished pre-built UI

#### Cons
- **Group chat capped at 100-300 participants** — deal-breaker for large channels
- No voice/video at all
- Basic moderation only, no AI features
- No HIPAA or SOC 2 compliance
- No end-to-end encryption

---

### 4.3 Stream (GetStream)

**Website:** https://getstream.io  
**G2 Rating:** ⭐ 4.6/5

#### Overview
Stream is the most scalable option, used by companies like Adobe, IBM, and SAP. It offers a powerful React SDK with highly customizable components and advanced AI/moderation features. Best suited for apps expecting rapid growth.

#### Features

| Feature | Available? | Notes |
|---|---|---|
| 1:1 Chat | ✅ | |
| Group Chat | ✅ | No participant limits |
| Chat History & Storage | ✅ | Unlimited, fully searchable |
| Typing Indicators | ✅ | |
| Read Receipts | ✅ | |
| File/Image Sharing | ✅ | |
| Message Search | ✅ | Full-text + semantic search |
| Offline Messaging | ✅ | |
| Push Notifications | ✅ | |
| Reactions & Threads | ✅ | |
| AI Features | ✅ | Gen AI responses, AI moderation, smart suggestions |
| Voice/Video Calling | ✅ | Billed separately |
| Webhooks | ✅ | |
| REST API | ✅ | |
| Pre-built React SDK | ✅ | Themeable, highly customizable |
| End-to-End Encryption | ❌ | In-transit only |

#### Pricing

| Plan | Monthly Cost | MAU Included | Overage | Key Features |
|---|---|---|---|---|
| **Build (Free)** | $0 | 100 | — | Development only |
| **Start** | $499/mo | 10,000 | ~$0.05/MAU | Full chat features |
| **Elevate** | $1,299/mo | 25,000 | ~$0.05/MAU | + Advanced moderation, analytics |
| **Enterprise** | Custom | 100,000+ | Custom | + Dedicated infra, SLAs |

#### Projected Cost at Scale

| MAU | Estimated Monthly Cost |
|---|---|
| 5,000 | $499 |
| 10,000 | $499 |
| 25,000 | $1,299 |
| 50,000 | Custom (Enterprise) |

#### Pros
- Best scalability — handles millions of concurrent users
- Most powerful API and SDK
- Advanced AI moderation and semantic filtering
- Excellent documentation, great developer experience
- No group size limits

#### Cons
- **Most expensive** entry point ($499/mo)
- Video/livestream billed separately on top
- More setup required than TalkJS/CometChat
- Overkill for early-stage apps

---

### 4.4 Sendbird

**Website:** https://sendbird.com  
**G2 Rating:** ⭐ 4.3/5

#### Overview
Sendbird is the most feature-complete platform, offering chat, voice, and video as a unified product. It includes an AI chatbot builder and supports supergroup channels with up to 20,000 members. Best if you want to replace both chat AND video calling in one platform.

#### Features

| Feature | Available? | Notes |
|---|---|---|
| 1:1 Chat | ✅ | |
| Group Chat | ✅ | Supergroups up to 20K members |
| Chat History & Storage | ✅ | Fully managed |
| Typing Indicators | ✅ | |
| Read Receipts | ✅ | |
| File/Image Sharing | ✅ | |
| Message Search | ✅ | |
| Offline Messaging | ✅ | |
| Push Notifications | ✅ | |
| Reactions & Threads | ✅ | |
| AI Chatbot Builder | ✅ | No-code chatbot creation |
| Voice/Video Calling | ✅ | Built-in, included in plan |
| Webhooks | ✅ | |
| REST API | ✅ | |
| Pre-built React UIKit | ✅ | |
| End-to-End Encryption | ❌ | In-transit only |

#### Pricing

| Plan | Monthly Cost | MAU Included | Key Limitations |
|---|---|---|---|
| **Developer (Free)** | $0 | 100 | 30-day trial of Pro features |
| **Starter** | ~$399/mo | 1,000 | Limited PCC (peak concurrent connections) |
| **Pro** | ~$499/mo | 5,000 | Higher PCC limits |
| **Enterprise** | Custom | Custom | Dedicated infra, priority support |

**Key Cost Risk:** Sendbird charges **$5 per additional peak concurrent connection (PCC)** above your plan's limit. During usage spikes, this can cause unexpected bills.

#### Projected Cost at Scale

| MAU | Estimated Monthly Cost |
|---|---|
| 1,000 | $399 |
| 5,000 | $499 + PCC overages |
| 10,000 | Custom (Enterprise) |

#### Pros
- Most feature-complete — chat + voice + video in one platform
- AI chatbot builder (no-code)
- Supergroup channels (20K members)
- Could replace Jitsi entirely if desired

#### Cons
- **Expensive and unpredictable** — PCC overage charges can spike costs
- Steeper learning curve than CometChat/TalkJS
- Built-in video is redundant since you already have Jitsi
- Lowest G2 rating among the options

---

## 5. Free / Open-Source Option

### 5.1 Rocket.Chat (Self-Hosted) — ★ Recommended

**Website:** https://rocket.chat  
**GitHub:** https://github.com/RocketChat/Rocket.Chat  
**GitHub Stars:** 40,000+  
**License:** MIT  
**G2 Rating:** ⭐ 4.5/5

#### Overview
Rocket.Chat is an open-source, enterprise-grade communications platform used by organizations including Deutsche Bahn, the US Navy, Credit Suisse, and the German Federal Police. It provides a complete chat solution with 1:1 messaging, group channels, threads, file sharing, search, and end-to-end encryption — all completely free when self-hosted.

#### Features

| Feature | Available? | Notes |
|---|---|---|
| 1:1 Chat | ✅ | |
| Group Chat | ✅ | No participant limits |
| Chat History & Storage | ✅ | Stored in MongoDB (same DB WisdomLinked uses) |
| Typing Indicators | ✅ | |
| Read Receipts | ✅ | |
| File/Image Sharing | ✅ | With previews, configurable storage |
| Message Search | ✅ | Full-text search built-in |
| Offline Messaging | ✅ | Messages stored and delivered on reconnect |
| Push Notifications | ✅ | Built-in push gateway (or use your own) |
| Reactions & Threads | ✅ | Full threading support |
| AI Integrations | ✅ | Marketplace apps for ChatGPT, Hugging Face, etc. |
| Voice/Video Calling | ✅ | Jitsi integration built-in |
| Webhooks | ✅ | Incoming + outgoing webhooks |
| REST API | ✅ | Comprehensive — 200+ endpoints |
| Realtime API | ✅ | WebSocket-based for live updates |
| Embeddable | ✅ | iframe embed + LiveChat widget |
| End-to-End Encryption | ✅ | Per-channel E2EE |
| Two-Factor Auth | ✅ | TOTP, email |
| SSO/OAuth/LDAP | ✅ | |
| Role-Based Access Control | ✅ | Granular permissions |

#### Pricing

| Deployment | Cost |
|---|---|
| **Self-Hosted** | **$0** — completely free, no MAU limits, no restrictions |
| **Cloud (SaaS)** | From $7/user/month |

**Infrastructure Cost for Self-Hosting:**

| Component | Estimated Cost |
|---|---|
| VPS (DigitalOcean/Hetzner) | $6–$24/mo depending on size |
| MongoDB | Already running (shared with WisdomLinked) |
| SSL Certificate | Free (Let's Encrypt) |
| **Total** | **$6–$24/mo** |

#### Security

| Security Feature | Status |
|---|---|
| End-to-End Encryption | ✅ Optional, per-channel |
| TLS/SSL | ✅ |
| Two-Factor Authentication | ✅ |
| OAuth / SAML / LDAP | ✅ |
| Role-Based Access Control | ✅ |
| Data Ownership | ✅ **All data stays on your server** |
| SOC 2 Compliant Architecture | ✅ |
| GDPR Ready | ✅ |
| HIPAA Ready | ✅ (you control the infrastructure) |
| Regular Security Audits | ✅ |
| Rate Limiting | ✅ |
| Brute Force Protection | ✅ |

#### Integration with WisdomLinked

Rocket.Chat can be integrated in two ways:

**Option A — Embedded iframe (Fastest)**
- Embed Rocket.Chat's UI directly into WisdomLinked pages using an iframe
- Users authenticate via Rocket.Chat's OAuth/SSO connected to WisdomLinked's auth system
- Minimal code changes required

**Option B — API-Driven (Most Flexible)**
- Use Rocket.Chat's REST API (200+ endpoints) to build custom chat UI in your React frontend
- Full control over the look and feel
- More development work, but the chat feels native to WisdomLinked

**Deployment:** Add to your existing `docker-compose.yml`:
```yaml
rocketchat:
  image: registry.rocket.chat/rocketchat/rocket.chat:latest
  restart: always
  environment:
    - MONGO_URL=mongodb://mongodb:27017/rocketchat
    - ROOT_URL=https://chat.wisdomlinked.com
  ports:
    - "3100:3000"
  depends_on:
    - mongodb
```

#### Pros
- **Completely free** — no MAU limits, no per-user charges, no overage surprises
- **Full data ownership** — all messages stay on your server, not a third party's cloud
- **MongoDB** — same database you already run, shared infrastructure
- **End-to-end encryption** — the only option in this evaluation that offers true E2EE for free
- **Jitsi integration built-in** — can connect to your existing Jitsi for video calls
- **200+ REST API endpoints** — more flexible than any paid option
- **Enterprise-proven** — US Navy, Deutsche Bahn, Credit Suisse
- **Docker deployment** — fits into your existing Docker Compose setup
- **Active community** — 40K+ GitHub stars, regular releases

#### Cons
- **You manage the server** — updates, backups, monitoring are your responsibility
- **Initial setup takes more time** than plug-and-play paid SDKs
- **UI customization requires more work** if using iframe embed approach
- **No dedicated support** unless you pay for their cloud/enterprise plan

---

## 6. Head-to-Head Comparison

### Feature Comparison

| Feature | CometChat | TalkJS | Stream | Sendbird | Rocket.Chat |
|---|---|---|---|---|---|
| 1:1 + Group Chat | ✅ | ✅ (capped) | ✅ | ✅ | ✅ |
| Chat History | ✅ | ✅ | ✅ | ✅ | ✅ |
| Read Receipts | ✅ | ✅ | ✅ | ✅ | ✅ |
| Typing Indicators | ✅ | ✅ | ✅ | ✅ | ✅ |
| Message Search | ✅ | Growth only | ✅ | ✅ | ✅ |
| File Sharing | ✅ | ✅ | ✅ | ✅ | ✅ |
| E2E Encryption | ❌ | ❌ | ❌ | ❌ | ✅ |
| Push Notifications | ✅ | ✅ | ✅ | ✅ | ✅ |
| AI Features | ✅ | ❌ | ✅ | ✅ | ✅ (plugins) |
| Webhooks / REST API | ✅ | ✅ | ✅ | ✅ | ✅ |
| React UI Kit | ✅ | ✅ | ✅ | ✅ | ⚠️ iframe/custom |
| Data Ownership | ❌ Theirs | ❌ Theirs | ❌ Theirs | ❌ Theirs | ✅ **Yours** |
| Jitsi Integration | ❌ | ❌ | ❌ | ❌ | ✅ Built-in |

### Cost Comparison (Monthly)

| MAU Tier | CometChat | TalkJS | Stream | Sendbird | Rocket.Chat |
|---|---|---|---|---|---|
| 100 | $0 | $0 | $0 | $0 | **$0** |
| 1,000 | $299 | $279 | $499 | $399 | **~$12** (VPS) |
| 5,000 | $699 | $279 | $499 | $499+ | **~$12** (VPS) |
| 10,000 | $1,249 | $279 | $499 | Custom | **~$24** (VPS) |
| 25,000 | Custom | $569 | $1,299 | Custom | **~$24** (VPS) |
| 100,000 | Custom | Custom | Custom | Custom | **~$48** (VPS) |

### Scoring Matrix (1-5 scale, 5 = best)

| Criteria | Weight | CometChat | TalkJS | Stream | Sendbird | Rocket.Chat |
|---|---|---|---|---|---|---|
| Cost | ★★★★★ | 2 | 3 | 1 | 2 | **5** |
| Features | ★★★★★ | 5 | 3 | 5 | 5 | **5** |
| Integration Ease | ★★★★ | 5 | 5 | 3 | 3 | 3 |
| Scalability | ★★★★ | 4 | 3 | 5 | 5 | 4 |
| Security | ★★★★ | 3 | 2 | 3 | 3 | **5** |
| Reliability | ★★★ | 5 | 4 | 5 | 5 | 4 |
| Dev Experience | ★★★ | 5 | 4 | 5 | 4 | 4 |
| **Weighted Total** | | **3.7** | **3.2** | **3.4** | **3.4** | **4.4** |

---

## 7. Final Recommendation

### Primary: Rocket.Chat (Self-Hosted)

Rocket.Chat is the strongest choice for WisdomLinked because:

1. **$0/mo** vs $279–$499/mo for the nearest paid alternative
2. **Full data ownership** — critical for an enterprise app handling expert-customer communications
3. **End-to-end encryption** — the only option offering this for free
4. **MongoDB** — no new database to manage, integrates with existing infrastructure
5. **Jitsi built-in** — when you self-host Jitsi later, it connects natively
6. **No MAU limits** — scales without cost surprises
7. **Battle-tested** — used by military, government, and Fortune 500 companies

### Fallback: CometChat

If the team decides they prefer a fully managed service and are willing to pay:

- Start on the **free tier (100 MAU)** for development and testing
- Move to **Basic ($299/mo)** when going to production
- Evaluate Enterprise when scaling beyond 5K MAU

---

## 8. Next Steps

1. **Team decision:** Confirm Rocket.Chat (self-hosted) or CometChat (paid)
2. **Migration plan:** Create detailed technical plan for ripping out Socket.IO and integrating the chosen solution
3. **Docker setup:** Add Rocket.Chat to `docker-compose.yml` (if self-hosted)
4. **Auth integration:** Connect WisdomLinked's JWT authentication to the chat system
5. **Frontend integration:** Embed chat UI or build custom React components
6. **Testing:** Validate 1:1 chat, group chat, file sharing, notifications
7. **Deployment:** Roll out to staging, then production
