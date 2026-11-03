/**
 * Cloudflare -> cloudflared -> API. Only trust these headers while the API
 * has no public host port. CF-Connecting-IP is set by Cloudflare, unlike the
 * leftmost X-Forwarded-For value which can be supplied by the visitor.
 * Shared by request logging and rate limiting (see pagination.ts).
 */
export function clientIp(request: Request): string {
  const cloudflareIp = request.headers.get("cf-connecting-ip")?.trim();
  if (cloudflareIp) return cloudflareIp;
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0].trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}
