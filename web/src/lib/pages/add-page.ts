import { localizeApiError } from "../api";
import { ensureSession } from "../auth";
import { avatar, clear, h, platformBadge, q, qs } from "../dom";
import { addFollow, resolveChannels, type ChannelMatch } from "../follows";
import { LOCALE_EVENT, t } from "../i18n";
import { openExternal } from "../telegram";
import { onPage, pageSignal } from "../page";
import { loadingState, notice as noticeCard } from "../ui";

onPage(() => {
  const root = q<HTMLElement>("#page-add");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const form = qs<HTMLFormElement>("[data-add-form]", root);
  const input = qs<HTMLInputElement>("[data-add-input]", root);
  const submit = qs<HTMLButtonElement>("[data-add-submit]", root);
  const result = qs<HTMLElement>("[data-add-result]", root);

  let query = "";
  let matches: ChannelMatch[] = [];
  let selected: ChannelMatch | null = null;
  /** Last successfully added channel, kept so the success card can show its avatar. */
  let added: ChannelMatch | null = null;
  let notice: string | null = null;
  let error: string | null = null;
  let busy = false;
  let adding = false;

  function updateSubmit(): void {
    submit.disabled = busy || adding || !query.trim();
  }

  function reset(): void {
    matches = [];
    selected = null;
    notice = null;
    render();
  }

  function choices(): HTMLElement {
    const wrapper = h("div", { class: "flex flex-col gap-2" });
    wrapper.append(h("p", { class: "text-sm tg-hint", text: t("add.choose_platform") }));

    for (const match of matches) {
      const button = h("button", {
        class: "flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card text-left",
        attrs: { type: "button", disabled: match.alreadyFollowing },
        children: [
          h("span", {
            class: "flex min-w-0 items-center gap-3",
            children: [
              avatar(match.avatarUrl, match.displayName),
              h("span", {
                class: "flex min-w-0 flex-col gap-1",
                children: [
                  h("span", { class: "truncate text-sm font-semibold tg-text", text: match.displayName }),
                  platformBadge(match.platform),
                ],
              }),
            ],
          }),
          match.alreadyFollowing
            ? h("span", { class: "shrink-0 text-xs tg-hint", text: t("add.already_short") })
            : h("span", { class: "shrink-0 text-xs font-medium tg-link", text: t("add.confirm") }),
        ],
      });
      button.addEventListener("click", () => {
        selected = match;
        render();
      });
      wrapper.append(button);
    }

    return wrapper;
  }

  function preview(): HTMLElement {
    if (!selected) return h("div");
    const match = selected;

    const confirm = h("button", {
      class: "flex-1 rounded-xl px-3 py-2.5 text-sm font-semibold tg-button",
      text: t("add.confirm"),
      attrs: { type: "button", disabled: adding },
    });
    confirm.addEventListener("click", () => void confirmAdd());

    const cancel = h("button", {
      class: "rounded-xl px-3 py-2.5 text-sm font-medium tg-secondary tg-text",
      text: t("common.cancel"),
      attrs: { type: "button" },
    });
    cancel.addEventListener("click", () => reset());

    const open = h("button", {
      class: "rounded-xl px-3 py-2.5 text-sm font-medium tg-secondary tg-text",
      text: t("common.open"),
      attrs: { type: "button", "aria-label": t("common.open") },
    });
    open.addEventListener("click", () => openExternal(match.url));

    return h("div", {
      class: "rounded-2xl p-4 tg-card",
      children: [
        h("div", {
          class: "flex items-center gap-3",
          children: [
            avatar(match.avatarUrl, match.displayName, 48),
            h("div", {
              class: "flex min-w-0 flex-col gap-1.5",
              children: [
                h("p", {
                  class: "truncate text-sm font-medium tg-text",
                  text: t("add.preview", { name: match.displayName }),
                }),
                platformBadge(match.platform),
              ],
            }),
          ],
        }),
        h("div", { class: "mt-4 flex gap-2", children: [confirm, cancel, open] }),
      ],
    });
  }

  function render(): void {
    updateSubmit();
    clear(result);

    if (notice) {
      result.append(h("div", {
        class: "flex items-center gap-3 rounded-2xl p-4 tg-card",
        children: [
          added ? avatar(added.avatarUrl, added.displayName, 36) : null,
          h("p", { class: "min-w-0 text-sm tg-text", text: notice }),
        ],
      }));
    }

    if (error) result.append(noticeCard(error, { destructive: true }));
    if (busy) result.append(loadingState(t("add.resolving")));
    else if (matches.length > 1 && !selected) result.append(choices());
    else if (selected) result.append(preview());
  }

  async function search(): Promise<void> {
    const value = query.trim();
    if (!value || busy) return;

    busy = true;
    error = null;
    notice = null;
    selected = null;
    added = null;
    render();

    try {
      const response = await resolveChannels(value);
      matches = response.matches;
      if (response.matches.length === 0) {
        error = response.unavailablePlatforms.length > 0
          ? t("add.provider_unavailable")
          : t("add.not_found");
        return;
      }
      const fresh = response.matches.filter((match) => !match.alreadyFollowing);
      if (fresh.length === 0) {
        notice = t("add.already", { name: response.matches[0]!.displayName });
        return;
      }
      if (fresh.length === 1) selected = fresh[0]!;
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      busy = false;
      render();
    }
  }

  async function confirmAdd(): Promise<void> {
    const match = selected;
    if (!match || adding) return;

    adding = true;
    error = null;
    render();

    try {
      const response = await addFollow(match.platform, match.channelId, match.login);
      const message = response.isNew
        ? t("add.success", { name: match.displayName })
        : t("add.already", { name: match.displayName });
      reset();
      added = response.isNew ? match : null;
      notice = message;
      query = "";
      input.value = "";
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      adding = false;
      render();
    }
  }

  input.addEventListener("input", () => {
    query = input.value;
    updateSubmit();
  }, { signal });

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    void search();
  }, { signal });

  window.addEventListener(LOCALE_EVENT, render, { signal });

  void ensureSession().then((authenticated) => {
    if (!authenticated) {
      input.disabled = true;
      submit.disabled = true;
    }
  });
});
