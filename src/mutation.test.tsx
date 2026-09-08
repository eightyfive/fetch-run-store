/** @jest-environment jsdom */
import { act, render, renderHook } from "@testing-library/react";

import { Api } from "fetch-run";
import { createApiStore } from "./api";
import { executeQuery, store } from "./store";

import { createMutation } from "./mutation";

test("normalizes non-Error rejections in state and the returned promise", async () => {
  const useMutation = createMutation<"users", void, void>("users", async () => {
    throw "offline";
  });
  const { result } = renderHook(() => useMutation());
  await act(async () => {
    await expect(result.current[0]()).rejects.toThrow("offline");
  });
  expect(result.current[2]).toBeInstanceOf(Error);
  expect(result.current[2]?.message).toBe("offline");
  expect(result.current[1]).toBe(false);
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });

  return { promise, resolve };
}

test("keeps loading true until every overlapping mutation settles", async () => {
  const first = deferred<{ id: number }>();
  const second = deferred<{ id: number }>();
  const execute = jest
    .fn<Promise<{ id: number }>, [string, { name: string }]>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const useMutation = createMutation<"users", { name: string }, { id: number }>(
    "users",
    execute,
  );
  let result!: ReturnType<typeof useMutation>;

  function Probe() {
    result = useMutation();

    return <output>{String(result[1])}</output>;
  }

  render(<Probe />);
  let firstCall!: Promise<{ id: number }>;
  let secondCall!: Promise<{ id: number }>;

  act(() => {
    firstCall = result[0]({ name: "Ada" });
    secondCall = result[0]({ name: "Grace" });
  });
  expect(result[1]).toBe(true);

  await act(async () => {
    first.resolve({ id: 1 });
    await firstCall;
  });
  expect(result[1]).toBe(true);

  await act(async () => {
    second.resolve({ id: 2 });
    await secondCall;
  });
  expect(result[1]).toBe(false);
});

test.each(["create", "update"] as const)(
  "%s setData updates only the resource and lets a pending read replace it",
  async (method) => {
    const baseUrl = `https://${method}-optimistic.example.test`;
    const api = Api.create(baseUrl);
    const apiStore = createApiStore(api);
    type User = { id: string; name: string };
    const request = deferred<User>();
    const get = jest.spyOn(api, "get").mockReturnValue(request.promise);
    const resource = apiStore.route("organizations/:organizationId/users");
    const useRead = resource.read<User>();
    const useMutation = resource[method]<{ name: string }, User>();
    const params = { organizationId: "a/b" };
    const key = "organizations/a%2Fb/users/42%2F1";
    await executeQuery(baseUrl, "organizations/a%2Fb/users", async () => []);
    await executeQuery(baseUrl, `${key}?details=1`, async () => ({ name: "variant" }));
    const read = renderHook(() => useRead("42/1", params));
    const mutation = renderHook(() => useMutation(params));
    const setData = mutation.result.current[3];

    act(() => setData({ id: "42/1", name: "optimistic" }));
    expect(read.result.current.data).toEqual({ id: "42/1", name: "optimistic" });
    expect(read.result.current.isFetching).toBe(true);
    expect(mutation.result.current[1]).toBe(false);
    expect(store.getState().namespaces[baseUrl].data["organizations/a%2Fb/users"]).toEqual([]);
    expect(store.getState().namespaces[baseUrl].data[`${key}?details=1`]).toEqual({ name: "variant" });
    mutation.rerender();
    expect(mutation.result.current[3]).toBe(setData);
    expect(get).toHaveBeenCalledTimes(1);

    await act(async () => {
      request.resolve({ id: "42/1", name: "server" });
      await request.promise;
    });
    expect(read.result.current.data).toEqual({ id: "42/1", name: "server" });
    expect(read.result.current.isFetching).toBe(false);
    read.unmount();
    mutation.unmount();
    apiStore.resetQueries();
  },
);

test("setData follows parent route parameters and preserves existing errors", async () => {
  const baseUrl = "https://parent-optimistic.example.test";
  const apiStore = createApiStore(Api.create(baseUrl));
  const useCreate = apiStore.route("organizations/:organizationId/users")
    .create<{ name: string }, { id: number; name: string }>();
  const { result, rerender, unmount } = renderHook(
    ({ organizationId }) => useCreate({ organizationId }),
    { initialProps: { organizationId: "first" } },
  );
  act(() => result.current[3]({ id: 1, name: "first" }));
  rerender({ organizationId: "second" });
  const error = new Error("offline");
  await expect(executeQuery(baseUrl, "organizations/second/users/1", async () => {
    throw error;
  })).rejects.toBe(error);
  act(() => result.current[3]({ id: 1, name: "second" }));
  const state = store.getState().namespaces[baseUrl];
  expect(state.data["organizations/first/users/1"]).toEqual({ id: 1, name: "first" });
  expect(state.data["organizations/second/users/1"]).toEqual({ id: 1, name: "second" });
  expect(state.errors["organizations/second/users/1"]).toBe(error);
  expect(state.fresh["organizations/second/users/1"]).toBeUndefined();
  unmount();
  apiStore.resetQueries();
});
