import {
  adminLogs,
  formatAdminDate,
  loadAdminSettings,
  requireAdmin,
  type AdminLog,
} from "../admin";
import { clear, h, platformBadge, q, qs, setHidden } from "../dom";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";
import { LocalPager } from "../pagination";
import { Pager } from "../pager";
import { errorState, renderCollection } from "../ui";

function logRow(log: AdminLog): HTMLElement {
  return h("div", {
    class: "flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card",
    children: [
      h("span", {
        class: "flex min-w-0 flex-col gap-1",
        children: [
          h("span", {
            class: "truncate text-sm font-medium tg-text",
            children: [
              h("span", { text: log.event === "online" ? "🟢" : "⚪", attrs: { "aria-hidden": "true" } }),
              " ",
              log.channelName ?? log.channelId,
            ],
          }),
          h("span", {
            class: "flex flex-wrap items-center gap-1.5",
            children: [
              platformBadge(log.platform),
              h("span", {
                class: "text-xs tg-hint",
                text: `${t(`admin.logs.${log.event === "online" ? "online" : "offline"}`)} · ${t("admin.logs.followers", { count: log.followers })}`,
              }),
            ],
          }),
        ],
      }),
      h("span", { class: "shrink-0 text-xs tg-hint", text: formatAdminDate(log.created) }),
    ],
  });
}

onPage(() => {
  const root = q<HTMLElement>("#page-admin-logs");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const list = qs<HTMLElement>("[data-logs-list]", root);
  const refresh = qs<HTMLButtonElement>("[data-logs-refresh]", root);
  const pagerRoot = qs<HTMLElement>("[data-pager]", root);

  let items: AdminLog[] = [];
  let loading = true;
  let error: string | null = null;
  const pager = new LocalPager<AdminLog>(() => items, render);
  const view = new Pager(pagerRoot, (page) => pager.goToPage(page));

  function render(): void {
    if (error) {
      clear(list);
      list.append(errorState(error, () => void load()));
    } else {
      renderCollection(list, {
        items: pager.visibleItems,
        loading,
        error: null,
        emptyMessage: t("admin.empty"),
        renderItem: logRow,
      });
    }
    setHidden(pagerRoot, !(items.length && !error));
    view.update({
      page: pager.page,
      totalPages: pager.totalPages,
      hasNext: pager.hasNext,
      loading,
    });
    refresh.disabled = loading;
  }

  async function load(): Promise<void> {
    loading = true;
    error = null;
    render();
    try {
      await loadAdminSettings();
      const response = await adminLogs();
      items = response.items;
      pager.reset();
      pager.clamp();
    } catch (err) {
      error = t("common.error");
    } finally {
      loading = false;
      render();
    }
  }

  refresh.addEventListener("click", () => void load(), { signal });
  window.addEventListener(LOCALE_EVENT, render, { signal });

  render();
  void requireAdmin().then((allowed) => {
    if (allowed) void load();
  });
});
