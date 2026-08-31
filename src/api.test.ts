import { Api } from "fetch-run";
import { createApiStore } from "./api";
import { executeQuery, resetQueries, store } from "./store";

const baseUrl = "https://api.example.test";
const apiStore = createApiStore(Api.create(baseUrl));

afterEach(() => resetQueries(baseUrl));

test("invalidates one route in its API namespace", async () => {
  await executeQuery(baseUrl, "users/42", async () => ({ id: 42 }));

  apiStore.invalidateQuery("users/:userId", { userId: 42 });

  expect(store.getState().namespaces[baseUrl].stale["users/42"]).toBe(true);
});

test("invalidates and resets only its API namespace", async () => {
  await executeQuery(baseUrl, "users", async () => [{ id: 1 }]);

  apiStore.invalidateQueries();

  expect(store.getState().namespaces[baseUrl].data.users).toEqual([{ id: 1 }]);
  expect(store.getState().namespaces[baseUrl].stale.users).toBe(true);

  apiStore.resetQueries();

  expect(store.getState().namespaces[baseUrl].data).toEqual({});
});
