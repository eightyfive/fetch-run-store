import { useCallback, useState } from "react";
import { ExtractRouteParams, ResourceId, WithOptionalRouteParams, IdWithOptionalRouteParams } from "./types";
import { buildRoute } from "./utils";

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

export function createCreateMutation<
  R extends string,
  Req extends object | void,
  Res extends object | void,
>(route: R, execute: (url: string, data: Req) => Promise<Res>) {
  return createMutation<R, Req, Res>(route, execute);
}

export function createUpdateMutation<
  R extends string,
  Req extends object | void,
  Res extends object | void,
>(route: R, execute: (url: string, data: Req) => Promise<Res>) {
  type AllParams = ExtractRouteParams<`${R}/:id`>;
  type ParentParams = Omit<AllParams, "id">;
  const fullRoute = `${route}/:id` as `${R}/:id`;
  const useMutation = createMutation(fullRoute, execute);

  const useUpdate = (id: ResourceId, routeParams: ParentParams = {} as ParentParams) => {
    const params = { ...routeParams, id } as AllParams;
    return useMutation(params);
  };

  return useUpdate as IdWithOptionalRouteParams<ParentParams, Mutation<Req, Res>>;
}

export function createDeleteMutation<R extends string, Res extends object | void>(
  route: R,
  execute: (url: string) => Promise<Res>,
) {
  type AllParams = ExtractRouteParams<`${R}/:id`>;
  type ParentParams = Omit<AllParams, "id">;
  const useMutation = createMutation<`${R}/:id`, void, Res>(`${route}/:id`, execute);

  const useDelete = (id: ResourceId, routeParams: ParentParams = {} as ParentParams) =>
    useMutation({ ...routeParams, id } as AllParams);

  return useDelete as IdWithOptionalRouteParams<ParentParams, Mutation<void, Res>>;
}
