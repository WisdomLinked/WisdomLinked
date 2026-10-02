# WisdomLinked

WisdomLinked connects students and customers with experts for one-on-one advice, group seminars, messaging, and live video sessions.

## Live sites

| Environment | App | API |
|-------------|-----|-----|
| Production | [wisdomlinked.com](https://wisdomlinked.com) | [api.wisdomlinked.com](https://api.wisdomlinked.com) |
| Staging | [staging.wisdomlinked.com](https://staging.wisdomlinked.com) | same host under `/api` |

Video meetings use [meet.wisdomlinked.com](https://meet.wisdomlinked.com). Chat runs on Rocket.Chat (`chat.wisdomlinked.com` in production, `chat-staging.wisdomlinked.com` in staging).

## Who uses the platform

- **Students / customers** — find experts, book paid sessions, register for seminars, message hosts, join video calls, and manage payments.
- **Experts** — publish profiles and availability, host seminars, message participants, run meetings, and track earnings.
- **Admins** — manage users, payments, featured experts, site announcements, and platform settings.

## What you can do on the site

- Browse and book **1:1 consultations** with experts
- Discover and join **seminars** (group sessions)
- **Message** experts and communities in real time
- Join **video meetings** (Jitsi) with in-meeting chat sync
- Pay with **Stripe** or wallet flows where enabled
- Ask the in-app **HelpBot / site search** for grounded answers about the product

## Repository layout

| Path | Role |
|------|------|
| `FE/` | React SPA (Vite, Redux, MUI, Tailwind) |
| `BE/` | Express + MongoDB API |
| `Functions/` | DigitalOcean Serverless image helpers |
| `jitsi/` | Custom Meet client scripts and branding |
| `ops/` | Host nginx and related ops configs |
| `.github/workflows/` | CI, staging deploy, production deploy |

## Local development

```bash
# API — http://localhost:5000
cd BE && npm install && npm start

# UI — http://localhost:3000 (proxies /api → :5000)
cd FE && npm install && npm start
```

Copy the usual `.env` values for each package before starting. Tests:

```bash
cd BE && npm run test:coverage
cd FE && npm run test:coverage
```

## Environments

Staging and production are separate app deployments with separate MongoDB databases, Rocket.Chat instances, and secrets. Jitsi Meet is shared; each meeting routes chat-sync to the correct environment’s API. Merges to `staging` deploy staging; merges to `main` deploy production.
