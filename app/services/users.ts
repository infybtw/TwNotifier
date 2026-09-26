import {
  checkOrCreateUser,
  ensureUserSettings,
  getSettingsStateByUserId,
  getUserByUserId,
  setBotBlockedStateByUserId,
  setChatDeliveryByUserId,
} from "../database/db";
import { ServiceError } from "./errors";
import { toChatDelivery, type ChatDelivery, type Locale } from "./types";

export interface UserProfile {
  id: string;
  username: string | null;
  firstName: string | null;
  language: Locale;
  isAdmin: boolean;
  chatDelivery: ChatDelivery;
  isBotBlocked: boolean;
}

export async function getProfile(userId: number): Promise<UserProfile> {
  const user = await getUserByUserId(userId);
  if (!user) {
    throw new ServiceError("NOT_FOUND", "User not found");
  }
  const settings = await ensureUserSettings(userId);
  const language = (settings?.language as Locale) ?? "ru";
  return {
    id: String(user.user_id),
    username: user.username,
    firstName: user.first_name,
    language,
    isAdmin: Boolean(user.is_admin),
    chatDelivery: settings ? toChatDelivery(settings) : "unknown",
    isBotBlocked: settings?.is_bot_blocked === 1,
  };
}

/**
 * Creates the user and settings rows if needed and refreshes the name from
 * verified data. Existing preferences are preserved.
 */
export async function registerUser(
  userId: number,
  username: string | null,
  firstName: string | null,
): Promise<{ profile: UserProfile; isNew: boolean }> {
  if (!Number.isSafeInteger(userId) || userId <= 0) {
    throw new ServiceError("INVALID_INPUT", "Invalid user id");
  }
  const result = await checkOrCreateUser(userId, username ?? "", firstName ?? "");
  if (!result) {
    throw new ServiceError("INTERNAL", "Failed to register user");
  }
  await ensureUserSettings(userId);
  return { profile: await getProfile(userId), isNew: result.isNew };
}

/**
 * Called from server-side Telegram signals (/start, write_access_allowed).
 * Never call this from a client-triggered HTTP request: opening the Mini App or
 * a successful `requestWriteAccess()` callback is not proof of permission.
 */
export async function markChatDeliveryEnabled(userId: number): Promise<void> {
  await ensureUserSettings(userId);
  await setChatDeliveryByUserId(userId, 1);
  await setBotBlockedStateByUserId(userId, 0);
}

export async function markChatDeliveryBlocked(userId: number): Promise<void> {
  await ensureUserSettings(userId);
  await setChatDeliveryByUserId(userId, 0);
  await setBotBlockedStateByUserId(userId, 1);
}

export async function getChatDelivery(userId: number): Promise<ChatDelivery> {
  const settings = await getSettingsStateByUserId(userId);
  return settings ? toChatDelivery(settings) : "unknown";
}
