# TOE

Project Overview

This project is a web application with a React-based frontend and a Node.js backend. The backend uses Express.js and MongoDB for handling requests and data storage, while the frontend is built using React TypeScript for a seamless user interface.


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

To start the frontend development server:

cd frontend
npm start

Production Mode

To build and serve the frontend for production:

cd frontend
npm run build-stg



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

Testing And Coverage

Backend (BE):

cd BE
npm test
npm run test:coverage

Frontend (FE):

cd FE
npm test
npm run test:coverage

CI Policy:

- Pull requests and pushes to `staging` and `main` run backend and frontend test+coverage workflows.
- Coverage gates are enforced in CI to keep testing part of SDLC for all changes.
