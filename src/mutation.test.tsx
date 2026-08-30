/** @jest-environment jsdom */
import { act, render } from "@testing-library/react";

import { createMutation } from "./mutation";

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
    execute
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
