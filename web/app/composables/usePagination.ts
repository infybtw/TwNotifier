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

/** Keep opaque API cursors; replacing a page never appends to the collection. */
export function useCursorPagination<T>(
  key: string,
  fetchPage: (request: PageRequest) => Promise<CursorPage<T>>,
) {
  const state = useState<{
    items: T[];
    cursors: (string | null)[];
    page: number;
    pageSize: number;
    nextCursor: string | null;
  }>(`pagination:${key}`, () => ({ items: [], cursors: [null], page: 1, pageSize: 5, nextCursor: null }));
  const loading = ref(false);
  const error = ref<string | null>(null);
  const localizeError = useApiError();
  let requestId = 0;

  async function load(target = state.value.page): Promise<void> {
    if (!Number.isInteger(target) || target < 1 || target > state.value.cursors.length) return;
    const id = ++requestId;
    const cursor = state.value.cursors[target - 1] ?? undefined;
    const limit = state.value.pageSize;
    loading.value = true;
    error.value = null;
    try {
      const response = await fetchPage({ cursor, limit });
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

  async function setPageSize(size: number): Promise<void> {
    if (![5, 10, 20].includes(size) || loading.value) return;
    state.value.pageSize = size;
    await reset();
  }

  onScopeDispose(() => { requestId++; });

  return {
    items: computed(() => state.value.items),
    page: computed(() => state.value.page),
    pageSize: computed(() => state.value.pageSize),
    hasNext: computed(() => Boolean(state.value.nextCursor)),
    loading,
    error,
    load,
    reset,
    invalidate,
    setPageSize,
  };
}

/** Paginate endpoints which already return a bounded snapshot (online, recent logs). */
export function useLocalPagination<T>(items: Ref<T[]>, defaultSize = 5) {
  const page = ref(1);
  const pageSize = ref(defaultSize);
  const totalPages = computed(() => Math.max(1, Math.ceil(items.value.length / pageSize.value)));
  const visibleItems = computed(() => items.value.slice((page.value - 1) * pageSize.value, page.value * pageSize.value));

  function goToPage(target: number): void {
    page.value = Math.max(1, Math.min(totalPages.value, target));
  }

  function setPageSize(size: number): void {
    if (![5, 10, 20].includes(size)) return;
    pageSize.value = size;
    page.value = 1;
  }

  watch(totalPages, () => goToPage(page.value));

  return { page, pageSize, totalPages, visibleItems, goToPage, setPageSize };
}
