import { Elysia } from "elysia";
import { authenticateRequest, type AuthenticatedSession } from "./sessions";
import { apiErrorBody } from "../errors";

export interface AuthContext {
  auth: AuthenticatedSession | null;
  requestId: string;
}

/**
 * Scoped guard: resolves the bearer session once per request and rejects
 * protected routes with 401 when it is missing or expired. Handlers receive
 * `auth` (non-null after the guard) and `requestId`.
 */
export const authPlugin = new Elysia({ name: "auth-plugin" })
  .derive({ as: "scoped" }, async ({ request }) => {
    const auth = await authenticateRequest(request);
    return { auth, requestId: crypto.randomUUID() };
  })
  .onBeforeHandle({ as: "scoped" }, ({ auth, requestId, status }) => {
    if (!auth) {
      return status(401, apiErrorBody("UNAUTHORIZED", "Authentication required", requestId));
    }
  });

export function requireAuth(auth: AuthenticatedSession | null): AuthenticatedSession {
  if (!auth) {
    throw new Error("requireAuth called without an authenticated session");
  }
  return auth;
}
