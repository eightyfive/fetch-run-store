import { Api } from "fetch-run";
import { createApiStore } from "./api";
import { executeQuery, resetQueries, store } from "./store";

const baseUrl = "https://api.example.test";
const apiStore = createApiStore(Api.create(baseUrl));

afterEach(() => resetQueries(baseUrl));

test("invalidates one resolved cache ID in its API namespace", async () => {
  await executeQuery(baseUrl, "users/42", async () => ({ id: 42 }));

  apiStore.invalidateQuery("users/42");

  expect(store.getState().namespaces[baseUrl].fresh["users/42"]).toBe(false);
});

test("invalidates a route and all of its search variants", async () => {
  await executeQuery(baseUrl, "users", async () => [{ id: 1 }]);
  await executeQuery(baseUrl, "users?name=alice", async () => [{ id: 2 }]);
  await executeQuery(baseUrl, "users?name=bob", async () => [{ id: 3 }]);

  apiStore.invalidateQuery("users");

  const { fresh } = store.getState().namespaces[baseUrl];
  expect(fresh.users).toBe(false);
  expect(fresh["users?name=alice"]).toBe(false);
  expect(fresh["users?name=bob"]).toBe(false);
});

test("invalidates one exact search cache ID", async () => {
  await executeQuery(baseUrl, "users?name=alice", async () => [{ id: 1 }]);
  await executeQuery(baseUrl, "users?name=bob", async () => [{ id: 2 }]);

  apiStore.invalidateQuery("users?name=alice");

  const { fresh } = store.getState().namespaces[baseUrl];
  expect(fresh["users?name=alice"]).toBe(false);
  expect(fresh["users?name=bob"]).toBe(true);
});

test("invalidates and resets only its API namespace", async () => {
  await executeQuery(baseUrl, "users", async () => [{ id: 1 }]);

  apiStore.invalidateQueries();

  expect(store.getState().namespaces[baseUrl].data.users).toEqual([{ id: 1 }]);
  expect(store.getState().namespaces[baseUrl].fresh.users).toBeUndefined();

  apiStore.resetQueries();

  expect(store.getState().namespaces[baseUrl].data).toEqual({});
});

test("sets exact cache entries without affecting other namespaces", () => {
  apiStore.setQueryData("users?name=alice", [{ id: 2 }]);
  apiStore.setQueryData("users", [{ id: 1 }]);
  apiStore.setQueryData("users", [{ id: 1 }, { id: 3 }]);

  const state = store.getState().namespaces[baseUrl];
  expect(state.data.users).toEqual([{ id: 1 }, { id: 3 }]);
  expect(state.data["users?name=alice"]).toEqual([{ id: 2 }]);
  expect(state.fresh.users).toBe(true);
  expect(state.fetching.users).toBe(false);
  expect(state.errors.users).toBeNull();
  const other = createApiStore(Api.create("https://isolated.example.test"));
  other.setQueryData("users", [{ id: 99 }]);
  expect(store.getState().namespaces[baseUrl].data.users).toEqual([{ id: 1 }, { id: 3 }]);
  other.resetQueries();
});

test("setting data clears a previous query error", async () => {
  await expect(executeQuery(baseUrl, "users", async () => {
    throw new Error("offline");
  })).rejects.toThrow("offline");
  apiStore.setQueryData("users", [{ id: 1 }]);
  expect(store.getState().namespaces[baseUrl].errors.users).toBeNull();
});
