import { Api } from "fetch-run";
import { createApiStore, MutationResult } from "../../src";

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
const writeResult: void = api.setData("users/42", { id: 42, name: "Ada" });
api.setData("count", 42);
api.setData("empty", null);
api.setData("missing", undefined);
// @ts-expect-error cache keys must be strings
api.setData(42, {});
// @ts-expect-error replacement data is required
api.setData("users/42");
// @ts-expect-error the setter has no response type parameter
api.setData<User>("users/42", { id: 42, name: "Ada" });
// @ts-expect-error the old global setter name is not exposed
api.setQueryData("users", []);

function setUserData(id: number, data: User): void {
  api.setData(`users/${id}`, data);
}
setUserData(42, { id: 42, name: "Ada" });
// @ts-expect-error application helpers enforce the response type
setUserData(42, { id: "42", name: "Ada" });

// @ts-expect-error read hooks have no setter
useUser(42, { organizationId: "acme" }).setData;
// @ts-expect-error read IDs remain required
api.route("users").read<User>()();
// @ts-expect-error list hooks have no setter
useUsers({ organizationId: "acme" }).setData;
// @ts-expect-error search hooks have no setter
useSearch(undefined, { organizationId: "acme" }).setData;
const useCustom = api.createQuery("users/:id", async () => ({ count: 1 }));
// @ts-expect-error custom queries have no setter
useCustom({ id: 1 }).setData;
// @ts-expect-error custom query route parameters remain required
useCustom();
const useCustomMutation = api.createMutation("users", async () => ({ id: 1 }));
// @ts-expect-error custom mutation results have only three tuple items
useCustomMutation()[3];
// @ts-expect-error delete results have only three tuple items
useDelete(42)[3];

async function checkMutationResults() {
  const result: MutationResult<User> = await useCreateUser({
    organizationId: "acme",
  })[0]({ name: "Ada" });
  // @ts-expect-error data is only available after checking success
  result.data;
  if (result.ok) {
    const user: User = result.data;
    // @ts-expect-error successful results do not have errors
    result.error;
  } else {
    const error: Error = result.error;
    // @ts-expect-error failed results do not have data
    result.data;
  }
  const removed: MutationResult<void> = await useDelete(42)[0]();
  if (removed.ok) {
    const data: void = removed.data;
  }
  const updated: MutationResult<User> = await useUpdateUser(42)[0]({
    name: "Ada",
  });
  const custom = api.createMutation("users/:id", async (_url, _data: void) => ({
    id: 1,
  }));
  const outcome: MutationResult<{ id: number }> = await custom({ id: 1 })[0]();
}
