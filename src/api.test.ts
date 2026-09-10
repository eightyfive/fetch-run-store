import { Api } from "fetch-run";
import { createApiStore } from "./api";
import { executeQuery, resetQueries, store } from "./store";

const baseUrl = "https://api.example.test";
const apiStore = createApiStore(Api.create(baseUrl));

afterEach(() => resetQueries(baseUrl));

test("invalidates one resolved cache ID in its API namespace", async () => {
  await executeQuery(baseUrl, "users/42", async () => ({ id: 42 }));

  apiStore.invalidate("users/42");

  expect(store.getState().namespaces[baseUrl].fresh["users/42"]).toBe(false);
});

test("invalidates a route and all of its search variants", async () => {
  await executeQuery(baseUrl, "users", async () => [{ id: 1 }]);
  await executeQuery(baseUrl, "users?name=alice", async () => [{ id: 2 }]);
  await executeQuery(baseUrl, "users?name=bob", async () => [{ id: 3 }]);

  apiStore.invalidate("users");

  const { fresh } = store.getState().namespaces[baseUrl];
  expect(fresh.users).toBe(false);
  expect(fresh["users?name=alice"]).toBe(false);
  expect(fresh["users?name=bob"]).toBe(false);
});

test("invalidates one exact search cache ID", async () => {
  await executeQuery(baseUrl, "users?name=alice", async () => [{ id: 1 }]);
  await executeQuery(baseUrl, "users?name=bob", async () => [{ id: 2 }]);

  apiStore.invalidate("users?name=alice");

  const { fresh } = store.getState().namespaces[baseUrl];
  expect(fresh["users?name=alice"]).toBe(false);
  expect(fresh["users?name=bob"]).toBe(true);
});

test("invalidates and resets only its API namespace", async () => {
  await executeQuery(baseUrl, "users", async () => [{ id: 1 }]);

  apiStore.invalidateAll();

  expect(store.getState().namespaces[baseUrl].data.users).toEqual([{ id: 1 }]);
  expect(store.getState().namespaces[baseUrl].fresh.users).toBeUndefined();

  apiStore.resetAll();

  expect(store.getState().namespaces[baseUrl].data).toEqual({});
});

test("setData creates a missing namespace and notifies subscribers", () => {
  const ns = "https://new-api.example.test";
  const api = createApiStore(Api.create(ns));
  expect(store.getState().namespaces[ns]).toBeUndefined();
  const listener = jest.fn();
  const unsubscribe = store.subscribe(listener);
  try {
    expect(api.setData("users/42", { id: 42 })).toBeUndefined();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(store.getState().namespaces[ns]).toEqual({
      data: { "users/42": { id: 42 } },
      errors: {},
      fetching: {},
      fresh: {},
      revision: {},
    });
  } finally {
    unsubscribe();
    resetQueries(ns);
  }
});

test.each([42, "text", false, null, undefined, [1, 2], { id: 1 }])(
  "setData stores the direct value %p at a missing key",
  (value) => {
    apiStore.setData("new-key", value);
    const data = store.getState().namespaces[baseUrl].data;
    expect(Object.prototype.hasOwnProperty.call(data, "new-key")).toBe(true);
    expect(data["new-key"]).toBe(value);
  },
);

test("setData stores functions as values without invoking them", () => {
  apiStore.setData("users", { id: 1 });
  const value = jest.fn(() => ({ id: 2 }));
  apiStore.setData("users", value);
  expect(value).not.toHaveBeenCalled();
  expect(store.getState().namespaces[baseUrl].data.users).toBe(value);
});
