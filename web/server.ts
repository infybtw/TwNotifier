import { join, normalize, relative } from "node:path";

const root = "/web/public";
const port = Number(process.env.WEB_SERVER_PORT || 3001);

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("WEB_SERVER_PORT must be a valid TCP port");
}

function resolveFile(pathname: string): string | null {
  const decoded = decodeURIComponent(pathname);
  const filePath = normalize(join(root, decoded));
  return relative(root, filePath).startsWith("..") ? null : filePath;
}

Bun.serve({
  hostname: "0.0.0.0",
  port,
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", { status: 405, headers: { allow: "GET, HEAD" } });
    }

    const filePath = resolveFile(new URL(request.url).pathname);
    if (filePath) {
      const file = Bun.file(filePath);
      if (await file.exists()) return new Response(request.method === "HEAD" ? null : file);
    }

    // Nuxt SPA routes are resolved by the client application.
    const index = Bun.file(join(root, "index.html"));
    return new Response(request.method === "HEAD" ? null : index);
  },
});

console.log(`Mini App server started on port ${port}`);
