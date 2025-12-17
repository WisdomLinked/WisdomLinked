# TOE

## 🚀 Quick Start

**Automated Start (macOS):**
```bash
./START.sh
```

**Manual Start:**
```bash
# Terminal 1 - Backend (Port 5555)
cd BE && npm run dev

# Terminal 2 - Frontend (Port 5173)
cd FE && npm start
```

**Access:** Frontend at http://localhost:5173, Backend at http://localhost:5555

📚 **See [SETUP.md](./SETUP.md) for detailed instructions** | **[MIGRATION_SUMMARY.md](./MIGRATION_SUMMARY.md) for migration details**

---

## Project Overview

This project is a web application with a React-based frontend and a Node.js backend. The backend uses Express.js and MongoDB for handling requests and data storage, while the frontend is built using **React 18 + Vite + TypeScript** for a modern, fast development experience.


Features

User authentication and authorization

Video chat functionality

Integration with third-party APIs such as SendGrid for email and Stripe for payments

Real-time communication with WebSockets



Installation Guide

Prerequisites

Node.js and npm installed on your system

MongoDB server setup and running

Configure environment variables by creating a .env file in the backend and frontend directory (separate for development and production environments)


Steps to Install

Clone the repository:

git clone <repository-url>
cd <repository-directory>


Install dependencies for both frontend and backend:

Backend:

cd BE
npm install

Frontend:

cd FE
npm install


Install Python dependencies (if required):

pip install -r requirements.txt

Set up the environment variables by creating a .env file in the backend directory and frontend directory.

Environment Variables Configuration

Backend (.env)

The backend runs on port 5555 by default (changed from 5000 to avoid conflicts with macOS ControlCenter).

PORT=5555
MONGO_URI=mongodb://localhost:27017/your-database-name
FE_URL=http://localhost:8080
MAX_REQUEST_BODY_SIZE=1mb

Frontend (.env)

VITE_API_BASE_URL=http://localhost:5555/api/
VITE_SERVER_URL=http://localhost:5555
VITE_HOST_URL=http://localhost:5173
VITE_BASE_URL=/
VITE_AUTH_URL=/user/
# Plus payment gateway keys (Stripe, PayPal)

Note: 
- Backend port 5555 is used to avoid conflicts with macOS ControlCenter (port 5000)
- Frontend uses Vite (port 5173) instead of Create React App (port 8080)
- Environment variables use `VITE_*` prefix (Vite standard) instead of `REACT_APP_*`

Running the Application

Backend

Development Mode

To start the backend server in development mode:

cd backend
npm start

Production Mode

To start the backend server in production mode:

cd backend
npm run start-stg

Frontend

Development Mode

To start the frontend development server (Vite):

cd FE
npm start
# or
npm run dev

Production Mode

To build the frontend for production:

cd FE
npm run build

To preview the production build:

npm run preview



Code Structure

Backend

server.js: Main entry point for the backend. Handles routing and middleware.

turn.js: TURN server configuration for WebRTC functionalities.

util.js: Utility functions like OTP email sending and date formatting.

routes/: Contains various route files for handling specific API endpoints (e.g., authentication, chat, admin).

socket/: WebSocket server logic for real-time communication.



Frontend

App.tsx: Main application file that initializes routing and global states.

components/: Reusable UI components like headers, notifications, and loaders.

pages/: Contains React components for each route (e.g., login, register, dashboard).

actions/: Redux actions for managing global state and API interactions.

store/: Centralized Redux store for state management.

Additional Notes

Ensure MongoDB is running before starting the backend server.

For production, replace test keys and URLs with live credentials.

Add appropriate error handling and logging for debugging purposes.
