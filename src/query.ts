import { useCallback, useEffect } from "react";

import { executeQuery, invalidateQuery, useApiStore } from "./store";
import { ExtractRouteParams, WithOptionalRouteParams } from "./types";
import { buildRoute, transformResponse } from "./utils";

export type Query<T> = {
  data: T | undefined;
  error: Error | null;
  invalidate: () => void;
  isFetching: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

export function createQuery<R extends string, Res extends object, Data = Res>(
  ns: string,
  route: R,
  execute: (url: string) => Promise<Res | undefined>,
  transform?: (response: Res) => Data,
) {
  type _RouteParams = ExtractRouteParams<R>;

  const useQuery = (
    routeParams: _RouteParams = {} as _RouteParams,
    searchParams?: URLSearchParams,
  ): Query<Data> => {
    const routeId = buildRoute(route, routeParams);
    const search = searchParams?.toString();
    const queryId = search ? `${routeId}?${search}` : routeId;

    // State
    const data = useApiStore(ns, (s) => s.data[queryId] as Data | undefined);
    const { error, isFetching, isFresh, revision } = useApiStore(ns, (s) => ({
      error: s.errors[queryId] ?? null,
      isFetching: s.fetching[queryId] === true,
      isFresh: s.fresh[queryId] === true,
      revision: s.revision[queryId] ?? 0,
    }));

    // Computed
    const isLoading = !data && isFetching;

    // Methods
    const invalidate = useCallback(() => {
      invalidateQuery(ns, queryId);
    }, [ns, queryId]);

    const refetch = useCallback(() => {
      return executeQuery(ns, queryId, async () =>
        transformResponse(await execute(queryId), transform),
      );
    }, [execute, transform, ns, queryId]);

    // Effects
    useEffect(() => {
      if (!error && !isFresh) {
        void refetch().catch(() => undefined);
      }
    }, [error, isFresh, revision, refetch]);

    // Public
    return {
      data,
      error,
      invalidate,
      isFetching,
      isLoading,
      refetch,
    };
  };

  type UseQueryFn = WithOptionalRouteParams<_RouteParams, Query<Data>>;

  return useQuery as UseQueryFn;
}
