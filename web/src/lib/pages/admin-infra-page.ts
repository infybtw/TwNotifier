import { localizeApiError } from "../api";
import {
  adminEventSubCleanup,
  adminEventSubDisconnect,
  adminEventSubReconnects,
  adminEventSubReload,
  adminEventSubStatus,
  adminWebhookCleanup,
  adminWebhookDisconnect,
  adminWebhookReload,
  adminWebhookStatus,
  formatAdminDate,
  loadAdminSettings,
  requireAdmin,
  type EventSubReconnect,
  type EventSubStatus,
  type KickWebhookStatus,
} from "../admin";
import { alertAction, confirmAction } from "../dialog";
import { clear, h, q, qs, setHidden } from "../dom";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";
import { LocalPager } from "../pagination";
import { Pager } from "../pager";
import { errorState, loadingState, renderCollection } from "../ui";

type InfraAction = "reload" | "disconnect" | "cleanup";
type InfraTarget = "eventsub" | "webhook";
type InfraSection = "services" | "history";

const actions: InfraAction[] = ["reload", "disconnect", "cleanup"];

onPage(() => {
  const root = q<HTMLElement>("#page-admin-infra");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const tabButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-infra-tab]"));
  const servicesPane = qs<HTMLElement>('[data-infra-pane="services"]', root);
  const historyPane = qs<HTMLElement>('[data-infra-pane="history"]', root);
  const servicesBox = qs<HTMLElement>("[data-infra-services]", root);
  const historyList = qs<HTMLElement>("[data-history-list]", root);
  const historyRefresh = qs<HTMLButtonElement>("[data-history-refresh]", root);
  const historyPagerRoot = qs<HTMLElement>("[data-pager]", historyPane);

  let eventSub: EventSubStatus | null = null;
  let webhook: KickWebhookStatus | null = null;
  let loading = true;
  let error: string | null = null;
  let busyAction: string | null = null;
  let activeSection: InfraSection = "services";

  let historyItems: EventSubReconnect[] = [];
  let historyLoading = false;
  let historyError: string | null = null;

  const historyPager = new LocalPager<EventSubReconnect>(() => historyItems, renderHistory);
  const historyView = new Pager(historyPagerRoot, (page) => historyPager.goToPage(page));

  function progress(label: string): HTMLElement {
    return h("div", {
      class: "mt-3 flex flex-col gap-2",
      children: [
        h("p", { class: "text-xs tg-hint", text: label }),
        h("div", {
          class: "tg-progress h-1.5 w-full overflow-hidden rounded-full",
          attrs: { role: "progressbar", "aria-label": label },
        }),
      ],
    });
  }

  function actionsRow(target: InfraTarget): HTMLElement {
    const row = h("div", { class: "mt-3 flex flex-wrap gap-2" });
    for (const action of actions) {
      const key = `${target}:${action}`;
      const busy = busyAction === key;
      const button = h("button", {
        class: `rounded-lg px-3 py-2 text-xs font-semibold ${
          action === "disconnect" ? "tg-secondary tg-destructive" : "tg-secondary tg-text"
        }`,
        text: busy ? t("admin.infra.busy") : t(`admin.infra.${action}`),
        attrs: { type: "button", disabled: busyAction !== null },
      });
      button.addEventListener("click", () => void ask(target, action));
      row.append(button);
    }
    return row;
  }

  function renderServices(): void {
    clear(servicesBox);
    if (loading) {
      servicesBox.append(loadingState());
      return;
    }
    if (error && !eventSub) {
      servicesBox.append(errorState(error, () => void load()));
      return;
    }

    if (eventSub) {
      const card = h("div", {
        class: "rounded-2xl p-4 tg-card",
        children: [
          h("h2", { class: "text-sm font-semibold tg-text", text: t("admin.infra.eventsub") }),
          h("p", {
            class: "mt-2 text-xs tg-hint",
            text: `${t("admin.infra.total", { count: eventSub.total })} · ${t("admin.infra.online", { count: eventSub.online })} · ${t("admin.infra.offline", { count: eventSub.offline })} · ${eventSub.transport}`,
          }),
          actionsRow("eventsub"),
        ],
      });
      if (busyAction?.startsWith("eventsub:")) card.append(progress(t("admin.infra.busy")));
      servicesBox.append(card);
    }

    if (webhook) {
      const card = h("div", {
        class: "mt-4 rounded-2xl p-4 tg-card",
        children: [
          h("h2", { class: "text-sm font-semibold tg-text", text: t("admin.infra.webhook") }),
          h("p", {
            class: "mt-2 text-xs tg-hint",
            text: `${t("admin.infra.total", { count: webhook.total })} · ${t("admin.infra.livestream", { count: webhook.livestream })}`,
          }),
          actionsRow("webhook"),
        ],
      });
      if (busyAction?.startsWith("webhook:")) card.append(progress(t("admin.infra.busy")));
      servicesBox.append(card);
    }

    if (error) {
      servicesBox.append(h("p", { class: "mt-4 text-sm tg-destructive", text: error }));
    }
  }

  async function load(): Promise<void> {
    loading = true;
    error = null;
    renderServices();
    try {
      [eventSub, webhook] = await Promise.all([adminEventSubStatus(), adminWebhookStatus()]);
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      loading = false;
      renderServices();
    }
  }

  function formatTime(iso: string): string {
    return `${formatAdminDate(iso)}:${String(new Date(iso).getUTCSeconds()).padStart(2, "0")}`;
  }

  function duration(item: EventSubReconnect): string {
    return ((Date.parse(item.finishedAt) - Date.parse(item.startedAt)) / 1_000).toFixed(1);
  }

  function closeDescription(code: number): string {
    const key = `admin.infra.reconnects.close_${code}`;
    const translated = t(key);
    return translated === key ? t("admin.infra.reconnects.close_unknown") : translated;
  }

  function historyRow(item: EventSubReconnect): HTMLElement {
    const card = h("div", {
      class: "min-w-0 rounded-xl p-3 tg-secondary",
      children: [
        h("div", {
          class: "flex flex-wrap items-baseline justify-between gap-1",
          children: [
            h("time", {
              class: "text-xs tg-hint",
              text: formatTime(item.startedAt),
              attrs: { datetime: item.startedAt },
            }),
            h("span", {
              class: `text-xs font-semibold ${item.status === "failed" ? "tg-destructive" : "tg-text"}`,
              text: t(`admin.infra.reconnects.${item.status}`),
            }),
          ],
        }),
        h("p", {
          class: "mt-1 text-sm tg-text",
          text: t(`admin.infra.reconnects.reason_${item.reason}`),
        }),
        h("p", {
          class: "mt-1 text-xs tg-hint",
          text: `${t("admin.infra.reconnects.attempt", { count: item.attempt })} · ${t("admin.infra.reconnects.duration", { seconds: duration(item) })} · ${t("admin.infra.reconnects.delay", { seconds: (item.delayMs / 1_000).toFixed(1) })}`,
        }),
      ],
    });

    if (item.closeCode !== null) {
      card.append(h("p", {
        class: "mt-1 break-words text-xs tg-hint",
        text: `${t("admin.infra.reconnects.close_code", { code: item.closeCode })}: ${closeDescription(item.closeCode)}`,
      }));
    }
    if (item.closeReason) {
      card.append(h("p", { class: "mt-1 break-words text-xs tg-hint", text: item.closeReason }));
    }
    if (item.error) {
      card.append(h("p", { class: "mt-1 break-words text-xs tg-destructive", text: item.error }));
    }
    if (item.details || item.previousSessionId || item.sessionId) {
      const details = h("details", {
        class: "mt-2 text-xs tg-hint",
        children: [h("summary", { class: "cursor-pointer", text: t("admin.infra.reconnects.details") })],
      });
      if (item.details) {
        details.append(h("p", { class: "mt-1 break-words", text: item.details }));
      }
      if (item.previousSessionId) {
        details.append(h("p", {
          class: "mt-1 break-all",
          text: `${t("admin.infra.reconnects.previous_session")}: ${item.previousSessionId}`,
        }));
      }
      if (item.sessionId) {
        details.append(h("p", {
          class: "mt-1 break-all",
          text: `${t("admin.infra.reconnects.session")}: ${item.sessionId}`,
        }));
      }
      card.append(details);
    }

    return card;
  }

  function renderHistory(): void {
    if (historyError) {
      clear(historyList);
      historyList.append(errorState(historyError, () => void loadHistory()));
    } else if (!historyLoading && historyItems.length === 0) {
      clear(historyList);
      historyList.append(h("p", {
        class: "mt-3 text-xs tg-hint",
        text: t("admin.infra.reconnects.empty"),
      }));
    } else {
      renderCollection(historyList, {
        items: historyPager.visibleItems,
        loading: historyLoading,
        emptyMessage: t("admin.infra.reconnects.empty"),
        renderItem: historyRow,
        listClass: "mt-3 flex flex-col gap-2",
      });
    }
    setHidden(historyPagerRoot, !(historyItems.length && !historyError));
    historyView.update({
      page: historyPager.page,
      totalPages: historyPager.totalPages,
      hasNext: historyPager.hasNext,
      loading: historyLoading,
    });
    historyRefresh.disabled = historyLoading;
  }

  async function loadHistory(): Promise<void> {
    if (historyLoading) return;
    historyLoading = true;
    historyError = null;
    renderHistory();
    try {
      const [response] = await Promise.all([adminEventSubReconnects(), loadAdminSettings()]);
      historyItems = response.items;
      historyPager.reset();
      historyPager.clamp();
    } catch (err) {
      historyError = localizeApiError(err);
    } finally {
      historyLoading = false;
      renderHistory();
    }
  }

  function renderTabs(): void {
    tabButtons.forEach((button) => {
      const section = button.dataset.infraTab as InfraSection | undefined;
      button.setAttribute("aria-pressed", String(section === activeSection));
    });
    setHidden(servicesPane, activeSection !== "services");
    setHidden(historyPane, activeSection !== "history");
  }

  async function ask(target: InfraTarget, action: InfraAction): Promise<void> {
    const confirmed = await confirmAction({
      message: t(`admin.infra.confirm_${action}`),
    });
    if (confirmed) await run(target, action);
  }

  async function run(target: InfraTarget, action: InfraAction): Promise<void> {
    if (busyAction) return;
    busyAction = `${target}:${action}`;
    error = null;
    renderServices();

    let message: string | null = null;
    try {
      if (target === "eventsub") {
        if (action === "reload") message = t("admin.infra.result_reload", await adminEventSubReload());
        else if (action === "disconnect") message = t("admin.infra.result_disconnect", await adminEventSubDisconnect());
        else message = t("admin.infra.result_cleanup", await adminEventSubCleanup());
      } else if (action === "reload") {
        message = t("admin.infra.result_reload", await adminWebhookReload());
      } else if (action === "disconnect") {
        message = t("admin.infra.result_disconnect", await adminWebhookDisconnect());
      } else {
        message = t("admin.infra.result_cleanup", await adminWebhookCleanup());
      }
      await load();
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      busyAction = null;
      renderServices();
    }

    if (message) await alertAction(message);
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.infraTab as InfraSection | undefined;
      if (!section || section === activeSection) return;
      activeSection = section;
      renderTabs();
      if (section === "history") void loadHistory();
    }, { signal });
  });

  historyRefresh.addEventListener("click", () => void loadHistory(), { signal });
  window.addEventListener(LOCALE_EVENT, () => {
    renderServices();
    renderHistory();
  }, { signal });

  renderTabs();
  renderHistory();

  void requireAdmin().then((allowed) => {
    if (allowed) void load();
    else {
      loading = false;
      renderServices();
    }
  });
});
