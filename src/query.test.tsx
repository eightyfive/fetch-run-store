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
    </>
  );

  await waitFor(() => {
    expect(getByTestId("alice").textContent).toBe("users?name=alice");
    expect(getByTestId("bob").textContent).toBe("users?name=bob");
  });
});
