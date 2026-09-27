import { Elysia, t } from "elysia";
import { InputFile } from "grammy";
import {
  getAdminChannelsPage,
  getAdminFollowsPage,
  getAdminSettings,
  getAdminStats,
  getAdminUserDetail,
  getAdminUsersPage,
  getAllAdminKeys,
  getFollowsWithChannelPage,
  getRecentStreamLogs,
  getUserByUserId,
  getUserNotificationsPage,
  revokeAdminKey,
  setAdminTimezoneOffset,
  setBotBlockedStateByUserId,
  setUserAdmin,
} from "../../database/db";
import { toChatDelivery } from "../../services/types";
import type { Platform } from "../../database/schema";
import {
  cleanupEventSub,
  cleanupKickWebhook,
  createAdminKey,
  disconnectEventSub,
  disconnectKickWebhook,
  getEventSubStatus,
  getKickWebhookStatus,
  reloadEventSub,
  reloadKickWebhook,
} from "../../services/admin";
import { ServiceError } from "../../services/errors";
import { sendBroadcastMessage } from "../../bot/bot_sender";
import { authPlugin, requireAdmin } from "../auth/middleware";
import { decodeCursor, encodeCursor, parseLimit } from "../pagination";
import { isRateLimited } from "../limits";
import logger from "../../logger";

const log = logger.getSubLogger({ name: "http:admin" });

const MAX_PHOTO_BYTES = 10 * 1024 * 1024;
const BROADCAST_TEXT_MAX = 4096;
const LOGS_LIMIT = 50;

function rateLimit(request: Request): void {
  if (isRateLimited(request)) {
    throw new ServiceError("RATE_LIMITED", "Too many requests");
  }
}

function parseUserId(id: string): number {
  const parsed = Number(id);
  if (!Number.isSafeInteger(parsed) || parsed <= 0) {
    throw new ServiceError("INVALID_INPUT", "Invalid user id");
  }
  return parsed;
}

export const adminRoutes = new Elysia({ prefix: "/admin" })
  .use(authPlugin)
  .get("/overview", async ({ auth, set }) => {
    await requireAdmin(auth);
    set.headers["cache-control"] = "no-store";
    return getAdminStats();
  })
  .get("/users", async ({ auth, query, set }) => {
    await requireAdmin(auth);
    const limit = parseLimit(query.limit);
    const offset = decodeCursor(query.cursor);
    const rows = await getAdminUsersPage({ search: query.search ?? undefined, limit, offset });
    set.headers["cache-control"] = "no-store";
    return {
      items: rows.map((row) => ({
        id: String(row.user_id),
        username: row.username || null,
        firstName: row.first_name || null,
        created: row.created,
        isAdmin: Boolean(row.is_admin),
        isBotBlocked: Number(row.is_bot_blocked) === 1,
        follows: Number(row.follows),
      })),
      nextCursor: rows.length === limit ? encodeCursor(offset + limit) : null,
    };
  }, {
    query: t.Object({
      search: t.Optional(t.String({ maxLength: 64 })),
      cursor: t.Optional(t.String({ maxLength: 64 })),
      limit: t.Optional(t.String({ maxLength: 8 })),
    }),
  })
  .get("/users/:id", async ({ auth, params, set }) => {
    await requireAdmin(auth);
    const userId = parseUserId(params.id);
    const row = await getAdminUserDetail(userId);
    if (!row) {
      throw new ServiceError("NOT_FOUND", "User not found");
    }
    set.headers["cache-control"] = "no-store";
    return {
      id: String(row.user_id),
      username: row.username || null,
      firstName: row.first_name || null,
      created: row.created,
      isAdmin: Boolean(row.is_admin),
      isBotBlocked: Number(row.is_bot_blocked) === 1,
      chatDelivery: toChatDelivery({
        chat_delivery: row.chat_delivery,
        is_bot_blocked: row.is_bot_blocked,
      }),
      settings: {
        language: row.language === "en" ? "en" : "ru",
        onlineNotification: Number(row.online_notification) === 1,
        offlineNotification: Number(row.offline_notification) === 1,
        titleChangeNotification: Number(row.title_change_notification) === 1,
        categoryChangeNotification: Number(row.category_change_notification) === 1,
        streamMetadata: Number(row.stream_metadata) === 1,
        linkPreview: Number(row.link_preview) === 1,
      },
      follows: Number(row.follows),
      notifications: Number(row.notifications),
    };
  }, {
    params: t.Object({ id: t.String() }),
  })
  .get("/users/:id/follows", async ({ auth, params, query, set }) => {
    await requireAdmin(auth);
    const userId = parseUserId(params.id);
    const limit = parseLimit(query.limit);
    const offset = decodeCursor(query.cursor);
    const rows = await getFollowsWithChannelPage(userId, { limit, offset });
    set.headers["cache-control"] = "no-store";
    return {
      items: rows.map((row) => ({
        platform: row.platform,
        channelId: String(row.channel_id),
        channelName: row.channel_name,
        channelLogin: row.channel_login,
        created: row.created,
      })),
      nextCursor: rows.length === limit ? encodeCursor(offset + limit) : null,
    };
  }, {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      cursor: t.Optional(t.String({ maxLength: 64 })),
      limit: t.Optional(t.String({ maxLength: 8 })),
    }),
  })
  .get("/users/:id/notifications", async ({ auth, params, query, set }) => {
    await requireAdmin(auth);
    const userId = parseUserId(params.id);
    const limit = parseLimit(query.limit);
    const offset = decodeCursor(query.cursor);
    const rows = await getUserNotificationsPage(userId, { limit, offset });
    set.headers["cache-control"] = "no-store";
    return {
      items: rows.map((row) => ({
        id: row.id,
        platform: row.platform,
        channelId: row.channel_id != null ? String(row.channel_id) : null,
        channelName: row.channel_name ?? row.channel_login ?? null,
        event: row.event,
        status: row.status,
        created: row.created,
      })),
      nextCursor: rows.length === limit ? encodeCursor(offset + limit) : null,
    };
  }, {
    params: t.Object({ id: t.String() }),
    query: t.Object({
      cursor: t.Optional(t.String({ maxLength: 64 })),
      limit: t.Optional(t.String({ maxLength: 8 })),
    }),
  })
  .patch("/users/:id", async ({ auth, params, body, request, set }) => {
    rateLimit(request);
    const session = await requireAdmin(auth);
    const userId = parseUserId(params.id);
    if (body.isAdmin === undefined && body.isBotBlocked === undefined) {
      throw new ServiceError("INVALID_INPUT", "Nothing to update");
    }

    const user = await getUserByUserId(userId);
    if (!user) {
      throw new ServiceError("NOT_FOUND", "User not found");
    }

    if (body.isAdmin !== undefined) {
      if (userId === session.userId && !body.isAdmin) {
        throw new ServiceError("INVALID_INPUT", "You cannot revoke your own admin rights");
      }
      await setUserAdmin(userId, body.isAdmin);
    }
    if (body.isBotBlocked !== undefined) {
      await setBotBlockedStateByUserId(userId, body.isBotBlocked ? 1 : 0);
    }

    const detail = await getAdminUserDetail(userId);
    set.headers["cache-control"] = "no-store";
    return {
      id: String(userId),
      isAdmin: Boolean(detail?.is_admin),
      isBotBlocked: Number(detail?.is_bot_blocked) === 1,
    };
  }, {
    params: t.Object({ id: t.String() }),
    body: t.Object({
      isAdmin: t.Optional(t.Boolean()),
      isBotBlocked: t.Optional(t.Boolean()),
    }),
  })
  .get("/channels", async ({ auth, query, set }) => {
    await requireAdmin(auth);
    const limit = parseLimit(query.limit);
    const offset = decodeCursor(query.cursor);
    const platform = (query.platform === "twitch" || query.platform === "kick")
      ? query.platform as Platform
      : undefined;
    const rows = await getAdminChannelsPage({ platform, limit, offset });
    set.headers["cache-control"] = "no-store";
    return {
      items: rows.map((row) => ({
        platform: row.platform,
        channelId: String(row.channel_id),
        name: row.channel_name,
        login: row.channel_login,
        followers: Number(row.followers),
      })),
      nextCursor: rows.length === limit ? encodeCursor(offset + limit) : null,
    };
  }, {
    query: t.Object({
      platform: t.Optional(t.String()),
      cursor: t.Optional(t.String({ maxLength: 64 })),
      limit: t.Optional(t.String({ maxLength: 8 })),
    }),
  })
  .get("/follows", async ({ auth, query, set }) => {
    await requireAdmin(auth);
    const limit = parseLimit(query.limit);
    const offset = decodeCursor(query.cursor);
    const rows = await getAdminFollowsPage({ limit, offset });
    set.headers["cache-control"] = "no-store";
    return {
      items: rows.map((row) => ({
        userId: String(row.user_id),
        username: row.username || null,
        firstName: row.first_name || null,
        platform: row.platform,
        channelId: String(row.channel_id),
        channelName: row.channel_name,
        created: row.created,
      })),
      nextCursor: rows.length === limit ? encodeCursor(offset + limit) : null,
    };
  }, {
    query: t.Object({
      cursor: t.Optional(t.String({ maxLength: 64 })),
      limit: t.Optional(t.String({ maxLength: 8 })),
    }),
  })
  .get("/logs", async ({ auth, set }) => {
    await requireAdmin(auth);
    const rows = await getRecentStreamLogs(LOGS_LIMIT);
    set.headers["cache-control"] = "no-store";
    return {
      items: rows.map((row) => ({
        id: row.id,
        platform: row.platform,
        channelId: String(row.channel_id),
        channelName: row.channel_name ?? null,
        event: row.event,
        followers: Number(row.follower_count ?? 0),
        created: row.created,
      })),
    };
  })
  .get("/keys", async ({ auth, set }) => {
    await requireAdmin(auth);
    const keys = await getAllAdminKeys();
    set.headers["cache-control"] = "no-store";
    return {
      items: keys.map((key) => ({
        id: key.id,
        key: key.key,
        issueDate: key.issue_date,
        issuedBy: String(key.issued_by),
        issuedByName: key.issued_by_name ?? null,
        issuedByUsername: key.issued_by_username ?? null,
        used: Boolean(key.used),
        usedDate: key.used_date ?? null,
        usedBy: key.used_by != null ? String(key.used_by) : null,
      })),
    };
  })
  .post("/keys", async ({ auth, request, set }) => {
    rateLimit(request);
    const session = await requireAdmin(auth);
    const key = await createAdminKey(session.userId);
    set.headers["cache-control"] = "no-store";
    return {
      id: key.id,
      key: key.key,
      issueDate: key.issue_date,
      used: false,
    };
  })
  .delete("/keys/:id", async ({ auth, params, request, set }) => {
    rateLimit(request);
    await requireAdmin(auth);
    const id = Number(params.id);
    if (!Number.isSafeInteger(id) || id <= 0) {
      throw new ServiceError("INVALID_INPUT", "Invalid key id");
    }
    const revoked = await revokeAdminKey(id);
    if (!revoked) {
      throw new ServiceError("NOT_FOUND", "Key not found");
    }
    set.headers["cache-control"] = "no-store";
    return { revoked: true };
  }, {
    params: t.Object({ id: t.String() }),
  })
  .post("/broadcast", async ({ auth, body, request, set }) => {
    rateLimit(request);
    const session = await requireAdmin(auth);

    const text = body.text?.trim() || undefined;
    if (text && text.length > BROADCAST_TEXT_MAX) {
      throw new ServiceError("INVALID_INPUT", "Broadcast text is too long");
    }

    let photo: InputFile | undefined;
    if (body.photo) {
      if (body.photo.size > MAX_PHOTO_BYTES) {
        throw new ServiceError("INVALID_INPUT", "Photo is too large");
      }
      const buffer = new Uint8Array(await body.photo.arrayBuffer());
      photo = new InputFile(buffer, body.photo.name || "photo.jpg");
    }

    if (!text && !photo) {
      throw new ServiceError("INVALID_INPUT", "Broadcast requires text or a photo");
    }

    log.warn("broadcast started via web admin", { admin_id: session.userId, has_photo: Boolean(photo) });
    const result = await sendBroadcastMessage(text, photo);
    set.headers["cache-control"] = "no-store";
    return result;
  }, {
    body: t.Object({
      text: t.Optional(t.String({ maxLength: BROADCAST_TEXT_MAX })),
      photo: t.Optional(t.File({ maxSize: MAX_PHOTO_BYTES })),
    }),
  })
  .get("/eventsub", async ({ auth, set }) => {
    await requireAdmin(auth);
    set.headers["cache-control"] = "no-store";
    return getEventSubStatus();
  })
  .post("/eventsub/reload", async ({ auth, request, set }) => {
    rateLimit(request);
    const session = await requireAdmin(auth);
    const result = await reloadEventSub(session.userId);
    set.headers["cache-control"] = "no-store";
    return result;
  })
  .post("/eventsub/disconnect", async ({ auth, request, set }) => {
    rateLimit(request);
    const session = await requireAdmin(auth);
    const result = await disconnectEventSub(session.userId);
    set.headers["cache-control"] = "no-store";
    return result;
  })
  .post("/eventsub/cleanup", async ({ auth, request, set }) => {
    rateLimit(request);
    const session = await requireAdmin(auth);
    const result = await cleanupEventSub(session.userId);
    set.headers["cache-control"] = "no-store";
    return result;
  })
  .get("/webhook", async ({ auth, set }) => {
    await requireAdmin(auth);
    set.headers["cache-control"] = "no-store";
    return getKickWebhookStatus();
  })
  .post("/webhook/reload", async ({ auth, request, set }) => {
    rateLimit(request);
    const session = await requireAdmin(auth);
    const result = await reloadKickWebhook(session.userId);
    set.headers["cache-control"] = "no-store";
    return result;
  })
  .post("/webhook/disconnect", async ({ auth, request, set }) => {
    rateLimit(request);
    const session = await requireAdmin(auth);
    const result = await disconnectKickWebhook(session.userId);
    set.headers["cache-control"] = "no-store";
    return result;
  })
  .post("/webhook/cleanup", async ({ auth, request, set }) => {
    rateLimit(request);
    const session = await requireAdmin(auth);
    const result = await cleanupKickWebhook(session.userId);
    set.headers["cache-control"] = "no-store";
    return result;
  })
  .get("/settings", async ({ auth, set }) => {
    const session = await requireAdmin(auth);
    const settings = await getAdminSettings(session.userId);
    set.headers["cache-control"] = "no-store";
    return { utcOffset: settings?.utc_offset ?? 0 };
  })
  .patch("/settings", async ({ auth, body, set }) => {
    const session = await requireAdmin(auth);
    await setAdminTimezoneOffset(session.userId, body.utcOffset);
    set.headers["cache-control"] = "no-store";
    return { utcOffset: body.utcOffset };
  }, {
    body: t.Object({
      utcOffset: t.Integer({ minimum: -12, maximum: 14 }),
    }),
  })
  .post("/restart", async ({ auth, request, set }) => {
    rateLimit(request);
    const session = await requireAdmin(auth);
    log.warn("restart requested via web admin", { admin_id: session.userId });
    set.headers["cache-control"] = "no-store";
    // Respond first, then exit so the process supervisor restarts the app.
    setTimeout(() => process.exit(0), 500);
    return { restarting: true };
  });
