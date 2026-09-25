import { Elysia } from "elysia";
import { getProfile } from "../../services/users";
import { PLATFORM_CAPABILITIES, type UserProfileDto } from "../dto";
import { authPlugin, requireAuth } from "../auth/middleware";

export const meRoutes = new Elysia()
  .use(authPlugin)
  .get("/me", async ({ auth, set }): Promise<UserProfileDto> => {
    set.headers["cache-control"] = "no-store";
    const profile = await getProfile(requireAuth(auth).userId);
    return { ...profile, capabilities: PLATFORM_CAPABILITIES };
  });
