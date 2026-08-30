import { useCallback, useState } from "react";
import { buildRoute, ExtractRouteParams } from "fetch-run";
import { WithOptionalRouteParams } from "./types";

export type Mutation<Req extends object | void, Res extends object | void> = [
  (data: Req) => Promise<Res>,
  boolean,
  Error | null,
];

export function createMutation<
  R extends string,
  Req extends object | void,
  Res extends object | void,
>(route: R, execute: (url: string, data: Req) => Promise<Res>) {
  type _RouteParams = ExtractRouteParams<R>;

  const useMutation = (routeParams: _RouteParams = {} as _RouteParams) => {
    // Vars
    const url = buildRoute(route, routeParams ?? {});

    // State
    const [error, setError] = useState<Error | null>(null);
    const [pendingCount, setPendingCount] = useState(0);

    // Methods
    const mutate = useCallback(
      async (data: Req): Promise<Res> => {
        setError(null);
        setPendingCount((count) => count + 1);

        try {
          const res = await execute(url, data);

          return res;
        } catch (err) {
          if (err instanceof Error) {
            setError(err);
          }

          // Always throw
          throw err;
        } finally {
          setPendingCount((count) => count - 1);
        }
      },
      [execute, url]
    );

    // Public
    return [mutate, pendingCount > 0, error] as const;
  };

  type UseMutationFn = WithOptionalRouteParams<
    _RouteParams,
    Mutation<Req, Res>
  >;

  return useMutation as UseMutationFn;
}
