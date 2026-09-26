import ru from "../i18n/ru";
import en from "../i18n/en";

export type Locale = "ru" | "en";

const dictionaries: Record<Locale, Record<string, string>> = { ru, en };

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function useLocale() {
  const locale = useState<Locale>("locale", () => "ru");

  function t(key: string, params?: Record<string, string | number>): string {
    const template = dictionaries[locale.value][key] ?? dictionaries.ru[key] ?? key;
    return interpolate(template, params);
  }

  function setLocale(next: Locale): void {
    locale.value = next;
  }

  /** Telegram language_code with an RU fallback for unknown languages. */
  function localeFromTelegram(languageCode: string | null): Locale {
    const code = (languageCode ?? "").toLowerCase();
    if (code.startsWith("ru")) return "ru";
    if (code.startsWith("en")) return "en";
    return "ru";
  }

  return { locale, t, setLocale, localeFromTelegram };
}
