import { RouteParams } from "./types";

export function buildRoute(route: string, routeParams: RouteParams) {
  return route.replace(/:([^/]+)/g, (placeholder, name: string) =>
    Object.prototype.hasOwnProperty.call(routeParams, name)
      ? encodeURIComponent(String(routeParams[name]))
      : placeholder,
  );
}
