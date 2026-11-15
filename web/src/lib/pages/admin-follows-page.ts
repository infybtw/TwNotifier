import {
  adminFollows,
  formatAdminDate,
  loadAdminSettings,
  requireAdmin,
  type AdminFollow,
} from "../admin";
import { h, platformBadge, q, qs, setHidden } from "../dom";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";
import { CursorPager } from "../pagination";
import { Pager } from "../pager";
import { renderCollection } from "../ui";

function displayName(follow: AdminFollow): string {
  return follow.firstName || follow.username || follow.userId;
}

function followRow(follow: AdminFollow): HTMLElement {
  return h("div", {
    class: "rounded-2xl px-4 py-3 tg-card",
    children: [
      h("p", {
        class: "text-sm tg-text",
        children: [
          h("span", { class: "font-semibold", text: displayName(follow) }),
          follow.username ? h("span", { class: "tg-hint", text: ` @${follow.username}` }) : null,
          h("span", { class: "tg-hint", text: " → " }),
          h("span", { class: "font-semibold", text: follow.channelName }),
        ],
      }),
      h("div", {
        class: "mt-1.5 flex flex-wrap items-center gap-1.5",
        children: [
          platformBadge(follow.platform),
          h("span", { class: "text-xs tg-hint", text: formatAdminDate(follow.created) }),
        ],
      }),
    ],
  });
}

onPage(() => {
  const root = q<HTMLElement>("#page-admin-follows");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const list = qs<HTMLElement>("[data-admin-follows-list]", root);
  const pagerRoot = qs<HTMLElement>("[data-pager]", root);

  const pager = new CursorPager<AdminFollow>({
    key: "admin-follows",
    fetchPage: async ({ cursor, limit }) => {
      await loadAdminSettings();
      return adminFollows(cursor, limit);
    },
    onChange: render,
  });
  const view = new Pager(pagerRoot, (page) => void pager.load(page));

  function render(): void {
    renderCollection(list, {
      errorStyle: "inline",
      items: pager.items,
      loading: pager.state.loading,
      error: pager.state.error,
      emptyMessage: t("admin.empty"),
      retry: () => void pager.reload(),
      renderItem: followRow,
    });
    setHidden(pagerRoot, !(pager.items.length || pager.page > 1 || pager.state.loading));
    view.update({ page: pager.page, hasNext: pager.hasNext, loading: pager.state.loading });
  }

  window.addEventListener(LOCALE_EVENT, render, { signal });
  signal.addEventListener("abort", () => pager.cancel(), { once: true });

  render();
  void requireAdmin().then((allowed) => {
    if (allowed) void pager.reload();
  });
});
