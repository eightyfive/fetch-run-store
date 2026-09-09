import { Api } from "fetch-run";
import { createApiStore } from "../../src";

type User = { id: number; name: string };

const api = createApiStore(Api.create("https://api.example.test"));

const useHealth = api.route("health").list<User>();
useHealth();
// @ts-expect-error list hooks without path parameters take no arguments
useHealth(new URLSearchParams({ page: "1" }));
// @ts-expect-error query-string parameters belong to search hooks
useHealth(undefined, new URLSearchParams({ page: "1" }));

const useUsers = api.route("organizations/:organizationId/users").list<User>();
useUsers({ organizationId: 1 });
// @ts-expect-error list hooks accept path parameters only
useUsers({ organizationId: 1 }, new URLSearchParams({ page: "1" }));
// @ts-expect-error route parameters are required
useUsers();
// @ts-expect-error unknown keys cannot replace required route parameters
useUsers({ organization: 1 });

const useUser = api.route("organizations/:organizationId/users").read<User>();
useUser(42, { organizationId: "acme" });
// @ts-expect-error parent route parameters are required for reads
useUser(42);
// @ts-expect-error a resource ID is string or number
useUser({ id: 42 }, { organizationId: "acme" });

const useCreateUser = api
  .route("organizations/:organizationId/users")
  .create<{ name: string }, User>();
useCreateUser({ organizationId: "acme" });
// @ts-expect-error mutation routes require their route parameters
useCreateUser();

const useSearch = api
  .route("organizations/:organizationId/users")
  .search<User>();
useSearch(new URLSearchParams(), { organizationId: "acme" });
useSearch(undefined, { organizationId: "acme" });
// @ts-expect-error search routes require their route parameters
useSearch();
// @ts-expect-error search parameters do not substitute for route parameters
useSearch(new URLSearchParams());
// @ts-expect-error unknown route parameters are rejected
useSearch(undefined, { organization: "acme" });
api.route("users").search<User>()();

// @ts-expect-error create results have only three tuple items
useCreateUser({ organizationId: "acme" })[3];
const useUpdateUser = api.route("users").update<{ name: string }, User>();
// @ts-expect-error update results have only three tuple items
useUpdateUser(42)[3];
// @ts-expect-error update requires a resource ID
useUpdateUser();
const nested = api.route("organizations/:organizationId/users");
const useNestedUpdate = nested.update<{ name: string }, { name: string }>();
useNestedUpdate(42, { organizationId: "acme" });
// @ts-expect-error parent params are required for updates
useNestedUpdate(42);
// @ts-expect-error update ID must be a string or number
useNestedUpdate({ id: 42 }, { organizationId: "acme" });
const useNestedDelete = nested.delete();
useNestedDelete(42, { organizationId: "acme" });
// @ts-expect-error parent params are required for deletes
useNestedDelete(42);
// @ts-expect-error delete ID must be a string or number
useNestedDelete({ id: 42 }, { organizationId: "acme" });
const useDelete = api.route("users").delete();
useDelete(42);
// @ts-expect-error delete requires a resource ID
useDelete();
api.route("users").create<{ name: string }, { name: string }>()();
api.route("users").update<{ name: string }, void>()(42);
// @ts-expect-error global untyped cache writes are not exposed
api.setQueryData("users", []);

const user = useUser(42, { organizationId: "acme" });
user.setData({ id: 42, name: "Ada" });
user.setData(previous => {
  const value: User | undefined = previous;
  // @ts-expect-error previous may be undefined
  const required: User = previous;
  return { id: 42, name: value?.name ?? "Ada" };
});
// @ts-expect-error data must match the query response
user.setData({ id: "42", name: "Ada" });
// @ts-expect-error setters are already bound to an ID
user.setData(42, { id: 42, name: "Ada" });
// @ts-expect-error undefined is not response data
user.setData(undefined);
// @ts-expect-error updater must return response data
user.setData(() => undefined);
// @ts-expect-error read IDs remain required
api.route("users").read<User>()();
const list = useUsers({ organizationId: "acme" });
list.setData([{ id: 42, name: "Ada" }]);
list.setData(previous => [...(previous ?? []), { id: 43, name: "Grace" }]);
// @ts-expect-error lists require arrays
list.setData({ id: 42, name: "Ada" });
const search = useSearch(undefined, { organizationId: "acme" });
search.setData(previous => previous ?? []);
// @ts-expect-error searches require arrays
search.setData({ id: 42, name: "Ada" });
const useCustom = api.createQuery("users/:id", async () => ({ count: 1 }));
useCustom({ id: 1 }).setData(previous => ({ count: (previous?.count ?? 0) + 1 }));
// @ts-expect-error custom query route parameters remain required
useCustom();
// @ts-expect-error custom query setter uses its response type
useCustom({ id: 1 }).setData([]);
