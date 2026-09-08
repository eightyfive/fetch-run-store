/** @jest-environment jsdom */
import { act, render, renderHook } from "@testing-library/react";

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
