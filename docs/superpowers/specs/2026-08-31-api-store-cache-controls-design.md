# API Store Cache Controls and README Design

## Goal

Give each `createApiStore` instance explicit, namespace-bound cache controls and
document the complete user-facing API in a concise README.

## Public API

`createApiStore(api)` will additionally return:

```ts
apiStore.invalidateQuery(id)
apiStore.invalidateQueries()
apiStore.resetQueries()
```

`invalidateQuery` accepts the exact resolved cache ID, such as
`"organizations/1234/users"`. Callers therefore identify precisely which
cached route instance to invalidate. Typed route templates remain a core
guarantee for hook creation, but are not part of cache targeting.

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
and reset through the returned API instance. Type tests continue to protect
typed route creation. `npm test` and `npm run build` must pass.
