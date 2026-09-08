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

api.setQueryData("users/42", { id: 42, name: "Ada" });
// @ts-expect-error undefined is not a replacement value
api.setQueryData<User>("users/42", undefined);
// @ts-expect-error undefined is rejected without an explicit type too
api.setQueryData("leagues", undefined);
// @ts-expect-error values must match the explicit response type
api.setQueryData<User>("users/42", { id: "42", name: "Ada" });
