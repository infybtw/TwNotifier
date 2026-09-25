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
assets. Deploy `.output/public` behind the HTTPS proxy; the proxy must rewrite
unknown paths to `index.html` so nested routes work on reload.

## Configuration

Public, non-secret values only (never the bot token):

| Variable | Default | Purpose |
| --- | --- | --- |
| `NUXT_PUBLIC_API_BASE` | `/api/v1` | API base path or absolute URL |
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

The dev servers can be run behind `CaddyfileDev` (backend on `:3000`, Nuxt on
`:3001`, proxy on `:9091`) with a public HTTPS tunnel and a separate test bot.
Backend base URL and bot token live in the repository root `.env`; this package
only needs the public values above.

## Deployment

- `Dockerfile-web` builds the SPA and serves it with Caddy (`Caddyfile.prod`).
- The same Caddy instance proxies `/api/v1/*` and the provider webhook paths to
  the bot, and falls back to `index.html` for SPA routes.
- Responses for `/api/v1` are marked `Cache-Control: no-store`; versioned
  assets are cached immutably.
