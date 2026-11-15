import { adminChannels, requireAdmin, type AdminChannel } from "../admin";
import { h, platformBadge, q, qs, setHidden } from "../dom";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";
import { CursorPager } from "../pagination";
import { Pager } from "../pager";
import { renderCollection } from "../ui";
import type { Platform } from "../types";

let platform: Platform | "" = "";

function channelRow(channel: AdminChannel): HTMLElement {
  return h("div", {
    class: "flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card",
    children: [
      h("span", {
        class: "flex min-w-0 flex-col gap-1",
        children: [
          h("span", { class: "truncate text-sm font-semibold tg-text", text: channel.name }),
          platformBadge(channel.platform),
        ],
      }),
      h("span", {
        class: "shrink-0 text-xs tg-hint",
        text: t("admin.channels.followers", { count: channel.followers }),
      }),
    ],
  });
}

onPage(() => {
  const root = q<HTMLElement>("#page-admin-channels");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const list = qs<HTMLElement>("[data-channels-list]", root);
  const pagerRoot = qs<HTMLElement>("[data-pager]", root);
  const filterButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-platform]"));

  const pager = new CursorPager<AdminChannel>({
    key: "admin-channels",
    fetchPage: (request) => adminChannels({ ...request, platform: platform || undefined }),
    onChange: render,
  });
  const view = new Pager(pagerRoot, (page) => void pager.load(page));

  function renderFilters(): void {
    filterButtons.forEach((button) => {
      const active = button.dataset.platform === platform;
      button.classList.toggle("tg-button", active);
      button.classList.toggle("tg-secondary", !active);
      button.classList.toggle("tg-text", !active);
      button.setAttribute("aria-pressed", String(active));
    });
  }

  function render(): void {
    renderFilters();
    renderCollection(list, {
      errorStyle: "inline",
      items: pager.items,
      loading: pager.state.loading,
      error: pager.state.error,
      emptyMessage: t("admin.empty"),
      retry: () => void pager.reload(),
      renderItem: channelRow,
    });
    setHidden(pagerRoot, !(pager.items.length || pager.page > 1 || pager.state.loading));
    view.update({ page: pager.page, hasNext: pager.hasNext, loading: pager.state.loading });
  }

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.platform;
      if (next !== "" && next !== "twitch" && next !== "kick") return;
      if (next === platform) return;
      platform = next;
      void pager.reset();
    }, { signal });
  });

  window.addEventListener(LOCALE_EVENT, render, { signal });
  signal.addEventListener("abort", () => pager.cancel(), { once: true });

  render();
  void requireAdmin().then((allowed) => {
    if (allowed) void pager.reload();
  });
});
