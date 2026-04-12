<div align="center">
  <img src="https://wisdomlinked.com/static/media/logo.bd3810d2105156aee05a.png" alt="WisdomLinked Logo" width="300"/>

  <h1>WisdomLinked 🧠</h1>
  <p><strong>Connecting Curiosity with Expertise</strong></p>

  <p>
    <a href="#features">Features</a> • 
    <a href="#architecture-and-stack">Tech Stack</a> • 
    <a href="#getting-started">Getting Started</a>
  </p>
</div>

---

## 📌 Overview

**WisdomLinked** is a premium knowledge-sharing and consultation platform designed to bridge the gap between industry professionals (Experts) and individuals seeking guidance (Customers). 

By offering a seamless ecosystem for 1-on-1 consultations, massively scalable group seminars, and vibrant community chats, WisdomLinked empowers experts to monetize their knowledge effortlessly while giving users direct access to world-class advice.

---

## ✨ Features

- 🎭 **Dual User Ecosystem:** Distinct, tailored dashboards for **Experts** (to manage schedules, seminars, and earnings) and **Customers** (to browse, book, and learn).
- 📅 **Advanced Scheduling & Seminars:** Comprehensive calendar integration for booking 1-on-1 consultations or hosting paid public seminars.
- 💬 **Real-Time Communications:** Lightning-fast, infinitely scalable text messaging powered by **Rocket.Chat**, and high-definition video conferencing powered by **Jitsi Meet**.
- 💳 **Integrated Monetization:** Seamless payment processing. Experts set their rates, and users pay securely via **Stripe** or **PayPal**.
- 🖼️ **Serverless Image Optimization:** Profile and banner images are seamlessly offloaded to cloud storage and resized on-the-fly via serverless functions, keeping the core platform blazing fast.

---

## 🛠️ Architecture and Stack

WisdomLinked is built on a modern, robust, and horizontally scalable **MERN** foundation.

### Frontend
- **Framework:** React.js (TypeScript) + Redux Toolkit
- **Styling:** TailwindCSS + Vanilla CSS + Material-UI (MUI) components
- **Routing:** React Router DOM
- **Interactions:** Custom modern hooks, glassmorphism UI elements, and highly responsive layouts

### Backend
- **Core:** Node.js + Express.js (TypeScript)
- **Database:** MongoDB (with Mongoose ODM)
- **Authentication:** JWT (JSON Web Tokens) with Secure HTTP-Only Cookies & OAuth integration (Google/Facebook)
- **Email Delivery:** SendGrid Custom Mailers

### External Infrastructure
- **Messaging:** Self-hosted **Rocket.Chat** instance
- **Video:** Self-hosted **Jitsi Meet** server
- **Storage:** **DigitalOcean Spaces** (S3-compatible) standard bucket for media storage
- **Serverless Compute:** **DigitalOcean Functions** (`/Functions` directory) utilizing `sharp` for decoupled, non-blocking image resizing.
- **Payments:** Stripe & PayPal SDKs

### DevOps & Deployment
- **Containerization:** Docker & Docker Compose
- **CI/CD:** Highly optimized GitHub Actions strictly typing the staging and production release pipelines directly to DigitalOcean droplets.

---

## 🚀 Getting Started (Local Development)

### Prerequisites
- [Node.js](https://nodejs.org/en/) (v18+)
- [Docker](https://www.docker.com/) & Docker Compose
- A local or remote MongoDB instance

### 1. Clone the repository
```bash
git clone https://github.com/WisdomLinked/WisdomLinked.git
cd WisdomLinked
```

### 2. Environment Variables
Copy the example environment files and fill them out. Note: Required configurations such as your local API keys, Stripe variables, and Rocket.Chat endpoints are defined here.
```bash
cp BE/.env.example BE/.env
cp FE/.env.example FE/.env
```

### 3. Run via Docker Compose (Recommended)
This will orchestrate the database, backend API, and frontend client concurrently.
```bash
docker-compose up --build
```
*The frontend will be available at `http://localhost:3000` and the backend will run at `http://localhost:5000`.*

### 4. Run Manually

**Backend:**
```bash
cd BE
npm install
npm run dev
```

**Frontend:**
```bash
cd FE
npm install
npm start
```

---

<div align="center">
  <p>Built with ❤️ by the WisdomLinked Engineering Team.</p>
</div>
