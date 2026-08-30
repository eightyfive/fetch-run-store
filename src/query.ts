import { buildRoute, ExtractRouteParams } from "fetch-run";
import { useCallback, useEffect } from "react";

import { executeQuery, invalidateQuery, useApiStore } from "./store";
import { WithOptionalRouteParams } from "./types";

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
    // Vars
    const routeId = buildRoute(route, routeParams);
    const url = !searchParams ? routeId : `${routeId}?${searchParams}`;
    const id = url;

    // State
    const data = useApiStore(ns, (s) => s.data[id] as Res | undefined);
    const { error, isFetching, isStale } = useApiStore(ns, (s) => ({
      error: s.errors[id] ?? null,
      isFetching: s.fetching[id] === true,
      isStale: s.stale[id] === true,
    }));

    // Computed
    const isLoading = !data && isFetching;

    // Methods
    const invalidate = useCallback(() => {
      invalidateQuery(ns, id);
    }, [id, ns]);

    const refetch = useCallback(() => {
      return executeQuery(ns, id, () => execute(url));
    }, [execute, id, ns, url]);

    // Effects
    useEffect(() => {
      if (!error && (!data || isStale)) {
        void refetch().catch(() => undefined);
      }
    }, [data, error, isStale, refetch]);

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
