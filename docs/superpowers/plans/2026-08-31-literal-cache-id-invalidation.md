# Literal Cache-ID Invalidation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `apiStore.invalidateQuery` accept one resolved cache-ID string.

**Architecture:** `createApiStore` continues to bind low-level cache controls to
the API namespace. Targeted invalidation passes its literal ID through without
route-template parsing; route typing remains solely the responsibility of hook
creation.

**Tech Stack:** TypeScript 5.9, Jest 30, ts-jest.

---

## File structure

- `src/api.ts` — binds the literal ID to the API namespace.
- `src/api.test.ts` — verifies a resolved ID invalidates its matching entry.
- `tests/types/routes.test.ts` — removes route-template invalidation assertions.
- `README.md` — documents literal targeted invalidation.

### Task 1: Bind literal cache IDs

**Files:**
- Modify: `src/api.ts`
- Modify: `src/api.test.ts`
- Modify: `tests/types/routes.test.ts`

- [ ] **Step 1: Write the failing runtime test**

Replace the targeted test call in `src/api.test.ts` with the resolved cache ID:

```ts
apiStore.invalidateQuery("users/42");
```

Keep the existing assertion:

```ts
expect(store.getState().namespaces[baseUrl].stale["users/42"]).toBe(true);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `npm run test:runtime -- api.test.ts`

Expected: FAIL because the current public method requires a route template and
parameter object for a parameterized route.

- [ ] **Step 3: Implement the literal-ID façade**

In `src/api.ts`, remove `buildRoute`, `ExtractRouteParams`, and `RouteParams`
imports. Replace the local route-building function with the direct bound
method:

```ts
invalidateQuery: (id: string) => invalidateQueryForNamespace(ns, id),
```

Keep the existing `invalidateQueries` and `resetQueries` bindings unchanged.

- [ ] **Step 4: Keep type tests focused on hook routes**

Delete the four `api.invalidateQuery(...)` lines and their `@ts-expect-error`
comments from `tests/types/routes.test.ts`. The existing query and mutation
assertions continue to protect typed route inference.

- [ ] **Step 5: Verify runtime and type tests**

Run: `npm run test:runtime -- api.test.ts && npm run test:types`

Expected: the two API runtime tests pass and TypeScript accepts the remaining
typed hook assertions.

- [ ] **Step 6: Commit the behavior change**

```bash
git add src/api.ts src/api.test.ts tests/types/routes.test.ts
git commit -m "refactor: invalidate literal cache IDs"
```

### Task 2: Correct the public guide

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Replace the targeted invalidation example**

Replace the route-template example with:

```ts
apiStore.invalidateQuery("users");
apiStore.invalidateQuery("organizations/1234/users");
```

State that callers pass the exact resolved cache ID they want to invalidate.

- [ ] **Step 2: Verify docs and build**

Run: `npm test && npm run build && git diff --check`

Expected: all tests pass, TypeScript builds, and there is no whitespace error.

- [ ] **Step 3: Commit the README correction**

```bash
git add README.md
git commit -m "docs: clarify cache invalidation IDs"
```
