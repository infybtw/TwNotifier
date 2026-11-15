import { ensureSession } from "../auth";
import { h, platformBadge, q, qs, setHidden, statusBadge } from "../dom";
import { getFollowPage, type Follow } from "../follows";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";
import { CursorPager } from "../pagination";
import { Pager } from "../pager";
import { renderCollection } from "../ui";
import type { Platform } from "../types";

let platform: Platform | "" = "";
let search = "";

function followCard(follow: Follow): HTMLElement {
  return h("a", {
    class: "flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card",
    attrs: { href: `/follow/${follow.platform}/${encodeURIComponent(follow.channelId)}` },
    children: [
      h("span", {
        class: "flex min-w-0 flex-col gap-1",
        children: [
          h("span", { class: "truncate text-sm font-semibold tg-text", text: follow.displayName }),
          h("span", {
            class: "flex flex-wrap items-center gap-1.5",
            children: [platformBadge(follow.platform), statusBadge(follow.online)],
          }),
        ],
      }),
      h("span", { class: "text-lg tg-hint", text: "›", attrs: { "aria-hidden": "true" } }),
    ],
  });
}

onPage(() => {
  const root = q<HTMLElement>("#page-follows");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const input = qs<HTMLInputElement>("[data-follows-search]", root);
  const list = qs<HTMLElement>("[data-follows-list]", root);
  const summary = qs<HTMLElement>("[data-follows-summary]", root);
  const filterButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-platform]"));
  const pagerRoot = qs<HTMLElement>("[data-pager]", root);
  const pager = new CursorPager<Follow>({
    key: "follows",
    fetchPage: (request) => getFollowPage({
      ...request,
      platform: platform || undefined,
      search: search || undefined,
    }),
    onChange: render,
  });
  const view = new Pager(pagerRoot, (page) => {
    void pager.load(page);
  });

  let debouncing = false;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

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
    const online = pager.items.filter((item) => item.online === "online").length;
    summary.textContent = t("follows.page_summary", { total: pager.items.length, online });
    renderFilters();

    const loading = pager.state.loading || debouncing;
    renderCollection(list, {
      items: pager.items,
      loading,
      error: pager.state.error,
      emptyMessage: t("follows.empty"),
      emptyAction: { label: t("follows.empty_action"), href: "/add" },
      retry: () => void pager.reload(),
      renderItem: followCard,
    });

    setHidden(pagerRoot, !(pager.items.length || pager.page > 1 || loading));
    view.update({
      page: pager.page,
      hasNext: pager.hasNext,
      loading,
    });

    input.value = search;
  }

  input.addEventListener("input", () => {
    search = input.value;
    if (searchTimer) clearTimeout(searchTimer);
    debouncing = true;
    pager.invalidate();
    searchTimer = setTimeout(() => {
      debouncing = false;
      void pager.reset();
    }, 300);
  }, { signal });

  filterButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const next = button.dataset.platform;
      if (next !== "" && next !== "twitch" && next !== "kick") return;
      if (next === platform) return;
      platform = next;
      if (searchTimer) clearTimeout(searchTimer);
      debouncing = false;
      void pager.reset();
    }, { signal });
  });

  window.addEventListener(LOCALE_EVENT, render, { signal });
  signal.addEventListener("abort", () => {
    if (searchTimer) clearTimeout(searchTimer);
    pager.cancel();
  }, { once: true });

  input.value = search;
  renderFilters();
  render();

  void ensureSession().then((authenticated) => {
    if (authenticated) void pager.reload();
  });
});
