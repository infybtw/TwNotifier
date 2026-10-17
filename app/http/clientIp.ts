/**
 * Resolves the client IP from proxy headers set along the
 * Cloudflare -> Caddy -> edge_proxy chain. Must stay in sync with what
 * the rate limiter buckets on (see `clientKey` in pagination.ts).
 */
export function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
