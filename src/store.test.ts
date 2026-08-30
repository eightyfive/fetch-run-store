import { executeQuery, resetQueries, store } from "./store";

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
