# fetch-run-store

Small, typed React hooks for APIs built with [`fetch-run`](https://www.npmjs.com/package/fetch-run).

`fetch-run-store` turns route strings into query and mutation hooks. Route
parameters are inferred from the route, so a route such as
`"organizations/:organizationId/users"` requires `organizationId` everywhere
it is used.

## Install

```sh
npm install fetch-run fetch-run-store
```

React 18 or 19 and fetch-run 3 are peer dependencies. Use a modern browser
bundler and a runtime with Fetch and URLSearchParams. TypeScript declarations
are included; no separate types package is needed for fetch-run-store.

The planned first release is 0.1.0: the API may evolve before 1.0.0. See
[the changelog](CHANGELOG.md).

Maintainers release with `npm run release` (local `np`, requiring Node 22+ and
npm 10+). The package stays at 0.0.0 until `np` prompts for the first version;
select 0.1.0 when publishing from `main`.

## Usage

Create one API store for each `Api` instance, then define your application
hooks from typed routes. Name the returned factory for its route—for example,
`const chatFactory = apiStore.route("chats")`. Its methods create hooks:

```ts
import { Api } from "fetch-run";
import { createApiStore } from "fetch-run-store";

const api = Api.create("https://api.example.com");
export const apiStore = createApiStore(api);

type User = { id: number; name: string };

const userFactory = apiStore.route("users");
export const useUsers = userFactory.list<User>();
export const useUser = userFactory.read<User>();
export const useCreateUser = userFactory.create<{ name: string }, User>();
export const useUpdateUser = userFactory.update<{ name: string }, User>();

const organizationUsersFactory = apiStore.route(
  "organizations/:organizationId/users",
);
export const useOrganizationUsers = organizationUsersFactory.list<User>();
```

Caches are shared by `api.baseUrl`: separate instances with the same base URL
share data, in-flight requests, invalidation, and reset. Applications own the
cache lifecycle, including resetting shared caches after authentication changes.
The cache is module-global; server applications must account for that sharing
between requests to the same base URL.

Use those hooks in components:

```tsx
function Users() {
  const { data: users, error, isLoading, refetch } = useUsers();
  const [createUser, isCreating] = useCreateUser();

  if (isLoading) return <p>Loading…</p>;
  if (error) return <p>{error.message}</p>;

  return (
    <>
      <button onClick={() => void refetch()}>Refresh</button>
      <button
        disabled={isCreating}
        onClick={() => void createUser({ name: "Ada" })}
      >
        Add user
      </button>
      <ul>
        {users?.map((user) => (
          <li key={user.id}>{user.name}</li>
        ))}
      </ul>
    </>
  );
}

function OrganizationUsers({ organizationId }: { organizationId: string }) {
  const { data } = useOrganizationUsers({ organizationId });
  return <p>{data?.length ?? 0} users</p>;
}
```

`createApiStore` is the public entry point. It provides `route()` for typed
CRUDL hooks, `createQuery()` for a custom query, `createMutation()` for a
custom mutation, and the cache controls below.

`list()` hooks accept only the path parameters declared in the route (or no
arguments for a route without parameters). Use `search()` hooks explicitly
when passing query-string parameters via `URLSearchParams`.

## Cache lifecycle

Cache lifecycle is explicit. Queries retain their data until you invalidate or
reset them; mutations do not invalidate queries automatically.

`read()`, `update()`, and `delete()` hooks share the same arguments:
`(id, routeParams?)`. Parent route parameters are required when the collection
route declares them. All three target the individual resource at `resource/:id`:

```ts
const userFactory = apiStore.route("organizations/:organizationId/users");
const useUser = userFactory.read<User>();
const useUpdateUser = userFactory.update<{ name: string }, User>();
const useDeleteUser = userFactory.delete();

// Inside a component:
useUser(42, { organizationId: "acme" });
useUpdateUser(42, { organizationId: "acme" });
useDeleteUser(42, { organizationId: "acme" });
```

`apiStore.setData(key: string, data: unknown): void` writes a direct value to
one exact cache key in the API's namespace, creating the entry if it is missing.
Use the resolved route, including encoded route parameters, resource ID, and
any nonempty `URLSearchParams.toString()` suffix. For example:

```ts
apiStore.setData("matches/42", match);
apiStore.setData("matches?status=active", activeMatches);
```

Query and mutation hooks do not expose setters. Application services can provide
typed helpers:

```ts
export function setMatchData(id: number, data: Match) {
  apiStore.setData(`matches/${id}`, data);
}
```

Optimistic updates must compute the next value before calling the setter:

```tsx
const useMatch = apiStore.route("matches").read<Match>();
const useUpdateMatch = apiStore.route("matches").update<{ name: string }, Match>();

// Inside a component:
const { data: match, invalidate } = useMatch(matchId);
const [updateMatch, isUpdating, updateError] = useUpdateMatch(matchId);

async function rename(name: string) {
  if (match) {
    const nextMatch = { ...match, name };
    setMatchData(matchId, nextMatch);
  }
  try {
    await updateMatch({ name });
  } finally {
    invalidate();
  }
}
```

`setData` updates subscribed hooks immediately. Only cached data changes:
freshness, errors, and fetching state are preserved. A new entry remains stale
and fetches normally when a query mounts. Pending requests continue normally,
and successful server responses overwrite local data. Failed requests report
errors while retaining cached data. Other cache keys are unchanged; invalidate
related queries separately when needed. The setter sends no request.

Any value, including `null` and `undefined`, can be stored. Functional updaters
are not supported: passing a function stores that function as data without
calling it. The string key does not infer a response type; use application
helpers when you need type checking.

Create, update, delete, and custom mutation results are three-item tuples:
`[mutate, isPending, error]`.

`apiStore.invalidate(id)` marks cache entries stale. Pass a resolved route
to invalidate that route and every search variant; pass a resolved route with
search parameters to invalidate only that exact search entry:

```ts
apiStore.invalidate("users");
apiStore.invalidate("organizations/1234/users");
apiStore.invalidate("users?name=Ada");
```

Matching is literal: `users` does not match `users/42` or `usersettings`, and
wildcards are not supported. Empty search parameters share the route key.
Nonempty keys use `URLSearchParams.toString()` as-is, including parameter order.
Changing search parameters fetches an uncached variant automatically; debounce
the parameters passed to the hook when needed. A hook's `invalidate()` follows
the same matching rules (an empty-search hook invalidates all route variants).

`apiStore.invalidateAll()` invalidates every query for that API while
keeping its cached data available until a refetch completes. Active hooks
refetch; inactive hooks refetch when they next mount. `apiStore.resetAll()`
clears that API's cache entirely. In both names, `All` means the API namespace
identified by its base URL, including other stores using that same base URL.
`invalidate(id)` requires an ID; use `invalidateAll()` for API-wide invalidation.

For example, invalidate after a successful mutation observed by `fetch-run`:

```ts
api.subscribe((request, response) => {
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(
    request.method,
  );
  const isSuccess = response.status >= 200 && response.status < 300;

  if (isMutation && isSuccess) apiStore.invalidateAll();
});
```

Refresh API-backed screens when the app returns to the foreground:

```ts
function onAppForeground() {
  apiStore.invalidateAll();
}
```

Apply authentication changes from your application's session-store
subscription:

```ts
function applyToken(token: string | null) {
  api.setBearer(token);

  if (token) {
    // Retry the current user query after a previous 401.
    apiStore.invalidate("user");
  } else {
    // Do not retain data from the previous session.
    apiStore.resetAll();
  }
}
```

## Design constraints

This library intentionally does one small job: turn typed API routes into
React query and mutation hooks with explicit cache controls.

- Preserve typed routes. Route parameter inference is a core guarantee.
- A cache entry and in-flight request are identified by the resolved route and
  its nonempty search parameters. Concurrent callers share the first active
  request for that exact URL.
- Invalidating a route also invalidates all of its search variants. Invalidating
  a URL with search parameters affects that exact cache entry. Debounce and
  choose refetch behavior in the application.
- Applications own retries, cancellation, refetch timing, and cache lifecycle.
  There is no automatic mutation invalidation, retry policy, cancellation, or
  cache garbage collection.

These limits are deliberate: keep the public API narrow, predictable, and
easy to adopt.
