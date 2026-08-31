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

React is a peer dependency.

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

const organizationUsers = apiStore.route(
  "organizations/:organizationId/users"
);
export const useOrganizationUsers = organizationUsers.list<User>();
```

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
      <ul>{users?.map((user) => <li key={user.id}>{user.name}</li>)}</ul>
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

## Cache lifecycle

Cache lifecycle is explicit. Queries retain their data until you invalidate or
reset them; mutations do not invalidate queries automatically.

`apiStore.invalidateQuery(id)` marks one exact cache ID stale. Pass the
resolved route you want to invalidate:

```ts
apiStore.invalidateQuery("users");
apiStore.invalidateQuery("organizations/1234/users");
```

`apiStore.invalidateQueries()` marks every query for that API stale while
keeping its cached data. Active hooks refetch; inactive hooks refetch when
they next mount. `apiStore.resetQueries()` clears that API's cache entirely.

For example, invalidate after a successful mutation observed by `fetch-run`:

```ts
api.subscribe((request, response) => {
  const isMutation = ["POST", "PUT", "PATCH", "DELETE"].includes(
    request.method
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
- A cache entry and in-flight request are identified by the resolved route
  path. Concurrent callers share the first active request for that route.
- Search parameters change the request URL, not the route cache key. Debounce
  and choose refetch behavior in the application.
- Applications own retries, cancellation, refetch timing, and cache lifecycle.
  There is no automatic mutation invalidation, retry policy, cancellation, or
  cache garbage collection.

These limits are deliberate: keep the public API narrow, predictable, and
easy to adopt.
