# TwitchNotifierBot - Agent Guidance

## Development Commands
- `bun run dev` - Development mode with `.env.dev` file and file watching
- `bun run start` - Production mode with `.env` file
- `bun test` - Run tests (no test files currently exist in app/)

## Environment Setup
- Environment files: `.env.dev` (development)
- Development uses localhost endpoints for Twitch API mocking
- Production uses real Twitch endpoints (`wss://eventsub.wss.twitch.tv/ws`, `https://api.twitch.tv`)
- Environment variables are loaded via `--env-file` flag in package.json scripts

## Architecture Notes
- Entry point: `app/index.ts` - starts Telegram bot, Twitch authentication, WebSocket connection
- Uses Bun runtime with TypeScript (ES modules, `"type": "module"` in package.json)
- Telegram bot built with grammy.js framework
- Twitch EventSub WebSocket integration for real-time notifications
- SQLite database (`main.db`) for persistence (ignored in .gitignore)

## Build & Type Checking
- TypeScript config: `tsconfig.json` with `rootDir: "./app"`, `outDir: "./dist"`
- No linting or formatting scripts defined in package.json
- Build artifacts go to `dist/` directory (ignored in .gitignore)

## Important Constraints
- Database file (`*.db`) and session files (`/sessions`) are git-ignored
- Logs directory (`logs/`) is git-ignored
- Uses Bun's built-in test runner (no Jest/Mocha configuration found)
- No existing test files in `app/` directory - `bun test` will run but find no tests
