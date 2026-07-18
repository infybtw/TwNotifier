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
   git clone https://github.com/iinfy/twnotifier
   cd TwitchNotifierBot
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

For development with twitch-mock, use localhost endpoints:
```bash
TWITCH_WS=ws://localhost:8081/ws
TWITCH_HELIX=localhost:7777
TWITCH_OAUTH=localhost:7777
```

### Running the Bot

**Development mode** (with `.env` file):
```bash
bun run dev
```

**Production mode** (via Docker):
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Testing
```bash
bun test
```

## Architecture

```
app/
├── index.ts              # Main entry point
├── config.ts             # Environment configuration
├── logger.ts             # Logging setup
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
│   ├── http_handler.ts   # Elysia HTTP server (Kick + Twitch webhooks)
│   └── webhook_handler.ts # Kick webhook processing
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
```

## Libraries Used

### Core Dependencies
- **[grammy](https://grammy.dev/)** (^1.42.0) - Telegram Bot Framework
- **[@grammyjs/conversations](https://grammy.dev/plugins/conversations)** (^2.1.1) - Conversation management for Telegram bots
- **[@grammyjs/storage-file](https://grammy.dev/plugins/storage-file)** (^2.5.1) - File-based session storage
- **[drizzle-orm](https://orm.drizzle.team/)** (^0.45.2) - TypeScript ORM for PostgreSQL
- **[elysia](https://elysiajs.com/)** (^1.4.29) - HTTP server framework (Kick + Twitch webhooks)
- **[pg](https://node-postgres.com/)** (^8.22.0) - PostgreSQL client
- **[pino](https://getpino.io/)** (^10.3.1) - Logger

### Development Dependencies
- **[@types/bun](https://bun.sh/docs/typescript)** - TypeScript definitions for Bun
- **[typescript](https://www.typescriptlang.org/)** (^5) - TypeScript compiler
- **[drizzle-kit](https://orm.drizzle.team/kit-docs/overview)** (^0.31.10) - Database migration tooling
- **[TwitchMock](https://github.com/twirapp/twir/tree/main/apps/twitch-mock)** - Twitch mock by Satont

### Runtime
- **[Bun](https://bun.sh/)** - JavaScript runtime and package manager
- **[PostgreSQL](https://www.postgresql.org/)** - Database for persistence

## Development

### TypeScript Configuration
- Target: ES2020
- Module: ES modules (`"type": "module"` in package.json)
- Source directory: `app/`
- Output directory: `dist/`
