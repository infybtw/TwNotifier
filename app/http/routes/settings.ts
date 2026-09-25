import { Elysia, t } from "elysia";
import { getUserSettings, updateUserSettings } from "../../services/settings";
import { authPlugin, requireAuth } from "../auth/middleware";
import type { SettingsDto } from "../dto";

export const settingsRoutes = new Elysia()
  .use(authPlugin)
  .get("/settings", async ({ auth, set }): Promise<SettingsDto> => {
    set.headers["cache-control"] = "no-store";
    return getUserSettings(requireAuth(auth).userId);
  })
  .patch("/settings", async ({ auth, body, set }): Promise<SettingsDto> => {
    set.headers["cache-control"] = "no-store";
    return updateUserSettings(
      requireAuth(auth).userId,
      body as Record<string, unknown>,
    );
  }, {
    body: t.Object({}, { additionalProperties: true }),
  });
