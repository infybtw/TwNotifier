import { localizeApiError } from "../api";
import {
  adminOverview,
  adminRestart,
  adminSaveTimezone,
  adminState,
  loadAdminSettings,
  requireAdmin,
  type AdminStats,
} from "../admin";
import { confirmAction } from "../dialog";
import { q, qs, setHidden } from "../dom";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";
import { errorState, loadingState } from "../ui";

onPage(() => {
  const root = q<HTMLElement>("#page-admin");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const stateBox = qs<HTMLElement>("[data-admin-state]", root);
  const content = qs<HTMLElement>("[data-admin-content]", root);
  const errorLine = qs<HTMLElement>("[data-admin-error]", root);
  const tzSelect = qs<HTMLSelectElement>("[data-admin-tz]", root);
  const tzSaved = qs<HTMLElement>("[data-tz-saved]", root);
  const restartButton = qs<HTMLButtonElement>("[data-admin-restart]", root);
  const blocked = qs<HTMLElement>("[data-admin-blocked]", root);

  let stats: AdminStats | null = null;
  let loading = true;
  let error: string | null = null;
  let savingTz = false;
  let restarting = false;
  let tzSavedVisible = false;
  let savedTimer: ReturnType<typeof setTimeout> | undefined;

  function setStat(key: string, value: string | number): void {
    const node = q(`[data-stat="${key}"]`, root);
    if (node) node.textContent = String(value);
  }

  function render(): void {
    stateBox.replaceChildren();
    if (loading) stateBox.append(loadingState());
    else if (error && !stats) stateBox.append(errorState(error, () => void load()));

    setHidden(content, !stats);
    if (!stats) return;

    setStat("users", stats.users);
    setStat("follows", stats.follows);
    setStat("channels", stats.channels);
    setStat("admins", stats.admins);
    const meta = q("[data-stat-channels-meta]", root);
    if (meta) meta.textContent = ` · Twitch ${stats.twitchChannels} · Kick ${stats.kickChannels}`;

    blocked.hidden = stats.blockedUsers <= 0;
    blocked.textContent = t("admin.stats.blocked", { count: stats.blockedUsers });

    tzSelect.value = String(adminState.utcOffset);
    tzSelect.disabled = savingTz;
    tzSaved.hidden = !tzSavedVisible;
    restartButton.disabled = restarting;
    restartButton.textContent = restarting ? t("admin.restarting") : t("admin.restart");
    errorLine.hidden = !error;
    errorLine.textContent = error ?? "";
  }

  async function load(): Promise<void> {
    loading = true;
    error = null;
    render();
    try {
      [stats] = await Promise.all([adminOverview(), loadAdminSettings().then(() => undefined)]);
    } catch (err) {
      error = localizeApiError(err);
    } finally {      loading = false;
      render();
    }
  }

  async function onTimezoneChange(): Promise<void> {
    const offset = Number(tzSelect.value);
    if (savingTz || !Number.isFinite(offset)) return;
    savingTz = true;
    error = null;
    tzSavedVisible = false;
    render();
    try {
      await adminSaveTimezone(offset);
      adminState.utcOffset = offset;
      tzSavedVisible = true;
      if (savedTimer) clearTimeout(savedTimer);
      savedTimer = setTimeout(() => {
        tzSavedVisible = false;
        render();
      }, 1500);
    } catch (err) {
      error = localizeApiError(err);
      tzSelect.value = String(adminState.utcOffset);
    } finally {
      savingTz = false;
      render();
    }
  }

  async function onRestart(): Promise<void> {
    if (restarting) return;
    const confirmed = await confirmAction({
      destructive: true,
      message: t("admin.restart_confirm"),
    });
    if (!confirmed) return;

    restarting = true;
    render();
    try {
      await adminRestart();
    } catch {
      // The process exits right after responding; a dropped connection is expected.
    }
  }

  tzSelect.addEventListener("change", () => void onTimezoneChange(), { signal });
  restartButton.addEventListener("click", () => void onRestart(), { signal });
  window.addEventListener(LOCALE_EVENT, render, { signal });
  signal.addEventListener("abort", () => {
    if (savedTimer) clearTimeout(savedTimer);
  }, { once: true });

  void requireAdmin().then((allowed) => {
    if (allowed) void load();
    else {
      loading = false;
      render();
    }
  });
});
