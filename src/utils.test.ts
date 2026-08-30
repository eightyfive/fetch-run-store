import { buildRoute } from "./utils";

test("builds a route from matching parameters", () => {
  expect(
    buildRoute("organizations/:organizationId/users/:userId", {
      organizationId: "acme",
      userId: 42,
    })
  ).toBe("organizations/acme/users/42");
});

test("ignores parameters that are not in the route", () => {
  expect(buildRoute("users", { page: 2 })).toBe("users");
});
