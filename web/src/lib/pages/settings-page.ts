import { localizeApiError } from "../api";
import { ensureSession, saveSettings } from "../auth";
import { q, qs } from "../dom";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";
import { session } from "../session";
import type { Settings } from "../types";

const autoSaveDelay = 1500;

function deliveryLabel(): string {
  switch (session.profile?.chatDelivery) {
    case "enabled":
      return t("settings.delivery_enabled");
    case "blocked":
      return t("settings.delivery_blocked");
    default:
      return t("settings.delivery_unknown");
  }
}

onPage(() => {
  const root = q<HTMLElement>("#page-settings");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const inputs = Array.from(root.querySelectorAll<HTMLInputElement>("[data-setting]"));
  const languageButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-language]"));
  const delivery = qs<HTMLElement>("[data-delivery-label]", root);
  const deliveryHint = qs<HTMLElement>("[data-delivery-hint]", root);
  const botLink = q<HTMLAnchorElement>("[data-bot-link]", root);
  const errorLine = qs<HTMLElement>("[data-save-error]", root);
  const savedLine = qs<HTMLElement>("[data-saved]", root);

  let saving = false;
  let error: string | null = null;
  let saved = false;
  let savedTimer: ReturnType<typeof setTimeout> | undefined;

  function setDisabled(disabled: boolean): void {
    inputs.forEach((input) => {
      input.disabled = disabled;
    });
    languageButtons.forEach((button) => {
      button.disabled = disabled;
    });
  }

  function render(): void {
    const settings = session.settings;

    inputs.forEach((input) => {
      const key = input.dataset.setting as keyof Settings | undefined;
      if (!key) return;
      input.checked = Boolean(settings?.[key]);
      input.disabled = !settings || saving;
    });

    languageButtons.forEach((button) => {
      const active = button.dataset.language === settings?.language;
      button.classList.toggle("tg-button", active);
      button.classList.toggle("tg-secondary", !active);
      button.classList.toggle("tg-text", !active);
      button.setAttribute("aria-pressed", String(active));
      button.disabled = !settings || saving;
    });

    delivery.textContent = deliveryLabel();
    const blocked = session.profile?.chatDelivery === "blocked";
    deliveryHint.hidden = !blocked;
    if (botLink) {
      botLink.hidden = !botLink.getAttribute("href") || session.profile?.chatDelivery === "enabled";
    }

    errorLine.hidden = !error;
    errorLine.textContent = error ?? "";
    savedLine.hidden = !saved;
  }

  async function save(patch: Partial<Settings>): Promise<boolean> {
    if (saving) return false;
    saving = true;
    error = null;
    saved = false;
    setDisabled(true);
    render();

    try {
      await saveSettings(patch);
      saved = true;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        saved = false;
        render();
      }, autoSaveDelay);
      return true;
    } catch (err) {
      error = localizeApiError(err);
      return false;
    } finally {
      saving = false;
      setDisabled(false);
      render();
    }
  }

  inputs.forEach((input) => {
    input.addEventListener("change", async () => {
      const key = input.dataset.setting as keyof Settings | undefined;
      if (!key) return;
      const value = input.checked;
      const ok = await save({ [key]: value } as Partial<Settings>);
      if (!ok) input.checked = !value;
    }, { signal });
  });

  languageButtons.forEach((button) => {
    button.addEventListener("click", async () => {
      const next = button.dataset.language;
      if (next !== "ru" && next !== "en") return;
      if (next === session.settings?.language) return;
      await save({ language: next });
    }, { signal });
  });

  window.addEventListener(LOCALE_EVENT, render, { signal });
  signal.addEventListener("abort", () => {
    if (savedTimer) clearTimeout(savedTimer);
  }, { once: true });

  void ensureSession().then((authenticated) => {
    if (authenticated) render();
  });
});
