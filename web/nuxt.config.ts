import tailwindcss from "@tailwindcss/vite";

/**
 * Comma-separated list of extra hosts the Vite dev server may respond to.
 * Needed when the Mini App is tuned through a public tunnel during development,
 * for example: DEV_ALLOWED_HOSTS=rp2.infybtw.dev,abc.ngrok-free.app
 */
const devAllowedHosts = (process.env.DEV_ALLOWED_HOSTS ?? "")
  .split(",")
  .map((host) => host.trim())
  .filter(Boolean);

// Telegram Mini App: client-side only SPA, shipped as static files.
export default defineNuxtConfig({
  ssr: false,
  compatibilityDate: "2025-01-01",
  devtools: { enabled: false },
  css: ["~/assets/css/main.css"],
  vite: {
    plugins: [tailwindcss()],
    server: {
      allowedHosts: devAllowedHosts,
    },
  },
  runtimeConfig: {
    public: {
      // Relative by default so the SPA and API share one HTTPS origin.
      apiBase: process.env.NUXT_PUBLIC_API_BASE || "/api/v1",
      botUsername: process.env.NUXT_PUBLIC_BOT_USERNAME || "",
    },
  },
  app: {
    head: {
      title: "TwNotifier",
      meta: [
        { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover" },
        { name: "theme-color", content: "#1f2937" },
      ],
      // The official bridge must be present before initialization.
      script: [{ src: "https://telegram.org/js/telegram-web-app.js" }],
    },
  },
  hooks: {
    // Only index.html/200.html/404.html are generated; routes are handled
    // client-side and the proxy rewrites unknown paths to index.html.
    "prerender:routes"({ routes }) {
      routes.clear();
    },
  },
});
