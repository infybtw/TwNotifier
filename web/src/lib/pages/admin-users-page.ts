import {
  adminUsers,
  formatAdminDate,
  loadAdminSettings,
  requireAdmin,
  type AdminUser,
} from "../admin";
import { h, q, qs, setHidden } from "../dom";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";
import { CursorPager } from "../pagination";
import { Pager } from "../pager";
import { renderCollection } from "../ui";

let search = "";

function displayName(user: AdminUser): string {
  return user.firstName || user.username || user.id;
}

function userRow(user: AdminUser): HTMLElement {
  const badges = h("span", { class: "flex flex-col items-end gap-1" });
  if (user.isAdmin) {
    badges.append(h("span", {
      class: "rounded-full px-2 py-0.5 text-xs font-medium tg-secondary tg-link",
      text: t("admin.users.admin_badge"),
    }));
  }
  if (user.isBotBlocked) {
    badges.append(h("span", {
      class: "rounded-full bg-red-500/15 px-2 py-0.5 text-xs font-medium text-red-400",
      text: t("admin.users.blocked_badge"),
    }));
  }

  return h("a", {
    class: "flex items-center justify-between gap-3 rounded-2xl px-4 py-3 tg-card",
    attrs: { href: `/admin/users/${encodeURIComponent(user.id)}` },
    children: [
      h("span", {
        class: "flex min-w-0 flex-col gap-1",
        children: [
          h("span", {
            class: "truncate text-sm font-semibold tg-text",
            children: [
              displayName(user),
              user.username ? h("span", { class: "font-normal tg-hint", text: ` @${user.username}` }) : null,
            ],
          }),
          h("span", {
            class: "flex flex-wrap items-center gap-1.5 text-xs tg-hint",
            children: [
              h("span", { text: `ID ${user.id}` }),
              h("span", { text: `· ${t("admin.users.follows", { count: user.follows })}` }),
              h("span", { text: `· ${formatAdminDate(user.created)}` }),
            ],
          }),
        ],
      }),
      h("span", {
        class: "flex shrink-0 items-center gap-2",
        children: [
          badges,
          h("span", { class: "text-lg tg-hint", text: "›", attrs: { "aria-hidden": "true" } }),
        ],
      }),
    ],
  });
}

onPage(() => {
  const root = q<HTMLElement>("#page-admin-users");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const input = qs<HTMLInputElement>("[data-users-search]", root);
  const list = qs<HTMLElement>("[data-users-list]", root);
  const pagerRoot = qs<HTMLElement>("[data-pager]", root);

  const pager = new CursorPager<AdminUser>({
    key: "admin-users",
    fetchPage: async (request) => {
      await loadAdminSettings();
      return adminUsers({ ...request, search: search || undefined });
    },
    onChange: render,
  });
  const view = new Pager(pagerRoot, (page) => void pager.load(page));

  let debouncing = false;
  let searchTimer: ReturnType<typeof setTimeout> | undefined;

  function render(): void {
    const loading = pager.state.loading || debouncing;
    renderCollection(list, {
      errorStyle: "inline",
      items: pager.items,
      loading,
      error: pager.state.error,
      emptyMessage: t("admin.empty"),
      retry: () => void pager.reload(),
      renderItem: userRow,
    });

    setHidden(pagerRoot, !(pager.items.length || pager.page > 1 || loading));
    view.update({ page: pager.page, hasNext: pager.hasNext, loading });
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

  window.addEventListener(LOCALE_EVENT, render, { signal });
  signal.addEventListener("abort", () => {
    if (searchTimer) clearTimeout(searchTimer);
    pager.cancel();
  }, { once: true });

  input.value = search;
  render();

  void requireAdmin().then((allowed) => {
    if (allowed) void pager.reload();
  });
});
