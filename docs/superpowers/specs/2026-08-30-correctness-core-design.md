# Correctness-Core Hardening Design

## Goal

Make `fetch-run-store` dependable without widening it into a configurable
React Query clone. The public API remains `createApiStore`; cache-wide helpers
remain internal implementation details.

## Public contract

- Typed route parameters remain mandatory whenever a route contains `:params`.
- Parameter-free routes continue to accept no argument.
- Read queries keep `id` separate from parent-route parameters.
- Search queries cache by their complete request URL, including serialized
  search parameters. Ordinary queries remain route-keyed.
- `refetch()` resolves only when the underlying request has completed, even
  when callers refetch the same key concurrently.
- Query failures appear in query state; effect-driven fetching must not produce
  an unhandled rejected promise.
- A mutation stays loading until all invocations started by that hook complete.

## Non-goals

- No retries, stale-time configuration, garbage collection, cancellation,
  optimistic updates, provider/client API, or mutation-driven automatic cache
  invalidation.
- Do not export `invalidateQueries` or `resetQueries` from the package root or
  add them to `createApiStore`.
- Do not change the typed-route call shapes.

## Implementation

### Tooling

Add a strict TypeScript build configuration that emits `dist` from `src` and
excludes tests. Configure Jest with `ts-jest` for TypeScript runtime tests.
Add a separate no-emit type-test project, run by the test command, for
`@ts-expect-error` route assertions.

### Query store

Track an in-flight promise per namespace/key. The first request records it;
all concurrent executions return that same promise. Remove the in-flight
record after success or failure. Normalize unknown thrown values into `Error`
before storing them. Keep stale/error/data semantics otherwise unchanged.

### Query hook

Keep ordinary query cache keys route-based. Let `createSearchQuery` build its
own cache key from the route plus runtime search parameters, so distinct
searches have independent state and cannot overwrite one another. Initiate
effect fetches without exposing their rejected promise to React; explicit
`refetch()` still rejects to its caller.

### Mutation hook

Use an invocation count rather than a boolean. Increment before execution and
decrement in `finally`, deriving `isLoading` from whether the count is nonzero.
Preserve the existing tuple API and error behavior.

## Tests

Runtime tests will cover:

1. Query state transitions for success, errors, invalidation, and reset.
2. Shared in-flight request behavior, including shared rejection.
3. Independent cache entries for distinct search URLs.
4. Mutation loading state while overlapping calls are pending.
5. Hook-level fetch/error behavior where React effects are involved.

Type tests will prove that valid typed routes compile and that these invalid
calls fail compilation: missing route parameters, missing parent parameters
for reads, unknown route parameters, and incorrect resource IDs. They will use
the exported package API so changes to the entry point cannot silently weaken
the route contract.

## Verification

`npm run build`, runtime tests, and type tests must all pass. A clean working
tree after the implementation commit is not required, but generated `dist`,
coverage, and dependencies must remain ignored.
