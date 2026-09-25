import { createHash, randomBytes } from "node:crypto";
import {
  createWebSession,
  deleteExpiredWebSessions,
  deleteWebSessionByTokenHash,
  getWebSessionByTokenHash,
} from "../../database/db";
import { SESSION_TTL_SECONDS } from "../../config";

export interface IssuedSession {
  token: string;
  expiresAt: string;
}

export interface AuthenticatedSession {
  userId: number;
  expiresAt: string;
}

export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/** Issues an opaque bearer token; only its hash is persisted. */
export async function issueSession(userId: number, ttlSeconds: number = SESSION_TTL_SECONDS): Promise<IssuedSession> {
  const token = randomBytes(32).toString("base64url");
  const now = Date.now();
  const createdAt = new Date(now).toISOString();
  const expiresAt = new Date(now + ttlSeconds * 1000).toISOString();
  await createWebSession(hashToken(token), userId, createdAt, expiresAt);
  // Opportunistic cleanup of expired records.
  await deleteExpiredWebSessions(createdAt).catch(() => undefined);
  return { token, expiresAt };
}

export function parseBearerToken(header: string | null): string | null {
  if (!header) return null;
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

export async function resolveSession(token: string, nowMs: number = Date.now()): Promise<AuthenticatedSession | null> {
  const row = await getWebSessionByTokenHash(hashToken(token));
  if (!row) return null;
  if (new Date(row.expires_at).getTime() <= nowMs) {
    await deleteWebSessionByTokenHash(row.token_hash).catch(() => undefined);
    return null;
  }
  return { userId: row.user_id, expiresAt: row.expires_at };
}

export async function authenticateRequest(request: Request): Promise<AuthenticatedSession | null> {
  const token = parseBearerToken(request.headers.get("authorization"));
  if (!token) return null;
  return resolveSession(token);
}

export async function revokeSession(token: string): Promise<void> {
  await deleteWebSessionByTokenHash(hashToken(token));
}
