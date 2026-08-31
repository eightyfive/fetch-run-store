# Fresh Query State Design

## Goal

Align the library's internal query freshness semantics with the current
production implementation without changing its public hook or cache-control
API.

## Design

The namespace store uses `fresh: Record<string, boolean>`. Only
`fresh[id] === true` means cached data is current. An absent entry and
`fresh[id] === false` both mean the query should fetch when enabled.

- A successful query stores data and sets `fresh[id] = true`.
- `invalidateQuery(id)` clears that error and sets `fresh[id] = false`, unless
  it is already invalidated without an error.
- `invalidateQueries()` preserves data but clears errors, fetching, and
  freshness. Missing freshness therefore invalidates every cached query.
- `resetQueries()` clears data as well.
- Query hooks fetch when they have no data or the entry is not fresh.

## Boundaries

Keep the existing shared-flight promise map, normalized generic errors, typed
route creation, mutation behavior, and route-level search identity. Do not add
new regression tests; update existing tests only for the internal state rename.
