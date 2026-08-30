import { Api } from "fetch-run";
import { createApiStore } from "../../src";

type User = { id: number; name: string };

const api = createApiStore(Api.create("https://api.example.test"));

const useHealth = api.route("health").list<User>();
useHealth();

const useUsers = api
  .route("organizations/:organizationId/users")
  .list<User>();
useUsers({ organizationId: 1 });
// @ts-expect-error route parameters are required
useUsers();
// @ts-expect-error unknown keys cannot replace required route parameters
useUsers({ organization: 1 });

const useUser = api
  .route("organizations/:organizationId/users")
  .read<User>();
useUser(42, { organizationId: "acme" });
// @ts-expect-error parent route parameters are required for reads
useUser(42);
// @ts-expect-error a resource ID is string or number
useUser({ id: 42 }, { organizationId: "acme" });

const useUserSearch = api
  .route("organizations/:organizationId/users")
  .search<User>();
useUserSearch(new URLSearchParams("name=ada"), { organizationId: "acme" });
// @ts-expect-error parent route parameters are required for searches
useUserSearch();

const useCreateUser = api
  .route("organizations/:organizationId/users")
  .create<{ name: string }, User>();
useCreateUser({ organizationId: "acme" });
// @ts-expect-error mutation routes require their route parameters
useCreateUser();
