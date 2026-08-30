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
