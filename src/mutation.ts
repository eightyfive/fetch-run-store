import { useCallback, useState } from "react";
import {
  ExtractRouteParams,
  ResourceId,
  WithOptionalRouteParams,
  IdWithOptionalRouteParams,
  TransformedResponse,
} from "./types";
import { buildRoute, transformResponse } from "./utils";

export type MutationResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: Error };

export type Mutation<Req extends object | void, Res> = [
  (data: Req) => Promise<MutationResult<Res>>,
  boolean,
  Error | null,
];

export function createMutation<
  R extends string,
  Req extends object | void,
  Res extends object | void,
  Data = Res,
>(
  route: R,
  execute: (url: string, data: Req) => Promise<Res>,
  transform?: (response: Exclude<Res, void>) => Data,
) {
  type _RouteParams = ExtractRouteParams<R>;

  const useMutation = (routeParams: _RouteParams = {} as _RouteParams) => {
    // Vars
    const url = buildRoute(route, routeParams ?? {});

    // State
    const [error, setError] = useState<Error | null>(null);
    const [pendingCount, setPendingCount] = useState(0);

    // Methods
    const mutate = useCallback(
      async (
        data: Req,
      ): Promise<MutationResult<TransformedResponse<Res, Data>>> => {
        setError(null);
        setPendingCount((count) => count + 1);

        try {
          const res = await execute(url, data);

          return { ok: true, data: transformResponse(res, transform) };
        } catch (err) {
          const normalizedError =
            err instanceof Error ? err : new Error(String(err));
          setError(normalizedError);
          return { ok: false, error: normalizedError };
        } finally {
          setPendingCount((count) => count - 1);
        }
      },
      [execute, transform, url],
    );

    // Public
    return [mutate, pendingCount > 0, error] as const;
  };

  type UseMutationFn = WithOptionalRouteParams<
    _RouteParams,
    Mutation<Req, TransformedResponse<Res, Data>>
  >;

  return useMutation as UseMutationFn;
}

export function createCreateMutation<
  R extends string,
  Req extends object | void,
  Res extends object | void,
  Data = Res,
>(
  route: R,
  execute: (url: string, data: Req) => Promise<Res>,
  transform?: (response: Exclude<Res, void>) => Data,
) {
  return createMutation<R, Req, Res, Data>(route, execute, transform);
}

export function createUpdateMutation<
  R extends string,
  Req extends object | void,
  Res extends object | void,
  Data = Res,
>(
  route: R,
  execute: (url: string, data: Req) => Promise<Res>,
  transform?: (response: Exclude<Res, void>) => Data,
) {
  type AllParams = ExtractRouteParams<`${R}/:id`>;
  type ParentParams = Omit<AllParams, "id">;
  const fullRoute = `${route}/:id` as `${R}/:id`;
  const useMutation = createMutation(fullRoute, execute, transform);

  const useUpdate = (
    id: ResourceId,
    routeParams: ParentParams = {} as ParentParams,
  ) => {
    const params = { ...routeParams, id } as AllParams;
    return useMutation(params);
  };

  return useUpdate as IdWithOptionalRouteParams<
    ParentParams,
    Mutation<Req, TransformedResponse<Res, Data>>
  >;
}

export function createDeleteMutation<
  R extends string,
  Res extends object | void,
  Data = Res,
>(
  route: R,
  execute: (url: string) => Promise<Res>,
  transform?: (response: Exclude<Res, void>) => Data,
) {
  type AllParams = ExtractRouteParams<`${R}/:id`>;
  type ParentParams = Omit<AllParams, "id">;
  const useMutation = createMutation<`${R}/:id`, void, Res, Data>(
    `${route}/:id`,
    execute,
    transform,
  );

  const useDelete = (
    id: ResourceId,
    routeParams: ParentParams = {} as ParentParams,
  ) => useMutation({ ...routeParams, id } as AllParams);

  return useDelete as IdWithOptionalRouteParams<
    ParentParams,
    Mutation<void, TransformedResponse<Res, Data>>
  >;
}
