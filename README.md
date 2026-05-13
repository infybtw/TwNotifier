# TwitchNotifierBot

A Telegram bot that sends real-time notifications when Twitch streamers go live. Built with TypeScript, Bun runtime, and integrates with Twitch EventSub WebSocket API.

## Project Description

TwitchNotifierBot is a notification system that connects to Twitch's EventSub WebSocket API to monitor streamers and sends Telegram notifications when they start streaming. The bot maintains persistent WebSocket connections to Twitch, handles authentication, and manages user subscriptions through a Telegram interface.

### Key Features
- Real-time Twitch stream notifications via Telegram
- Twitch EventSub WebSocket integration for efficient streaming
- PostgreSQL(SQLite deprecated) database for persistent user preferences
- Grammy.js framework for Telegram bot interactions
- Development mode with localhost API mocking support

## Quickstart

### Prerequisites
- [Bun](https://bun.sh/) runtime (v1.0+)
- Telegram Bot Token from [@BotFather](https://t.me/botfather)
- Twitch API credentials (Client ID and Client Secret)

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
   cp .env.example .env.dev
   ```

4. Edit the environment files:
   - `.env` - Production configuration with real Twitch endpoints
   - `.env.dev` - Development configuration with localhost endpoints

### Environment Variables

Create `.env` and `.env.dev` files with the following structure:

```bash
# Twitch API Credentials
CLIENT_ID=TWITCH_CLIENT_ID
CLIENT_SECRET=TWITCH_CLIENT_SECRET
BOT_USER_ID=BOT_USER_ID(not required)

# Twitch EventSub Configuration
SHARD_COUNT=1

# Telegram Bot Token
BOT_TOKEN=TELEGRAM_BOT_TOKEN

# Production endpoints (use in .env):
TWITCH_WS=TWITCH_WS_URL
TWITCH_HELIX=TWITCH_HELIX_URL
TWITCH_OAUTH=TWITCH_OAUTH_URL
DATABASE_URL=DATABASE_URL

# DEV ONLY — NEVER IN PRODUCTION
# Development endpoints (use in .env.dev):
# TWITCH_WS=ws://localhost:8081/ws
# TWITCH_HELIX=localhost:7777
# TWITCH_OAUTH=localhost:7777

```

### Running the Bot

**Development mode** (with file watching and localhost endpoints):
```bash
bun run dev
```

**Production mode** (with real Twitch endpoints):
```bash
bun run start
```

### Testing
```bash
bun test
```

## Architecture

```
app/
├── index.ts              # Main entry point
├── config.ts            # Environment configuration
├── logger.ts            # Logging setup
├── bot/                 # Telegram bot handlers
│   ├── bot.ts           # Bot initialization
│   ├── bot_router.ts    # Message routing
│   └── bot_callback_handler.ts # Callback handlers
├── twitchAPI/           # Twitch API integration
│   ├── auth.ts          # Authentication
│   ├── shards.ts        # WebSocket connection management
│   ├── conduits.ts      # Conduit management
│   └── subscriptions.ts # Event subscriptions
├── handlers/            # WebSocket handlers
│   └── ws_handler.ts    # WebSocket message processing
└── models/              # Database models
    ├── user.ts          # User data
    ├── channel.ts       # Channel tracking
    └── follow.ts        # Follow relationships
```

## Libraries Used

### Core Dependencies
- **[grammy](https://grammy.dev/)** (^1.42.0) - Telegram Bot Framework
- **[@grammyjs/conversations](https://grammy.dev/plugins/conversations)** (^2.1.1) - Conversation management for Telegram bots
- **[@grammyjs/storage-file](https://grammy.dev/plugins/storage-file)** (^2.5.1) - File-based session storage
- **[tslog](https://tslog.js.org/)** (^4.10.2) - TypeScript logging with rich features

### Development Dependencies
- **[@types/bun](https://bun.sh/docs/typescript)** - TypeScript definitions for Bun
- **[typescript](https://www.typescriptlang.org/)** (^5) - TypeScript compiler
- **[TwitchMock](https://github.com/twirapp/twir/tree/main/apps/twitch-mock)** - Twitch mock by Satont

### Runtime
- **[Bun](https://bun.sh/)** - JavaScript runtime and package manager
- **PostgreSQL** - Embedded database for persistence

## Development

### TypeScript Configuration
- Target: ES2020
- Module: CommonJS
- Source directory: `app/`
- Output directory: `dist/`
