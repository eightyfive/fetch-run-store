import { useCallback, useEffect } from "react";

import { executeQuery, invalidateQuery, useApiStore } from "./store";
import { ExtractRouteParams, WithOptionalRouteParams } from "./types";
import { buildRoute } from "./utils";

export type Query<T> = {
  data: T | undefined;
  error: Error | null;
  invalidate: () => void;
  isFetching: boolean;
  isLoading: boolean;
  refetch: () => Promise<void>;
};

export function createQuery<R extends string, Res extends object>(
  ns: string,
  route: R,
  execute: (url: string) => Promise<Res | undefined>
) {
  type _RouteParams = ExtractRouteParams<R>;

  const useQuery = (
    routeParams: _RouteParams = {} as _RouteParams,
    searchParams?: URLSearchParams
  ): Query<Res> => {
    const routeId = buildRoute(route, routeParams);
    const queryId = !searchParams ? routeId : `${routeId}?${searchParams}`;

    // State
    const data = useApiStore(ns, (s) => s.data[queryId] as Res | undefined);
    const { error, isFetching, isFresh } = useApiStore(ns, (s) => ({
      error: s.errors[queryId] ?? null,
      isFetching: s.fetching[queryId] === true,
      isFresh: s.fresh[queryId] === true,
    }));

    // Computed
    const isLoading = !data && isFetching;

    // Methods
    const invalidate = useCallback(() => {
      invalidateQuery(ns, queryId);
    }, [ns, queryId]);

    const refetch = useCallback(() => {
      return executeQuery(ns, queryId, () => execute(queryId));
    }, [execute, ns, queryId]);

    // Effects
    useEffect(() => {
      if (!error && (!data || !isFresh)) {
        void refetch().catch(() => undefined);
      }
    }, [data, error, isFresh, refetch]);

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

  type UseQueryFn = WithOptionalRouteParams<_RouteParams, Query<Res>>;

  return useQuery as UseQueryFn;
}
