# WisdomLinked Backend

Modern backend built with ElysiaJS, Bun, MongoDB, and TypeScript featuring authentication, role-based access control, metrics collection, and logging.

## Tech Stack

- **Runtime**: Bun
- **Framework**: ElysiaJS
- **Database**: MongoDB with Mongoose
- **Authentication**: JWT with argon2id password hashing
- **TypeScript**: Strict type checking

## Features

- JWT-based authentication system with session tracking
- Session management with device/location tracking
- argon2id password hashing for security
- Automatic session invalidation on password changes
- Role-based access control (admin/user)
- Discord OAuth integration
- API versioning (/api/v1/...)
- Metrics collection per endpoint
- Database logging system
- Rate limiting (generous limits for interactive frontends)
- CORS enabled
- Error handling middleware

## Setup

### Prerequisites

- Bun installed (https://bun.sh/)
- MongoDB running locally or accessible via connection string

### Installation

1. Install dependencies:
```bash
bun install
```

2. Create `.env` file (copy from `env.example`):
```bash
cp env.example .env
```

3. Configure environment variables in `.env`:
```env
MONGO_URI=mongodb://localhost:27017
DEV_DB_NAME=wisdomlinked
PROD_DB_NAME=wisdomlinked_prod
EPHEMERAL_TEST_DB_NAME=wisdomlinked_test
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
JWT_EXPIRES_IN=7d
PORT=5000
NODE_ENV=dev
```

`NODE_ENV` must be one of `dev`, `prod`, or `test` (aliases `development`/`production` are accepted).
When `NODE_ENV=test`, you must also provide:
`TEST_DB_CARE_WIPED_EVERY_TEST_RUN=I_UNDERSTAND_THIS_TEST_DB_IS_WIPED_EVERY_TEST_RUN`.

### Running

Development mode (with auto-reload):
```bash
bun dev
```

Production mode:
```bash
bun start
```

## Default Admin Account

On first startup, an admin account is seeded **only if** `ADMIN_DEFAULT_PASSWORD` is set in `.env`:
- **Username**: administrator
- **Email**: Value of `ADMIN_DEFAULT_EMAIL` (defaults to `admin@wisdomlinked.com`)
- **Password**: Value of `ADMIN_DEFAULT_PASSWORD`

If `ADMIN_DEFAULT_PASSWORD` is not set, no admin user is created automatically.

## API Endpoints

### Authentication (`/api/v1/auth`)
- `POST /register` - Register new user
- `POST /login` - Login user
- `GET /me` - Get current user (protected)
- `POST /logout` - Logout user (protected)

### Sessions (`/api/v1/sessions`)
- `GET /my-sessions` - Get all active sessions for current user (protected)
- `DELETE /:sessionId` - Revoke a specific session (protected)
- `DELETE /` - Revoke all other sessions (protected)
- `GET /user/:userId` - Get sessions for any user (admin only)
- `DELETE /user/:userId` - Revoke all sessions for a user (admin only)

### User Management (`/api/v1/user-management`) - Admin only
- `GET /users` - List users with search and filtering
- `GET /stats` - Get user statistics
- `PUT /users/:id/toggle-status` - Enable/disable user account
- `POST /users/:id/reset-password` - Reset user password (invalidates all sessions)
- `POST /users/:id/generate-reset-link` - Generate password reset link

### System Settings (`/api/v1/settings`) - Admin only
- `GET /` - Get system settings
- `PUT /` - Update system settings (registration, auth methods)

### OAuth (`/api/v1/oauth`)
- `GET /discord` - Initiate Discord OAuth flow
- `GET /discord/callback` - Discord OAuth callback

### Users (`/api/v1/users`) - Admin only
- `GET /` - Get all users
- `GET /:id` - Get user by ID
- `POST /` - Create new user
- `PUT /:id` - Update user
- `DELETE /:id` - Delete user

### Logs (`/api/v1/logs`) - Admin only
- `GET /` - Get logs with pagination and filtering
- `DELETE /` - Clear all logs

### Metrics (`/api/v1/metrics`) - Admin only
- `GET /` - Get metrics with pagination
- `GET /summary` - Get metrics summary with aggregations
- `DELETE /` - Clear all metrics

### Health Check
- `GET /health` - Server health status

## Project Structure

```
backend/
├── src/
│   ├── config/         # Database and configuration
│   ├── models/         # Mongoose schemas
│   ├── controllers/    # Business logic
│   ├── routes/         # API routes (versioned)
│   ├── middlewares/    # Auth, logging, metrics, rate limiting
│   ├── utils/          # Helper functions (JWT, hashing)
│   └── server.ts       # Entry point
├── package.json
├── tsconfig.json
└── env.example
```

## Development

### Code Quality

Format code:
```bash
bun format
```

Lint code:
```bash
bun lint
```

### Debugging Tools

View database logs:
```bash
bun logs                    # View latest 50 logs
bun logs:errors             # View only errors
bun run src/utils/viewLogs.ts -l warn -n 100  # Custom options
```

View metrics:
```bash
bun metrics                 # View metrics summary and recent requests
bun run src/utils/viewMetrics.ts -n 100       # Custom options
```

Available options for logs:
- `-l, --level <level>` - Filter by level (error, warn, info, debug)
- `-n, --limit <number>` - Number of logs to display
- `--no-metadata` - Hide metadata
- `-h, --help` - Show help

Available options for metrics:
- `-p, --path <path>` - Filter by endpoint path
- `-n, --limit <number>` - Number of metrics to display
- `-a, --authenticated` - Show only authenticated requests
- `--anonymous` - Show only anonymous requests
- `-h, --help` - Show help

## Rate Limiting

The API implements generous rate limiting:
- Anonymous users: 1000 requests per minute per IP
- Authenticated users: 2000 requests per minute per user

## Security

### Session Management
- Every login creates a tracked session with:
  - IP address
  - Device information (browser, OS, device type)
  - Last activity timestamp
  - Expiration date (7 days)
- Sessions automatically expire after 7 days
- Users can view and revoke active sessions
- Admins can manage sessions for any user

### Password Security
- All password changes invalidate active sessions (local accounts only)
- OAuth accounts (Discord) don't use passwords
- Passwords hashed with argon2id (memory-hard algorithm)
- Admin-initiated password resets also invalidate sessions

### Token Validation
- JWT tokens are validated on every protected request
- Session existence and validity checked alongside JWT
- Automatic session activity tracking
- Expired sessions are automatically cleaned up
- CORS enabled with credential support
- Input validation via ElysiaJS
- Role-based access control

## License

MIT

