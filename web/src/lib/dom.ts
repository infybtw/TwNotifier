import { t } from "./i18n";
import type { Platform } from "./types";

export interface ElementOptions {
  class?: string;
  text?: string;
  attrs?: Record<string, string | number | boolean | null | undefined>;
  children?: Array<Node | string | null | undefined>;
}

/** Creates an element and treats string children as text, never as markup. */
export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  options: ElementOptions = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (options.class) node.className = options.class;
  if (options.text !== undefined) node.textContent = options.text;

  for (const [key, value] of Object.entries(options.attrs ?? {})) {
    if (value === false || value === null || value === undefined) continue;
    node.setAttribute(key, value === true ? "" : String(value));
  }

  for (const child of options.children ?? []) {
    if (child === null || child === undefined) continue;
    node.append(child);
  }

  return node;
}

export function q<T extends Element = HTMLElement>(selector: string, root: ParentNode | null = document): T | null {
  return (root ?? document).querySelector<T>(selector);
}

export function qs<T extends Element = HTMLElement>(selector: string, root: ParentNode | null = document): T {
  const node = (root ?? document).querySelector<T>(selector);
  if (!node) throw new Error(`Missing element: ${selector}`);
  return node;
}

export function clear(node: Element): void {
  node.replaceChildren();
}

export function setHidden(node: Element | null, hidden: boolean): void {
  if (node instanceof HTMLElement) node.hidden = hidden;
}

export function avatar(url: string | null | undefined, name: string, size = 40): HTMLElement {
  const wrapper = h("span", {
    class: "relative inline-flex shrink-0 select-none items-center justify-center overflow-hidden rounded-full",
    attrs: { style: `width:${size}px;height:${size}px` },
  });
  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  const fallback = h("span", {
    class: "flex h-full w-full items-center justify-center text-sm font-semibold text-white",
    text: initial,
    attrs: { style: "background: linear-gradient(135deg, #7c3aed, #4c1d95)", "aria-hidden": "true" },
  });

  if (url) {
    const image = h("img", {
      class: "h-full w-full object-cover",
      attrs: { src: url, alt: name, loading: "lazy" },
    });
    image.addEventListener("error", () => image.replaceWith(fallback), { once: true });
    wrapper.append(image);
  } else {
    wrapper.append(fallback);
  }

  return wrapper;
}

export function platformBadge(platform: Platform): HTMLElement {
  return h("span", {
    class: "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium tg-secondary tg-text",
    children: [
      h("span", {
        class: platform === "twitch" ? "text-violet-400" : "text-green-400",
        text: "●",
        attrs: { "aria-hidden": "true" },
      }),
      t(`platform.${platform}`),
    ],
  });
}

export function statusBadge(status: "online" | "offline" | "unknown"): HTMLElement {
  return h("span", {
    class: `inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-xs font-medium ${
      status === "online" ? "bg-red-500/15 text-red-400" : "tg-secondary tg-hint"
    }`,
    children: [
      h("span", {
        text: status === "online" ? "🔴" : status === "offline" ? "⚪" : "❔",
        attrs: { "aria-hidden": "true" },
      }),
      t(`status.${status}`),
    ],
  });
}

export function streamPreview(url: string | null | undefined, alt: string): HTMLElement | null {
  if (!url) return null;
  const image = h("img", {
    class: "aspect-video w-full rounded-xl object-cover tg-secondary",
    attrs: { src: url, alt, loading: "lazy" },
  });
  image.addEventListener("error", () => image.remove(), { once: true });
  return image;
}
