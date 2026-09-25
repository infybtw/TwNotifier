import { Elysia, t } from "elysia";
import { INIT_DATA_MAX_BYTES } from "../../config";
import { verifyInitData, InitDataError } from "../auth/initData";
import { issueSession, parseBearerToken, resolveSession, revokeSession } from "../auth/sessions";
import { registerUser } from "../../services/users";
import { getUserSettings } from "../../services/settings";
import { apiErrorBody, mapInitDataError, mapServiceError } from "../errors";
import { PLATFORM_CAPABILITIES } from "../dto";
import { isRateLimited } from "../limits";
import logger from "../../logger";

const log = logger.getSubLogger({ name: "http:auth" });

export const authRoutes = new Elysia({ prefix: "/auth" })
  .post("/telegram", async ({ body, request, status, set }) => {
    const requestId = crypto.randomUUID();
    const initData = body.initData.trim();

    if (initData.length === 0 || Buffer.byteLength(initData, "utf8") > INIT_DATA_MAX_BYTES) {
      return status(400, apiErrorBody("INVALID_INPUT", "Invalid initData", requestId));
    }
    if (isRateLimited(request)) {
      return status(429, apiErrorBody("RATE_LIMITED", "Too many requests", requestId));
    }

    try {
      const verified = verifyInitData(initData);
      const { profile } = await registerUser(
        verified.user.id,
        verified.user.username ?? null,
        verified.user.first_name ?? null,
      );
      const settings = await getUserSettings(verified.user.id);
      const session = await issueSession(verified.user.id);

      set.headers["cache-control"] = "no-store";
      log.info("session issued", { user_id: verified.user.id, has_write_access: verified.allowsWriteToPm });

      return {
        token: session.token,
        expiresAt: session.expiresAt,
        profile: { ...profile, capabilities: PLATFORM_CAPABILITIES },
        settings,
        capabilities: PLATFORM_CAPABILITIES,
      };
    } catch (error) {
      const initError = mapInitDataError(error);
      if (initError) {
        log.warn("initData rejected", { reason: (error as InitDataError).reason, requestId });
        return status(initError.status as 401, apiErrorBody(initError.code, initError.message, requestId));
      }
      const serviceError = mapServiceError(error);
      if (serviceError) {
        return status(serviceError.status as 400, apiErrorBody(serviceError.code, serviceError.message, requestId));
      }
      log.error("authentication failed", { error, requestId });
      return status(500, apiErrorBody("INTERNAL", "Internal error", requestId));
    }
  }, {
    body: t.Object({ initData: t.String() }),
  })
  .delete("/session", async ({ request, status, set }) => {
    const requestId = crypto.randomUUID();
    const token = parseBearerToken(request.headers.get("authorization"));
    if (!token) {
      return status(401, apiErrorBody("UNAUTHORIZED", "Authentication required", requestId));
    }
    const session = await resolveSession(token);
    if (!session) {
      return status(401, apiErrorBody("SESSION_EXPIRED", "Session expired", requestId));
    }
    await revokeSession(token);
    set.headers["cache-control"] = "no-store";
    return { revoked: true };
  });
