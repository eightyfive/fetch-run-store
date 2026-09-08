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
hooks from typed routes:

```ts
import { Api } from "fetch-run";
import { createApiStore } from "fetch-run-store";

const api = Api.create("https://api.example.com");
export const apiStore = createApiStore(api);

type User = { id: number; name: string };

const users = apiStore.route("users");
export const useUsers = users.list<User>();
export const useUser = users.read<User>();
export const useCreateUser = users.create<{ name: string }, User>();
export const useUpdateUser = users.update<{ name: string }, User>();

const organizationUsers = apiStore.route("organizations/:organizationId/users");
export const useOrganizationUsers = organizationUsers.list<User>();
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

`create()` and `update()` mutation hooks expose `setData(data)` as their
fourth tuple item. Their response types must include `id: string | number`.
The setter uses that response type and `data.id` to write only the
individual resource key: a hook defined on `"leagues"` writes `"leagues/:id"`,
the same entry used by `route("leagues").read<League>()`. Define these hooks on
the collection route; parent route parameters are resolved from the hook's
arguments, and the resource ID from `data.id` is URL-encoded.

```tsx
const leagues = apiStore.route("leagues");
const useCreateLeague = leagues.create<{ name: string }, League>();
const useUpdateLeague = leagues.update<{ id: League["id"]; name: string }, League>();

// Inside a component:
const [createLeague, isCreating, createError, setCreatedData] = useCreateLeague();
const [updateLeague, isUpdating, updateError, setUpdatedData] = useUpdateLeague();

async function create(name: string) {
  const league = await createLeague({ name });
  setCreatedData(league);
}

async function rename(league: League, name: string) {
  setUpdatedData({ ...league, name });
  try {
    await updateLeague({ id: league.id, name });
  } catch (error) {
    setUpdatedData(league);
    throw error;
  } finally {
    apiStore.invalidateQuery(`leagues/${encodeURIComponent(String(league.id))}`);
  }
}
```

`setData` updates subscribed hooks immediately. Only cached data changes:
freshness, errors, and fetching state are preserved. Pending requests continue
normally, and successful server responses overwrite optimistic data. Failed
requests report their errors while retaining cached data. Lists, search variants,
and other resources are unchanged; invalidate lists separately when needed.
The setter does not change the mutation's request URL or send a request itself.
Updater callbacks and `undefined` are not supported. Use a custom mutation for
endpoints returning no resource or a response without an ID. Custom mutations
and `delete()` hooks retain their existing three-item tuples.

`apiStore.invalidateQuery(id)` marks cache entries stale. Pass a resolved route
to invalidate that route and every search variant; pass a resolved route with
search parameters to invalidate only that exact search entry:

```ts
apiStore.invalidateQuery("users");
apiStore.invalidateQuery("organizations/1234/users");
apiStore.invalidateQuery("users?name=Ada");
```

Matching is literal: `users` does not match `users/42` or `usersettings`, and
wildcards are not supported. Empty search parameters share the route key.
Nonempty keys use `URLSearchParams.toString()` as-is, including parameter order.
Changing search parameters fetches an uncached variant automatically; debounce
the parameters passed to the hook when needed. A hook's `invalidate()` follows
the same matching rules (an empty-search hook invalidates all route variants).

`apiStore.invalidateQueries()` invalidates every query for that API while
keeping its cached data available until a refetch completes. Active hooks
refetch; inactive hooks refetch when they next mount. `apiStore.resetQueries()`
clears that API's cache entirely.

For example, invalidate after a successful mutation observed by `fetch-run`:

```ts
api.subscribe((request, response) => {
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(
    request.method,
  );
  const isSuccess = response.status >= 200 && response.status < 300;

  if (isMutation && isSuccess) apiStore.invalidateQueries();
});
```

Refresh API-backed screens when the app returns to the foreground:

```ts
function onAppForeground() {
  apiStore.invalidateQueries();
}
```

Apply authentication changes from your application's session-store
subscription:

```ts
function applyToken(token: string | null) {
  api.setBearer(token);

  if (token) {
    // Retry the current user query after a previous 401.
    apiStore.invalidateQuery("user");
  } else {
    // Do not retain data from the previous session.
    apiStore.resetQueries();
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
