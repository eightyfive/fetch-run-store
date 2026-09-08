/** @jest-environment jsdom */
import { act, renderHook, waitFor } from "@testing-library/react";
import { Api } from "fetch-run";
import { createApiStore } from "./api";

test("separate Api instances at the same base URL share data and invalidation", async () => {
  const a = createApiStore(Api.create("https://shared.example.test"));
  const b = createApiStore(Api.create("https://shared.example.test"));
  let requestCount = 0;
  const execute = async () => ({ requestCount: ++requestCount });
  const useA = a.createQuery("health", execute);
  const useB = b.createQuery("health", execute);
  const first = renderHook(() => useA());
  const second = renderHook(() => useB());
  await waitFor(() => {
    expect(first.result.current.data).toEqual({ requestCount: 1 });
    expect(second.result.current.data).toEqual({ requestCount: 1 });
  });
  act(() => b.invalidateQuery("health"));
  await waitFor(() => {
    expect(first.result.current.data).toEqual({ requestCount: 2 });
    expect(second.result.current.data).toEqual({ requestCount: 2 });
  });
  first.unmount();
  second.unmount();
  a.resetQueries();
});
