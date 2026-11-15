import { qs } from "./dom";
import { t } from "./i18n";

export interface PagerView {
  page: number;
  totalPages?: number;
  hasNext: boolean;
  loading?: boolean;
}

/**
 * Binds the shared in-flow pager. Labels come from `data-i18n` attributes;
 * only the status text and disabled states change per page.
 */
export class Pager {
  private readonly root: HTMLElement;
  private readonly status: HTMLElement;
  private readonly previous: HTMLButtonElement;
  private readonly next: HTMLButtonElement;
  private view: PagerView = { page: 1, hasNext: false };
  private lastPage = 0;

  constructor(
    root: HTMLElement,
    private readonly onChange: (page: number) => void,
  ) {
    this.root = root;
    this.status = qs<HTMLElement>("[data-pager-status]", root);
    this.previous = qs<HTMLButtonElement>("[data-pager-prev]", root);
    this.next = qs<HTMLButtonElement>("[data-pager-next]", root);

    this.previous.addEventListener("click", () => {
      if (!this.view.loading && this.view.page > 1) this.onChange(this.view.page - 1);
    });
    this.next.addEventListener("click", () => {
      if (!this.view.loading && this.view.hasNext) this.onChange(this.view.page + 1);
    });
  }

  update(view: PagerView): void {
    const pageChanged = this.lastPage !== 0 && this.lastPage !== view.page;
    this.view = view;
    this.lastPage = view.page;

    this.status.textContent = view.totalPages
      ? t("pagination.page_of", { page: view.page, total: view.totalPages })
      : t("pagination.page", { page: view.page });
    this.previous.disabled = Boolean(view.loading) || view.page <= 1;
    this.next.disabled = Boolean(view.loading) || !view.hasNext;
    this.root.setAttribute("aria-busy", String(Boolean(view.loading)));

    if (pageChanged) {
      // Keep keyboard focus on the pager but bring the new page into view.
      this.root.closest("[data-paginated]")?.scrollIntoView({ block: "start", behavior: "instant" });
    }
  }
}

export function pagerRoot(selector: string, root: ParentNode = document): HTMLElement {
  return qs<HTMLElement>(selector, root);
}
