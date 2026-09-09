# Changelog

## Unreleased

- Breaking: rename API store cache controls from `invalidateQuery(id)`,
  `invalidateQueries()`, and `resetQueries()` to `invalidate(id)`,
  `invalidateAll()`, and `resetAll()`. Behavior and API namespace scope are unchanged.

## 0.1.0 (unreleased)

Initial public release candidate:

- Typed React query and mutation hooks for fetch-run 3, including CRUDL helpers.
- Cache identity includes resolved route and nonempty search parameters.
- Explicit route-wide, exact-search, API-wide invalidation and cache reset.
- Shared caches and in-flight requests by API base URL,
  and protection against obsolete responses after invalidation.
- Required route parameters for list, search, read, and mutation hooks.
- Normalized errors and accurate loading state for overlapping mutations.
- React 18/19 support, CommonJS output, declarations, and source maps.

During 0.x development, compatible fixes use patch versions and breaking API
changes use minor versions. Version 1.0.0 will mark the stable API contract.
