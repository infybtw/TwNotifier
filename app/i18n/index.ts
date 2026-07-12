import ru from "./ru.json";
import en from "./en.json";

const translations: Record<string, Record<string, string>> = { ru, en };
export type Locale = "ru" | "en";

export function t(key: string, locale: Locale = "ru"): string {
  return translations[locale]?.[key] ?? translations["ru"][key] ?? key;
}
