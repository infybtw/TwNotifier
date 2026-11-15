import { t } from "./i18n";
import { clear, h } from "./dom";

export function loadingState(message?: string): HTMLElement {
  return h("div", {
    class: "flex flex-col items-center gap-3 py-10 text-center tg-hint",
    children: [
      h("span", { class: "text-3xl", text: "⏳", attrs: { "aria-hidden": "true" } }),
      h("p", { text: message ?? t("common.loading") }),
    ],
  });
}

export function errorState(message?: string, retry?: () => void): HTMLElement {
  const children: Array<Node | string> = [
    h("span", { class: "text-3xl", text: "⚠️", attrs: { "aria-hidden": "true" } }),
    h("p", { class: "tg-hint", text: message ?? t("common.error") }),
  ];
  if (retry) {
    const button = h("button", {
      class: "rounded-lg px-4 py-2 text-sm font-medium tg-button",
      text: t("common.retry"),
      attrs: { type: "button" },
    });
    button.addEventListener("click", () => retry());
    children.push(button);
  }
  return h("div", {
    class: "flex flex-col items-center gap-3 py-10 text-center",
    children,
  });
}

export function emptyState(
  message?: string,
  action?: { label: string; href: string },
): HTMLElement {
  const children: Array<Node | string> = [
    h("span", { class: "text-3xl", text: "📭", attrs: { "aria-hidden": "true" } }),
    h("p", { class: "tg-hint", text: message ?? t("common.empty") }),
  ];
  if (action) {
    children.push(h("a", {
      class: "rounded-lg px-4 py-2 text-sm font-medium tg-button",
      text: action.label,
      attrs: { href: action.href },
    }));
  }
  return h("div", {
    class: "flex flex-col items-center gap-3 py-10 text-center",
    children,
  });
}

export interface CollectionOptions<T> {
  items: T[];
  loading?: boolean;
  loadingMessage?: string;
  error?: string | null;
  emptyMessage?: string;
  emptyAction?: { label: string; href: string };
  retry?: () => void;
  renderItem: (item: T) => Node;
  listClass?: string;
  /** Inline errors match list screens that keep rows visible; default is a retry block. */
  errorStyle?: "block" | "inline";
}

/**
 * Renders the shared loading / empty / error / list states into a container.
 * Loading replaces the collection, matching the original page behavior;
 * an error keeps the current rows visible and adds a retry block below.
 */
export function renderCollection<T>(container: Element, options: CollectionOptions<T>): void {
  clear(container);

  if (options.loading) {
    container.append(loadingState(options.loadingMessage));
    return;
  }

  if (options.error && options.items.length === 0) {
    container.append(errorState(options.error, options.retry));
    return;
  }

  if (options.items.length === 0) {
    container.append(emptyState(options.emptyMessage, options.emptyAction));
    return;
  }

  const list = h("ul", { class: options.listClass ?? "flex flex-col gap-2" });
  for (const item of options.items) {
    list.append(h("li", { children: [options.renderItem(item)] }));
  }
  container.append(list);

  if (options.error) {
    if (options.errorStyle === "inline") {
      container.append(h("p", { class: "text-sm tg-destructive", text: options.error }));
    } else {
      container.append(errorState(options.error, options.retry));
    }
  }
}

export function notice(text: string, options: { destructive?: boolean } = {}): HTMLElement {
  return h("p", {
    class: options.destructive
      ? "rounded-2xl px-4 py-3 text-sm tg-card tg-destructive"
      : "rounded-2xl px-4 py-3 text-sm tg-card tg-text",
    text,
  });
}
