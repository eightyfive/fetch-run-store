/** @jest-environment jsdom */
import {
  act,
  cleanup,
  render,
  renderHook,
  waitFor,
} from "@testing-library/react";

import { createSearchQuery } from "./resource";
import { invalidateQueries, invalidateQuery, resetQueries } from "./store";

afterEach(() => {
  cleanup();
  resetQueries("query-test");
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
