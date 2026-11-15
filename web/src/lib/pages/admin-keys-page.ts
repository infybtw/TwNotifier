import { localizeApiError } from "../api";
import {
  adminCreateKey,
  adminKeys,
  adminRevokeKey,
  formatAdminDate,
  loadAdminSettings,
  requireAdmin,
  type AdminKeyItem,
} from "../admin";
import { confirmAction } from "../dialog";
import { clear, h, q, qs, setHidden } from "../dom";
import { LOCALE_EVENT, t } from "../i18n";
import { onPage, pageSignal } from "../page";
import { LocalPager } from "../pagination";
import { Pager } from "../pager";
import { errorState, renderCollection } from "../ui";

function issuerName(key: AdminKeyItem): string {
  return key.issuedByName || key.issuedByUsername || key.issuedBy;
}

onPage(() => {
  const root = q<HTMLElement>("#page-admin-keys");
  if (!root || root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const signal = pageSignal();
  const createButton = qs<HTMLButtonElement>("[data-keys-create]", root);
  const noticeLine = qs<HTMLElement>("[data-keys-notice]", root);
  const list = qs<HTMLElement>("[data-keys-list]", root);
  const pagerRoot = qs<HTMLElement>("[data-pager]", root);

  let items: AdminKeyItem[] = [];
  let loading = true;
  let busy = false;
  let error: string | null = null;
  let notice: string | null = null;

  const pager = new LocalPager<AdminKeyItem>(() => items, render);
  const view = new Pager(pagerRoot, (page) => pager.goToPage(page));

  function keyRow(key: AdminKeyItem): HTMLElement {
    const copy = h("button", {
      class: "min-w-0 truncate text-left font-mono text-sm font-medium tg-link",
      text: `${key.key.slice(0, 8)}…`,
      attrs: { type: "button", "aria-label": t("admin.keys.copy") },
    });
    copy.addEventListener("click", () => void copyKey(key.key));

    const card = h("div", {
      class: "flex flex-col gap-2 rounded-2xl px-4 py-3 tg-card",
      children: [
        h("div", {
          class: "flex items-center justify-between gap-2",
          children: [
            copy,
            h("span", {
              class: `shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                key.used ? "tg-secondary tg-hint" : "bg-green-500/15 text-green-400"
              }`,
              text: key.used ? t("admin.keys.used") : t("admin.keys.unused"),
            }),
          ],
        }),
        h("p", {
          class: "text-xs tg-hint",
          text: `${t("admin.keys.issued_by", { name: issuerName(key) })} · ${formatAdminDate(key.issueDate)}`
            + (key.used && key.usedDate ? ` · ${t("admin.keys.used_at")} ${formatAdminDate(key.usedDate)}` : ""),
        }),
      ],
    });

    if (!key.used) {
      const revoke = h("button", {
        class: "self-start rounded-lg px-3 py-1.5 text-xs font-semibold tg-secondary tg-destructive",
        text: t("admin.keys.revoke"),
        attrs: { type: "button" },
      });
      revoke.addEventListener("click", () => void revokeKey(key));
      card.append(revoke);
    }

    return card;
  }

  function render(): void {
    noticeLine.hidden = !notice;
    noticeLine.textContent = notice ?? "";
    createButton.disabled = busy;

    if (error && items.length === 0) {
      clear(list);
      list.append(errorState(error, () => void load()));
    } else {
      renderCollection(list, {
        errorStyle: "inline",
        items: pager.visibleItems,
        loading,
        error,
        emptyMessage: t("admin.empty"),
        retry: () => void load(),
        renderItem: keyRow,
      });
    }

    setHidden(pagerRoot, !items.length);
    view.update({
      page: pager.page,
      totalPages: pager.totalPages,
      hasNext: pager.hasNext,
      loading: loading || busy,
    });
  }

  async function load(): Promise<void> {
    loading = true;
    error = null;
    render();
    try {
      await loadAdminSettings();
      const response = await adminKeys();
      items = response.items;
      pager.clamp();
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      loading = false;
      render();
    }
  }

  async function create(): Promise<void> {
    if (busy) return;
    busy = true;
    error = null;
    render();
    try {
      await adminCreateKey();
      notice = t("admin.keys.created");
      await load();
      pager.goToPage(1);
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      busy = false;
      render();
    }
  }

  async function revokeKey(key: AdminKeyItem): Promise<void> {
    if (busy) return;
    const confirmed = await confirmAction({
      destructive: true,
      message: t("admin.keys.revoke_confirm"),
    });
    if (!confirmed) return;

    busy = true;
    error = null;
    render();
    try {
      await adminRevokeKey(key.id);
      await load();
    } catch (err) {
      error = localizeApiError(err);
    } finally {
      busy = false;
      render();
    }
  }

  async function copyKey(key: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(key);
      notice = t("admin.keys.copied");
    } catch {
      notice = null;
    }
    render();
  }

  createButton.addEventListener("click", () => void create(), { signal });
  window.addEventListener(LOCALE_EVENT, render, { signal });

  render();
  void requireAdmin().then((allowed) => {
    if (allowed) void load();
  });
});
