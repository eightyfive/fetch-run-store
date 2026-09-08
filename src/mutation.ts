import { useCallback, useState } from "react";
import { ExtractRouteParams, ResourceId, WithOptionalRouteParams } from "./types";
import { buildRoute } from "./utils";
import { setQueryData } from "./store";

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
          const normalizedError =
            err instanceof Error ? err : new Error(String(err));
          setError(normalizedError);
          throw normalizedError;
        } finally {
          setPendingCount((count) => count - 1);
        }
      },
      [execute, url],
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

export function createResourceMutation<
  R extends string,
  Req extends object | void,
  Res extends { id: ResourceId },
>(ns: string, route: R, execute: (url: string, data: Req) => Promise<Res>) {
  type Params = ExtractRouteParams<R>;
  const useMutation = createMutation<R, Req, Res>(route, execute);

  const useResourceMutation = (routeParams: Params = {} as Params) => {
    const mutation = useMutation(routeParams);
    const url = buildRoute(route, routeParams);
    const setData = useCallback(
      (data: Res): void => {
        setQueryData(ns, `${url}/${encodeURIComponent(String(data.id))}`, data);
      },
      [ns, url],
    );

    return [...mutation, setData] as const;
  };

  return useResourceMutation as WithOptionalRouteParams<
    Params,
    [...Mutation<Req, Res>, (data: Res) => void]
  >;
}
