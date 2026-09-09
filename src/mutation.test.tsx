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
    const useCreate = resource.create<{ name: string }, User>();
    const useUpdate = resource.update<{ name: string }, User>();
    const useMutation = method === "create"
      ? () => {
          const [mutate, pending, error, setData] = useCreate(params);
          return [mutate, pending, error, setData] as const;
        }
      : () => {
          const [mutate, pending, error, setData] = useUpdate("42/1", params);
          return [mutate, pending, error, setData] as const;
        };
    const params = { organizationId: "a/b" };
    const key = "organizations/a%2Fb/users/42%2F1";
    await executeQuery(baseUrl, "organizations/a%2Fb/users", async () => []);
    await executeQuery(baseUrl, `${key}?details=1`, async () => ({ name: "variant" }));
    const read = renderHook(() => useRead("42/1", params));
    const mutation = renderHook(() => useMutation());
    const setData = mutation.result.current[3];

    act(() => {
      if (method === "create") {
        (setData as (id: string, data: User) => void)("42/1", { id: "42/1", name: "optimistic" });
      } else {
        (setData as (data: User) => void)({ id: "42/1", name: "optimistic" });
      }
    });
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
    apiStore.resetAll();
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
  act(() => result.current[3](1, { id: 1, name: "first" }));
  rerender({ organizationId: "second" });
  const error = new Error("offline");
  await expect(executeQuery(baseUrl, "organizations/second/users/1", async () => {
    throw error;
  })).rejects.toBe(error);
  act(() => result.current[3](1, { id: 1, name: "second" }));
  const state = store.getState().namespaces[baseUrl];
  expect(state.data["organizations/first/users/1"]).toEqual({ id: 1, name: "first" });
  expect(state.data["organizations/second/users/1"]).toEqual({ id: 1, name: "second" });
  expect(state.errors["organizations/second/users/1"]).toBe(error);
  expect(state.fresh["organizations/second/users/1"]).toBeUndefined();
  unmount();
  apiStore.resetAll();
});

test("update and delete use the read URL and follow changed IDs and parents", async () => {
  const baseUrl = "https://resource-routes.example.test";
  const api = Api.create(baseUrl);
  const get = jest.spyOn(api, "get").mockResolvedValue({ name: "server" });
  const put = jest.spyOn(api, "put").mockResolvedValue({ name: "updated" });
  const remove = jest.spyOn(api, "delete").mockResolvedValue(undefined);
  const apiStore = createApiStore(api);
  const resource = apiStore.route("organizations/:organizationId/users");
  const useRead = resource.read<{ name: string }>();
  const useUpdate = resource.update<{ name: string }, { name: string }>();
  const useDelete = resource.delete();
  const { result, rerender, unmount } = renderHook(
    ({ id, organizationId }) => ({
      read: useRead(id, { organizationId }),
      update: useUpdate(id, { organizationId }),
      remove: useDelete(id, { organizationId }),
    }),
    { initialProps: { id: "42/1", organizationId: "a/b" } },
  );
  for (const [id, organizationId] of [["42/1", "a/b"], ["7?x", "second"]]) {
    rerender({ id, organizationId });
    const url = `organizations/${encodeURIComponent(organizationId)}/users/${encodeURIComponent(id)}`;
    await act(async () => {
      await result.current.update[0]({ name: "updated" });
      await result.current.remove[0]();
    });
    expect(get).toHaveBeenLastCalledWith(url);
    expect(put).toHaveBeenLastCalledWith(url, { name: "updated" });
    expect(remove).toHaveBeenLastCalledWith(url);
    act(() => result.current.update[3]({ name: "optimistic" }));
    expect(result.current.read.data).toEqual({ name: "optimistic" });
  }
  expect(store.getState().namespaces[baseUrl].data["organizations/a%2Fb/users/42%2F1"]).toEqual({ name: "optimistic" });
  unmount();
  apiStore.resetAll();
});

test("create posts to the collection and writes response data to the explicit ID", async () => {
  const api = Api.create("https://create-route.example.test");
  const post = jest.spyOn(api, "post").mockResolvedValue({ name: "created" });
  const apiStore = createApiStore(api);
  const useCreate = apiStore.route("users").create<{ name: string }, { name: string }>();
  const { result, unmount } = renderHook(() => useCreate());
  await act(async () => {
    const data = await result.current[0]({ name: "created" });
    result.current[3](42, data);
  });
  expect(post).toHaveBeenCalledWith("users", { name: "created" });
  expect(store.getState().namespaces[api.baseUrl].data).toEqual({
    "users/42": { name: "created" },
  });
  unmount();
  apiStore.resetAll();
});
