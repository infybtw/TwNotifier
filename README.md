# TwitchNotifierBot

A Telegram bot that sends real-time notifications when Twitch/Kick streamers go live, with a web admin panel for management. Built with TypeScript, Bun runtime, and integrates with Twitch EventSub WebSocket API and Kick webhooks.

## Project Description

TwitchNotifierBot is a notification system that connects to Twitch's EventSub WebSocket API and Kick's webhook system to monitor streamers and sends Telegram notifications when they start streaming. The bot maintains persistent WebSocket connections to Twitch, handles authentication, and manages user subscriptions through a Telegram interface.

### Key Features
- Real-time Twitch and Kick stream notifications via Telegram
- Twitch EventSub WebSocket integration for efficient streaming
- Kick webhook integration for stream notifications
- PostgreSQL database for persistent user preferences
- Grammy.js framework for Telegram bot interactions
- Development mode with Twitch API mocking support
- **Web admin panel** with Nuxt 4 + Tailwind CSS v4

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
   cd web-admin && bun install
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

# Telegram Bot Token
BOT_TOKEN=TELEGRAM_BOT_TOKEN

# Database
DATABASE_URL=DATABASE_URL

# JWT Secret for web admin auth
JWT_SECRET=CHANGE_ME_TO_A_RANDOM_STRING

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

### Running

**Development** (bot + web):
```bash
bun run dev    # Bot on :3000
bun run web    # Web admin on :3001
```

**Production** (Docker):
```bash
docker compose -f docker-compose.prod.yml up -d
```

### Testing
```bash
bun test
```

## Web Admin Panel

The web admin panel (`web-admin/`) provides a browser-based interface for managing the bot.

### Authentication
1. Open the web panel in your browser
2. Send `/weblogin` to the Telegram bot to get a one-time code
3. Enter the code on the login page
4. You'll receive a Telegram notification confirming the login

### Pages
- **Dashboard** — overview with stats (users, channels, follows, stream logs)
- **Users** — list, edit, delete registered users
- **Channels** — list, edit, delete tracked channels
- **Follows** — list, delete user-channel subscriptions
- **Admin Keys** — generate and manage admin access keys
- **Stream Logs** — view stream online/offline event history
- **Broadcast** — send messages to all bot users
- **EventSub** — view, reload, disconnect, cleanup Twitch EventSub subscriptions
- **Webhooks** — view, reload, disconnect, cleanup Kick webhook subscriptions
- **Admin Logs** — audit trail of admin actions

### Tech Stack
- **Nuxt 4** — Vue.js framework with SSR
- **Tailwind CSS v4** — utility-first CSS
- **Dark mode** — toggle in sidebar, persisted to localStorage
- **Collapsible sidebar** — with icon-only collapsed state

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
│   └── users.ts          # User lookups
├── kickAPI/              # Kick API integration
│   ├── auth.ts           # Kick authentication
│   ├── subscription.ts   # Kick subscription management
│   ├── users.ts          # Kick user lookups
│   ├── publicKey.ts      # Webhook signature verification
│   └── verifyWebhook.ts  # Webhook verification
├── handlers/             # Event handlers
│   ├── ws_handler.ts     # Twitch WebSocket message processing
│   ├── http_handler.ts   # Elysia HTTP server (API + webhooks)
│   ├── webhook_handler.ts # Kick webhook processing
│   ├── admin_api.ts      # REST API for web admin
│   └── auth_api.ts       # JWT auth endpoints
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

web-admin/
├── nuxt.config.ts        # Nuxt configuration
├── Dockerfile            # Production build
├── app/
│   ├── app.vue           # App entry
│   ├── assets/css/       # Tailwind CSS entry
│   ├── components/       # Reusable components
│   │   ├── Sidebar.vue
│   │   ├── DataTable.vue
│   │   ├── Modal.vue
│   │   ├── Button.vue
│   │   ├── Input.vue
│   │   ├── StatCard.vue
│   │   ├── ThemeSwitcher.vue
│   │   └── AppLayout.vue
│   ├── composables/      # Vue composables
│   │   ├── useApi.ts     # API fetch helpers
│   │   ├── useAuth.ts    # Auth state management
│   │   └── useSidebar.ts # Sidebar collapse state
│   ├── middleware/        # Route middleware
│   │   └── auth.global.ts # Auth guard
│   ├── layouts/          # Page layouts
│   └── pages/            # Page components
│       ├── index.vue     # Dashboard
│       ├── login.vue     # Auth login
│       ├── users/        # User management
│       ├── channels/     # Channel management
│       ├── follows/      # Follow management
│       ├── admin-keys/   # Admin key management
│       ├── stream-logs/  # Stream event logs
│       ├── broadcast/    # Message broadcast
│       ├── eventsub/     # EventSub control
│       ├── webhooks/     # Webhook control
│       └── admin-logs/   # Admin action logs
```

## Libraries Used

### Core Dependencies
- **[grammy](https://grammy.dev/)** (^1.42.0) - Telegram Bot Framework
- **[@grammyjs/conversations](https://grammy.dev/plugins/conversations)** (^2.1.1) - Conversation management for Telegram bots
- **[@grammyjs/storage-file](https://grammy.dev/plugins/storage-file)** (^2.5.1) - File-based session storage
- **[drizzle-orm](https://orm.drizzle.team/)** (^0.45.2) - TypeScript ORM for PostgreSQL
- **[elysia](https://elysiajs.com/)** (^1.4.29) - HTTP server framework
- **[pg](https://node-postgres.com/)** (^8.22.0) - PostgreSQL client
- **[pino](https://getpino.io/)** (^10.3.1) - Logger

### Web Admin Dependencies
- **[nuxt](https://nuxt.com/)** (^4.4.8) - Vue.js framework
- **[tailwindcss](https://tailwindcss.com/)** (^4.3.2) - CSS framework
- **[@tailwindcss/vite](https://tailwindcss.com/)** - Tailwind Vite plugin

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
