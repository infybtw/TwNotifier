import { getSettingsStateByUserId } from "../database/db";
import { Locale } from "../i18n";

export async function getUserLocale(user_id: number): Promise<Locale> {
  const settings = await getSettingsStateByUserId(user_id);
  return (settings?.language as Locale) || "ru";
}
