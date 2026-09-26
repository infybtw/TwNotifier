# TwitchNotifierBot

A Telegram bot that sends real-time notifications when Twitch/Kick streamers go live. Built with TypeScript, Bun runtime, and integrates with Twitch EventSub (WebSocket conduit or webhook) and Kick webhooks.

## Project Description

TwitchNotifierBot is a notification system that monitors Twitch and Kick streamers and sends Telegram notifications when they start or stop streaming. For Twitch, it supports two EventSub transport modes: **conduit** (persistent WebSocket connection) or **webhook** (HTTP callback). Kick uses webhook integration. The bot handles authentication, manages user subscriptions, and provides an admin panel via Telegram.

### Key Features
- Real-time Twitch and Kick stream notifications via Telegram
- Twitch EventSub with configurable transport: conduit (WebSocket) or webhook
- Kick webhook integration for stream notifications
- PostgreSQL database for persistent user preferences
- Grammy.js framework for Telegram bot interactions
- Development mode with Twitch API mocking support

## Quickstart

### Prerequisites
- [Bun](https://bun.sh/) runtime (v1.0+)
- PostgreSQL database
- Telegram Bot Token from [@BotFather](https://t.me/botfather)
- Twitch API credentials (Client ID and Client Secret)
- Kick API credentials (optional, for Kick stream notifications)

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/infybtw/TwNotifier
   cd TwNotifier
   ```

2. Install dependencies:
   ```bash
   bun install
   ```

3. Configure environment variables:
   ```bash
   cp .env.example .env
   ```

4. Edit `.env` with your configuration (see `.env.example` for all required variables)

### Environment Variables

Create a `.env` file with the following structure (see `.env.example`):

```bash
# Twitch API Credentials
CLIENT_ID=TWITCH_CLIENT_ID
CLIENT_SECRET=TWITCH_CLIENT_SECRET
BOT_USER_ID=BOT_USER_ID

# Kick API Credentials (optional)
KICK_CLIENT_ID=
KICK_CLIENT_SECRET=
KICK_WEBHOOK_PATH=
HTTP_SERVER_PORT=

# Twitch EventSub Configuration
SHARD_COUNT=1

# Twitch EventSub Transport: "webhook" or "conduit" (required)
TWITCH_EVENT_TRANSPORT=

# Webhook config (required when TWITCH_EVENT_TRANSPORT=webhook)
TWITCH_WEBHOOK_PATH=
TWITCH_WEBHOOK_SECRET=
BOT_URL=https://your-domain.com

# Telegram Bot Token
BOT_TOKEN=TELEGRAM_BOT_TOKEN

# Database
DATABASE_URL=DATABASE_URL

# Twitch endpoints
TWITCH_WS=TWITCH_WS_URL
TWITCH_HELIX=TWITCH_HELIX_URL
TWITCH_OAUTH=TWITCH_OAUTH_URL
```

### Running the Bot

**Development mode** (with `.env` file):
```bash
bun run dev
```

**Development stack** (PostgreSQL, backend, Mini App and Caddy; Twitch uses the
real API configured in `.env`):
```bash
docker compose -f docker-compose.dev.yml up --build
```

The stack is available on `http://localhost:3000`; Caddy forwards Mini App,
`API_PATH`, and provider webhooks to the internal containers. Only PostgreSQL
(`localhost:54322`) and Caddy (`localhost:3000`) are published to the host.

**Production mode** (via Docker):
```bash
docker compose -f docker-compose.prod.yml up -d
```

Prebuilt images are published to GHCR on every git tag push (version tag + `latest`):
```bash
docker pull ghcr.io/infybtw/twnotifier:latest
```

### Testing
```bash
bun test
```

Backend type checking (from `app/`):
```bash
cd app && bun run typecheck
```

Frontend commands (from `web/`):
```bash
bun install
bun run dev        # Nuxt dev server on :3001
bun run typecheck
bun run generate   # static SPA into web/.output/public
```

### Deep Links

To open the bot and automatically follow a Twitch or Kick channel, use its platform and channel name in the `start` payload:

```
https://t.me/<bot_username>?start=prefollow_<platform>_<channel_name>
```

For example:

```
https://t.me/<bot_username>?start=prefollow_twitch_justovich221337
https://t.me/<bot_username>?start=prefollow_kick_justovich221337
```

Telegram deep links use the `start` parameter, so `?prefollow=twitch/justovich221337` is not delivered to the bot.

## Telegram Mini App

The bot ships with a Telegram Mini App (a static Nuxt SPA in `web/`) that covers
every user-facing feature: follows, adding and removing channels, live status,
all notification settings, language and help. Chat commands and buttons keep
working in parallel; notifications are always delivered in the private chat,
whether or not the Mini App is open.

```
web/ (Nuxt 4 SPA, static build)
      │ HTTPS /api/v1 + bearer token
      ▼
Bun / Elysia: auth → validation → services ─── PostgreSQL
      ▲                                      └── Twitch / Kick API
Telegram commands / callbacks ─ services ────┘
```

### Backend API

All routes except the `initData` exchange require an
`Authorization: Bearer <token>` header. The token is opaque, stored hashed in
`web_sessions`, and short-lived (default 1 hour).

| Method and path | Purpose |
| --- | --- |
| `POST /api/v1/auth/telegram` | Verify `initData`, register the user, issue a session |
| `DELETE /api/v1/auth/session` | Revoke the current session |
| `GET /api/v1/me` | Profile, language, chat-delivery state |
| `GET /api/v1/settings` | All user settings (booleans) |
| `PATCH /api/v1/settings` | Set explicitly supplied values |
| `POST /api/v1/channels/resolve` | Resolve a username/URL to platform matches |
| `GET /api/v1/follows` | Paginated follows with `platform`/`search` filters |
| `POST /api/v1/follows` | Add `{ platform, channelId }` after server-side verification |
| `GET /api/v1/follows/:platform/:channelId` | Follow details and share links |
| `DELETE /api/v1/follows/:platform/:channelId` | Remove a follow (idempotent) |
| `GET /api/v1/follows/:platform/:channelId/live` | Live status and stream details |
| `GET /api/v1/online` | Live channels from the user's follows |

Errors use `{ "error": { "code", "message", "requestId" } }`; the frontend
localizes by `code`. A provider outage yields `unknown`, never `offline`.

Authentication follows Telegram's HMAC-SHA-256 scheme: `secret = HMAC("WebAppData", bot_token)`,
`hash = HMAC(secret, data_check_string)`. `initData` is accepted only from the
JSON body (size limited), `auth_date` must be fresh (5 minutes by default), and
the bot token never reaches the frontend.

### Frontend

See [`web/README.md`](web/README.md) for frontend commands and configuration.
Public configuration is limited to `NUXT_PUBLIC_API_BASE` and
`NUXT_PUBLIC_BOT_USERNAME`; no backend secret is exposed.

### Launching the Mini App

1. Create the Mini App in [@BotFather](https://t.me/botfather) and set its
   production HTTPS URL (`WEB_APP_URL`).
2. Set the menu button to that URL (BotFather or `setChatMenuButton`).
3. The private chat main menu already contains an "Open app" inline button when
   `WEB_APP_URL` is set; commands remain available below it.
4. Share links use the Main Mini App form:
   `https://t.me/<bot_username>?startapp=prefollow_<platform>_<login>`.
   Existing `?start=prefollow_...` links keep working through the bot.

### Docker deployment

`docker-compose.prod.yml` starts the API and static Mini App as independent
containers; no reverse proxy is included:

- API: `HTTP_SERVER_PORT` (default `3000`) with routes under `API_PATH`
  (default `/api/v1`).
- Mini App: `WEB_SERVER_PORT` (default `3001`), with client-side routes falling
  back to `index.html`.
- Set `NUXT_PUBLIC_API_BASE` to the absolute public API URL including
  `API_PATH`, and add the Mini App origin to `CORS_ORIGINS` when they use
  different origins.

Both public endpoints must be HTTPS for Telegram. TLS termination, if needed,
is provided outside this Compose stack.

Before deploying, confirm:

1. The production Mini App domain and where the external HTTPS proxy is managed.
2. A separate test bot and HTTPS URL for Mini App testing.
3. Visual style preferences; the default is a compact interface using Telegram
   theme colors.

If the Mini App fails to load, users can keep managing everything through chat
commands; reopening the Mini App from the bot button is the recovery path for
expired sessions.

## Architecture

```
app/
├── index.ts              # Main entry point
├── config.ts             # Environment configuration
├── logger.ts             # Custom logger (json/pretty/plain, Alloy/Loki compatible)
├── migrate.ts            # Database migration runner
├── bot/                  # Telegram bot handlers
│   ├── bot.ts            # Bot initialization
│   ├── bot_router.ts     # Message routing
│   ├── bot_callback_handler.ts # Callback handlers
│   ├── bot_sender.ts     # Notification sending
│   └── keyboards.ts      # Keyboard layouts
├── twitchAPI/            # Twitch API integration
│   ├── auth.ts           # Authentication
│   ├── shards.ts         # WebSocket connection management
│   ├── conduits.ts       # Conduit management
│   ├── subscriptions.ts  # Event subscriptions
│   ├── users.ts          # User lookups
│   ├── verifyWebhook.ts  # Webhook signature verification (HMAC-SHA256)
│   └── webhook_handler.ts # Twitch webhook processing
├── kickAPI/              # Kick API integration
│   ├── auth.ts           # Kick authentication
│   ├── subscription.ts   # Kick subscription management
│   ├── users.ts          # Kick user lookups
│   ├── publicKey.ts      # Webhook signature verification
│   └── verifyWebhook.ts  # Webhook verification
├── handlers/             # Event handlers
│   ├── ws_handler.ts     # Twitch WebSocket message processing
│   ├── http_handler.ts   # Elysia HTTP server (API + Kick/Twitch webhooks)
│   └── webhook_handler.ts # Kick webhook processing
├── services/             # Shared business logic (bot + API)
│   ├── users.ts          # Registration, profile, chat delivery
│   ├── follows.ts        # Add/remove follows, provider subscriptions
│   ├── channels.ts       # Username/URL resolution and verification
│   ├── settings.ts       # Notification settings validation
│   ├── online.ts         # Batched live status with caching
│   └── errors.ts         # Transport-agnostic service errors
├── http/                 # User-facing REST API (v1)
│   ├── api.ts            # Route mounting and error mapping
│   ├── auth/             # initData verification, sessions, guard
│   ├── routes/           # auth, me, settings, channels, follows
│   └── dto.ts            # Public data structures
├── database/             # Database layer
│   ├── db.ts             # Database queries
│   └── schema.ts         # Drizzle ORM schema
├── models/               # Type definitions
│   ├── twitch_user.ts
│   ├── twitch_subscription.ts
│   └── kick_user.ts
└── utils/                # Utilities
    ├── settings.ts       # User settings helpers
    └── urlParser.ts      # URL parsing
web/                      # Telegram Mini App (Nuxt 4 + Tailwind 4 SPA)
```

## Libraries Used

### Core Dependencies
- **[grammy](https://grammy.dev/)** (^1.42.0) - Telegram Bot Framework
- **[@grammyjs/conversations](https://grammy.dev/plugins/conversations)** (^2.1.1) - Conversation management for Telegram bots
- **[@grammyjs/storage-file](https://grammy.dev/plugins/storage-file)** (^2.5.1) - File-based session storage
- **[drizzle-orm](https://orm.drizzle.team/)** (^0.45.2) - TypeScript ORM for PostgreSQL
- **[elysia](https://elysiajs.com/)** (^1.4.29) - HTTP server framework (Kick + Twitch webhooks)
- **[pg](https://node-postgres.com/)** (^8.22.0) - PostgreSQL client
- Custom logger (`app/logger.ts`) - Zero-dependency logger with json/pretty/plain formats, compatible with Grafana Alloy/Loki

### Development Dependencies
- **[@types/bun](https://bun.sh/docs/typescript)** - TypeScript definitions for Bun
- **[typescript](https://www.typescriptlang.org/)** (^5) - TypeScript compiler
- **[drizzle-kit](https://orm.drizzle.team/kit-docs/overview)** (^0.31.10) - Database migration tooling

### Runtime
- **[Bun](https://bun.sh/)** - JavaScript runtime and package manager
- **[PostgreSQL](https://www.postgresql.org/)** - Database for persistence

## Development

### TypeScript Configuration
- Target: ES2020
- Module: ES modules (`"type": "module"` in package.json)
- Source directory: `app/`
- Output directory: `dist/`
