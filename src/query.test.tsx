/** @jest-environment jsdom */
import { cleanup, render, waitFor } from "@testing-library/react";

import { createSearchQuery } from "./resource";
import { resetQueries, store } from "./store";

afterEach(() => {
  cleanup();
  resetQueries("query-test");
});

test("uses the full search URL as the cache key", async () => {
  const execute = jest.fn(async (url: string) => ({
    page: url.split("=")[1],
  }));
  const useSearch = createSearchQuery("query-test", "users", execute);

  function Probe({ query }: { query: string }) {
    const { data } = useSearch(new URLSearchParams(query));

    return <output>{data?.page}</output>;
  }

  render(
    <>
      <Probe query="page=1" />
      <Probe query="page=2" />
    </>
  );

  await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
  await waitFor(() =>
    expect(store.getState().namespaces["query-test"].data).toEqual({
      "users?page=1": { page: "1" },
      "users?page=2": { page: "2" },
    })
  );
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
