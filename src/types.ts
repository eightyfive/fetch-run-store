import { ResourceId } from "fetch-run";

export type ExtractRouteParams<T extends string> =
  T extends `${string}:${infer Param}/${infer Rest}`
    ? { [K in Param | keyof ExtractRouteParams<Rest>]: ResourceId }
    : T extends `${string}:${infer Param}`
      ? { [K in Param]: ResourceId }
      : {};

export type WithOptionalRouteParams<P, R> = [keyof P] extends [never]
  ? (routeParams?: P) => R
  : (routeParams: P) => R;
