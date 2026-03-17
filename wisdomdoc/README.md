# Wisdom Document System (wisdomdoc)

Document upload system for admission documents (SOP, LOR, Resume, Transcript) with committee dashboard. Ported from WisdomDocumentUpload.

## Features

- **Student**: Register, login, upload documents (SOP, LOR, Resume, Transcript, additional files), message to committee, view committee feedback
- **Expert**: View students by major, enable/disable upload per student, send clarification emails, upload feedback files, configure majors
- **Admin**: Full access to all students, bulk approve/disable
- **Auth**: Login, register (student/expert), forgot password, reset password
- **Email**: SMTP for clarification and feedback notifications

## Quick Start (local)

```bash
# Backend
cd BE && npm install && npm run dev

# Frontend (new terminal)
cd FE && npm install && npm run dev
```

- Frontend: http://localhost:3001
- Backend API: http://localhost:4001

## Docker

```bash
# From wisdomlinked root (if docker-compose includes wisdomdoc)
docker compose up wisdomdoc_backend wisdomdoc_frontend

# Or run wisdomdoc standalone
cd wisdomdoc
docker compose up --build
```

- wisdomdoc frontend: http://localhost:3001
- wisdomdoc backend API: http://localhost:4001

## Sample credentials

After first run (seed data):

| Role   | Email                 | Password   |
|--------|------------------------|------------|
| Admin  | hithamagadi@gmail.com  | admin123   |
| Expert | expert@wisdom.edu      | expert123  |
| Student| student@wisdom.edu     | student123 |

## Environment

- `BE/.env`: PORT, SMTP_* (see `BE/.env.example`)
- `FE`: VITE_API_URL (optional; for production set to backend URL, e.g. `http://localhost:4001`)

## Database

Uses SQLite (`BE/data/app.db`) by default. Files stored in `BE/uploads` (or `.uploads` when using Docker volume).
