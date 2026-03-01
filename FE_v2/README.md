# WisdomLinked Frontend

Modern React frontend built with Vite, TypeScript, TailwindCSS, and ShadCN UI components featuring dark mode, state management with Jotai, and comprehensive dashboards for customers, experts, and admins.

## Tech Stack

- **Framework**: React 18
- **Build Tool**: Vite
- **Language**: TypeScript
- **Styling**: TailwindCSS v4 + ShadCN UI
- **State Management**: Jotai (no prop drilling)
- **Routing**: React Router v7
- **HTTP Client**: Axios
- **Icons**: Lucide React

## Features

- Dark mode only UI (beautiful and modern)
- JWT-based authentication with auto token management
- Protected routes with role-based access
- Admin dashboard with metrics and logs
- Centralized API client with error handling
- Toast notifications for user feedback
- Loading states and spinners
- Responsive design

## Setup

### Prerequisites

- Node.js 18+ or Bun
- Backend server running (see backend README)

### Installation

1. Install dependencies:
```bash
npm install
# or
bun install
```

2. Create `.env` file (copy from `env.example`):
```bash
cp env.example .env
```

3. Configure environment variables in `.env`:
```env
VITE_API_URL=http://localhost:5000
```

### Running

Development mode:
```bash
npm run dev
# or
bun dev
```

Build for production:
```bash
npm run build
# or
bun run build
```

Preview production build:
```bash
npm run preview
# or
bun preview
```

## Project Structure

```
frontend/
├── src/
│   ├── api/            # Axios client & API modules
│   ├── atoms/          # Jotai state atoms
│   ├── components/     # Reusable components
│   │   └── ui/         # ShadCN UI components
│   ├── hooks/          # Custom React hooks
│   ├── layouts/        # Page layouts
│   ├── lib/            # Utilities
│   ├── pages/          # Page components
│   │   └── Admin/      # Admin pages
│   ├── App.tsx         # Router setup
│   ├── main.tsx        # Entry point
│   └── index.css       # Global styles
├── package.json
├── vite.config.ts
├── tsconfig.json
└── components.json     # ShadCN config
```

## Features

### Authentication
- Login and registration forms
- Automatic token persistence
- Protected routes with redirect
- Role-based access control

### User Dashboard
- Account information display
- Quick access to admin panel (for admins)
- Welcome screen with getting started info

### Admin Dashboard

**Overview Page**:
- Total requests counter
- Authenticated vs anonymous stats
- Unique endpoints count
- Top endpoints with hit counts
- Recent activity feed

**Metrics Page**:
- Comprehensive API metrics
- Request statistics
- Endpoint performance analytics
- Average response times
- Clear metrics functionality

**Logs Page**:
- System logs viewer
- Filter by log level (info, warn, error, debug)
- Detailed metadata view
- Clear logs functionality
- Timestamp and severity indicators

## State Management

Using Jotai for atomic state management:
- `authAtoms.ts` - User authentication state
- `logsAtoms.ts` - Logs data and pagination
- `metricsAtoms.ts` - Metrics data and summaries

No prop drilling needed!

## API Integration

Centralized API client with:
- Automatic token injection
- Global error handling
- Toast notifications
- Request/response interceptors

## Development

### Code Quality

Format code:
```bash
npm run format
# or
bun format
```

Lint code:
```bash
npm run lint
# or
bun lint
```

### Adding ShadCN Components

Components are already configured. The project includes:
- Button
- Card
- Input
- Toast/Toaster
- And more...

## Dark Mode Theme

The app uses a carefully crafted dark theme with:
- High contrast for readability
- Consistent color palette
- Smooth transitions
- Accessible design

Theme variables are defined in `src/index.css`.

## License

MIT

