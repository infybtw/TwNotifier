# TwitchNotifierBot - Agent Guidance

## Development Commands
- `bun run dev` - Run the bot with `.env` file (no file watching)
- `bun test` - Run tests (no test files currently exist in app/)
- There is no `start` script; production runs via Docker (`Dockerfile-app`)

## Environment Setup
- Environment file: `.env` (loaded via `--env-file` flag in package.json script)
- `.env.example` documents all required variables including Kick integration vars
- Development uses localhost endpoints for Twitch API mocking (twitch-mock service)
- Production uses real Twitch endpoints (`wss://eventsub.wss.twitch.tv/ws`, `https://api.twitch.tv`)
- `DATABASE_URL` is required - PostgreSQL connection string

## Architecture Notes
- Entry point: `app/index.ts` - runs migrations, starts Telegram bot, authenticates Twitch/Kick, connects WebSocket, starts HTTP server
- Uses Bun runtime with TypeScript (ES modules, `"type": "module"` in package.json)
- Telegram bot built with grammy.js framework (`app/bot/`)
- Twitch EventSub WebSocket integration for real-time stream notifications (`app/twitchAPI/`)
- Kick integration via webhooks handled by Elysia HTTP server (`app/kickAPI/`, `app/handlers/http_handler.ts`)
- PostgreSQL database via Drizzle ORM (`app/database/`)
- Schema: `app/database/schema.ts`, migrations: `drizzle/` directory
- Drizzle config: `drizzle.config.ts` (uses `DATABASE_URL` env var)
- Startup order matters: migrate → bot → auth → conduits → websocket → http server

## Database
- PostgreSQL 16 (not SQLite)
- Drizzle ORM with `drizzle-orm/bun-sql` driver
- Run migrations: `bun run app/migrate.ts` (also runs automatically on startup)
- Generate migrations: `npx drizzle-kit generate`
- Schema tables: `users`, `channels`, `users_follows`, `users_settings`, `admin_keys`

## Docker Compose Files
- `docker-compose.dev.yml` - PostgreSQL + twitch-mock (for local development)
- `docker-compose.prod.yml` - PostgreSQL + app + adminer + pgbackweb (production)
- `docker-compose.local.yml` - PostgreSQL + app + adminer (local prod-like testing)

## Build & Type Checking
- TypeScript config: `tsconfig.json` with `rootDir: "./app"`, `outDir: "./dist"`
- No linting, formatting, or typecheck scripts defined in package.json
- Build artifacts go to `dist/` directory (git-ignored)

## Important Constraints
- Database file (`*.db`) and session files (`/sessions`) are git-ignored
- Logs directory (`logs/`) is git-ignored
- Uses Bun's built-in test runner (no Jest/Mocha configuration found)
- No existing test files in `app/` directory - `bun test` will run but find no tests
- `APP_TOKEN`, `KICK_APP_TOKEN`, `CONDUIT_ID` are mutable globals set at runtime in `app/config.ts`
