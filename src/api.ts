import { Api } from "fetch-run";
import { createQuery } from "./query";
import {
  createMutation,
  createCreateMutation,
  createUpdateMutation,
  createDeleteMutation,
} from "./mutation";
import {
  createListQuery,
  createReadQuery,
  createSearchQuery,
} from "./resource";
import {
  invalidateQueries as invalidateQueriesForNamespace,
  invalidateQuery as invalidateQueryForNamespace,
  resetQueries as resetQueriesForNamespace,
  setQueryData,
} from "./store";

export function createApiStore(api: Api) {
  const ns = api.baseUrl;

  return {
    createQuery<R extends string, Res extends object, Data = Res>(
      route: R,
      execute: (url: string) => Promise<Res | undefined>,
      transform?: (response: Res) => Data,
    ) {
      return createQuery<R, Res, Data>(ns, route, execute, transform);
    },

    createMutation,

    setData: (key: string, data: unknown): void => setQueryData(ns, key, data),

    invalidate: (id: string) => invalidateQueryForNamespace(ns, id),

    invalidateAll: () => invalidateQueriesForNamespace(ns),

    resetAll: () => resetQueriesForNamespace(ns),

    route<R extends string>(route: R) {
      function create<
        Req extends object | void,
        Res extends object | void,
        Data = Res,
      >(transform?: (response: Exclude<Res, void>) => Data) {
        return createCreateMutation<R, Req, Res, Data>(
          route,
          (url, req) => api.post<Res, Req>(url, req),
          transform,
        );
      }

      function read<Res extends object, Data = Res>(
        transform?: (response: Res) => Data,
      ) {
        return createReadQuery<R, Res, Data>(
          ns,
          route,
          (url) => api.get<Res>(url),
          transform,
        );
      }

      function update<
        Req extends object | void,
        Res extends object | void,
        Data = Res,
      >(transform?: (response: Exclude<Res, void>) => Data) {
        return createUpdateMutation<R, Req, Res, Data>(
          route,
          (url, req) => api.put<Res, Req>(url, req),
          transform,
        );
      }

      function _delete<Res extends object | void = void, Data = Res>(
        transform?: (response: Exclude<Res, void>) => Data,
      ) {
        return createDeleteMutation<R, Res, Data>(
          route,
          (url) => api.delete<Res>(url),
          transform,
        );
      }

      // The no-transform overloads retain the existing item-type generics.
      function list<ListItem extends object>(): ReturnType<
        typeof createListQuery<R, ListItem[]>
      >;
      function list<Res extends object, Data>(
        transform: (response: Res) => Data,
      ): ReturnType<typeof createListQuery<R, Res, Data>>;
      function list<Res extends object, Data = Res>(
        transform?: (response: Res) => Data,
      ) {
        return createListQuery<R, Res, Data>(
          ns,
          route,
          (url) => api.get<Res>(url),
          transform,
        );
      }

      function search<ListItem extends object>(): ReturnType<
        typeof createSearchQuery<R, ListItem[]>
      >;
      function search<Res extends object, Data>(
        transform: (response: Res) => Data,
      ): ReturnType<typeof createSearchQuery<R, Res, Data>>;
      function search<Res extends object, Data = Res>(
        transform?: (response: Res) => Data,
      ) {
        return createSearchQuery<R, Res, Data>(
          ns,
          route,
          (url) => api.get<Res>(url),
          transform,
        );
      }

      return { create, read, update, delete: _delete, list, search };
    },
  };
}
