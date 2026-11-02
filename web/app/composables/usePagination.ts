import { computed, onScopeDispose, ref, watch, type Ref } from "vue";
import { useApiError } from "./useApi";

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

/** Keep opaque API cursors; replacing a page never appends to the collection. */
export function useCursorPagination<T>(
  key: string,
  fetchPage: (request: PageRequest) => Promise<CursorPage<T>>,
) {
  const state = useState<{
    items: T[];
    cursors: (string | null)[];
    page: number;
    nextCursor: string | null;
  }>(`pagination:${key}`, () => ({ items: [], cursors: [null], page: 1, nextCursor: null }));
  const loading = ref(false);
  const error = ref<string | null>(null);
  const localizeError = useApiError();
  let requestId = 0;

  async function load(target = state.value.page): Promise<void> {
    if (!Number.isInteger(target) || target < 1 || target > state.value.cursors.length) return;
    const id = ++requestId;
    const cursor = state.value.cursors[target - 1] ?? undefined;
    loading.value = true;
    error.value = null;
    try {
      const response = await fetchPage({ cursor, limit: PAGE_SIZE });
      if (id !== requestId) return;
      // Data can shrink between visits. Never strand the user on an empty last page.
      if (response.items.length === 0 && target > 1) {
        state.value.cursors = state.value.cursors.slice(0, target - 1);
        await load(target - 1);
        return;
      }
      state.value.items = response.items;
      state.value.page = target;
      state.value.nextCursor = response.nextCursor;
      state.value.cursors = state.value.cursors.slice(0, target);
      if (response.nextCursor) state.value.cursors.push(response.nextCursor);
    } catch (err) {
      if (id === requestId) error.value = localizeError(err);
    } finally {
      if (id === requestId) loading.value = false;
    }
  }

  function invalidate(): void {
    requestId++;
    state.value.items = [];
    state.value.cursors = [null];
    state.value.page = 1;
    state.value.nextCursor = null;
    error.value = null;
    loading.value = false;
  }

  async function reset(): Promise<void> {
    invalidate();
    await load(1);
  }

  onScopeDispose(() => { requestId++; });

  return {
    items: computed(() => state.value.items),
    page: computed(() => state.value.page),
    hasNext: computed(() => Boolean(state.value.nextCursor)),
    loading,
    error,
    load,
    reset,
    invalidate,
  };
}

/** Paginate endpoints which already return a bounded snapshot (online, recent logs). */
export function useLocalPagination<T>(items: Ref<T[]>) {
  const page = ref(1);
  const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / PAGE_SIZE)));
  const visibleItems = computed(() => items.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE));

  function goToPage(target: number): void {
    page.value = Math.max(1, Math.min(totalPages.value, target));
  }

  watch(totalPages, () => goToPage(page.value));

  return { page, totalPages, visibleItems, goToPage };
}
