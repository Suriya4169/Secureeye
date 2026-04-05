# 🛡️ SecureEye — Production Security Monitoring System

> Multi-laptop CCTV system with real-time hand detection, push notifications, and a mobile dashboard.

## Architecture

```
secureeye/
├── shared/            # Types, constants, validators (Zod)
├── backend/           # Express + WebSocket server
├── laptop-cctv/       # Electron + MediaPipe Hands
├── mobile-app/        # Expo React Native dashboard
└── supabase/          # Migrations, RLS policies, seed data
```

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Backend | Express.js, WebSocket (ws), Bull queues, Redis |
| Database | Supabase (PostgreSQL + Auth + Storage) |
| CCTV App | Electron, MediaPipe Hands |
| Mobile App | Expo React Native, Zustand, React Native Paper |
| Networking | Tailscale mesh VPN |
| Notifications | Firebase Cloud Messaging (FCM) |

## How It Works

1. **Laptop cameras** run the Electron CCTV app with MediaPipe Hands detection
2. When **2 hands** are detected (confidence > threshold), an alert is triggered
3. Alert sends a **snapshot via WebSocket** to the backend over Tailscale
4. Backend **compresses and stores** the image, then sends push notifications
5. **Mobile app** receives real-time alerts with snapshot preview

## Setup

### Prerequisites
- Node.js 18+
- Redis (for queues and rate limiting)
- Supabase project (or local via Docker)
- Tailscale installed on all devices
- Firebase project (for push notifications)

### 1. Environment Variables

```bash
cp .env.example .env
# Fill in all values
```

### 2. Install Dependencies

```bash
npm install          # Installs all workspaces
```

### 3. Database

```bash
# Apply migrations to your Supabase project
# Via Supabase CLI:
supabase db push
```

### 4. Start Backend

```bash
npm run dev --workspace=backend
```

### 5. Start Laptop CCTV

```bash
npm run dev --workspace=laptop-cctv
```

### 6. Start Mobile App

```bash
npm run start --workspace=mobile-app
```

## Detection Logic

- **Model**: MediaPipe Hands (runs in browser/Electron renderer)
- **Trigger**: 2 hands detected simultaneously
- **Threshold**: Configurable (default 0.70)
- **Cooldown**: 30 seconds between alerts
- **Snapshot**: JPEG compressed to <200KB

## Security

- All camera↔backend traffic flows through **Tailscale VPN** (100.64.0.0/10 guard)
- **Supabase RLS** policies enforce multi-tenant data isolation
- **JWT authentication** on all API routes
- **Rate limiting** on login (5/15min) and API (100/min)
- Camera API keys for device authentication

## API Routes

| Method | Path | Auth | Description |
|--------|------|------|-------------|
| POST | `/api/auth/verify-email` | No | Resend verification |
| POST | `/api/auth/logout` | JWT | Invalidate session |
| GET | `/api/cameras` | JWT | List cameras |
| POST | `/api/cameras/register` | Tailscale | Register camera |
| PATCH | `/api/cameras/:id` | JWT | Update camera |
| DELETE | `/api/cameras/:id` | JWT | Remove camera |
| POST | `/api/cameras/:id/command` | JWT | Send command |
| GET | `/api/alerts` | JWT | Paginated alerts |
| PATCH | `/api/alerts/:id/reviewed` | JWT | Mark reviewed |
| GET/POST | `/api/orgs` | JWT | List/create org |
| POST | `/api/orgs/join` | JWT | Join via invite code |
| POST | `/api/notifications/token` | JWT | Save FCM token |

## License

MIT
