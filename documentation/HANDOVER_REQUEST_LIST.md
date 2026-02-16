# Project Handover Checklist

**Goal**: Getting all necessary credentials, access rights, and knowledge to independently manage and deploy the WisdomLinked application.

## 1. Credentials & Secrets (The "Keys")
Ask for the **values** for these specific environment variables (or the `.env` file itself):

*   **Database**:
    *   [ ] `MONGO_URI` for **Production** (Live data).
    *   [ ] `MONGO_URI` for **Development/Staging** (Test data).
*   **Payments (Stripe)**:
    *   [ ] Stripe Dashboard Login (or Invite to Team).
    *   [ ] `STRIPE_SECRET_KEY_LIVE` (starts with `sk_live_...`).
    *   [ ] `STRIPE_SECRET_KEY_TEST` (starts with `sk_test_...`).
    *   [ ] **Stripe Webhook Secret** (if used for confirming payments).
*   **Email Services**:
    *   [ ] **SendGrid API Key** (starts with `SG...`).
    *   [ ] Access to the **SendGrid Dashboard** (to view/edit Email Templates like `d-46af...`).
    *   [ ] **Gmail Credentials** (Email & App Password) for `varunsahni286@gmail.com` (or request to change this to your own email immediately).
*   **Infrastructure**:
    *   [ ] **AWS Access Keys** (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`) for S3 image uploads.
    *   [ ] **TimeZoneDB API Key**.
    *   [ ] **TURN Server Credentials** (URL, Username, Password) for WebRTC video calls.

## 2. Infrastructure & Hosting Access
Ask *where* things are running and get access:

*   **Backend Hosting**:
    *   [ ] Where is the Node.js server running? (Heroku, AWS EC2, DigitalOcean, Render?).
    *   [ ] **Login Credentials** or **Team Invite** to that platform.
    *   [ ] SSH Access (pem key) if it's a raw server (like EC2).
*   **Frontend Hosting**:
    *   [ ] Where is the React app hosted? (Vercel, Netlify, AWS S3/CloudFront?).
    *   [ ] **Login Credentials** or **Team Invite**.
*   **Domain & DNS**:
    *   [ ] Registrar Access (GoDaddy, Namecheap, Cloudflare?) to manage `wisdomlinked.com`.
*   **SSL Certificates**:
    *   [ ] If not managed automatically, ask for the `privkey.pem` and `fullchain.pem` files found in `BE/cert/`.

## 3. Code & Repository Access
*   **GitHub/GitLab**:
    *   [ ] **Admin Access** to the repository (to set up Branch Protection rules).
*   **Local Configs**:
    *   [ ] Ask for their local `.env` file to see what settings they were using.

## 4. Operational Questions (The "How-To")
Ask these specific questions to avoid guessing:
1.  **Deployment**: "How do you currently deploy a change? Is it manual (FTP/SSH) or automatic (Git push)?"
2.  **Staging**: "Is there a testing URL, or did you just test locally?"
3.  **Admin Access**: "What is the username/password for the Super Admin account on the live site?"
4.  **Crons/Scripts**: "Are there any background scripts running that I don't see in the code?"
5.  **Current Bugs**: "Is there anything broken right now that I should know about before I touch it?"

## 5. Dangerous Hardcoded Items (To Fix Immediately)
Tell the developer you found these and ask if they are still valid:
*   "I found `varunsahni286@gmail.com` hardcoded in `utils.js`. Is this your personal email? I need to change this."
*   "I found Stripe Test/Live mode logic in the `AppState` database collection. Can you confirm if the production DB has `stripeMode` set to 'live'?"
