/** @jest-environment jsdom */
import { act, render, renderHook } from "@testing-library/react";

import { Api } from "fetch-run";
import { createApiStore } from "./api";
import { store } from "./store";

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
    expect(result.current.update).toHaveLength(3);
    expect(result.current.read.data).toEqual({ name: "server" });
  }
  expect(store.getState().namespaces[baseUrl].data["organizations/a%2Fb/users/42%2F1"]).toEqual({ name: "server" });
  unmount();
  apiStore.resetAll();
});

test("create posts to the collection and returns a three-item mutation tuple", async () => {
  const api = Api.create("https://create-route.example.test");
  const post = jest.spyOn(api, "post").mockResolvedValue({ name: "created" });
  const apiStore = createApiStore(api);
  const useCreate = apiStore.route("users").create<{ name: string }, { name: string }>();
  const { result, unmount } = renderHook(() => useCreate());
  await act(async () => {
    const data = await result.current[0]({ name: "created" });
    expect(data).toEqual({ name: "created" });
  });
  expect(post).toHaveBeenCalledWith("users", { name: "created" });
  expect(result.current).toHaveLength(3);
  expect(store.getState().namespaces[api.baseUrl]?.data ?? {}).toEqual({});
  unmount();
  apiStore.resetAll();
});
