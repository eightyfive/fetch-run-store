import { ResourceId } from "fetch-run";

import { createQuery, Query } from "./query";
import { ExtractRouteParams } from "./types";

//
// CRUDL
//

// READ
type IdWithOptionalRouteParams<P, Res> = [keyof P] extends [never]
  ? (id: ResourceId, routeParams?: P) => Query<Res>
  : (id: ResourceId, routeParams: P) => Query<Res>;

export function createReadQuery<R extends string, Res extends object>(
  ns: string,
  route: R,
  execute: (url: string) => Promise<Res | undefined>
) {
  type _RouteWithId = `${R}/:id`;
  type _AllParams = ExtractRouteParams<_RouteWithId>;
  type _RouteParams = Omit<_AllParams, "id">;

  const fullRoute = `${route}/:id` as _RouteWithId;

  const useQuery = createQuery<_RouteWithId, Res>(ns, fullRoute, execute);

  const useReadQuery = (
    id: ResourceId,
    routeParams: _RouteParams = {} as _RouteParams
  ) => {
    return useQuery({ id, ...routeParams } as _AllParams);
  };

  return useReadQuery as IdWithOptionalRouteParams<_RouteParams, Res>;
}

// LIST
export function createListQuery<R extends string, Res extends object>(
  ns: string,
  route: R,
  execute: (url: string) => Promise<Res | undefined>
) {
  const useQuery = createQuery<R, Res>(ns, route, execute);

  type _RouteParams = ExtractRouteParams<R>;

  return function useListQuery(routeParams: _RouteParams = {} as _RouteParams) {
    return useQuery(routeParams);
  };
}

// SEARCH
/**
 * Search parameters change the request URL, not the cache key. Callers control
 * subsequent searches (for example, by debouncing input and calling refetch).
 */
export function createSearchQuery<R extends string, Res extends object>(
  ns: string,
  route: R,
  execute: (url: string) => Promise<Res | undefined>
) {
  const useQuery = createQuery<R, Res>(ns, route, execute);

  type _RouteParams = ExtractRouteParams<R>;

  return function useSearchQuery(
    searchParams: URLSearchParams = new URLSearchParams(),
    routeParams: _RouteParams = {} as _RouteParams
  ) {
    return useQuery(routeParams, searchParams);
  };
}
