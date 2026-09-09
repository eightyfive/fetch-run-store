/** @jest-environment jsdom */
import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";

import { createQuery } from "./query";
import { createListQuery, createReadQuery, createSearchQuery } from "./resource";
import { invalidateQueries, invalidateQuery, resetQueries, store } from "./store";

afterEach(() => {
  cleanup();
  resetQueries("query-test");
  resetQueries("other-query-test");
});

test.each(["targeted", "all", "reset"])(
  "%s invalidation restarts a pending initial fetch",
  async (kind) => {
    let resolveOld!: (value: { name: string }) => void;
    const old = new Promise<{ name: string }>((resolve) => {
      resolveOld = resolve;
    });
    const execute = jest
      .fn()
      .mockReturnValueOnce(old)
      .mockResolvedValue({ name: "new" });
    const useSearch = createSearchQuery<"users", { name: string }>(
      "query-test",
      "users",
      execute,
    );
    const { result } = renderHook(() =>
      useSearch(new URLSearchParams({ name: "alice" })),
    );
    await waitFor(() => expect(execute).toHaveBeenCalledTimes(1));
    act(() => {
      if (kind === "targeted") invalidateQuery("query-test", "users");
      else if (kind === "all") invalidateQueries("query-test");
      else resetQueries("query-test");
    });
    await waitFor(() => expect(result.current.data).toEqual({ name: "new" }));
    await act(async () => {
      resolveOld({ name: "old" });
      await old;
    });
    expect(result.current.data).toEqual({ name: "new" });
    expect(result.current.isFetching).toBe(false);
    expect(execute).toHaveBeenCalledTimes(2);
  },
);

test("a successful undefined response stays fresh across remounts", async () => {
  const execute = jest.fn(async () => undefined);
  const useSearch = createSearchQuery("query-test", "users", execute);
  const first = renderHook(() => useSearch());
  await waitFor(() => expect(first.result.current.isFetching).toBe(false));
  first.unmount();
  renderHook(() => useSearch());
  expect(execute).toHaveBeenCalledTimes(1);
});

test("captures automatic-fetch failures in query state", async () => {
  const useSearch = createSearchQuery("query-test", "users", async () => {
    throw new Error("offline");
  });

  function Probe() {
    const { error } = useSearch();

    return <output>{error?.message}</output>;
  }

  const { getByText } = render(<Probe />);
  await waitFor(() => expect(getByText("offline")).toBeTruthy());
});

test("keeps search results isolated by their full request URL", async () => {
  const useSearch = createSearchQuery("query-test", "users", async (url) => ({
    url,
  }));

  function Probe({ name }: { name: string }) {
    const { data } = useSearch(new URLSearchParams({ name }));

    return <output data-testid={name}>{data?.url}</output>;
  }

  const { getByTestId } = render(
    <>
      <Probe name="alice" />
      <Probe name="bob" />
    </>,
  );

  await waitFor(() => {
    expect(getByTestId("alice").textContent).toBe("users?name=alice");
    expect(getByTestId("bob").textContent).toBe("users?name=bob");
  });
});

test("normalizes empty search parameters to the route cache key", async () => {
  const execute = jest.fn(async (url: string) => ({ url }));
  const useSearch = createSearchQuery("query-test", "users", execute);

  function Probe({ searchParams }: { searchParams?: URLSearchParams }) {
    const { data } = useSearch(searchParams);

    return (
      <output data-testid={searchParams ? "explicit" : "default"}>
        {data?.url}
      </output>
    );
  }

  const { getByTestId } = render(
    <>
      <Probe />
      <Probe searchParams={new URLSearchParams()} />
    </>,
  );

  await waitFor(() => {
    expect(getByTestId("default").textContent).toBe("users");
    expect(getByTestId("explicit").textContent).toBe("users");
  });
  expect(execute).toHaveBeenCalledTimes(1);
});

test("builds parameterized search URLs before using them as cache keys", async () => {
  const useSearch = createSearchQuery(
    "query-test",
    "organizations/:organizationId/users",
    async (url) => ({ url }),
  );

  function Probe() {
    const { data } = useSearch(new URLSearchParams({ name: "Ada" }), {
      organizationId: "acme",
    });

    return <output>{data?.url}</output>;
  }

  const { getByText } = render(<Probe />);
  await waitFor(() =>
    expect(getByText("organizations/acme/users?name=Ada")).toBeTruthy(),
  );
});

test("setData uses the latest data and lets the in-flight server response win", async () => {
  let resolve!: (value: { count: number }) => void;
  const request = new Promise<{ count: number }>(res => { resolve = res; });
  const execute = jest.fn(() => request);
  const useQuery = createQuery("query-test", "users/:id", execute);
  const { result, rerender } = renderHook(() => useQuery({ id: "a/b" }));
  const setData = result.current.setData;
  const before = store.getState().namespaces["query-test"];
  const previousValues: ({ count: number } | undefined)[] = [];
  act(() => {
    setData(previous => {
      previousValues.push(previous);
      return { count: (previous?.count ?? 0) + 1 };
    });
    setData(previous => {
      previousValues.push(previous);
      return { count: (previous?.count ?? 0) + 1 };
    });
  });
  expect(previousValues).toEqual([undefined, { count: 1 }]);
  expect(result.current.data).toEqual({ count: 2 });
  const after = store.getState().namespaces["query-test"];
  expect(after.errors).toBe(before.errors);
  expect(after.fresh).toBe(before.fresh);
  expect(after.fetching).toBe(before.fetching);
  expect(after.revision).toBe(before.revision);
  rerender();
  expect(result.current.setData).toBe(setData);
  expect(execute).toHaveBeenCalledTimes(1);
  await act(async () => { resolve({ count: 10 }); await request; });
  expect(result.current.data).toEqual({ count: 10 });
  expect(result.current.isFetching).toBe(false);
});

test("setData preserves errors and stale state", async () => {
  const error = new Error("offline");
  const execute = jest.fn(async (): Promise<{ name: string }> => { throw error; });
  const useQuery = createQuery("query-test", "users", execute);
  const { result } = renderHook(() => useQuery());
  await waitFor(() => expect(result.current.error).toBe(error));
  const before = store.getState().namespaces["query-test"];
  act(() => result.current.setData({ name: "local" }));
  expect(result.current.data).toEqual({ name: "local" });
  expect(result.current.error).toBe(error);
  const after = store.getState().namespaces["query-test"];
  expect(after.fresh).toBe(before.fresh);
  expect(after.errors).toBe(before.errors);
  expect(after.fetching).toBe(before.fetching);
  expect(after.revision).toBe(before.revision);
  expect(execute).toHaveBeenCalledTimes(1);
});

test("setData follows exact search keys and parents without changing fresh sibling entries", async () => {
  const route = "organizations/:organizationId/users";
  const execute = jest.fn(async () => [{ name: "server" }]);
  const useSearch = createSearchQuery("query-test", route, execute);
  const useList = createListQuery("query-test", route, execute);
  const useOtherNamespace = createSearchQuery("other-query-test", route, execute);
  const { result, rerender } = renderHook(
    ({ organizationId, name }) => ({
      search: useSearch(new URLSearchParams({ name }), { organizationId }),
      list: useList({ organizationId: "a/b" }),
      other: useOtherNamespace(new URLSearchParams({ name: "Ada" }), { organizationId: "a/b" }),
    }),
    { initialProps: { organizationId: "a/b", name: "Ada" } },
  );
  await waitFor(() => expect(result.current.search.isFetching).toBe(false));
  const firstSetter = result.current.search.setData;
  act(() => firstSetter([{ name: "local" }]));
  expect(result.current.list.data).toEqual([{ name: "server" }]);
  expect(result.current.other.data).toEqual([{ name: "server" }]);
  expect(store.getState().namespaces["query-test"].fresh["organizations/a%2Fb/users?name=Ada"]).toBe(true);
  for (const props of [{ organizationId: "a/b", name: "Grace" }, { organizationId: "second", name: "Grace" }]) {
    rerender(props);
    await waitFor(() => expect(result.current.search.isFetching).toBe(false));
    expect(result.current.search.setData).not.toBe(firstSetter);
    act(() => result.current.search.setData([{ name: props.name }]));
  }
  const data = store.getState().namespaces["query-test"].data;
  expect(data["organizations/a%2Fb/users?name=Ada"]).toEqual([{ name: "local" }]);
  expect(data["organizations/a%2Fb/users?name=Grace"]).toEqual([{ name: "Grace" }]);
  expect(data["organizations/second/users?name=Grace"]).toEqual([{ name: "Grace" }]);
  act(() => firstSetter([{ name: "original key" }]));
  expect(result.current.search.data).toEqual([{ name: "Grace" }]);
  expect(store.getState().namespaces["query-test"].data["organizations/a%2Fb/users?name=Ada"]).toEqual([{ name: "original key" }]);
});

test("read setters follow encoded resource IDs and list setters share the empty-search key", async () => {
  const execute = async () => ({ name: "server" });
  const useRead = createReadQuery("query-test", "teams/:teamId/users", execute);
  const read = renderHook(({ id }) => useRead(id, { teamId: "a/b" }), { initialProps: { id: "1/2" } });
  await waitFor(() => expect(read.result.current.isFetching).toBe(false));
  act(() => read.result.current.setData({ name: "first" }));
  read.rerender({ id: "3?4" });
  await waitFor(() => expect(read.result.current.isFetching).toBe(false));
  act(() => read.result.current.setData({ name: "second" }));
  expect(store.getState().namespaces["query-test"].data["teams/a%2Fb/users/1%2F2"]).toEqual({ name: "first" });
  expect(store.getState().namespaces["query-test"].data["teams/a%2Fb/users/3%3F4"]).toEqual({ name: "second" });
  const useList = createListQuery("query-test", "users", async () => [] as { name: string }[]);
  const useSearch = createSearchQuery("query-test", "users", async () => [] as { name: string }[]);
  const queries = renderHook(() => ({ list: useList(), search: useSearch(new URLSearchParams()) }));
  await waitFor(() => expect(queries.result.current.list.isFetching).toBe(false));
  act(() => queries.result.current.list.setData([{ name: "local" }]));
  expect(queries.result.current.search.data).toEqual([{ name: "local" }]);
});
