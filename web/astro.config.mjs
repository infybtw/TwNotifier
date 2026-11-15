import { defineConfig } from "astro/config";
import node from "@astrojs/node";
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

// Telegram Mini App rendered on demand by a small Node server; the API and the
// Telegram bridge stay client-side, so no product data is fetched during SSR.
export default defineConfig({
  output: "server",
  adapter: node({ mode: "standalone" }),
  server: {
    host: true,
    port: 3001,
  },
  compressHTML: true,
  vite: {
    // Reuse the repository-level `.env` for local runs; production builds get
    // PUBLIC_* values from Docker build args instead.
    envDir: "..",
    plugins: [tailwindcss()],
    server: {
      allowedHosts: devAllowedHosts,
    },
  },
});
