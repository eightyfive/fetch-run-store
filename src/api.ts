import { Api } from "fetch-run";
import { createQuery } from "./query";
import { createMutation } from "./mutation";
import {
  createListQuery,
  createReadQuery,
  createSearchQuery,
} from "./resource";
import {
  invalidateQueries as invalidateQueriesForNamespace,
  invalidateQuery as invalidateQueryForNamespace,
  resetQueries as resetQueriesForNamespace,
} from "./store";
import { ExtractRouteParams, RouteParams } from "./types";
import { buildRoute } from "./utils";

export function createApiStore(api: Api) {
  const ns = api.baseUrl;
  const invalidateRoute = <R extends string>(
    route: R,
    ...[routeParams]: [keyof ExtractRouteParams<R>] extends [never]
      ? []
      : [ExtractRouteParams<R>]
  ) => {
    invalidateQueryForNamespace(
      ns,
      buildRoute(route, (routeParams ?? {}) as RouteParams)
    );
  };

  return {
    createQuery<R extends string, Res extends object>(
      route: R,
      execute: (url: string) => Promise<Res | undefined>
    ) {
      return createQuery<R, Res>(ns, route, execute);
    },

    createMutation,

    invalidateQuery: invalidateRoute,

    invalidateQueries: () => invalidateQueriesForNamespace(ns),

    resetQueries: () => resetQueriesForNamespace(ns),

    route<R extends string>(route: R) {
      return {
        create<Req extends object | void, Res extends object | void>() {
          return createMutation<R, Req, Res>(route, (url, req: Req) =>
            api.post<Res, Req>(url, req)
          );
        },
        read<Item extends object>() {
          return createReadQuery<R, Item>(ns, route, (url) =>
            api.get<Item>(url)
          );
        },
        update<Req extends object | void, Res extends object | void>() {
          return createMutation<R, Req, Res>(route, (url, req: Req) =>
            api.put<Res, Req>(url, req)
          );
        },
        delete<Res extends object | void = void>() {
          return createMutation<R, void, Res>(route, (url) =>
            api.delete<Res>(url)
          );
        },
        list<ListItem extends object>() {
          return createListQuery<R, ListItem[]>(ns, route, (url) =>
            api.get<ListItem[]>(url)
          );
        },
        search<ListItem extends object>() {
          return createSearchQuery<R, ListItem[]>(ns, route, (url) =>
            api.get<ListItem[]>(url)
          );
        },
      };
    },
  };
}
