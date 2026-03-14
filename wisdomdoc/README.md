# Wisdom Document Upload (wisdomdoc)

Separate component for document upload (SOP, LOR, Resume, Transcript) in staging.

## Structure

- **BE** – Backend (Express, SQLite)
- **FE** – Frontend (React, Vite)

## Local Development

```bash
# Install all dependencies
npm run install:all

# Run backend (port 4001)
npm run server

# Run frontend (port 3001, proxies /api to backend)
npm run client

# Or both:
npm run dev
```

## Docker (with wisdomlinked)

From the project root:

```bash
# Run everything (wisdomlinked + wisdomdoc)
docker compose up --build

# Run only wisdomdoc
docker compose up --build wisdomdoc_backend wisdomdoc_frontend
```

- **wisdomdoc frontend**: http://localhost:3001
- **wisdomdoc backend API**: http://localhost:4001

## Setup

1. Copy `BE/.env.example` to `BE/.env`
2. Configure SMTP in `BE/.env` for email (optional for basic use)
