const ALLOWED_METHODS = "GET, POST, PATCH, DELETE, OPTIONS";
const ALLOWED_HEADERS = "authorization, content-type";

/** Returns CORS response headers only for explicitly configured origins. */
export function corsHeaders(origin: string | null, allowedOrigins: readonly string[]): Record<string, string> {
  if (!origin || !allowedOrigins.includes(origin)) return {};

  return {
    "access-control-allow-origin": origin,
    "access-control-allow-methods": ALLOWED_METHODS,
    "access-control-allow-headers": ALLOWED_HEADERS,
    "access-control-max-age": "86400",
    vary: "Origin",
  };
}
