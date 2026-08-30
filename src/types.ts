export type ResourceId = string | number;

export type RouteParams = Record<string, ResourceId>;

export type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<Rest>]: ResourceId }
    : T extends `${string}:${infer Param}`
      ? { [K in Param]: ResourceId }
      : {};

export type WithOptionalRouteParams<P, R> = [keyof P] extends [never]
  ? (routeParams?: P, searchParams?: URLSearchParams) => R
  : (routeParams: P, searchParams?: URLSearchParams) => R;
