import { botUrl } from "./api";
import { refreshProfile, retrySignIn, saveSettings } from "./auth";
import { clear, h, q, setHidden } from "./dom";
import { applyTranslations, LOCALE_EVENT, t } from "./i18n";
import { session } from "./session";
import { telegramState, requestWriteAccess } from "./telegram";
import { loadingState } from "./ui";

let switchingLanguage = false;
let enablingDelivery = false;
let shellInitialized = false;

function navKeyForPath(path: string): string {
  if (path === "/" || path.startsWith("/follow")) return "follows";
  if (path.startsWith("/admin")) return "admin";
  if (path.startsWith("/online")) return "online";
  if (path.startsWith("/add")) return "add";
  if (path.startsWith("/settings")) return "settings";
  if (path.startsWith("/about")) return "about";
  return "";
}

function renderNav(): void {
  const active = navKeyForPath(window.location.pathname);
  document.querySelectorAll<HTMLElement>("[data-nav]").forEach((link) => {
    const isActive = link.dataset.nav === active;
    link.classList.toggle("tg-link", isActive);
    link.classList.toggle("tg-hint", !isActive);
    if (isActive) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
}

function renderHeader(): void {
  const username = q<HTMLElement>("[data-header-username]");
  if (username) {
    username.hidden = !session.profile?.username;
    username.textContent = session.profile?.username ? `@${session.profile.username}` : "";
  }

  const language = q<HTMLButtonElement>("[data-language-toggle]");
  if (language) {
    language.textContent = session.settings?.language === "ru" ? "RU" : "EN";
    language.disabled = !session.settings || switchingLanguage;
  }

  const adminItem = q<HTMLElement>("[data-admin-nav]");
  setHidden(adminItem, !session.profile?.isAdmin);
}

function renderDeliveryBanner(): void {
  const container = q<HTMLElement>("#delivery-banner");
  if (!container) return;
  clear(container);

  const profile = session.profile;
  if (!profile || profile.chatDelivery === "enabled") {
    container.hidden = true;
    return;
  }

  const blocked = profile.chatDelivery === "blocked";
  const actions = h("div", { class: "mt-3 flex flex-wrap gap-2" });

  if (!blocked && telegramState().available) {
    const enable = h("button", {
      class: "rounded-lg px-3 py-2 text-xs font-semibold tg-button",
      text: t("onboarding.enable_notifications"),
      attrs: { type: "button", disabled: enablingDelivery },
    });
    enable.addEventListener("click", () => {
      void enableDelivery();
    });
    actions.append(enable);
  }

  if (botUrl) {
    actions.append(h("a", {
      class: "rounded-lg px-3 py-2 text-xs font-semibold tg-secondary tg-text",
      text: t("onboarding.open_chat"),
      attrs: { href: botUrl, target: "_blank", rel: "noopener" },
    }));
  }

  container.append(h("div", {
    class: "mb-4 rounded-2xl p-4 tg-card",
    children: [
      h("p", {
        class: "text-sm font-medium tg-text",
        text: blocked
          ? t("onboarding.notifications_blocked")
          : t("onboarding.notifications_unknown"),
      }),
      actions,
    ],
  }));
  container.hidden = false;
}

async function enableDelivery(): Promise<void> {
  if (enablingDelivery) return;
  enablingDelivery = true;
  renderDeliveryBanner();
  try {
    if (telegramState().available) {
      // A client-side signal; the backend trusts the server-side update it
      // receives from Telegram, not this callback.
      await requestWriteAccess();
    }
    await refreshProfile().catch(() => undefined);
  } finally {
    enablingDelivery = false;
    renderDeliveryBanner();
  }
}

function retryButton(): HTMLElement {
  const button = h("button", {
    class: "rounded-xl px-5 py-3 text-sm font-semibold tg-button",
    text: t("onboarding.retry"),
    attrs: { type: "button" },
  });
  button.addEventListener("click", () => {
    void retrySignIn();
  });
  return button;
}

function renderOnboarding(): void {
  const container = q<HTMLElement>("#onboarding");
  if (!container) return;
  clear(container);
  if (session.profile) return;

  const wrapper = h("div", {
    class: "mx-auto flex max-w-md flex-col items-center gap-4 px-4 py-16 text-center",
  });

  const tg = telegramState();
  const authError = session.authError;

  if (session.signingIn) {
    wrapper.append(loadingState(t("onboarding.signing_in")));
  } else if (!tg.available) {
    wrapper.append(
      h("span", { class: "text-4xl", text: "✈️", attrs: { "aria-hidden": "true" } }),
      h("h1", { class: "text-xl font-semibold tg-text", text: t("onboarding.open_title") }),
      h("p", { class: "tg-hint", text: t("onboarding.open_body") }),
    );
    if (botUrl) {
      wrapper.append(h("a", {
        class: "rounded-xl px-5 py-3 text-sm font-semibold tg-button",
        text: t("onboarding.open_button"),
        attrs: { href: botUrl, target: "_blank", rel: "noopener" },
      }));
    }
  } else if (authError === "no_init_data" || authError === "expired") {
    wrapper.append(
      h("span", { class: "text-4xl", text: "🔄", attrs: { "aria-hidden": "true" } }),
      h("p", { class: "tg-hint", text: t("onboarding.expired") }),
      retryButton(),
    );
  } else if (authError === "failed" || authError === "network") {
    wrapper.append(
      h("span", { class: "text-4xl", text: "⚠️", attrs: { "aria-hidden": "true" } }),
      h("p", {
        class: "tg-hint",
        text: authError === "network" ? t("onboarding.network") : t("onboarding.failed"),
      }),
      retryButton(),
    );
  } else {
    wrapper.append(loadingState(t("onboarding.signing_in")));
  }

  container.append(wrapper);
}

export function renderShell(): void {
  const shell = q<HTMLElement>("#app-shell");
  const onboarding = q<HTMLElement>("#onboarding");
  const authenticated = Boolean(session.profile);

  setHidden(shell, !authenticated);
  setHidden(onboarding, authenticated);

  applyTranslations(document);
  renderHeader();
  renderNav();
  renderDeliveryBanner();
  renderOnboarding();
}

async function toggleLanguage(): Promise<void> {
  if (switchingLanguage || !session.settings) return;
  const next = session.settings.language === "ru" ? "en" : "ru";
  switchingLanguage = true;
  renderShell();
  try {
    await saveSettings({ language: next });
    applyTranslations(document);
    document.dispatchEvent(new CustomEvent(LOCALE_EVENT));
  } catch {
    // The settings screen surfaces save errors; a failed quick switch is silent.
  } finally {
    switchingLanguage = false;
    renderShell();
  }
}

/** Binds shell listeners exactly once per document. */
export function initShell(): void {
  if (shellInitialized) return;
  shellInitialized = true;

  document.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;
    if (target.closest("[data-language-toggle]")) {
      event.preventDefault();
      void toggleLanguage();
    }
  });
}
