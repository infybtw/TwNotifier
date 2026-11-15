import { navigate } from "astro:transitions/client";
import { ensureSession } from "../auth";
import {
  clear,
  h,
  platformBadge,
  q,
  qs,
  setHidden,
  statusBadge,
  streamPreview,
} from "../dom";
import { loadOnline, type Follow } from "../follows";
import { LOCALE_EVENT, t } from "../i18n";
import { openExternal } from "../telegram";
import { onPage, pageSignal } from "../page";
import { LocalPager } from "../pagination";
import { Pager } from "../pager";
import { errorState, renderCollection } from "../ui";

function onlineCard(follow: Follow): HTMLElement {
  const details = h("dl", { class: "space-y-1 text-xs tg-hint" });
  if (follow.live?.status === "online" && follow.live.title) {
    details.append(h("div", {
      children: [
        h("dt", { class: "sr-only", text: t("details.stream_title") }),
        h("dd", { class: "truncate", text: t("details.stream_title", { title: follow.live.title }) }),
      ],
    }));
  }
  if (follow.live?.status === "online" && follow.live.viewers !== undefined) {
    details.append(h("div", {
      children: [
        h("dt", { class: "sr-only", text: t("details.viewers") }),
        h("dd", { text: t("details.viewers", { count: follow.live.viewers }) }),
      ],
    }));
  }

  const openButton = h("button", {
    class: `rounded-lg px-2.5 py-1.5 text-xs font-medium ${
      follow.platform === "twitch" ? "bg-violet-500/15 text-violet-400" : "bg-green-500/15 text-green-400"
    }`,
    text: t(`platform.${follow.platform}`),
    attrs: { type: "button", "aria-label": t("details.open_channel") },
  });
  openButton.addEventListener("click", (event) => {
    event.stopPropagation();
    openExternal(follow.url);
  });

  const card = h("div", {
    class: "flex cursor-pointer flex-col gap-2.5 rounded-2xl p-4 tg-card",
    children: [
      streamPreview(follow.live?.previewUrl, follow.displayName),
      h("div", {
        class: "flex items-center justify-between gap-2",
        children: [
          h("div", {
            class: "flex min-w-0 flex-col gap-1",
            children: [
              h("span", { class: "truncate text-sm font-semibold tg-text", text: follow.displayName }),
              h("span", {
                class: "flex flex-wrap items-center gap-1.5",
                children: [platformBadge(follow.platform), statusBadge(follow.online)],
              }),
            ],
          }),
          h("div", { class: "flex shrink-0 gap-2", children: [openButton] }),
        ],
      }),
    ],
  });

  if (follow.live?.status === "online" && details.childElementCount > 0) {
    card.append(details);
  }

  card.addEventListener("click", () => {
    void navigate(`/follow/${follow.platform}/${encodeURIComponent(follow.channelId)}`);
  });
  card.tabIndex = 0;
  card.setAttribute("role", "link");
  card.addEventListener("keydown", (event) => {
    if (event.target !== card) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    void navigate(`/follow/${follow.platform}/${encodeURIComponent(follow.channelId)}`);
  });

  return card;
}

onPage(() => {
  const root = q<HTMLElement>("#page-online");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const list = qs<HTMLElement>("[data-online-list]", root);
  const refresh = qs<HTMLButtonElement>("[data-online-refresh]", root);
  const pagerRoot = qs<HTMLElement>("[data-pager]", root);
  const pager = new LocalPager<Follow>(() => items, render);
  const view = new Pager(pagerRoot, (page) => pager.goToPage(page));

  let items: Follow[] = [];
  let loading = false;
  let error: string | null = null;

  function render(): void {
    if (error) {
      clear(list);
      list.append(errorState(error, () => void reload()));
    } else {
      renderCollection(list, {
        items: pager.visibleItems,
        loading,
        loadingMessage: t("online.checking"),
        error: null,
        emptyMessage: t("online.empty"),
        renderItem: onlineCard,
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

  async function reload(): Promise<void> {
    if (loading) return;
    loading = true;
    error = null;
    render();
    try {
      const response = await loadOnline();
      items = response.items;
      pager.reset();
      pager.clamp();
    } catch {
      error = t("common.error");
    } finally {
      loading = false;
      render();
    }
  }

  refresh.addEventListener("click", () => void reload(), { signal });
  window.addEventListener(LOCALE_EVENT, render, { signal });
  signal.addEventListener("abort", () => {
    loading = false;
  }, { once: true });

  void ensureSession().then((authenticated) => {
    if (authenticated) void reload();
    else render();
  });
});
