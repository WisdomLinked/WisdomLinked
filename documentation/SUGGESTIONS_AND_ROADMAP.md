# Strategic Roadmap & Engineering Standards

This document outlines the path from the current MVP state to a Production-Ready, Scalable, and Secure platform. It covers Code Quality, Security, DevOps, and Infrastructure.

---

## 0. Immediate (Audit Findings)
These issues were found during the Deep Dive and pose immediate risks.

### **A. Hardcoded Secrets Clean-up**
*   **File**: `BE/controllers/auth.controller.js` contains `"123456"` as an OTP.
*   **File**: `BE/initDB.js` contains a hardcoded admin password.
*   **Action**: Replace with `process.env` variables or auto-generated random strings immediately.

### **B. Hybrid Storage Standardization**
*   **Issue**: Resume uploads use `AWS-SDK` (Spaces), while Image uploads use a hardcoded `FaaS` URL.
*   **Action**: Need to pick **ONE** strategy (recommend AWS-SDK via Spaces) and use it everywhere. Remove the dependency on the external FaaS function.

### **C. Frontend Build Tool Migration**
*   **Issue**: Project uses `react-scripts` (Create React App), which is deprecated/unmaintained.
*   **Action**: Migrate to **Vite**.
    *   Significantly faster dev server.
    *   Better ESM support.
    *   Smaller bundle sizes.

---

## 1. Code Quality & Basics (Immediate Wins)

### **A. Linting & Formatting**
Currently, the codebase has inconsistent formatting (indentation, semicolons).
*   **Action**: Install `eslint` and `prettier`.
*   **Why**: Enforces a standard style automatically. No more debates about code style in PRs.
*   **Command**:
    ```json
    "scripts": {
      "format": "prettier --write .",
      "lint": "eslint ."
    }
    ```

### **B. Logging Hygiene**
*   **Issue**: `console.log` is everywhere, including logging sensitive data occasionally.
*   **Fix**: Use a proper logger like `winston` or `pino`.
    *   **Dev Mode**: Pretty print to console.
    *   **Prod Mode**: ID-correlation (log to file/stream) and **ERROR level only**.
*   **Action**: Remove all `console.log` statements from backend controllers before production.

### **C. Directory Structure Cleanup**
*   **Issue**: `socketControllers` and `controllers` are separate but highly coupled.
*   **Fix**: Group by **Feature** rather than **Type**.
    *   `src/modules/chat/` (contains model, controller, socket handler, routes)
    *   `src/modules/payment/`
    *   `src/modules/auth/`

---

## 2. Security Hardening (Critical)

### **A. Secrets Management**
*   **Risk**: Hardcoded secrets (SendGrid Keys, Email Addresses) found in `utils.js` and `auth.controller.js`.
*   **Fix**: Strict `.env` usage.
*   **Tool**: Use `dotenv-safe` or `envalid` to **crash the app** at startup if required env vars are missing.

### **B. HTTP Headers & Rate Limiting**
*   **Risk**: Express app is exposed.
*   **Fix**:
    1.  Install `helmet`: `app.use(helmet())` (Sets secure HTTP headers).
    2.  Install `express-rate-limit`: Prevent brute-force password guessing on `/api/auth/login`.

### **C. Input Validation**
*   **Issue**: Relies heavily on happy-path logic.
*   **Fix**: Use a validation library like `Joi` or `Zod` for **every** request body.
    *   *Example*: Verify `email` is actually an email, `age` is a number, etc., *before* hitting the database.

---

## 3. Repository Governance & Workflow (Stop the "Wild West")

### **A. Branch Structure**
*   **`main` (or `master`)**:
    *   **STATUS**: Production Ready. Stable.
    *   **RULE**: **LOCKED**. No one pushes here directly. Only Merges via Pull Request (PR) from `staging`.
*   **`staging`**:
    *   **STATUS**: Pre-Production. Mirror of production but for testing.
    *   **RULE**: **LOCKED**. Merges via PR from `dev`. Updates the "Staging" environment.
*   **`dev`**:
    *   **STATUS**: The integration sandbox.
    *   **RULE**: Merges via PR from `feat/*` branches.
*   **`feat/username-ticket`**:
    *   **STATUS**: Where you write code.
    *   **RULE**: Push strictly here.

### **B. GitHub Protection Rules (Mandatory Setup)**
Go to `Settings > Branches > Add Rule` for `main`, `staging`, and `dev`:
1.  **Require Pull Request reviews before merging**: Set to at least **1 reviewer**.
    *   *Effect*: You cannot merge your own code without someone else checking it.
2.  **Require status checks to pass before merging**:
    *   *Effect*: GitHub Actions (Lint, Test, Build) MUST pass (green check) before the "Merge" button becomes clickable.
3.  **Dismiss stale pull request approvals when new commits are pushed**:
    *   *Effect*: If you change code after approval, you need approval again.
4.  **Include administrators**:
    *   *Effect*: Even the repository owner cannot bypass these rules.

### **C. Environment Strategy (Separate Worlds)**
You need **physically separate** databases and keys for each stage. Do not use the same MongoDB data for Dev and Prod.

| Environment | Branch | Database (`MONGO_URI`) | Stripe Keys | URL |
| :--- | :--- | :--- | :--- | :--- |
| **Development** | `dev` | `mongodb+srv://.../wisdom_dev` | `sk_test_...` | `localhost:3000` |
| **Staging** | `staging` | `mongodb+srv://.../wisdom_staging` | `sk_test_...` | `staging.wisdomlinked.com` |
| **Production** | `main` | `mongodb+srv://.../wisdom_prod` | `sk_live_...` | `wisdomlinked.com` |

---

## 4. CI/CD Pipeline (Automation)

**Tool Recommendation**: GitHub Actions (Free & Integrated).

### **Phase 1: CI (Continuous Integration)**
Run this on every **Pull Request** to `dev`, `staging`, or `main`.
```yaml
name: Guardrails CI
on: [pull_request]
jobs:
  quality-check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Install Node
        uses: actions/setup-node@v3
        with: { node-version: 18 }
      - name: Install Deps
        run: npm ci # Cleaner than npm install
      - name: Lint Code
        run: npm run lint # Must fail on bad formatting
      - name: Scan Secrets
        run: npx @odot/gitleaks-wrapper # Fails if keys detected
      - name: Test
        run: npm run test
```

### **Phase 2: CD (Continuous Deployment)**
Run this only when merging to `staging` or `main`.
*   **Trigger**: Push to branch.
*   **Action**:
    1.  Build Docker Image.
    2.  Push to Google Container Registry (GCR) or AWS ECR.
    3.  Auto-deploy to the matching environment (Staging vs Prod).


## 5. Infrastructure & DevOps

### **A. Dockerization (Standardization)**
*   Create a `Dockerfile` for Backend and Frontend.
*   **Why**: "It works on my machine" is a lie. Docker makes it run the same everywhere.
*   **Compose**: Use `docker-compose.yml` to spin up Backend + MongoDB + Frontend locally with one command (`docker-compose up`).

### **B. Infrastructure Provider Recommendations**
*   **Beginner/MVP**: **Render.com** or **Railway.app**.
    *   Why: Zero config, connects to GitHub, built-in HTTPS, easy logs.
*   **Intermediate**: **DigitalOcean Droplet** (VPV).
    *   Why: Cheaper ($5/mo), you control the Linux server (Ubuntu), good for learning.
    *   Tool: use `pm2` to keep Node.js alive.
*   **Advanced/Scale**: **AWS (ECS/Fargate)**.
    *   Why: Infinite scale, but high complexity.

### **C. Database Backups**
*   **Risk**: You lose data.
*   **Fix**: Automated nightly dumps of MongoDB.
    *   MongoDB Atlas does this automatically (M10+ tiers).
    *   Manual: Cron job script running `mongodump` and uploading to S3 buckets.

---

## 6. Testing Strategy

*   **Unit Tests**: Test individual functions (e.g., "Does `calculateTotal(price, tax)` return correct value?"). Tool: `Jest`.
*   **Integration Tests**: Test API endpoints (e.g., "Post /login returns 200"). Tool: `Supertest`.
*   **E2E Tests**: Test full user flow (e.g., "Open Browser -> Click Login -> Type Password -> Dashboard loads"). Tool: `Cypress` or `Playwright`.

---

## Summary Checklist for "Next Week"

1.  [ ] **Repo Cleanup**: Apply `.gitignore` and remove `node_modules` from tracking.
2.  [ ] **Secrets**: Move all hardcoded keys to `.env`.
3.  [ ] **Security**: Install `helmet` and `cors` properly.
4.  [ ] **Docker**: Create a `Dockerfile` for the backend.
5.  [ ] **CI**: Set up a simple GitHub Action to run `npm install` on PRs.
