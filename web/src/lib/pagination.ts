import { localizeApiError } from "./api";

export interface CursorPage<T> {
  items: T[];
  nextCursor: string | null;
}

export interface PageRequest {
  cursor?: string;
  limit: number;
}

/** Fixed page size for every paginated list. */
export const PAGE_SIZE = 10;

export interface CursorPagerState<T> {
  items: T[];
  cursors: (string | null)[];
  page: number;
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
}

interface PersistedState<T> {
  items: T[];
  cursors: (string | null)[];
  page: number;
  nextCursor: string | null;
}

const cursorStates = new Map<string, PersistedState<unknown>>();

export interface CursorPagerOptions<T> {
  key: string;
  fetchPage: (request: PageRequest) => Promise<CursorPage<T>>;
  onChange: () => void;
}

/**
 * Cursor-backed bounded pages. The page position and opaque cursors survive
 * route revisits in app state; replacing a page never appends rows.
 */
export class CursorPager<T> {
  readonly state: CursorPagerState<T>;
  private requestId = 0;

  constructor(private readonly options: CursorPagerOptions<T>) {
    const saved = cursorStates.get(options.key) as PersistedState<T> | undefined;
    this.state = saved
      ? { ...saved, cursors: [...saved.cursors], loading: false, error: null }
      : { items: [], cursors: [null], page: 1, nextCursor: null, loading: false, error: null };
  }

  get items(): T[] {
    return this.state.items;
  }

  get page(): number {
    return this.state.page;
  }

  get hasNext(): boolean {
    return Boolean(this.state.nextCursor);
  }

  async load(target: number = this.state.page): Promise<void> {
    if (!Number.isInteger(target) || target < 1 || target > this.state.cursors.length) return;

    const id = ++this.requestId;
    const cursor = this.state.cursors[target - 1] ?? undefined;
    this.state.loading = true;
    this.state.error = null;
    this.options.onChange();

    try {
      const response = await this.options.fetchPage({ cursor, limit: PAGE_SIZE });
      if (id !== this.requestId) return;

      // Data can shrink between visits. Never strand the user on an empty last page.
      if (response.items.length === 0 && target > 1) {
        this.state.cursors = this.state.cursors.slice(0, target - 1);
        await this.load(target - 1);
        return;
      }

      this.state.items = response.items;
      this.state.page = target;
      this.state.nextCursor = response.nextCursor;
      this.state.cursors = this.state.cursors.slice(0, target);
      if (response.nextCursor) this.state.cursors.push(response.nextCursor);
      this.persist();
    } catch (error) {
      if (id === this.requestId) this.state.error = localizeApiError(error);
    } finally {
      if (id === this.requestId) {
        this.state.loading = false;
        this.options.onChange();
      }
    }
  }

  invalidate(): void {
    this.requestId++;
    this.state.items = [];
    this.state.cursors = [null];
    this.state.page = 1;
    this.state.nextCursor = null;
    this.state.loading = false;
    this.state.error = null;
    this.persist();
    this.options.onChange();
  }

  async reset(): Promise<void> {
    this.invalidate();
    await this.load(1);
  }

  async reload(): Promise<void> {
    await this.load(this.state.page);
  }

  /** Drops in-flight responses without clearing the remembered page. */
  cancel(): void {
    this.requestId++;
    this.state.loading = false;
  }

  private persist(): void {
    cursorStates.set(this.options.key, {
      items: this.state.items,
      cursors: [...this.state.cursors],
      page: this.state.page,
      nextCursor: this.state.nextCursor,
    });
  }
}

/** Paginate endpoints which already return a bounded snapshot (online, recent logs). */
export class LocalPager<T> {
  page = 1;

  constructor(
    private readonly getItems: () => T[],
    private readonly onChange: () => void,
  ) {}

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.getItems().length / PAGE_SIZE));
  }

  get visibleItems(): T[] {
    return this.getItems().slice((this.page - 1) * PAGE_SIZE, this.page * PAGE_SIZE);
  }

  get hasNext(): boolean {
    return this.page < this.totalPages;
  }

  goToPage(target: number): void {
    const next = Math.max(1, Math.min(this.totalPages, target));
    if (next === this.page) return;
    this.page = next;
    this.onChange();
  }

  reset(): void {
    if (this.page === 1) return;
    this.page = 1;
    this.onChange();
  }

  /** Keeps the current page inside the available range when data shrinks. */
  clamp(): void {
    const next = Math.max(1, Math.min(this.totalPages, this.page));
    if (next === this.page) return;
    this.page = next;
    this.onChange();
  }
}

/** Test helper: forget remembered cursor positions. */
export function clearCursorPagerStates(): void {
  cursorStates.clear();
}
