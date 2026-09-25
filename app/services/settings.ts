import {
  ensureUserSettings,
  getSettingsStateByUserId,
  updateUserSettingsByUserId,
  type UserSettingsPatch,
} from "../database/db";
import { ServiceError } from "./errors";
import { settingsToDto, type Locale, type SettingsDto } from "./types";

type BooleanSettingKey = Exclude<keyof SettingsDto, "language">;

const FIELD_MAP: Record<BooleanSettingKey, keyof UserSettingsPatch> = {
  onlineNotification: "online_notification",
  offlineNotification: "offline_notification",
  titleChangeNotification: "title_change_notification",
  categoryChangeNotification: "category_change_notification",
  streamMetadata: "stream_metadata",
  linkPreview: "link_preview",
};

const ALLOWED_KEYS = new Set<string>([...Object.keys(FIELD_MAP), "language"]);

export async function getUserSettings(userId: number): Promise<SettingsDto> {
  const settings = await ensureUserSettings(userId);
  if (!settings) {
    throw new ServiceError("NOT_FOUND", "User not found");
  }
  return settingsToDto(settings);
}

/**
 * Applies only explicitly supplied fields (PATCH semantics: set state, never
 * toggle), so retries are safe. Returns the resulting settings.
 */
export async function updateUserSettings(userId: number, input: Record<string, unknown>): Promise<SettingsDto> {
  const patch: UserSettingsPatch = {};

  for (const key of Object.keys(input)) {
    if (!ALLOWED_KEYS.has(key)) {
      throw new ServiceError("INVALID_INPUT", `Unknown setting: ${key}`);
    }
  }

  for (const [key, dbField] of Object.entries(FIELD_MAP) as [BooleanSettingKey, keyof UserSettingsPatch][]) {
    if (input[key] === undefined) continue;
    if (typeof input[key] !== "boolean") {
      throw new ServiceError("INVALID_INPUT", `${key} must be a boolean`);
    }
    (patch as Record<string, unknown>)[dbField] = input[key] ? 1 : 0;
  }

  if (input.language !== undefined) {
    if (input.language !== "ru" && input.language !== "en") {
      throw new ServiceError("INVALID_INPUT", "language must be 'ru' or 'en'");
    }
    patch.language = input.language;
  }

  await ensureUserSettings(userId);
  const updated = await updateUserSettingsByUserId(userId, patch);
  if (!updated) {
    throw new ServiceError("NOT_FOUND", "User not found");
  }
  return settingsToDto(updated);
}

export async function getLanguage(userId: number): Promise<Locale> {
  const settings = await getSettingsStateByUserId(userId);
  return (settings?.language as Locale) ?? "ru";
}

export async function setLanguage(userId: number, language: Locale): Promise<SettingsDto> {
  return updateUserSettings(userId, { language });
}
