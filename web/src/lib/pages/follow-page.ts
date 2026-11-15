import { navigate } from "astro:transitions/client";
import { localizeApiError } from "../api";
import { ensureSession } from "../auth";
import { confirmAction } from "../dialog";
import {
  avatar,
  clear,
  h,
  platformBadge,
  q,
  qs,
  statusBadge,
  streamPreview,
} from "../dom";
import { getFollowDetails, removeFollow, type FollowDetails } from "../follows";
import { getLocale, LOCALE_EVENT, t } from "../i18n";
import { openExternal, openTelegramLink } from "../telegram";
import { onPage, pageSignal } from "../page";
import { errorState, loadingState } from "../ui";

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(getLocale() === "ru" ? "ru-RU" : "en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

onPage(() => {
  const root = q<HTMLElement>("#page-follow");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const platform = root.dataset.platform ?? "";
  const channelId = root.dataset.channelId ?? "";
  const content = qs<HTMLElement>("[data-follow-content]", root);
  const signal = pageSignal();

  let details: FollowDetails | null = null;
  let loading = true;
  let error: string | null = null;
  let busy = false;

  function actionButton(
    label: string,
    className: string,
    handler: () => void,
  ): HTMLButtonElement {
    const button = h("button", {
      class: `rounded-xl px-4 py-3 text-sm ${className}`,
      text: label,
      attrs: { type: "button" },
    });
    button.addEventListener("click", handler);
    return button;
  }

  function renderDetails(): void {
    if (!details) return;
    const detail = details;
    const capabilities = detail.capabilities ?? { titleChange: false, categoryChange: false };
    const live = detail.live;

    const header = h("header", {
      class: "rounded-2xl p-4 tg-card",
      children: [
        h("div", {
          class: "flex items-center gap-3",
          children: [
            avatar(detail.avatarUrl, detail.displayName, 48),
            h("h1", {
              class: "min-w-0 truncate text-lg font-semibold tracking-tight tg-text",
              text: detail.displayName,
            }),
          ],
        }),
        h("div", {
          class: "mt-3 flex flex-wrap items-center gap-2",
          children: [platformBadge(detail.platform), statusBadge(detail.online)],
        }),
        h("p", {
          class: "mt-3 text-xs tg-hint",
          text: t("details.follow_date", { date: formatDate(detail.followDate) }),
        }),
        h("p", {
          class: "mt-1.5 text-xs tg-hint",
          text: detail.platform === "twitch" ? t("details.twitch_full") : t("details.kick_limited"),
        }),
      ],
    });

    const nodes: Node[] = [header];

    if (live && live.status === "online") {
      const liveCard = h("section", {
        class: "rounded-2xl p-4 tg-card",
        children: [
          h("h2", { class: "text-sm font-semibold tg-text", text: t("details.status") }),
        ],
      });
      const preview = streamPreview(live.previewUrl, detail.displayName);
      if (preview) {
        preview.classList.add("mt-3");
        liveCard.append(preview);
      }

      const list = h("dl", { class: "mt-2 space-y-1.5 text-sm tg-text" });
      if (live.title) {
        list.append(h("div", {
          children: [
            h("dt", { class: "sr-only", text: t("details.stream_title") }),
            h("dd", { text: t("details.stream_title", { title: live.title }) }),
          ],
        }));
      }
      if (live.viewers !== undefined) {
        list.append(h("div", {
          children: [
            h("dt", { class: "sr-only", text: t("details.viewers") }),
            h("dd", { text: t("details.viewers", { count: live.viewers }) }),
          ],
        }));
      }
      if (live.category && capabilities.categoryChange) {
        list.append(h("div", {
          children: [
            h("dt", { class: "sr-only", text: t("details.category") }),
            h("dd", { text: t("details.category", { name: live.category }) }),
          ],
        }));
      }
      liveCard.append(list);
      nodes.push(liveCard);
    }

    const actions = h("div", { class: "flex flex-col gap-2" });
    actions.append(
      actionButton(t("details.open_channel"), "font-semibold tg-button", () => openExternal(detail.url)),
      actionButton(t("details.share"), "font-medium tg-secondary tg-text", () => share(detail)),
      actionButton(t("details.remove"), "font-semibold tg-secondary tg-destructive", () => void confirmRemove(detail)),
    );
    if (busy) {
      actions.querySelectorAll<HTMLButtonElement>("button").forEach((button) => {
        button.disabled = true;
      });
    }
    nodes.push(actions);

    if (error) nodes.push(h("p", { class: "text-sm tg-destructive", text: error }));
    content.replaceChildren(...nodes);
  }

  function share(detail: FollowDetails): void {
    if (detail.shareUrl) openTelegramLink(detail.shareUrl);
    else openExternal(detail.url);
  }

  async function load(): Promise<void> {
    loading = true;
    error = null;
    clear(content);
    content.append(loadingState());
    try {
      details = await getFollowDetails(platform, channelId);
      document.title = details.displayName;
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      loading = false;
      render();
    }
  }

  async function confirmRemove(detail: FollowDetails): Promise<void> {
    const confirmed = await confirmAction({
      destructive: true,
      confirmLabel: t("common.remove"),
      message: t("details.remove_confirm", { name: detail.displayName }),
    });
    if (!confirmed || busy) return;

    busy = true;
    error = null;
    renderDetails();
    try {
      await removeFollow(platform, channelId);
      if (signal.aborted) return;
      await navigate("/");
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      busy = false;
      renderDetails();
    }
  }

  function render(): void {
    clear(content);
    if (loading) {
      content.append(loadingState());
      return;
    }
    if (error && !details) {
      content.append(errorState(error, () => void load()));
      return;
    }
    if (!details) return;
    renderDetails();
  }

  window.addEventListener(LOCALE_EVENT, render, { signal });

  void ensureSession().then((authenticated) => {
    if (authenticated) void load();
    else {
      loading = false;
      render();
    }
  });
});
