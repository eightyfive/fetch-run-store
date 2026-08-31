# API Store Cache Controls and README Design

## Goal

Give each `createApiStore` instance explicit, namespace-bound cache controls and
document the complete user-facing API in a concise README.

## Public API

`createApiStore(api)` will additionally return:

```ts
apiStore.invalidateQuery(route, routeParams?)
apiStore.invalidateQueries()
apiStore.resetQueries()
```

`invalidateQuery` accepts the same typed route parameters as queries. A route
without parameters accepts no argument; a parameterized route requires the
matching parameter object. It builds the same route-level cache ID used by the
query hooks.

`invalidateQueries` and `resetQueries` operate only on the namespace derived
from that API instance's `baseUrl`.

## Boundaries

- Cache lifecycle remains explicit and application-owned. Mutations do not
  automatically invalidate anything.
- Low-level Zustand helpers (`store`, `useApiStore`, and standalone cache
  functions) remain internal implementation details.
- Search requests retain their route-level cache identity and first-flight-wins
  behavior. Callers control later searches through debounce and `refetch()`.

## README

The README will include:

1. A short statement of purpose and non-goals.
2. Installation and a minimal `createApiStore` setup.
3. A typed route/read/list/mutation usage example.
4. The cache-control API, including targeted and namespace-wide examples.
5. Application-owned lifecycle examples for successful mutations, foreground
   refresh, and authentication changes.
6. A compact design-constraints section for contributors, humans, and agents.

## Tests and verification

Runtime tests will prove targeted invalidation, namespace-wide invalidation,
and reset through the returned API instance. Compile-time tests will prove
that `invalidateQuery` retains the typed-route requirements. `npm test` and
`npm run build` must pass.
