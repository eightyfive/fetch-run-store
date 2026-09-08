import { buildRoute } from "./utils";

test("replaces repeated parameters and overlapping names independently of key order", () => {
  expect(buildRoute("users/:id2/links/:id/:id", { id: 1, id2: 2 })).toBe(
    "users/2/links/1/1",
  );
});

test("builds a route from matching parameters", () => {
  expect(
    buildRoute("organizations/:organizationId/users/:userId", {
      organizationId: "acme",
      userId: 42,
    }),
  ).toBe("organizations/acme/users/42");
});

test("ignores parameters that are not in the route", () => {
  expect(buildRoute("users", { page: 2 })).toBe("users");
});

test("encodes route parameters as path segments", () => {
  expect(buildRoute("users/:userId", { userId: "maria/ø?draft=true" })).toBe(
    "users/maria%2F%C3%B8%3Fdraft%3Dtrue",
  );
});
