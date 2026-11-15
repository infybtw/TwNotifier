import { localizeApiError } from "../api";
import {
  adminUpdateUser,
  adminUserDetail,
  adminUserFollows,
  adminUserNotifications,
  formatAdminDate,
  loadAdminSettings,
  requireAdmin,
  type AdminUserDetail,
  type AdminUserFollow,
  type AdminUserNotification,
} from "../admin";
import { confirmAction } from "../dialog";
import { h, platformBadge, q, qs, setHidden } from "../dom";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";
import { CursorPager } from "../pagination";
import { Pager } from "../pager";
import { errorState, loadingState, renderCollection } from "../ui";

type Section = "overview" | "settings" | "follows" | "notifications";

function statusClass(status: string): string {
  if (status === "sent") return "bg-green-500/15 text-green-400";
  if (status === "blocked") return "bg-red-500/15 text-red-400";
  return "bg-amber-500/15 text-amber-400";
}

onPage(() => {
  const root = q<HTMLElement>("#page-admin-user");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const userId = root.dataset.userId ?? "";
  const signal = pageSignal();
  const stateBox = qs<HTMLElement>("[data-user-state]", root);
  const detailBox = qs<HTMLElement>("[data-user-detail]", root);
  const headerBox = qs<HTMLElement>("[data-user-header]", root);
  const errorLine = qs<HTMLElement>("[data-user-error]", root);
  const tabButtons = Array.from(root.querySelectorAll<HTMLButtonElement>("[data-user-tab]"));
  const panes: Record<Section, HTMLElement> = {
    overview: qs<HTMLElement>('[data-user-pane="overview"]', root),
    settings: qs<HTMLElement>('[data-user-pane="settings"]', root),
    follows: qs<HTMLElement>('[data-user-pane="follows"]', root),
    notifications: qs<HTMLElement>('[data-user-pane="notifications"]', root),
  };
  const overviewBox = panes.overview;
  const settingsBox = panes.settings;
  const followsBox = panes.follows;
  const notificationsBox = panes.notifications;
  const followsList = qs<HTMLElement>("[data-user-follows-list]", followsBox);
  const notificationsList = qs<HTMLElement>("[data-user-notifications-list]", notificationsBox);
  const followsTitle = qs<HTMLElement>("[data-user-follows-title]", followsBox);
  const notificationsTitle = qs<HTMLElement>("[data-user-notifications-title]", notificationsBox);

  let detail: AdminUserDetail | null = null;
  let loading = true;
  let error: string | null = null;
  let notice: string | null = null;
  let activeSection: Section = "overview";
  let savingAdmin = false;
  let savingBlocked = false;

  const followsPager = new CursorPager<AdminUserFollow>({
    key: `user-${userId}-follows`,
    fetchPage: ({ cursor, limit }) => adminUserFollows(userId, cursor, limit),
    onChange: renderFollows,
  });
  const notificationsPager = new CursorPager<AdminUserNotification>({
    key: `user-${userId}-notifications`,
    fetchPage: ({ cursor, limit }) => adminUserNotifications(userId, cursor, limit),
    onChange: renderNotifications,
  });
  const followsView = new Pager(qs<HTMLElement>("[data-pager]", followsBox), (page) => {
    void followsPager.load(page);
  });
  const notificationsView = new Pager(qs<HTMLElement>("[data-pager]", notificationsBox), (page) => {
    void notificationsPager.load(page);
  });

  function displayName(): string {
    if (!detail) return userId;
    return detail.firstName || detail.username || detail.id;
  }

  function deliveryLabel(): string {
    if (detail?.chatDelivery === "enabled") return t("settings.delivery_enabled");
    if (detail?.chatDelivery === "blocked") return t("settings.delivery_blocked");
    return t("settings.delivery_unknown");
  }

  function renderHeader(): void {
    headerBox.replaceChildren();
    if (!detail) return;

    const badges = h("span", { class: "flex shrink-0 flex-col items-end gap-1" });
    if (detail.isAdmin) {
      badges.append(h("span", {
        class: "rounded-full px-2 py-0.5 text-xs font-medium tg-secondary tg-link",
        text: t("admin.users.admin_badge"),
      }));
    }
    if (detail.isBotBlocked) {
      badges.append(h("span", {
        class: "rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400",
        text: t("admin.users.blocked_badge"),
      }));
    }

    headerBox.append(h("header", {
      class: "flex flex-col gap-2 rounded-2xl px-4 py-4 tg-card",
      children: [
        h("div", {
          class: "flex items-center justify-between gap-3",
          children: [
            h("span", {
              class: "min-w-0 text-base font-semibold tg-text",
              children: [
                displayName(),
                detail.username ? h("span", { class: "font-normal tg-hint", text: ` @${detail.username}` }) : null,
              ],
            }),
            badges,
          ],
        }),
        h("dl", {
          class: "flex flex-col gap-1 text-xs tg-hint",
          children: [
            h("div", {
              class: "flex gap-1",
              children: [h("dt", { text: "ID:" }), h("dd", { class: "tg-text", text: detail.id })],
            }),
            h("div", {
              class: "flex gap-1",
              children: [
                h("dt", { text: `${t("admin.user.registered")}:` }),
                h("dd", { class: "tg-text", text: formatAdminDate(detail.created) }),
              ],
            }),
            h("div", {
              class: "flex gap-1",
              children: [
                h("dt", { text: `${t("admin.user.chat_delivery")}:` }),
                h("dd", { class: "tg-text", text: deliveryLabel() }),
              ],
            }),
          ],
        }),
      ],
    }));
  }

  function actionButton(label: string, className: string, handler: () => void, disabled = false): HTMLElement {
    const button = h("button", {
      class: `rounded-xl px-3 py-2 text-xs font-semibold ${className}`,
      text: label,
      attrs: { type: "button", disabled },
    });
    button.addEventListener("click", handler);
    return button;
  }

  function renderOverview(): void {
    overviewBox.replaceChildren();
    if (!detail) return;

    const actions = h("div", { class: "flex flex-wrap gap-2" });
    if (!detail.isAdmin) {
      actions.append(actionButton(
        t("admin.user.make_admin"),
        "tg-button",
        () => void setAdmin(true),
        savingAdmin,
      ));
    } else {
      actions.append(actionButton(
        t("admin.user.revoke_admin"),
        "tg-secondary tg-destructive",
        () => void revokeAdmin(),
        savingAdmin,
      ));
    }
    if (detail.isBotBlocked) {
      actions.append(actionButton(
        t("admin.user.unblock"),
        "tg-secondary tg-text",
        () => void resetBlocked(),
        savingBlocked,
      ));
    }
    actions.append(actionButton(t("admin.user.copy_id"), "tg-secondary tg-text", () => void copyId()));

    const card = h("div", {
      class: "flex flex-col gap-2 rounded-2xl px-4 py-4 tg-card",
      children: [
        h("h2", { class: "text-sm font-semibold tg-text", text: t("admin.user.actions") }),
        actions,
      ],
    });
    if (detail.isBotBlocked) {
      card.append(h("p", { class: "text-xs tg-hint", text: t("admin.user.unblock_hint") }));
    }
    if (notice) card.append(h("p", { class: "text-xs tg-link", text: notice }));
    overviewBox.append(card);
  }

  function renderSettings(): void {
    settingsBox.replaceChildren();
    const settings = detail?.settings;
    if (!settings) return;

    const list = h("ul", { class: "flex flex-col gap-1.5 text-xs" });
    const rows: Array<[string, boolean]> = [
      [t("settings.stream_start"), settings.onlineNotification],
      [t("settings.stream_end"), settings.offlineNotification],
      [t("settings.title_change"), settings.titleChangeNotification],
      [t("settings.category_change"), settings.categoryChangeNotification],
      [t("settings.stream_metadata"), settings.streamMetadata],
      [t("settings.link_preview"), settings.linkPreview],
    ];
    for (const [label, on] of rows) {
      list.append(h("li", {
        class: "flex items-center justify-between gap-2",
        children: [
          h("span", { class: "tg-hint", text: label }),
          h("span", { class: on ? "text-green-400" : "tg-hint", text: on ? "✓" : "—" }),
        ],
      }));
    }
    list.append(h("li", {
      class: "flex items-center justify-between gap-2",
      children: [
        h("span", { class: "tg-hint", text: t("settings.language") }),
        h("span", { class: "tg-text", text: settings.language.toUpperCase() }),
      ],
    }));

    settingsBox.append(h("div", {
      class: "flex flex-col gap-2 rounded-2xl px-4 py-4 tg-card",
      children: [
        h("h2", { class: "text-sm font-semibold tg-text", text: t("admin.user.settings") }),
        list,
      ],
    }));
  }

  function followRow(follow: AdminUserFollow): HTMLElement {
    return h("div", {
      class: "flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card",
      children: [
        h("span", {
          class: "flex min-w-0 flex-col gap-1",
          children: [
            h("span", { class: "truncate text-sm font-medium tg-text", text: follow.channelName }),
            platformBadge(follow.platform),
          ],
        }),
        h("span", { class: "shrink-0 text-xs tg-hint", text: formatAdminDate(follow.created) }),
      ],
    });
  }

  function notificationRow(item: AdminUserNotification): HTMLElement {
    return h("div", {
      class: "flex flex-wrap items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card",
      children: [
        h("span", {
          class: "flex min-w-0 flex-col gap-1",
          children: [
            h("span", {
              class: "truncate text-sm font-medium tg-text",
              children: [
                t(`admin.notif.${item.event}`),
                item.channelName ? h("span", { class: "font-normal tg-hint", text: ` · ${item.channelName}` }) : null,
              ],
            }),
            h("span", {
              class: "flex flex-wrap items-center gap-1.5",
              children: [
                item.platform ? platformBadge(item.platform) : null,
                h("span", {
                  class: `rounded-full px-2 py-0.5 text-xs font-medium ${statusClass(item.status)}`,
                  text: t(`admin.notif.status_${item.status}`),
                }),
              ],
            }),
          ],
        }),
        h("span", { class: "shrink-0 text-xs tg-hint", text: formatAdminDate(item.created) }),
      ],
    });
  }

  function renderFollows(): void {
    if (!detail) return;
    followsTitle.textContent = t("admin.user.follows", { count: detail.follows });
    renderCollection(followsList, {
      items: followsPager.items,
      loading: followsPager.state.loading,
      error: followsPager.state.error,
      emptyMessage: t("admin.empty"),
      retry: () => void followsPager.reload(),
      renderItem: followRow,
    });
    const pager = qs<HTMLElement>("[data-pager]", followsBox);
    setHidden(pager, !(followsPager.items.length || followsPager.page > 1 || followsPager.state.loading));
    followsView.update({
      page: followsPager.page,
      hasNext: followsPager.hasNext,
      loading: followsPager.state.loading,
    });
  }

  function renderNotifications(): void {
    if (!detail) return;
    notificationsTitle.textContent = `${t("admin.user.notifications")} (${detail.notifications})`;
    renderCollection(notificationsList, {
      items: notificationsPager.items,
      loading: notificationsPager.state.loading,
      error: notificationsPager.state.error,
      emptyMessage: t("admin.empty"),
      retry: () => void notificationsPager.reload(),
      renderItem: notificationRow,
    });
    const pager = qs<HTMLElement>("[data-pager]", notificationsBox);
    setHidden(pager, !(notificationsPager.items.length || notificationsPager.page > 1 || notificationsPager.state.loading));
    notificationsView.update({
      page: notificationsPager.page,
      hasNext: notificationsPager.hasNext,
      loading: notificationsPager.state.loading,
    });
  }

  function renderTabs(): void {
    tabButtons.forEach((button) => {
      const section = button.dataset.userTab as Section | undefined;
      button.setAttribute("aria-pressed", String(section === activeSection));
    });
    (Object.keys(panes) as Section[]).forEach((section) => {
      setHidden(panes[section], section !== activeSection);
    });
  }

  function render(): void {
    stateBox.replaceChildren();
    if (loading) stateBox.append(loadingState());
    else if (error && !detail) stateBox.append(errorState(error, () => void load()));

    setHidden(detailBox, !detail);
    errorLine.hidden = !error || !detail;
    errorLine.textContent = error ?? "";

    if (!detail) return;
    renderHeader();
    renderOverview();
    renderSettings();
    renderTabs();
    renderFollows();
    renderNotifications();
  }

  async function load(): Promise<void> {
    loading = true;
    error = null;
    render();
    try {
      await loadAdminSettings();
      detail = await adminUserDetail(userId);
      document.title = displayName();
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      loading = false;
      render();
    }
  }

  async function setAdmin(isAdmin: boolean): Promise<void> {
    if (savingAdmin) return;
    savingAdmin = true;
    error = null;
    renderOverview();
    try {
      const updated = await adminUpdateUser(userId, { isAdmin });
      if (detail) detail.isAdmin = updated.isAdmin;
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      savingAdmin = false;
      renderHeader();
      renderOverview();
      errorLine.hidden = !error;
      errorLine.textContent = error ?? "";
    }
  }

  async function revokeAdmin(): Promise<void> {
    const confirmed = await confirmAction({
      destructive: true,
      message: t("admin.user.revoke_admin_confirm"),
    });
    if (confirmed) await setAdmin(false);
  }

  async function resetBlocked(): Promise<void> {
    if (savingBlocked) return;
    savingBlocked = true;
    error = null;
    renderOverview();
    try {
      const updated = await adminUpdateUser(userId, { isBotBlocked: false });
      if (detail) {
        detail.isBotBlocked = updated.isBotBlocked;
        if (!updated.isBotBlocked && detail.chatDelivery === "blocked") {
          detail.chatDelivery = "unknown";
        }
      }
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      savingBlocked = false;
      renderHeader();
      renderOverview();
      errorLine.hidden = !error;
      errorLine.textContent = error ?? "";
    }
  }

  async function copyId(): Promise<void> {
    try {
      await navigator.clipboard.writeText(userId);
      notice = t("admin.user.copied");
    } catch {
      notice = null;
    }
    renderOverview();
  }

  async function openSection(section: Section): Promise<void> {
    activeSection = section;
    renderTabs();
    if (section === "follows") await followsPager.load(followsPager.page);
    if (section === "notifications") await notificationsPager.load(notificationsPager.page);
  }

  tabButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const section = button.dataset.userTab as Section | undefined;
      if (!section || section === activeSection) return;
      void openSection(section);
    }, { signal });
  });

  window.addEventListener(LOCALE_EVENT, () => {
    if (detail) document.title = displayName();
    render();
  }, { signal });

  signal.addEventListener("abort", () => {
    followsPager.cancel();
    notificationsPager.cancel();
  }, { once: true });

  void requireAdmin().then((allowed) => {
    if (allowed) void load();
    else {
      loading = false;
      render();
    }
  });
});
