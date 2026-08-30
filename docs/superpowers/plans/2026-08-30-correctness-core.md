# Correctness-Core Hardening Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Establish reliable build and test tooling, then harden query and mutation correctness while preserving the intentionally narrow API.

**Architecture:** Keep the public entry point unchanged. The Zustand store owns cache state and a private in-flight-promise registry; hooks build typed routes and delegate state transitions to it. Runtime tests exercise store transitions and hooks, while a separate TypeScript project type-checks route call signatures.

**Tech Stack:** TypeScript 5.9, Jest 30 with ts-jest, React 19, Zustand 5, React Testing Library.

---

> **Design update:** `createQuery` remains route-keyed. `createSearchQuery`
> alone builds a full URL cache ID from its runtime search parameters, so
> distinct searches fetch and cache independently.

## File structure

- `tsconfig.json` — strict library build configuration that emits `dist`.
- `tsconfig.type-tests.json` — no-emit configuration for compile-time API tests.
- `jest.config.cjs` — Jest/ts-jest configuration for `src/**/*.test.ts(x)`.
- `tests/types/routes.test.ts` — public-API type assertions for typed routes.
- `src/store.test.ts` — state-machine and in-flight-deduplication tests.
- `src/query.test.tsx` — hook tests for search-key isolation and effect failures.
- `src/mutation.test.tsx` — hook test for overlapping mutation loading state.
- `src/store.ts` — private in-flight registry and error normalization.
- `src/query.ts` — URL-based cache key and caught effect-triggered fetch.
- `src/mutation.ts` — pending-operation-count loading state.
- `package.json` / `package-lock.json` — test scripts and development-only React DOM test dependencies.

### Task 1: Establish strict build and test commands

**Files:**
- Create: `tsconfig.json`
- Create: `jest.config.cjs`
- Modify: `package.json`
- Modify: `package-lock.json`

- [ ] **Step 1: Add a failing build contract by running the existing build**

Run: `npm run build`

Expected: FAIL with `TS5057: Cannot find a tsconfig.json file`.

- [ ] **Step 2: Add strict TypeScript and Jest configuration**

Create `tsconfig.json`:

```json
{
  "compilerOptions": {
    "declaration": true,
    "esModuleInterop": true,
    "jsx": "react-jsx",
    "lib": ["ES2022", "DOM"],
    "module": "CommonJS",
    "outDir": "dist",
    "rootDir": "src",
    "skipLibCheck": true,
    "strict": true,
    "target": "ES2022"
  },
  "exclude": ["dist", "node_modules", "tests"],
  "include": ["src/**/*.ts", "src/**/*.tsx"]
}
```

Create `jest.config.cjs`:

```js
/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  roots: ['<rootDir>/src'],
  testMatch: ['**/*.test.ts', '**/*.test.tsx'],
  testEnvironment: 'node',
};
```

Update the scripts in `package.json` to:

```json
{
  "build": "rm -rf dist && tsc --project .",
  "test": "npm run test:runtime && npm run test:types",
  "test:runtime": "jest --runInBand",
  "test:types": "tsc --project tsconfig.type-tests.json"
}
```

Install development-only hook-test dependencies:

```bash
npm install --save-dev @testing-library/react jest-environment-jsdom react-dom @types/react-dom
```

- [ ] **Step 3: Verify the build is green**

Run: `npm run build`

Expected: PASS and `dist/` contains compiled JavaScript and declarations.

- [ ] **Step 4: Commit the tooling foundation**

```bash
git add package.json package-lock.json tsconfig.json jest.config.cjs
git commit -m "test: configure build and Jest"
```

### Task 2: Lock down the typed-route public contract

**Files:**
- Create: `tsconfig.type-tests.json`
- Create: `tests/types/routes.test.ts`

- [ ] **Step 1: Write the compile-time route assertions**

Create `tsconfig.type-tests.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "noEmit": true, "rootDir": "." },
  "include": ["src/**/*.ts", "tests/types/**/*.ts"]
}
```

Create `tests/types/routes.test.ts`:

```ts
import { Api } from 'fetch-run';
import { createApiStore } from '../../src';

type User = { id: number; name: string };

const api = createApiStore(Api.create('https://api.example.test'));

const useHealth = api.route('health').list<User>();
useHealth();

const useUsers = api.route('organizations/:organizationId/users').list<User>();
useUsers({ organizationId: 1 });
// @ts-expect-error route parameters are required
useUsers();
// @ts-expect-error unknown keys cannot replace required route parameters
useUsers({ organization: 1 });

const useUser = api.route('organizations/:organizationId/users').read<User>();
useUser(42, { organizationId: 'acme' });
// @ts-expect-error parent route parameters are required for reads
useUser(42);
// @ts-expect-error a resource ID is string or number
useUser({ id: 42 }, { organizationId: 'acme' });

const useCreateUser = api.route('organizations/:organizationId/users').create<{ name: string }, User>();
useCreateUser({ organizationId: 'acme' });
// @ts-expect-error mutation routes require their route parameters
useCreateUser();
```

- [ ] **Step 2: Run the type test to verify the current contract is accepted**

Run: `npm run test:types`

Expected: PASS. The assertion file documents existing desired behavior; if it fails, correct the test configuration rather than changing route signatures.

- [ ] **Step 3: Commit the type-contract guardrail**

```bash
git add tsconfig.type-tests.json tests/types/routes.test.ts
git commit -m "test: protect typed route contracts"
```

### Task 3: Deduplicate query requests and normalize stored errors

**Files:**
- Create: `src/store.test.ts`
- Modify: `src/store.ts`

- [ ] **Step 1: Write failing store tests**

Create `src/store.test.ts` with a deferred helper and these contract tests:

```ts
import { executeQuery, resetQueries, store } from './store';

function deferred<T>() {
  let reject!: (reason?: unknown) => void;
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res, rej) => { resolve = res; reject = rej; });
  return { promise, reject, resolve };
}

afterEach(() => resetQueries('store-test'));

test('shares one in-flight promise for a namespace and cache key', async () => {
  const request = deferred<{ id: number }>();
  const run = jest.fn(() => request.promise);

  const first = executeQuery('store-test', 'users', run);
  const second = executeQuery('store-test', 'users', run);

  expect(second).toBe(first);
  expect(run).toHaveBeenCalledTimes(1);
  request.resolve({ id: 1 });
  await expect(first).resolves.toBeUndefined();
  expect(store.getState().namespaces['store-test'].data.users).toEqual({ id: 1 });
});

test('stores a normalized Error and shares request failure', async () => {
  const request = deferred<never>();
  const first = executeQuery('store-test', 'users', () => request.promise);
  const second = executeQuery('store-test', 'users', () => request.promise);

  request.reject('offline');
  await expect(first).rejects.toThrow('offline');
  await expect(second).rejects.toThrow('offline');
  expect(store.getState().namespaces['store-test'].errors.users).toBeInstanceOf(Error);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test:runtime -- store.test.ts`

Expected: FAIL because concurrent executions return `undefined` instead of a shared pending promise, and a string rejection is stored without normalization.

- [ ] **Step 3: Implement the smallest store change**

Add these private declarations after `store`:

```ts
const inFlightQueries = new Map<string, Map<string, Promise<void>>>();

function toError(error: unknown): Error {
  return error instanceof Error ? error : new Error(String(error));
}
```

Replace `executeQuery` with:

```ts
export function executeQuery(
  ns: string,
  id: string,
  request: () => Promise<unknown>
) {
  const namespaceFlights = inFlightQueries.get(ns) ?? new Map<string, Promise<void>>();
  const existing = namespaceFlights.get(id);

  if (existing) return existing;

  inFlightQueries.set(ns, namespaceFlights);
  setQueryExecuting(ns, id);

  const promise = new Promise<unknown>((resolve) => resolve(request()))
    .then((data) => setQueryExecuted(ns, id, data))
    .catch((error: unknown) => {
      const normalizedError = toError(error);
      setQueryErrored(ns, id, normalizedError);
      throw normalizedError;
    })
    .finally(() => {
      if (namespaceFlights.get(id) === promise) {
        namespaceFlights.delete(id);
      }
      if (namespaceFlights.size === 0) {
        inFlightQueries.delete(ns);
      }
    });

  namespaceFlights.set(id, promise);
  return promise;
}
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm run test:runtime -- store.test.ts`

Expected: PASS with both tests green.

- [ ] **Step 5: Commit request-state correctness**

```bash
git add src/store.ts src/store.test.ts
git commit -m "fix: deduplicate query requests"
```

### Task 4: Cache search queries by URL and absorb automatic-fetch failures

**Files:**
- Create: `src/query.test.tsx`
- Modify: `src/query.ts`

- [ ] **Step 1: Write failing hook tests**

Create `src/query.test.tsx`:

```tsx
/** @jest-environment jsdom */
import { cleanup, render, waitFor } from '@testing-library/react';
import { createSearchQuery } from './resource';
import { resetQueries, store } from './store';

afterEach(() => {
  cleanup();
  resetQueries('query-test');
});

test('uses the full search URL as the cache key', async () => {
  const execute = jest.fn(async (url: string) => ({ page: url.split('=')[1] }));
  const useSearch = createSearchQuery('query-test', 'users', execute);

  function Probe({ query }: { query: string }) {
    const { data } = useSearch(new URLSearchParams(query));
    return <output>{data?.page}</output>;
  }

  render(<><Probe query="page=1" /><Probe query="page=2" /></>);

  await waitFor(() => expect(execute).toHaveBeenCalledTimes(2));
  await waitFor(() => expect(store.getState().namespaces['query-test'].data).toEqual({
    'users?page=1': { page: '1' },
    'users?page=2': { page: '2' },
  });
});

test('captures automatic-fetch failures in query state', async () => {
  const useSearch = createSearchQuery('query-test', 'users', async () => {
    throw new Error('offline');
  });

  function Probe() {
    const { error } = useSearch();
    return <output>{error?.message}</output>;
  }

  const { getByText } = render(<Probe />);
  await waitFor(() => expect(getByText('offline')).toBeTruthy());
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test:runtime -- query.test.tsx`

Expected: FAIL because both search probes share the `users` cache key; the rejection test exposes the uncaught effect promise.

- [ ] **Step 3: Implement the smallest query change**

Replace the route/key setup, refetch callback, and effect in `src/query.ts` with:

```ts
const routeId = buildRoute(route, routeParams);
const url = !searchParams ? routeId : `${routeId}?${searchParams}`;
const id = url;

const refetch = useCallback(() => {
  return executeQuery(ns, id, () => execute(url));
}, [execute, id, ns, url]);

useEffect(() => {
  if (!error && (!data || isStale)) {
    void refetch().catch(() => undefined);
  }
}, [data, error, isStale, refetch]);
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm run test:runtime -- query.test.tsx`

Expected: PASS with isolated page cache entries and a rendered query error.

- [ ] **Step 5: Commit cache identity correctness**

```bash
git add src/query.ts src/query.test.tsx
git commit -m "fix: isolate search query cache entries"
```

### Task 5: Keep mutation loading true across overlapping calls

**Files:**
- Create: `src/mutation.test.tsx`
- Modify: `src/mutation.ts`

- [ ] **Step 1: Write a failing overlapping-mutation hook test**

Create `src/mutation.test.tsx`:

```tsx
/** @jest-environment jsdom */
import { act, render } from '@testing-library/react';
import { createMutation } from './mutation';

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => { resolve = res; });
  return { promise, resolve };
}

test('keeps loading true until every overlapping mutation settles', async () => {
  const first = deferred<{ id: number }>();
  const second = deferred<{ id: number }>();
  const execute = jest
    .fn<(url: string, data: { name: string }) => Promise<{ id: number }>>()
    .mockReturnValueOnce(first.promise)
    .mockReturnValueOnce(second.promise);
  const useMutation = createMutation('users', execute);
  let result!: ReturnType<typeof useMutation>;

  function Probe() {
    result = useMutation();
    return <output>{String(result[1])}</output>;
  }

  render(<Probe />);
  let firstCall!: Promise<{ id: number }>;
  let secondCall!: Promise<{ id: number }>;
  act(() => {
    firstCall = result[0]({ name: 'Ada' });
    secondCall = result[0]({ name: 'Grace' });
  });
  expect(result[1]).toBe(true);

  await act(async () => { first.resolve({ id: 1 }); await firstCall; });
  expect(result[1]).toBe(true);

  await act(async () => { second.resolve({ id: 2 }); await secondCall; });
  expect(result[1]).toBe(false);
});
```

- [ ] **Step 2: Run the focused test and verify it fails**

Run: `npm run test:runtime -- mutation.test.tsx`

Expected: FAIL after the first request resolves because the existing boolean is set to `false` while the second request remains pending.

- [ ] **Step 3: Implement the smallest mutation change**

Replace mutation loading state and tuple return in `src/mutation.ts` with:

```ts
const [pendingCount, setPendingCount] = useState(0);

const mutate = useCallback(
  async (data: Req): Promise<Res> => {
    setError(null);
    setPendingCount((count) => count + 1);

    try {
      return await execute(url, data);
    } catch (err) {
      if (err instanceof Error) setError(err);
      throw err;
    } finally {
      setPendingCount((count) => count - 1);
    }
  },
  [execute, url]
);

return [mutate, pendingCount > 0, error] as const;
```

- [ ] **Step 4: Run the focused test and verify it passes**

Run: `npm run test:runtime -- mutation.test.tsx`

Expected: PASS, with loading remaining true until the final pending mutation settles.

- [ ] **Step 5: Commit mutation-state correctness**

```bash
git add src/mutation.ts src/mutation.test.tsx
git commit -m "fix: track overlapping mutation requests"
```

### Task 6: Run the complete verification suite

**Files:**
- Modify: only files required by failures from the commands below

- [ ] **Step 1: Run all runtime and compile-time tests**

Run: `npm test`

Expected: PASS with the store, query, mutation, and route type tests green.

- [ ] **Step 2: Run the package build**

Run: `npm run build`

Expected: PASS and emit a consumable `dist/` directory.

- [ ] **Step 3: Inspect the final change set**

Run: `git status --short && git log --oneline -6`

Expected: no generated `dist/`, `coverage/`, or `node_modules/` files are tracked; each hardening unit has a focused commit.
