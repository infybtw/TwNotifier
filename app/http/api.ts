import { Elysia } from "elysia";
import { authRoutes } from "./routes/auth";
import { meRoutes } from "./routes/me";
import { settingsRoutes } from "./routes/settings";
import { channelRoutes } from "./routes/channels";
import { followRoutes } from "./routes/follows";
import { apiErrorBody, mapInitDataError, mapServiceError } from "./errors";
import { API_PATH } from "../config";
import logger from "../logger";

const log = logger.getSubLogger({ name: "http:api" });

const protectedRoutes = new Elysia({ name: "api-protected" })
  .use(meRoutes)
  .use(settingsRoutes)
  .use(channelRoutes)
  .use(followRoutes);

export const apiRoutes = new Elysia({ prefix: API_PATH })
  .onError({ as: "global" }, ({ code, error, set, status }) => {
    const requestId = crypto.randomUUID();
    set.headers["cache-control"] = "no-store";

    const mapped = mapServiceError(error) ?? mapInitDataError(error);
    if (mapped) {
      return status(mapped.status as 400, apiErrorBody(mapped.code, mapped.message, requestId));
    }
    if (code === "VALIDATION" || code === "PARSE") {
      return status(400, apiErrorBody("INVALID_INPUT", "Invalid request", requestId));
    }
    if (code === "NOT_FOUND") {
      return status(404, apiErrorBody("NOT_FOUND", "Not found", requestId));
    }

    log.error("unhandled API error", { code, error });
    return status(500, apiErrorBody("INTERNAL", "Internal error", requestId));
  })
  .use(authRoutes)
  .use(protectedRoutes);
