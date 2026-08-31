import {
  executeQuery,
  invalidateQuery,
  resetQueries,
  store,
} from "./store";

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });

  return { promise, reject, resolve };
}

afterEach(() => resetQueries("store-test"));

test("shares one in-flight promise for a namespace and cache key", async () => {
  const request = deferred<{ id: number }>();
  const run = jest.fn(() => request.promise);

  const first = executeQuery("store-test", "users", run);
  const second = executeQuery("store-test", "users", run);

  expect(second).toBe(first);
  expect(run).toHaveBeenCalledTimes(1);
  request.resolve({ id: 1 });
  await expect(first).resolves.toBeUndefined();
  expect(store.getState().namespaces["store-test"].data.users).toEqual({
    id: 1,
  });
});

test("stores a normalized Error and shares request failure", async () => {
  const request = deferred<never>();
  const first = executeQuery("store-test", "users", () => request.promise);
  const second = executeQuery("store-test", "users", () => request.promise);

  request.reject("offline");
  await expect(first).rejects.toThrow("offline");
  await expect(second).rejects.toThrow("offline");
  expect(store.getState().namespaces["store-test"].errors.users).toBeInstanceOf(
    Error
  );
});

test("ignores a completion that predates targeted invalidation", async () => {
  const oldRequest = deferred<{ id: string }>();
  const newRequest = deferred<{ id: string }>();
  const run = jest
    .fn()
    .mockReturnValueOnce(oldRequest.promise)
    .mockReturnValueOnce(newRequest.promise);

  const oldFlight = executeQuery("store-test", "users", run);
  invalidateQuery("store-test", "users");
  const newFlight = executeQuery("store-test", "users", run);

  expect(run).toHaveBeenCalledTimes(2);
  oldRequest.resolve({ id: "old" });
  await oldFlight;
  expect(store.getState().namespaces["store-test"].data.users).toBeUndefined();

  newRequest.resolve({ id: "new" });
  await newFlight;
  expect(store.getState().namespaces["store-test"].data.users).toEqual({
    id: "new",
  });
});

test("ignores a completion that predates reset", async () => {
  const oldRequest = deferred<{ id: string }>();
  const newRequest = deferred<{ id: string }>();
  const run = jest
    .fn()
    .mockReturnValueOnce(oldRequest.promise)
    .mockReturnValueOnce(newRequest.promise);

  const oldFlight = executeQuery("store-test", "users", run);
  resetQueries("store-test");
  const newFlight = executeQuery("store-test", "users", run);

  expect(run).toHaveBeenCalledTimes(2);
  oldRequest.resolve({ id: "old" });
  await oldFlight;
  expect(store.getState().namespaces["store-test"].data.users).toBeUndefined();

  newRequest.resolve({ id: "new" });
  await newFlight;
  expect(store.getState().namespaces["store-test"].data.users).toEqual({
    id: "new",
  });
});
