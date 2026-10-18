import { afterEach, beforeEach, expect, mock, test } from "bun:test";
import { generateKeyPairSync, sign } from "node:crypto";

const startedAt = "2026-10-18T10:00:00.000Z";
const titleChanged = mock(async (..._args: unknown[]) => {});
const categoryChanged = mock(async (..._args: unknown[]) => {});
const online = mock(async (..._args: unknown[]) => {});
const offline = mock(async (..._args: unknown[]) => {});
const lookup = mock(async (..._args: unknown[]): Promise<object | undefined> => ({}));
const update = mock(async (..._args: unknown[]) => ({ titleChanged: false, categoryChanged: false, hadActiveSession: true }));
const start = mock(async (..._args: unknown[]) => false);
const finish = mock(async (..._args: unknown[]) => ({ outcome: "no_session" }));
const liveChannel = () => ({
  data: [{ stream: { is_live: true, start_time: startedAt }, category: { name: "Games" } }],
});
const getChannel = mock(async (..._args: unknown[]) => liveChannel());
const followedChannels = mock(async () => [{ channel_id: 123 }]);
const originalFetch = globalThis.fetch;
const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });

mock.module("../bot/bot_sender", () => ({
  sendKickStreamTitleChangedNotificationToUsers: titleChanged,
  sendKickStreamCategoryChangedNotificationToUsers: categoryChanged,
  sendKickStreamOnlineNotificationToUsers: online,
  sendKickStreamfflineNotificationToUsers: offline,
}));
mock.module("../database/db", () => ({
  getChannelByChannelIdAndPlatform: lookup,
  updateKickStream: update,
  startKickStream: start,
  finishKickStream: finish,
  getChannelsWithFollowersByPlatform: followedChannels,
}));
mock.module("../kickAPI/auth", () => ({ getKickAppToken: async () => {} }));
mock.module("../config", () => ({ KICK_APP_TOKEN: "test-token", KICK_API: "https://kick.example", KICK_OAUTH: "https://oauth.example" }));
mock.module("../kickAPI/users", () => ({ getKickChannelByUsername: getChannel }));
mock.module("../kickAPI/publicKey", () => ({
  getKickPublicKey: async () => publicKey.export({ type: "spki", format: "pem" }),
}));
mock.module("../logger", () => ({ default: { getSubLogger: () => ({ info() {}, warn() {}, error() {} }) } }));

const { handleKickWebhook } = await import("./webhook_handler");
const { subscribeToKickChannelOnline, ensureKickMetadataSubscriptions } = await import("../kickAPI/subscription");

function webhook(payload = metadata(), eventType = "livestream.metadata.updated") {
  const rawBody = JSON.stringify(payload);
  const messageId = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const signature = sign("RSA-SHA256", Buffer.from(`${messageId}.${timestamp}.${rawBody}`), privateKey).toString("base64");
  return {
    rawBody,
    headers: new Headers({
      "kick-event-message-id": messageId,
      "kick-event-message-timestamp": timestamp,
      "kick-event-signature": signature,
      "kick-event-type": eventType,
    }),
  };
}

function metadata(): Record<string, unknown> {
  return {
    broadcaster: { user_id: 123, channel_slug: "streamer" },
    metadata: { title: "New title", language: "en", has_mature_content: false, category: { id: 1, name: "Games", thumbnail: "" } },
  };
}

beforeEach(() => {
  for (const fn of [titleChanged, categoryChanged, online, offline, lookup, update, start, finish, getChannel]) fn.mockClear();
  lookup.mockImplementation(async () => ({}));
  update.mockImplementation(async () => ({ titleChanged: false, categoryChanged: false, hadActiveSession: true }));
  getChannel.mockImplementation(async () => liveChannel());
  start.mockImplementation(async () => false);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

test("sends title and category changes for a signed metadata event", async () => {
  update.mockResolvedValue({ titleChanged: true, categoryChanged: true, hadActiveSession: true });
  expect((await handleKickWebhook(webhook())).status).toBe(200);
  expect(update).toHaveBeenCalledWith(123, "New title", "Games", startedAt);
  expect(titleChanged).toHaveBeenCalledWith(123, "streamer", "New title");
  expect(categoryChanged).toHaveBeenCalledWith(123, "streamer", "Games");
  expect(online).not.toHaveBeenCalled();
});

test("does not send for unchanged title/category (including language-only updates)", async () => {
  await handleKickWebhook(webhook());
  expect(titleChanged).not.toHaveBeenCalled();
  expect(categoryChanged).not.toHaveBeenCalled();
});

test("sends only the changed field", async () => {
  update.mockResolvedValue({ titleChanged: true, categoryChanged: false, hadActiveSession: true });
  await handleKickWebhook(webhook());
  expect(titleChanged).toHaveBeenCalledTimes(1);
  expect(categoryChanged).not.toHaveBeenCalled();
});

test("backfills missing session silently", async () => {
  update.mockResolvedValue({ titleChanged: false, categoryChanged: false, hadActiveSession: false });
  await handleKickWebhook(webhook());
  expect(start).toHaveBeenCalledWith(123, "New title", startedAt, "Games");
  expect(titleChanged).not.toHaveBeenCalled();
  expect(categoryChanged).not.toHaveBeenCalled();
  expect(online).not.toHaveBeenCalled();
});

test("does not notify for offline metadata updates", async () => {
  getChannel.mockResolvedValue({ data: [{ stream: { is_live: false, start_time: startedAt }, category: { name: "Games" } }] });
  await handleKickWebhook(webhook());
  expect(update).not.toHaveBeenCalled();
  expect(start).not.toHaveBeenCalled();
  expect(offline).not.toHaveBeenCalled();
  expect(finish).not.toHaveBeenCalled();
});

test("skips unknown channels", async () => {
  lookup.mockResolvedValue(undefined);
  await handleKickWebhook(webhook());
  expect(getChannel).not.toHaveBeenCalled();
  expect(update).not.toHaveBeenCalled();
});

test("deduplicates repeated webhook deliveries", async () => {
  update.mockResolvedValue({ titleChanged: true, categoryChanged: false, hadActiveSession: true });
  const request = webhook();
  await handleKickWebhook(request);
  await handleKickWebhook(request);
  expect(titleChanged).toHaveBeenCalledTimes(1);
  expect(update).toHaveBeenCalledTimes(1);
});

test("allows retry after channel lookup failure", async () => {
  const request = webhook();
  getChannel.mockResolvedValueOnce({ data: [] });
  await expect(handleKickWebhook(request)).rejects.toThrow("Could not fetch Kick channel");
  await handleKickWebhook(request);
  expect(update).toHaveBeenCalledTimes(1);
});

test("rejects invalid signatures before changing state", async () => {
  const request = webhook();
  request.rawBody += " ";
  expect((await handleKickWebhook(request)).status).toBe(401);
  expect(update).not.toHaveBeenCalled();
});

test("stores category baseline on stream start and sends online only for a new session", async () => {
  start.mockResolvedValue(true);
  await handleKickWebhook(webhook({
    broadcaster: { user_id: 123, channel_slug: "streamer" },
    is_live: true, title: "Initial title", started_at: startedAt, ended_at: null,
  }, "livestream.status.updated"));
  expect(start).toHaveBeenCalledWith(123, "Initial title", startedAt, "Games");
  expect(online).toHaveBeenCalledWith(123, "streamer", "Initial title");
});

test("subscribes to metadata even if the status subscription already exists", async () => {
  const requests: string[] = [];
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    const { events } = JSON.parse(init!.body as string);
    requests.push(events[0].name);
    return Response.json({ data: [{ error: null }] }, { status: requests.length === 1 ? 409 : 200 });
  }) as unknown as typeof fetch;
  expect(await subscribeToKickChannelOnline(123)).toBe(202);
  expect(requests).toEqual(["livestream.status.updated", "livestream.metadata.updated"]);
});

test("does not treat per-event subscription errors as success", async () => {
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    return init?.method === "POST"
      ? Response.json({ data: [{ error: "Subscription limit exceeded" }] })
      : Response.json({ data: [] });
  }) as unknown as typeof fetch;
  expect(await subscribeToKickChannelOnline(123)).toBe(-1);
});

test("accepts a per-event duplicate error only if the subscription exists", async () => {
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    return init?.method === "POST"
      ? Response.json({ data: [{ error: "Already subscribed" }] })
      : Response.json({ data: [
        { broadcaster_user_id: 123, event: "livestream.status.updated", version: 1 },
        { broadcaster_user_id: 123, event: "livestream.metadata.updated", version: 1 },
      ] });
  }) as unknown as typeof fetch;
  expect(await subscribeToKickChannelOnline(123)).toBe(202);
});

test("startup adds only missing metadata subscriptions to followed active channels", async () => {
  const requests: object[] = [];
  globalThis.fetch = mock(async (_input: unknown, init?: RequestInit) => {
    if (init?.method === "POST") {
      requests.push(JSON.parse(init.body as string));
      return Response.json({ data: [{ error: null }] });
    }
    return Response.json({ data: [
      { broadcaster_user_id: 123, event: "livestream.status.updated", version: 1 },
      { broadcaster_user_id: 456, event: "livestream.status.updated", version: 1 },
    ] });
  }) as unknown as typeof fetch;
  await ensureKickMetadataSubscriptions();
  expect(requests).toEqual([{
    broadcaster_user_id: 123,
    events: [{ name: "livestream.metadata.updated", version: 1 }],
    method: "webhook",
  }]);
});

test("startup preserves disconnected channels and existing metadata subscriptions", async () => {
  const request = mock(async () => Response.json({ data: [
    { broadcaster_user_id: 123, event: "livestream.metadata.updated", version: 1 },
    { broadcaster_user_id: 123, event: "livestream.status.updated", version: 1 },
  ] }));
  globalThis.fetch = request as unknown as typeof fetch;
  await ensureKickMetadataSubscriptions();
  expect(request).toHaveBeenCalledTimes(1);
  request.mockImplementation(async () => Response.json({ data: [] }));
  await ensureKickMetadataSubscriptions();
  expect(request).toHaveBeenCalledTimes(2);
});
