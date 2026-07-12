import { getSettingsStateByUserId } from "../database/db";
import { Locale } from "../i18n";
import { DEFAULT_LANGUAGE } from "../config";

export async function getUserLocale(user_id: number): Promise<Locale> {
  const settings = await getSettingsStateByUserId(user_id);
  return (settings?.language as Locale) || (DEFAULT_LANGUAGE as Locale);
}
