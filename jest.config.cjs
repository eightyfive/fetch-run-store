/** @type {import('jest').Config} */
module.exports = {
  preset: "ts-jest",
  moduleNameMapper: {
    "^fetch-run$": "<rootDir>/node_modules/fetch-run/src/index.ts",
  },
  roots: ["<rootDir>/src"],
  testMatch: ["**/*.test.ts", "**/*.test.tsx"],
  testEnvironment: "node",
  transformIgnorePatterns: ["/node_modules/(?!(fetch-run)/)"],
};
