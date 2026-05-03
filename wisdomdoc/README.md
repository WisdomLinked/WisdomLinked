# Wisdom Document System (wisdomdoc)

Admission document workflow: students upload required materials, submit an application case, and interact with the committee; experts and admins review cases on a shared dashboard. Ported from WisdomDocumentUpload.

---

## Table of contents

1. [What this app does](#what-this-app-does)
2. [Quick start](#quick-start-local)
3. [Docker](#docker)
4. [URLs and configuration](#urls-and-configuration)
5. [Sample credentials](#sample-credentials)
6. [Navigation](#navigation)
7. [Roles at a glance](#roles-at-a-glance)
8. [Student workflow (complete)](#student-workflow-complete)
9. [Upload access and document rules](#upload-access-and-document-rules)
10. [Application case lifecycle](#application-case-lifecycle)
11. [Expert workflow (complete)](#expert-workflow-complete)
12. [Admin workflow (complete)](#admin-workflow-complete)
13. [Team messages (experts and admins)](#team-messages-experts-and-admins)
14. [Email notifications](#email-notifications)
15. [Profile and account](#profile-and-account)
16. [Authentication](#authentication)
17. [Database and files](#database-and-files)
18. [API surface (reference)](#api-surface-reference)

---

## What this app does

- **Students** register, complete profile-related fields at signup, sign in, and use **My uploads** to manage documents, read committee clarifications and feedback, message the committee, submit or resubmit an application, and withdraw while allowed.
- **Experts** use **Submissions** to see students matched to their majors, enable or disable student upload access (within rules), review assigned cases, change workflow status where permitted, recommend approval or reject, send clarifications and feedback files, add private case notes, and use **Team Messages** to chat with admins and other experts.
- **Admins** have full visibility: all students, all cases, expert assignment, workload view, bulk upload enable/disable, final approval after expert recommendation, status overrides, reopening rejected cases, and team messaging.

---

## Quick start (local)

```bash
# Backend
cd BE && npm install && npm run dev

# Frontend (new terminal)
cd FE && npm install && npm run dev
```

- **Frontend:** http://localhost:3001  
- **Backend API:** http://localhost:4001  

---

## Docker

From the **wisdomlinked** repo root (if your compose file includes wisdomdoc services):

```bash
docker compose up wisdomdoc_backend wisdomdoc_frontend
```

**Standalone** wisdomdoc:

```bash
cd wisdomdoc
docker compose up --build
```

- **Frontend:** http://localhost:3001  
- **Backend API:** http://localhost:4001  

---

## URLs and configuration

| Item | Notes |
|------|--------|
| `BE/.env` | `PORT`, SMTP settings — see `BE/.env.example` |
| `FE` | Optional `VITE_API_URL` for production (e.g. `http://localhost:4001`) |

---

## Sample credentials

After first run (seed data):

| Role    | Email                 | Password   |
|---------|----------------------|------------|
| Admin   | hithamagadi@gmail.com | admin123   |
| Expert  | expert@wisdom.edu     | expert123  |
| Student | student@wisdom.edu    | student123 |

---

## Navigation

After login, the header shows:

| Role | Links |
|------|--------|
| **Student** | **My uploads** (`/`), **Profile** (`/profile`), **Logout** |
| **Expert / Admin** | **Submissions** (`/committee`), **Profile** (`/profile`), **Logout** |

Students never see the committee URL unless they manually browse it; the app routes experts and admins away from the student home page.

---

## Roles at a glance

| Capability | Student | Expert | Admin |
|------------|---------|--------|-------|
| Register / login | Yes | Yes | Seeded |
| My uploads / documents | Own only | — | — |
| Committee dashboard | No | Yes (scoped) | Yes (all) |
| Student list | — | Majors + assigned | All students |
| Cases list | Own | Assigned only | All |
| Toggle student “upload enabled” | — | Yes* | Yes |
| Assign expert to case | — | No | Yes |
| Expert recommend approval / reject | — | On assigned case | — |
| Final approve / many status changes | — | No | Yes |
| Clarifications & feedback upload | — | Yes* | Yes |
| Private notes on case | — | If assigned | Yes |
| Case status audit (`/updates`) | Own case | If allowed | If allowed |
| Team DM | No | Yes | Yes |

\*Experts must either be **assigned** to that student’s active case or the student’s **major** must match one of the expert’s configured majors (see [Expert workflow](#expert-workflow-complete)). Experts cannot toggle upload for a student who already has a **final-approved** case until an admin reopens that situation.

---

## Student workflow (complete)

### 1. Registration and first login

1. Open the app → **Register** → **Student register**.
2. Fill in **full name**, **email**, **password** and **confirm password**, **major** (pick from list or “Other”), optional **target year** (same year list as Profile — used for committee filters), **country**, optional state/city, **phone** (with country code), optional short bio, **timezone**.
3. Submit. If the email is already registered, the API responds with whether it is in use as a **student**, **expert**, or **administrator**.
4. You are logged in and taken to **My uploads**.

### 2. Before the committee enables you (“upload not enabled”)

- If **upload access** is off (`approved` flag on your account is false) and you have **no documents** yet, you see a short notice that the expert/committee will enable uploads, plus:
  - **Clarifications from committee** (if any)
  - **Message to admission committee** (always available; up to **10** stored messages roll off oldest first)
- You **cannot** upload files until an expert or admin **enables upload** for your account.

### 3. After upload is enabled — prepare your package

- **Document checklist** shows the four **required** slots (SOP, LOR, Resume, Transcript) and a separate line **Additional Files · Total number: N** (optional uploads do not change the “X of 4 required” summary).
- For each category you can upload **PDF, DOC, DOCX, or TXT**, max **10 MB** per file.
- **Additional files** can include a short description; duplicate filenames can be auto-renamed with your confirmation.
- Replacing a document in the same category creates a new **version** (stored server-side).
- **Committee feedback** appears when the committee uploads feedback-type documents; you can preview and download but not delete committee files.

### 4. Submit application

- When all **four** required types exist as **your** uploads (not committee-uploaded rows) and you have **no active** non-terminal case, a **Submit application** action appears.
- Submit creates a **case** in **Submitted** status with a public **`WL-YYYY-NNNNN`** case id (year + zero-padded sequence). A **due date** is set (default: **5 days** after submission in the current backend).
- After submit, **uploads lock** until the case is in **Needs info** (committee asks for more) or an admin reopens edge cases. You can still **message the committee** and preview/download existing files.

### 5. While the case is active

- The page shows **application progress** (queue → review → action needed → decision, etc.) aligned to your case **status**.
- **Withdraw application** is available for most non-terminal statuses until withdrawn; withdrawn is **terminal** for that submission (upload rules follow rejected/withdrawn policy below).
- **Resubmit** appears when status is **Needs info**, uploads are allowed again, and you again have all four required documents; that moves the case to **Resubmitted** for the expert to continue.

### 6. Terminal outcomes

- **Approved** (after admin finalizes): uploads close; you keep read access to documents and messages.
- **Rejected** or **Withdrawn**: uploads stay closed for that cycle; committee messaging may still apply per UI.

### 7. Profile (`/profile`)

- Students can update name, optional title/bio, **major**, **target year**, timezone, location, phone — **not** email (login identifier).
- Experts/admins have a different profile shape (e.g. majors list for matching).

---

## Upload access and document rules

**Upload enabled** (`users.approved = 1`) is controlled only from the **committee dashboard** (experts/admins). It is **independent** of case status but interacts with it:

| Situation | Upload / delete own docs? |
|-----------|---------------------------|
| Upload **disabled** by committee | No (banner explains); messages and viewing may still work |
| **Enabled**, no case yet, never rejected/withdrawn only | Yes |
| **Enabled**, active case, status **Needs info** | Yes (fix package and resubmit) |
| **Enabled**, active case, any other status (e.g. Submitted, Under review) | No |
| **Final-approved** case exists | No |
| Prior case **Rejected** or **Withdrawn** and no new active case | No (prevents orphaned uploads; admin may reopen a rejected case to queue a new cycle) |

**Messaging:** `POST /documents/message` remains available so students can always reach the committee (subject to normal auth).

---

## Application case lifecycle

Internal statuses (see `BE/constants/caseStatus.js`) drive transitions. Labels in the UI are human-readable (e.g. “Under review”, “Pending admin approval”).

### Status meanings (student-facing)

| Status | Typical meaning |
|--------|-----------------|
| **Submitted** | Application filed; awaiting admin to assign an expert |
| **Assigned** | Admin assigned an expert; expert may start review |
| **Under review** | Expert is actively reviewing |
| **Needs info** | Expert/committee requested more; student may upload and **Resubmit** |
| **Resubmitted** | Student resubmitted after needs info |
| **Pending admin approval** | Expert **recommended approval**; only **admin** can set **Approved** |
| **Approved** | Final positive decision; uploads locked |
| **Rejected** | Not approved; terminal unless admin reopens to **Submitted** |
| **Withdrawn** | Student withdrew; terminal |
| **Overdue** | Past due date while still in a pending bucket; committee may still move status |

### Who can change status

- **Expert** (only on **assigned** cases): dedicated actions to **recommend approval** (→ pending admin approval) or **reject**; and status PATCH limited effectively to **under_review**, **needs_info**, **rejected** (plus flows the UI exposes, e.g. starting review from assigned).
- **Admin**: assign/unassign expert (`PATCH /cases/:id/assign`), full **status** dropdown for valid transitions, **Final approval** when case is **Pending admin approval**, can reopen **Rejected** → **Submitted** (clears assignment timestamps as implemented), can adjust **Approved** edge cases (e.g. back to needs info per transition table).

### Case audit trail

- On the committee case detail view, **Case updates** lists `from_status → to_status` with actor email/role when the backend logs them.
- **`GET /cases/:id/events`** exists for **admin-only** deeper event inspection (API).

### Due dates

- New cases get `due_at` set at creation (implementation uses **5 days** after `submitted_at`). Overdue display is a UI hint; status may become **overdue** per backend rules.

---

## Expert workflow (complete)

### Getting started

1. **Expert register** or use a seeded expert account.
2. Set **majors** (committee matching) from **Profile** or the majors editor on **Submissions** (stored as JSON list; matching is flexible against student **major** text).
3. Open **Submissions** (`/committee`).

### Tabs

| Tab | Purpose |
|-----|---------|
| **Cases** | All cases **assigned to you** (API filters `assigned_expert_id`). Not all students — only your workload. |
| **Students** | Students whose **major** matches your majors **or** whom you could reach via assignment; used to open detail, toggle upload, clarify, feedback. |
| **Team Messages** | Direct messages with **admins and other experts** (not students). |
| **Experts** | **Admin only** — not shown to experts. |

### Per student (Students tab → select row)

- View profile summary, documents (preview/download), **clarifications** history, student messages to committee.
- **Enable upload / Disable upload** — toggles `approved`. Blocked if student has a **final-approved** case (tooltip explains admin must reopen first).
- **Send clarification** — text (max **500** chars stored per row); persists in student UI; **email** sent to student if SMTP configured.
- **Upload committee feedback** — file + optional note; stored as student document type **feedback**; **email** to student.

### Per case (Cases tab → select case)

- See case id, status, due date, student, assignment.
- **Recommend approval** (check-style control) — moves case to **Pending admin approval**; notifies student (email).
- **Reject** — sets **Rejected**; notifies student.
- Move into **Under review** / **Needs info** as the UI exposes (backed by `PATCH /cases/:id/status` with expert restrictions).
- **Private notes** — visible to **you and admins only** (not the student); capped at **100** notes per case (oldest pruned).
- **Case updates** timeline — status changes with who changed them.

### Experts and “all students”

- Experts **do not** see every student in the system—only students matching **majors** (and assignment-based access for edge cases). **Admins** see the full student list.

---

## Admin workflow (complete)

Admins have every expert capability **plus**:

### Students tab

- **Enable upload all / Disable upload all** — bulk sets `approved` for **all students**.
- Per-student **toggle** same as expert.
- Filters (e.g. by major / target year) when present in UI help triage.

### Cases tab

- See **all** cases (any expert, any status filter the UI provides: all / pending / approved / rejected / withdrawn).
- **Assign expert** — pick from expert list (recommended majors surfaced when choosing for a case). Unassign returns case toward **Submitted** when appropriate.
- **Expert workload** — table of active vs completed case counts per expert for balancing.
- **Status** control — admin-only transitions include setting **Approved** only from **Pending admin approval**, reopening **Rejected** to **Submitted**, and other entries allowed by `STATUS_TRANSITIONS` in code.
- **Final Approval** shortcut when status is already pending admin approval.

### Experts tab (admin only)

- Pick an expert to see their profile and **all cases ever assigned** to them.

### Team Messages

- Same as experts: DMs with experts and other admins, unread counts, conversation threads.

### Private notes and feedback

- Same endpoints as experts; admins are never blocked by “not assigned” for student detail access.

---

## Team messages (experts and admins)

- **Separate** from student committee messages and from case threads.
- **Contacts** list shows other **admin** and **expert** users with unread badges.
- Messages up to **2000** characters per send; thread loads full history for that pair.
- Used for internal coordination (assignment questions, handoffs, etc.).

---

## Email notifications

If `SMTP_*` is configured in `BE/.env`, the server sends emails for typical events, including:

| Trigger | Typical recipients |
|---------|----------------------|
| Clarification posted to student | Student |
| Committee feedback file uploaded | Student |
| Case **Assigned** | Student + assigned expert |
| **Needs info** | Student |
| **Resubmitted** | Assigned expert |
| **Pending admin approval** | Student |
| **Approved** / **Rejected** / **Withdrawn** | Student (wording varies by template in `BE/utils/emailTriggers.js` and `email.js`) |

If SMTP is missing or fails, in-app data still updates; check server logs for email errors.

---

## Profile and account

- **Students:** name, title, bio, major, target year, timezone, country/state/city, phone.
- **Experts:** name, title, bio, **majors** (lines or comma-separated in API), timezone, phone, etc.
- **Email** cannot be changed after registration (it is the login id).

---

## Authentication

- **Login** — separate flows for student, expert, and admin (role checked after credential check).
- **Register** — student or expert; password must be entered **twice** and match on the client.
- **Forgot password** — from login screens, navigates to reset flow with email query param where applicable.
- **Reset password** — `POST /auth/reset-password-simple` with email + new password + confirm in UI; min length enforced in UI/API.

Passwords in the default/dev setup are stored as configured by `BE` auth routes (see `auth.js` for the demo/simple hash behavior in development).

---

## Limits (enforced in backend)

| Resource | Limit |
|----------|--------|
| Student “message to committee” history | **10** rows (oldest dropped) |
| Clarifications per student | **10** rows |
| Case thread messages (`/cases/:id/messages`) | **10** per case (**API only** in current build — neither **My uploads** nor **Submissions** exposes this thread; use student **Message to admission committee** for async contact) |
| Private notes per case | **100** |
| Team DM body | **2000** characters |
| Case additional fields | **10** key/value pairs |
| Single upload size | **10 MB** |
| Allowed extensions | **pdf, doc, docx, txt** |

---

## Database and files

- **SQLite** database: `BE/data/app.db` (created on first run).
- **Uploaded files:** `BE/uploads` (or Docker volume mount as configured).
- **Artifacts:** documents, case rows, messages, clarifications, case updates, optional `case_additional_fields` (admin/student structured metadata), `event_log` for admin diagnostics.

---

## API surface (reference)

High level only; see `BE/routes/*.js` for exact bodies and errors.

| Prefix | Auth | Purpose |
|--------|------|---------|
| `/auth/*` | Mixed | login, register, me, PATCH me, forgot/reset password |
| `/documents/*` | Student | list docs + upload flags, upload, delete, message committee, download/preview |
| `/cases/*` | Logged in | create case, list cases, assign, status, resubmit, withdraw, expert approve/recommend, expert reject, messages, private notes, fields, updates, events |
| `/committee/*` | Expert or admin | students list/detail, approve toggle, clarify, feedback upload, expert `me` majors, team contacts/messages, student doc download/preview |

Frontend uses `VITE_API_URL` or same-origin defaults wired in `FE/src/config`.

---

## Troubleshooting

| Issue | Things to check |
|-------|------------------|
| Student cannot upload | `approved` flag, active case status, prior rejected/withdrawn without reopen |
| Expert sees empty student list | Expert **majors** empty or no overlap with student **major** strings |
| Email not received | `BE/.env` SMTP_*, spam folder, server console |
| 409 on register | Email already used (message names role) |
| CORS / blank API calls | `VITE_API_URL` matches backend URL and port |

For behavior not covered here, the source of truth is **`BE/routes`** and **`FE/src/pages`** (especially `Upload.jsx` and `CommitteeDashboard.jsx`).
