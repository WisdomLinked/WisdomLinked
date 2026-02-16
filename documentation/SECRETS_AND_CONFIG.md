# Internal Master Reference: Secrets & Configuration

> [!IMPORTANT]

> This document has been verified against the `develop` branch.

**CONFIDENTIAL**: This document contains comprehensive details on ALL configuration, secrets, certificates, and hardcoded values found in the WisdomLinked codebase.
**WARNING**: This file is a security audit artifact. Do not share externally.

---

## 1. Critical Infrastructure Secrets (Files)

These are physical files on the server disk that contain sensitive keys.

| File Path | Description | Criticality | Action |
| :--- | :--- | :--- | :--- |
| `BE/cert/privkey.pem` | **SSL Private Key**. used for HTTPS server in `server-https.js`. | **EXTREME** | Never commit. Backup securely. |
| `BE/cert/fullchain.pem`| **SSL Certificate Chain**. Public/Scientific, but part of the pair. | High | Keep with private key. |
| `BE/.env` | Backend config file (see below). | High | Ensure in `.gitignore`. |
| `FE/.env` | Frontend config file. | Medium | Ensure in `.gitignore`. |

---

## 2. Environment Variables (`.env`)

### Backend (`/BE/.env`)
The server *requires* these to function.

| Variable | Description | Source/How to Get |
| :--- | :--- | :--- |
| `MONGO_URI` | **Database Access**. `mongodb+srv://...` | MongoDB Atlas Dashboard. |
| `JWT_SECRET` | **Auth Signing Key**. Arbitrary secure string. | Generate: `openssl rand -hex 32`. |
| `STRIPE_SECRET_KEY_TEST` | Stripe **Test Mode** Secret Key (`sk_test_...`). | Stripe Dashboard > API Keys. |
| `STRIPE_SECRET_KEY_LIVE` | Stripe **Live Mode** Secret Key (`sk_live_...`). | Stripe Dashboard > API Keys. |
| `SENDGRID_APIKEY` | **Email Sending Key** (`SG....`). | SendGrid Dashboard. |
| `GOOGLE_EMAIL` | **System Sender Address** (e.g., `system@gmail.com`). | Gmail Account. |
| `GOOGLE_PASSWORD` | **SMTP App Password** (Not login pwd). | Google Account > Security. |
| `TIMEZONE_API_KEY` | API Key for TimeZoneDB. | https://timezonedb.com. |
| `AWS_URL` | S3/Gateway URL for image hosting. | AWS Console. |
| `DO_SPACES_ENDPOINT` | **DigitalOcean Spaces Endpoint**. | DigitalOcean Dashboard. |
| `DO_SPACES_KEY` | **Spaces Access Key**. | DigitalOcean Dashboard. |
| `DO_SPACES_SECRET` | **Spaces Secret**. | DigitalOcean Dashboard. |
| `DO_SPACES_BUCKET` | **Spaces Bucket Name**. | DigitalOcean Dashboard. |
| `PORT` | Server Port (Default: 5555). | Infra Config. |
| `MAX_REQUEST_BODY_SIZE` | HTTP Payload Limit (Default: '1mb'). | Config. |
| `COOKIE_EXPIRED_TIME` | Session duration (ms). | Config. |

### Frontend (`/FE/.env`)
These are exposed to the browser.
> [!CAUTION]
> **Prefix Alert**: This project uses **Create React App**, so all frontend environment variables **MUST** start with `REACT_APP_`. Variables starting with `VITE_` will **NOT** work.

| Variable | Description | Value Note |
| :--- | :--- | :--- |
| `REACT_APP_SERVER_URL` | WebSocket Server URL. | `wss://...` |
| `REACT_APP_API_BASE_URL` | Backend API Base URL. | `https://.../api/` |
| `REACT_APP_AUTH_URL` | Auth Dashboard Base URL. | `/user/` |
| `REACT_APP_BASE_URL` | Public Base URL. | `/` |
| `REACT_APP_HOST_URL` | Host URL (for local dev). | `http://localhost:3000` |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY_TEST`| Stripe Public Key (Test). | `pk_test_...` |
| `REACT_APP_STRIPE_PUBLISHABLE_KEY_LIVE`| Stripe Public Key (Live). | `pk_live_...` |
| `REACT_APP_PAYPAL_TEST_CLIENT_ID` | PayPal Client ID (Test). | |
| `REACT_APP_PAYPAL_REAL_CLIENT_ID` | PayPal Client ID (Live). | |
| `REACT_APP_TURN_URL` | WebRTC TURN Server. | `relay1.expressturn.com` |


---

## 3. Hardcoded Secrets (Code Audit)

These values were found **hardcoded** in the source files during the audit.

### Backend (`BE/`)
- **Email Templates** (`services/utils.js`):
    - `d-46afc30a193342d5b3795022b0fc4c53` (OTP Template)
    - `d-b2822afa5ff441f897415de5a0f8b180` (Contact Us Template)
- **Sender Identity** (`services/utils.js`):
    - `"varunsahni286@gmail.com"` (Hardcoded sender email).
    - **RISK**: If `GOOGLE_EMAIL` env var differs, this hardcoded value might cause auth mismatches in SendGrid.
- **Default OTP** (`controllers/auth.controller.js`):
    - Found `"123456"` in `auth.controller.js`. **(Note: Please ensure this is patched to random generation before prod).**
- **Admin Credentials** (`BE/initDB.js`):
    - **CRITICAL**: Hardcoded password `"no9x@mhc#z11l<k"` for `admin@wisdomlinked.com`.
- **FaaS URL** (`BE/services/imageUploadService.js`):
    - **High Risk**: Hardcoded URL `https://faas-nyc1-2ef2e6cc.doserverless.co/...`. If this changes, uploads break.
- **Auth Cookie Name**: `"accessToken"`.

### Frontend (`FE/`)
- **WebRTC Ports** (`socket/webRTC.ts`):
    - Hardcoded ports `3478` for TURN server connections.

---

## 4. Hidden/Implicit Configurations

-   **Database Flags**: `AppState` collection in MongoDB stores a `stripeMode` field (`test` vs `live`). The backend reads this database field to decide which Stripe Secret Key to use.
-   **Package Scripts**: `package.json` uses `env-cmd -f .env.stg` for staging builds, implying the existence of a `.env.stg` file for staging environments.

## 5. Deployment Checklist
1. [ ] Create `BE/cert/` directory and upload `privkey.pem` & `fullchain.pem`.
2. [ ] Create `.env` files in both `BE/` and `FE/` with all keys above.
3. [ ] Verify `AppState` in MongoDB has `stripeMode: 'live'` for production.
4. [ ] Change the hardcoded sender email in `BE/services/utils.js` if you are not Varun.
