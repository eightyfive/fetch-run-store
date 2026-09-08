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

const [, , , setCreatedUser] = useCreateUser({ organizationId: "acme" });
setCreatedUser({ id: 42, name: "Ada" });
// @ts-expect-error data must include its resource ID
setCreatedUser({ name: "Ada" });
// @ts-expect-error data must match the mutation response type
setCreatedUser({ id: "42", name: "Ada" });
// @ts-expect-error undefined is not resource data
setCreatedUser(undefined);
const useUpdateUser = api.route("users").update<{ name: string }, User>();
const [, , , setUpdatedUser] = useUpdateUser();
setUpdatedUser({ id: 42, name: "Grace" });
// @ts-expect-error update data must match the response type
setUpdatedUser([{ id: 42, name: "Grace" }]);
// @ts-expect-error create responses must have a resource ID
api.route("users").create<{ name: string }, { name: string }>();
// @ts-expect-error update responses must have a string or number ID
api.route("users").update<{ name: string }, { id: boolean }>();
// @ts-expect-error create responses must be resources, not void
api.route("users").create<{ name: string }, void>();
// @ts-expect-error global untyped cache writes are not exposed
api.setQueryData("users", []);
