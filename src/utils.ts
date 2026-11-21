import { RouteParams, TransformedResponse } from "./types";

export function buildRoute(route: string, routeParams: RouteParams) {
  return route.replace(/:([^/]+)/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(routeParams, name)
      ? encodeURIComponent(String(routeParams[name]))
      : placeholder,
  );
}

export function transformResponse<Res, Data = Res>(
  response: Res,
  transform?: (response: Exclude<Res, void>) => Data,
): TransformedResponse<Res, Data> {
  if (response !== undefined && transform) {
    return transform(response as Exclude<Res, void>);
  }
  // Without a transformer Data defaults to Res; empty bodies pass through.
  return response as TransformedResponse<Res, Data>;
}
