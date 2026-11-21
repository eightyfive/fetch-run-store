import { Api } from "fetch-run";
import { createApiStore, MutationResult } from "../../src";
import { createQuery } from "../../src/query";
import { createMutation } from "../../src/mutation";

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

// Equality assertions detect accidental widening (including `any`) in inference.
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2
    ? true
    : false;
type Expect<T extends true> = T;
type LeagueResponse = {
  league_id: number;
  league_name: string;
  rawOnly: boolean;
};
type League = { id: number; name: string };
type LeagueRequest = { name: string };
const normalizeLeagueResponse = (response: LeagueResponse): League => ({
  id: response.league_id,
  name: response.league_name,
});
const normalizeLeagues = (response: {
  items: LeagueResponse[];
  total: number;
}) => response.items.map(normalizeLeagueResponse);
const leagues = api.route("organizations/:organizationId/leagues");
const params = { organizationId: "acme" };
const useLeague = leagues.read(normalizeLeagueResponse);
const league = useLeague(1, params);
type ReadOutput = Expect<Equal<typeof league.data, League | undefined>>;
// @ts-expect-error transformed reads do not expose raw fields
league.data?.rawOnly;
// @ts-expect-error transformed reads require parent parameters
useLeague(1);
// @ts-expect-error incorrect parent parameters are rejected
useLeague(1, { organization: "acme" });
// @ts-expect-error resource IDs remain string or number
useLeague({ id: 1 }, params);
const useLeagueList = leagues.list(normalizeLeagues);
const leagueList = useLeagueList(params);
type ListOutput = Expect<Equal<typeof leagueList.data, League[] | undefined>>;
// @ts-expect-error list envelope is no longer exposed
leagueList.data?.total;
// @ts-expect-error list items do not expose wire fields
leagueList.data?.[0].league_id;
// @ts-expect-error transformed lists require route parameters
useLeagueList();
// @ts-expect-error incorrect list route parameters are rejected
useLeagueList({ organization: "acme" });
// @ts-expect-error lists still reject search parameters
useLeagueList(params, new URLSearchParams());
const useLeagueSearch = leagues.search(normalizeLeagues);
const leagueSearch = useLeagueSearch(new URLSearchParams(), params);
type SearchOutput = Expect<
  Equal<typeof leagueSearch.data, League[] | undefined>
>;
// @ts-expect-error search items do not expose wire fields
leagueSearch.data?.[0].rawOnly;
// @ts-expect-error transformed searches require route parameters
useLeagueSearch(new URLSearchParams());
// @ts-expect-error incorrect search route parameters are rejected
useLeagueSearch(undefined, { organization: "acme" });
const simpleLeagues = api.route("leagues");
const plainRead = simpleLeagues.read<League>()(1);
type SimpleRead = Expect<Equal<typeof plainRead.data, League | undefined>>;
const plainList = simpleLeagues.list<League>()();
const plainSearch = simpleLeagues.search<League>()();
type PlainList = Expect<Equal<typeof plainList.data, League[] | undefined>>;
type PlainSearch = Expect<Equal<typeof plainSearch.data, League[] | undefined>>;
simpleLeagues.read(normalizeLeagueResponse)(1);
simpleLeagues.list(normalizeLeagues)();
simpleLeagues.search(normalizeLeagues)();

const useLeagueCreate = leagues.create<LeagueRequest, LeagueResponse, League>(
  normalizeLeagueResponse,
);
const useLeagueUpdate = leagues.update<LeagueRequest, LeagueResponse, League>(
  normalizeLeagueResponse,
);
// With no request type specified, the wire and output types are inferred.
const inferredCreate = leagues.create(normalizeLeagueResponse);
const inferredUpdate = leagues.update(normalizeLeagueResponse);
const useLeagueDelete = leagues.delete(normalizeLeagueResponse);
type SuccessData<T extends (...args: never[]) => unknown> =
  Extract<Awaited<ReturnType<T>>, { ok: true }> extends { data: infer Data }
    ? Data
    : never;
type CreateOutput = Expect<
  Equal<SuccessData<ReturnType<typeof useLeagueCreate>[0]>, League>
>;
type UpdateOutput = Expect<
  Equal<SuccessData<ReturnType<typeof useLeagueUpdate>[0]>, League>
>;
type DeleteOutput = Expect<
  Equal<SuccessData<ReturnType<typeof useLeagueDelete>[0]>, League>
>;
type InferredCreateOutput = Expect<
  Equal<SuccessData<ReturnType<typeof inferredCreate>[0]>, League>
>;
type InferredUpdateOutput = Expect<
  Equal<SuccessData<ReturnType<typeof inferredUpdate>[0]>, League>
>;
type CreatePayload = Expect<
  Equal<Parameters<ReturnType<typeof useLeagueCreate>[0]>[0], LeagueRequest>
>;
type UpdatePayload = Expect<
  Equal<Parameters<ReturnType<typeof useLeagueUpdate>[0]>[0], LeagueRequest>
>;
// @ts-expect-error transformed creates require parent parameters
useLeagueCreate();
// @ts-expect-error incorrect create route parameters are rejected
useLeagueCreate({ organization: "acme" });
// @ts-expect-error transformed updates require parent parameters
useLeagueUpdate(1);
// @ts-expect-error incorrect update route parameters are rejected
useLeagueUpdate(1, { organization: "acme" });
// @ts-expect-error transformed deletes require parent parameters
useLeagueDelete(1);
// @ts-expect-error incorrect delete route parameters are rejected
useLeagueDelete(1, { organization: "acme" });
// @ts-expect-error delete IDs remain required
simpleLeagues.delete(normalizeLeagueResponse)();
// @ts-expect-error request payload fields are preserved
useLeagueCreate(params)[0]({ name: 123 });
// @ts-expect-error required request fields remain required
useLeagueUpdate(1, params)[0]({});
// @ts-expect-error delete still has no request payload
useLeagueDelete(1, params)[0]({ name: "League" });

const wireLeague: LeagueResponse = {
  league_id: 1,
  league_name: "Premier",
  rawOnly: true,
};
const executeLeague = async () => wireLeague;
const executeLeagueMutation = async (_url: string, _data: LeagueRequest) =>
  wireLeague;
const transformedQuery = api.createQuery(
  "leagues/:id",
  executeLeague,
  normalizeLeagueResponse,
);
const transformedMutation = api.createMutation(
  "leagues/:id",
  executeLeagueMutation,
  normalizeLeagueResponse,
);
const queryValue = transformedQuery({ id: 1 });
type QueryOutput = Expect<Equal<typeof queryValue.data, League | undefined>>;
type MutationOutput = Expect<
  Equal<SuccessData<ReturnType<typeof transformedMutation>[0]>, League>
>;
type MutationPayload = Expect<
  Equal<Parameters<ReturnType<typeof transformedMutation>[0]>[0], LeagueRequest>
>;
// @ts-expect-error low-level queries require route parameters
transformedQuery();
// @ts-expect-error incorrect low-level query parameters are rejected
transformedQuery({ leagueId: 1 });
// @ts-expect-error raw-only fields are absent from low-level query results
queryValue.data?.rawOnly;
// @ts-expect-error low-level mutations require route parameters
transformedMutation();
// @ts-expect-error incorrect low-level mutation parameters are rejected
transformedMutation({ leagueId: 1 });
// @ts-expect-error low-level mutation request fields are preserved
transformedMutation({ id: 1 })[0]({ name: 123 });
const plainQuery = api.createQuery("leagues", executeLeague)();
const plainMutation = api.createMutation("leagues", executeLeagueMutation);
type PlainQueryOutput = Expect<
  Equal<typeof plainQuery.data, LeagueResponse | undefined>
>;
type PlainMutationOutput = Expect<
  Equal<SuccessData<ReturnType<typeof plainMutation>[0]>, LeagueResponse>
>;
type PlainMutationPayload = Expect<
  Equal<Parameters<ReturnType<typeof plainMutation>[0]>[0], LeagueRequest>
>;
type PlainCreateOutput = Expect<
  Equal<SuccessData<ReturnType<typeof useCreateUser>[0]>, User>
>;
type PlainUpdateOutput = Expect<
  Equal<SuccessData<ReturnType<typeof useUpdateUser>[0]>, User>
>;
type PlainDeleteOutput = Expect<
  Equal<SuccessData<ReturnType<typeof useDelete>[0]>, void>
>;
// @ts-expect-error untransformed request payloads remain checked
plainMutation()[0]({ name: 123 });
// @ts-expect-error untransformed create payloads remain checked
useCreateUser(params)[0]({ name: 123 });
// @ts-expect-error untransformed update payloads remain checked
useUpdateUser(1)[0]({});

const emptyMutation = api.createMutation(
  "leagues",
  async (_url, _data: void): Promise<void> => undefined,
);
type EmptyMutation = Expect<
  Equal<SuccessData<ReturnType<typeof emptyMutation>[0]>, void>
>;
const maybeEmptyMutation = api.createMutation(
  "leagues",
  async (_url, _data: void): Promise<LeagueResponse | undefined> => undefined,
  normalizeLeagueResponse,
);
type MaybeEmptyMutation = Expect<
  Equal<
    SuccessData<ReturnType<typeof maybeEmptyMutation>[0]>,
    League | undefined
  >
>;
const emptyQuery = api.createQuery(
  "leagues",
  async () => undefined,
  normalizeLeagueResponse,
)();
type EmptyQuery = Expect<Equal<typeof emptyQuery.data, League | undefined>>;

async function checkTransformedMutationFields() {
  const results = [
    await useLeagueCreate(params)[0]({ name: "Premier" }),
    await useLeagueUpdate(1, params)[0]({ name: "Premier" }),
    await useLeagueDelete(1, params)[0](),
    await transformedMutation({ id: 1 })[0]({ name: "Premier" }),
  ];
  for (const result of results) {
    if (result.ok) {
      type Output = Expect<Equal<typeof result.data, League>>;
      // @ts-expect-error successful transformed mutations hide raw-only fields
      result.data.rawOnly;
    }
  }
}

// The underlying factories preserve the same contracts without an API store.
const directQuery = createQuery("type-test", "leagues/:id", executeLeague, normalizeLeagueResponse);
const directMutation = createMutation("leagues/:id", executeLeagueMutation, normalizeLeagueResponse);
type DirectQueryOutput = Expect<Equal<ReturnType<typeof directQuery>["data"], League | undefined>>;
type DirectMutationOutput = Expect<Equal<SuccessData<ReturnType<typeof directMutation>[0]>, League>>;
type DirectMutationPayload = Expect<Equal<Parameters<ReturnType<typeof directMutation>[0]>[0], LeagueRequest>>;
// @ts-expect-error direct queries still require their route parameters
directQuery();
// @ts-expect-error direct mutations still require their route parameters
directMutation();
// @ts-expect-error direct mutation request fields remain typed
directMutation({ id: 1 })[0]({ name: 1 });
// @ts-expect-error direct query data contains only the transformed fields
directQuery({ id: 1 }).data?.rawOnly;
const directPlainQuery = createQuery("type-test", "leagues", executeLeague);
const directPlainMutation = createMutation("leagues", executeLeagueMutation);
type DirectPlainQuery = Expect<Equal<ReturnType<typeof directPlainQuery>["data"], LeagueResponse | undefined>>;
type DirectPlainMutation = Expect<Equal<SuccessData<ReturnType<typeof directPlainMutation>[0]>, LeagueResponse>>;
