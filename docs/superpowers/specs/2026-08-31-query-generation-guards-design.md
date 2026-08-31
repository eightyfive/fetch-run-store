# Query Generation Guards Design

## Goal

Prevent an in-flight request that began before invalidation or reset from
writing obsolete data into the cache.

## Design

Each namespace/cache-ID flight key has a monotonically increasing generation.
`executeQuery` captures its generation before starting. Completion writes data
or an error only when that generation is still current.

`invalidateQuery`, `invalidateQueries`, and `resetQueries` advance affected
generations and remove their active flight entries. A subsequent refetch then
starts a new request immediately; the obsolete request is not aborted but its
completion is ignored.

## Boundaries

This changes cache-write correctness, not network cancellation. It preserves
the existing first-flight sharing for requests that have not been invalidated,
and does not change namespaces, typed routes, search identity, or public API.
