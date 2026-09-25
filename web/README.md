# Mini App

Telegram Mini App for TwitchNotifierBot. A static Nuxt 4 SPA (Tailwind CSS 4,
`ssr: false`) that talks to the bot's user API at `/api/v1`.

## Requirements

- Bun
- A running backend (see the repository root README)

## Commands

```bash
bun install        # install dependencies
bun run dev        # Nuxt dev server on http://localhost:3001
bun run typecheck  # vue-tsc type checking
bun run generate   # static build into web/.output/public
```

`nuxt generate` produces `index.html`, `200.html` and `404.html` plus hashed
assets. The production Docker image serves them directly with Bun and falls
back to `index.html` so nested routes work on reload.

## Configuration

Public, non-secret values only (never the bot token):

| Variable | Default | Purpose |
| --- | --- | --- |
| `API_PATH` | `/api/v1` | REST API path prefix |
| `NUXT_PUBLIC_API_BASE` | `API_PATH` | API base path or absolute URL |
| `NUXT_PUBLIC_BOT_USERNAME` | empty | Bot username used for chat/share links |

## How it works

1. The Telegram Web App script is loaded before the app initializes
   (`nuxt.config.ts` head script).
2. On launch the app sends `Telegram.WebApp.initData` to
   `POST /api/v1/auth/telegram`. Outside Telegram an "Open in Telegram" screen
   is shown instead.
3. The backend verifies `initData`, creates the user and returns an opaque
   bearer token. The token is kept in memory only (never in `localStorage`) and
   sent as `Authorization: Bearer ...`.
4. When a request returns `401`, the token is dropped and the recovery screen
   asks the user to reopen the Mini App from the bot button.
5. Notifications are delivered by the bot in the private chat and continue to
   work while the Mini App is closed.

## Local development inside Telegram

The backend (`:3000`) and Nuxt (`:3001`) can be exposed through a public HTTPS
tunnel with a separate test bot.
Backend base URL and bot token live in the repository root `.env`; this package
only needs the public values above.

## Deployment

- `Dockerfile-web` builds the SPA and serves it directly with Bun on
  `WEB_SERVER_PORT` (default `3001`).
- The API is a separate public endpoint on `HTTP_SERVER_PORT` (default `3000`).
  Set `NUXT_PUBLIC_API_BASE` to its full public URL at image build time.
- Both public endpoints need HTTPS for Telegram Mini Apps; TLS is deliberately
  outside this Compose stack.
