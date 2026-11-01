import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { effectScope, nextTick, ref, type EffectScope, type Ref } from "vue";
import { useCursorPagination, useLocalPagination, type CursorPage, type PageRequest } from "../app/composables/usePagination";

const states = new Map<string, Ref>();
const scopes: EffectScope[] = [];
const globals = globalThis as unknown as {
  useState: <T>(key: string, init: () => T) => Ref<T>;
  useLocale: () => { t: (key: string) => string };
};
const previousState = globals.useState;
const previousLocale = globals.useLocale;

beforeEach(() => {
  states.clear();
  globals.useState = <T>(key: string, init: () => T): Ref<T> => {
    if (!states.has(key)) states.set(key, ref(init()));
    return states.get(key) as Ref<T>;
  };
  globals.useLocale = () => ({ t: (key: string) => key });
});

afterEach(() => {
  scopes.splice(0).forEach((scope) => scope.stop());
  globals.useState = previousState;
  globals.useLocale = previousLocale;
});

function cursorPager(fetchPage: (request: PageRequest) => Promise<CursorPage<number>>) {
  const scope = effectScope();
  scopes.push(scope);
  return scope.run(() => useCursorPagination("test", fetchPage))!;
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, resolve, reject };
}

describe("cursor pagination", () => {
  test("replaces rows and navigates backward using opaque cursors", async () => {
    const requests: PageRequest[] = [];
    const pager = cursorPager(async (request) => {
      requests.push(request);
      return request.cursor
        ? { items: [6, 7], nextCursor: null }
        : { items: [1, 2, 3, 4, 5], nextCursor: "opaque-next" };
    });
    await pager.load();
    expect(pager.page.value).toBe(1);
    expect(pager.hasNext.value).toBe(true);
    await pager.load(2);
    expect(pager.items.value).toEqual([6, 7]);
    expect(pager.page.value).toBe(2);
    expect(pager.hasNext.value).toBe(false);
    await pager.load(1);
    expect(pager.items.value).toEqual([1, 2, 3, 4, 5]);
    expect(requests.map((request) => request.cursor)).toEqual([undefined, "opaque-next", undefined]);
  });

  test("preserves the current page on a failed transition", async () => {
    const pager = cursorPager(async ({ cursor }) => {
      if (cursor) throw new Error("offline");
      return { items: [1], nextCursor: "next" };
    });
    await pager.load();
    await pager.load(2);
    expect(pager.items.value).toEqual([1]);
    expect(pager.page.value).toBe(1);
    expect(pager.error.value).toBe("common.error");
    expect(pager.loading.value).toBe(false);
  });

  test("ignores stale requests after a filter reset", async () => {
    const oldPage = deferred<CursorPage<number>>();
    let calls = 0;
    const pager = cursorPager(async () => ++calls === 1 ? oldPage.promise : { items: [99], nextCursor: null });
    const first = pager.load();
    await pager.reset();
    oldPage.resolve({ items: [1], nextCursor: "stale" });
    await first;
    expect(pager.items.value).toEqual([99]);
    expect(pager.hasNext.value).toBe(false);
  });

  test("ignores stale errors and results after disposal", async () => {
    const request = deferred<CursorPage<number>>();
    const pager = cursorPager(() => request.promise);
    const pending = pager.load();
    scopes[0]!.stop();
    request.reject(new Error("late failure"));
    await pending;
    expect(pager.error.value).toBeNull();
    expect(pager.items.value).toEqual([]);
  });

  test("changing page size resets cursors and requests the new limit", async () => {
    const requests: PageRequest[] = [];
    const pager = cursorPager(async (request) => {
      requests.push(request);
      return { items: [1], nextCursor: "next" };
    });
    await pager.load();
    await pager.load(2);
    await pager.setPageSize(10);
    expect(pager.page.value).toBe(1);
    expect(requests.at(-1)).toEqual({ cursor: undefined, limit: 10 });
    await pager.setPageSize(999);
    expect(pager.pageSize.value).toBe(10);
  });

  test("recovers if the last page disappears after deletion", async () => {
    const pager = cursorPager(async ({ cursor }) => cursor
      ? { items: [], nextCursor: null }
      : { items: [1], nextCursor: "next" });
    await pager.load();
    await pager.load(2);
    expect(pager.page.value).toBe(1);
    expect(pager.items.value).toEqual([1]);
    expect(pager.loading.value).toBe(false);
  });

  test("restores the page and size when revisiting a list", async () => {
    const fetchPage = async ({ cursor }: PageRequest) => ({ items: [cursor ? 2 : 1], nextCursor: cursor ? null : "next" });
    const first = cursorPager(fetchPage);
    await first.setPageSize(10);
    await first.load(2);
    scopes[0]!.stop();
    const second = cursorPager(fetchPage);
    await second.load();
    expect(second.page.value).toBe(2);
    expect(second.pageSize.value).toBe(10);
    expect(second.items.value).toEqual([2]);
  });

  test("rejects navigation beyond known pages", async () => {
    let requests = 0;
    const pager = cursorPager(async () => { requests++; return { items: [], nextCursor: null }; });
    await pager.load(0);
    await pager.load(3);
    expect(requests).toBe(0);
  });
});

describe("snapshot pagination", () => {
  test("slices records and clamps the page when data shrinks", async () => {
    const items = ref(Array.from({ length: 12 }, (_, index) => index + 1));
    const scope = effectScope();
    scopes.push(scope);
    const pager = scope.run(() => useLocalPagination(items))!;
    expect(pager.totalPages.value).toBe(3);
    pager.goToPage(3);
    expect(pager.visibleItems.value).toEqual([11, 12]);
    items.value = [1, 2];
    await nextTick();
    expect(pager.page.value).toBe(1);
    expect(pager.visibleItems.value).toEqual([1, 2]);
  });

  test("handles an empty snapshot and resets after resizing", () => {
    const scope = effectScope();
    scopes.push(scope);
    const pager = scope.run(() => useLocalPagination(ref<number[]>([])))!;
    pager.goToPage(100);
    expect(pager.page.value).toBe(1);
    expect(pager.totalPages.value).toBe(1);
    expect(pager.visibleItems.value).toEqual([]);
    pager.setPageSize(20);
    expect(pager.pageSize.value).toBe(20);
  });
});
