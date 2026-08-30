import { RouteParams } from "./types";

export function buildRoute(route: string, routeParams: RouteParams) {
  let url = route;

  for (const [name, value] of Object.entries(routeParams)) {
    url = url.replace(`:${name}`, `${value}`);
  }

  return url;
}
