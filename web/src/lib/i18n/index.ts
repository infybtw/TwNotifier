import en from "./en";
import ru from "./ru";

export type Locale = "ru" | "en";

const dictionaries: Record<Locale, Record<string, string>> = { ru, en };

let current: Locale = "ru";

function interpolate(template: string, params?: Record<string, string | number>): string {
  if (!params) return template;
  return Object.entries(params).reduce(
    (text, [key, value]) => text.replaceAll(`{${key}}`, String(value)),
    template,
  );
}

export function getLocale(): Locale {
  return current;
}

export function setLocale(next: Locale): void {
  current = next;
}

export function t(key: string, params?: Record<string, string | number>): string {
  const template = dictionaries[current][key] ?? dictionaries.ru[key] ?? key;
  return interpolate(template, params);
}

/** Telegram language_code with an RU fallback for unknown languages. */
export function localeFromTelegram(languageCode: string | null): Locale {
  const code = (languageCode ?? "").toLowerCase();
  if (code.startsWith("ru")) return "ru";
  if (code.startsWith("en")) return "en";
  return "ru";
}

/**
 * Fills translated copy for server-rendered shells. Dynamic collections are
 * re-rendered by their page controllers on the `twn:locale` event instead.
 */
export function applyTranslations(root: ParentNode = document): void {
  document.documentElement.lang = current;

  root.querySelectorAll<HTMLElement>("[data-i18n]").forEach((element) => {
    const key = element.dataset.i18n;
    if (key) element.textContent = t(key);
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-placeholder]").forEach((element) => {
    const key = element.dataset.i18nPlaceholder;
    if (key) element.setAttribute("placeholder", t(key));
  });

  root.querySelectorAll<HTMLElement>("[data-i18n-aria-label]").forEach((element) => {
    const key = element.dataset.i18nAriaLabel;
    if (key) element.setAttribute("aria-label", t(key));
  });
}

export const LOCALE_EVENT = "twn:locale";
