# API Store Cache Controls and README Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add typed, namespace-bound manual cache controls to `createApiStore` and document the complete public workflow in a concise README.

**Architecture:** `createApiStore` binds low-level cache operations to `api.baseUrl`; applications never pass namespaces. A typed rest-tuple keeps route parameters mandatory for targeted invalidation. The README presents this façade as the explicit cache lifecycle boundary and leaves the Zustand internals private.

**Tech Stack:** TypeScript 5.9, React 19, Zustand 5, Jest 30, ts-jest.

---

## File structure

- `src/api.ts` — instance-bound cache methods and typed targeted invalidation.
- `src/api.test.ts` — runtime cache-control behavior through `createApiStore`.
- `src/store.ts` — make whole-namespace invalidation mark every known query stale.
- `tests/types/routes.test.ts` — compile-time targeted-invalidation route checks.
- `README.md` — installation, usage, cache lifecycle, and design constraints.

### Task 1: Add instance-bound cache controls

**Files:**
- Modify: `src/api.ts`
- Modify: `src/store.ts`
- Create: `src/api.test.ts`
- Modify: `tests/types/routes.test.ts`

- [ ] **Step 1: Write failing runtime cache-control tests**

Create `src/api.test.ts` with a real `Api` instance and the cache-store test
helpers:

```ts
import { Api } from "fetch-run";
import { createApiStore } from "./api";
import { executeQuery, resetQueries, store } from "./store";

const baseUrl = "https://api.example.test";
const apiStore = createApiStore(Api.create(baseUrl));

afterEach(() => resetQueries(baseUrl));

test("invalidates one typed route in its API namespace", async () => {
  await executeQuery(baseUrl, "users/42", async () => ({ id: 42 }));

  apiStore.invalidateQuery("users/:userId", { userId: 42 });

  expect(store.getState().namespaces[baseUrl].stale["users/42"]).toBe(true);
});

test("invalidates and resets only its API namespace", async () => {
  await executeQuery(baseUrl, "users", async () => [{ id: 1 }]);
  apiStore.invalidateQueries();
  expect(store.getState().namespaces[baseUrl].stale.users).toBe(true);

  apiStore.resetQueries();
  expect(store.getState().namespaces[baseUrl].data).toEqual({});
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test:runtime -- api.test.ts`

Expected: FAIL because `createApiStore` does not expose cache-control methods.

- [ ] **Step 3: Make whole-namespace invalidation actually stale**

Update `invalidateQueries` in `src/store.ts` to preserve cached data while
marking every known query id in that namespace stale. This makes active query
hooks refetch after an application-level foreground or mutation invalidation.
Clear transient errors and fetching flags as before.

- [ ] **Step 4: Add the smallest typed façade**

In `src/api.ts`, import the local `buildRoute`, `ExtractRouteParams`, and the
three low-level cache functions with aliases. Define the targeted method as a
generic rest-tuple function so only routes with parameters require a second
argument:

```ts
const invalidateRoute = <R extends string>(
  route: R,
  ...[routeParams]: [keyof ExtractRouteParams<R>] extends [never]
    ? []
    : [ExtractRouteParams<R>]
) => {
  invalidateQueryForNamespace(
    ns,
    buildRoute(route, (routeParams ?? {}) as ExtractRouteParams<R>)
  );
};
```

Return it alongside these bound methods:

```ts
invalidateQuery: invalidateRoute,
invalidateQueries: () => invalidateQueriesForNamespace(ns),
resetQueries: () => resetQueriesForNamespace(ns),
```

- [ ] **Step 5: Add compile-time route assertions**

Append to `tests/types/routes.test.ts`:

```ts
api.invalidateQuery("health");
api.invalidateQuery("organizations/:organizationId/users", {
  organizationId: "acme",
});
// @ts-expect-error parameterized routes require their parameters
api.invalidateQuery("organizations/:organizationId/users");
// @ts-expect-error route parameter values are string or number
api.invalidateQuery("organizations/:organizationId/users", {
  organizationId: false,
});
```

- [ ] **Step 6: Verify runtime and type tests**

Run: `npm run test:runtime -- api.test.ts && npm run test:types`

Expected: PASS.

- [ ] **Step 7: Commit the cache façade**

```bash
git add src/api.ts src/api.test.ts src/store.ts tests/types/routes.test.ts
git commit -m "feat: bind cache controls to API stores"
```

### Task 2: Write the README

**Files:**
- Create: `README.md`

- [ ] **Step 1: Add the public guide**

Write `README.md` with these exact sections: `# fetch-run-store`, `## Install`,
`## Usage`, `## Cache lifecycle`, and `## Design constraints`.

The usage section must show `Api.create`, `createApiStore`, typed `read`,
`list`, and `update` hooks. The cache-lifecycle section must show:

```ts
api.subscribe((request, response) => {
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(
    request.method
  );
  const isSuccess = response.status >= 200 && response.status < 300;

  if (isMutation && isSuccess) apiStore.invalidateQueries();
});
```

Include short examples for foreground refresh using `apiStore.invalidateQueries`
and for authentication changes using `api.setBearer`,
`apiStore.invalidateQuery("user")`, and `apiStore.resetQueries`.

The constraints section must state: typed routes are deliberate; requests share
the first active route flight; mutations do not invalidate automatically;
applications own debounce, refetch, and cache lifecycle policy; retries,
cancellation, and cache garbage collection are intentionally absent.

- [ ] **Step 2: Verify examples against public types**

Run: `npm run build && npm test`

Expected: PASS. Re-read every import and method name in `README.md` against
`src/index.ts` and `src/api.ts`; no README example imports internal store
modules.

- [ ] **Step 3: Commit the README**

```bash
git add README.md
git commit -m "docs: add library README"
```

### Task 3: Final verification and pull request

**Files:**
- Modify: only files required by a failing verification command

- [ ] **Step 1: Run all verification**

Run: `npm test && npm run build && git diff --check`

Expected: all runtime tests and type checks pass, the build succeeds, and the
working tree contains no uncommitted changes.

- [ ] **Step 2: Push and create the documentation PR**

```bash
git push -u origin feat/api-store-cache-controls
gh pr create --base main --head feat/api-store-cache-controls \
  --title "Document API store cache controls" \
  --body "## Summary\n- add namespace-bound cache controls to createApiStore\n- document installation, usage, and application-owned cache lifecycle\n\n## Test plan\n- npm test\n- npm run build"
```
