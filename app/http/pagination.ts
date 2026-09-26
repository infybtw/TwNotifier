export const DEFAULT_PAGE_LIMIT = 20;
export const MAX_PAGE_LIMIT = 50;

/** Cursor is an opaque base64url-encoded offset. */
export function encodeCursor(offset: number): string {
  return Buffer.from(String(offset), "utf8").toString("base64url");
}

export function decodeCursor(cursor: string | undefined | null): number {
  if (!cursor) return 0;
  const decoded = Buffer.from(cursor, "base64url").toString("utf8");
  const offset = Number(decoded);
  return Number.isSafeInteger(offset) && offset >= 0 ? offset : 0;
}

export function parseLimit(value: unknown): number {
  const parsed = typeof value === "string" ? Number(value) : typeof value === "number" ? value : NaN;
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return DEFAULT_PAGE_LIMIT;
  return Math.min(parsed, MAX_PAGE_LIMIT);
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return request.headers.get("x-real-ip") ?? "unknown";
}
