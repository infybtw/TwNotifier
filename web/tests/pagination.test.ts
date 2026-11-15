import { beforeEach, describe, expect, test } from "bun:test";
import {
  clearCursorPagerStates,
  CursorPager,
  LocalPager,
  PAGE_SIZE,
  type CursorPage,
  type PageRequest,
} from "../src/lib/pagination";
import { t } from "../src/lib/i18n";

beforeEach(() => {
  clearCursorPagerStates();
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: Error) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function cursorPager(
  fetchPage: (request: PageRequest) => Promise<CursorPage<number>>,
  onChange: () => void = () => undefined,
) {
  return new CursorPager({ key: "test", fetchPage, onChange });
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
    expect(pager.page).toBe(1);
    expect(pager.hasNext).toBe(true);

    await pager.load(2);
    expect(pager.items).toEqual([6, 7]);
    expect(pager.page).toBe(2);
    expect(pager.hasNext).toBe(false);

    await pager.load(1);
    expect(pager.items).toEqual([1, 2, 3, 4, 5]);
    expect(requests.map((request) => request.cursor)).toEqual([undefined, "opaque-next", undefined]);
  });

  test("preserves the current page on a failed transition", async () => {
    const pager = cursorPager(async ({ cursor }) => {
      if (cursor) throw new Error("offline");
      return { items: [1], nextCursor: "next" };
    });

    await pager.load();
    await pager.load(2);

    expect(pager.items).toEqual([1]);
    expect(pager.page).toBe(1);
    expect(pager.state.error).toBe(t("common.error"));
    expect(pager.state.loading).toBe(false);
  });

  test("ignores stale requests after a filter reset", async () => {
    const oldPage = deferred<CursorPage<number>>();
    let calls = 0;
    const pager = cursorPager(async () =>
      ++calls === 1 ? oldPage.promise : { items: [99], nextCursor: null },
    );

    const first = pager.load();
    await pager.reset();
    oldPage.resolve({ items: [1], nextCursor: "stale" });
    await first;

    expect(pager.items).toEqual([99]);
    expect(pager.hasNext).toBe(false);
  });

  test("ignores late results after the page is cancelled", async () => {
    const request = deferred<CursorPage<number>>();
    const pager = cursorPager(() => request.promise);

    const pending = pager.load();
    pager.cancel();
    request.resolve({ items: [1], nextCursor: "late" });
    await pending;

    expect(pager.items).toEqual([]);
    expect(pager.state.error).toBeNull();
    expect(pager.state.loading).toBe(false);
  });

  test("requests the fixed page size on every page", async () => {
    const requests: PageRequest[] = [];
    const pager = cursorPager(async (request) => {
      requests.push(request);
      return request.cursor
        ? { items: [6, 7], nextCursor: null }
        : { items: [1, 2, 3, 4, 5], nextCursor: "opaque-next" };
    });

    await pager.load();
    await pager.load(2);

    expect(requests).toEqual([
      { cursor: undefined, limit: PAGE_SIZE },
      { cursor: "opaque-next", limit: PAGE_SIZE },
    ]);
  });

  test("recovers if the last page disappears after deletion", async () => {
    const pager = cursorPager(async ({ cursor }) => cursor
      ? { items: [], nextCursor: null }
      : { items: [1], nextCursor: "next" });

    await pager.load();
    await pager.load(2);

    expect(pager.page).toBe(1);
    expect(pager.items).toEqual([1]);
    expect(pager.state.loading).toBe(false);
  });

  test("restores the page when revisiting a list", async () => {
    const fetchPage = async ({ cursor }: PageRequest) => ({
      items: [cursor ? 2 : 1],
      nextCursor: cursor ? null : "next",
    });

    const first = cursorPager(fetchPage);
    await first.load();
    await first.load(2);
    first.cancel();

    const second = cursorPager(fetchPage);
    await second.load();

    expect(second.page).toBe(2);
    expect(second.items).toEqual([2]);
  });

  test("rejects navigation beyond known pages", async () => {
    let requests = 0;
    const pager = cursorPager(async () => {
      requests++;
      return { items: [], nextCursor: null };
    });

    await pager.load(0);
    await pager.load(3);

    expect(requests).toBe(0);
  });
});

describe("snapshot pagination", () => {
  test("slices records in fixed pages and clamps the page when data shrinks", () => {
    let items = Array.from({ length: 12 }, (_, index) => index + 1);
    let renders = 0;
    const pager = new LocalPager(() => items, () => {
      renders++;
    });

    expect(pager.totalPages).toBe(2);
    pager.goToPage(2);
    expect(pager.visibleItems).toEqual([11, 12]);

    items = [1, 2];
    pager.clamp();
    expect(pager.page).toBe(1);
    expect(pager.visibleItems).toEqual([1, 2]);
    expect(renders).toBe(2);
  });

  test("handles an empty snapshot", () => {
    const pager = new LocalPager<number>(() => [], () => undefined);
    pager.goToPage(100);
    expect(pager.page).toBe(1);
    expect(pager.totalPages).toBe(1);
    expect(pager.visibleItems).toEqual([]);
  });

  test("resets to the first page after a reload", () => {
    const items = Array.from({ length: 25 }, (_, index) => index + 1);
    const pager = new LocalPager(() => items, () => undefined);
    pager.goToPage(3);
    pager.reset();
    expect(pager.page).toBe(1);
    expect(pager.visibleItems).toHaveLength(PAGE_SIZE);
  });
});
