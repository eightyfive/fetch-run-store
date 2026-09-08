/** @jest-environment jsdom */
import { cleanup, render, waitFor } from "@testing-library/react";

import { createSearchQuery } from "./resource";
import { resetQueries } from "./store";

afterEach(() => {
  cleanup();
  resetQueries("query-test");
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
