const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const esbuild = require("esbuild");

const root = path.resolve(__dirname, "..");
const temp = fs.mkdtempSync(path.join(os.tmpdir(), "fetch-run-store-package-"));
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const run = (command, args, cwd) =>
  execFileSync(command, args, {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "inherit"],
  });

try {
  const source = path.join(temp, "source");
  const consumer = path.join(temp, "consumer");
  fs.mkdirSync(source);
  fs.mkdirSync(consumer);
  // A clean source snapshot has no dist: prepack must build the entrypoints.
  for (const name of [
    "package.json",
    "tsconfig.json",
    "README.md",
    "CHANGELOG.md",
    "RELEASING.md",
    "LICENSE",
    "src",
  ]) {
    fs.cpSync(path.join(root, name), path.join(source, name), {
      recursive: true,
    });
  }
  fs.symlinkSync(
    path.join(root, "node_modules"),
    path.join(source, "node_modules"),
    "junction",
  );
  const [packed] = JSON.parse(
    run(npm, ["pack", "--json", "--pack-destination", temp], source),
  );
  const names = packed.files.map((file) => file.path);
  for (const name of [
    "dist/index.js",
    "dist/index.d.ts",
    "LICENSE",
    "README.md",
    "CHANGELOG.md",
    "RELEASING.md",
  ])
    assert(names.includes(name), `Missing ${name}`);
  assert(
    !names.some((name) => /\.test\.|^tests\/|^node_modules\//.test(name)),
    "Test artifacts leaked into package",
  );
  fs.writeFileSync(
    path.join(consumer, "package.json"),
    JSON.stringify({ private: true }),
  );
  const react = process.env.TEST_REACT_VERSION || "19";
  run(
    npm,
    [
      "install",
      "--ignore-scripts",
      "--no-audit",
      "--no-fund",
      "--package-lock=false",
      path.join(temp, packed.filename),
      "fetch-run@3.0.0",
      `react@${react}`,
      `react-dom@${react}`,
      `@types/react@${react}`,
    ],
    consumer,
  );
  const packageRoot = path.join(consumer, "node_modules", "fetch-run-store");
  assert.equal(typeof require(packageRoot).createApiStore, "function");
  // Compile the same route-contract tests against the installed declarations.
  const types = fs
    .readFileSync(path.join(root, "tests/types/routes.test.ts"), "utf8")
    .replace('from "../../src"', 'from "fetch-run-store"');
  fs.writeFileSync(path.join(consumer, "types.ts"), types);
  run(
    process.execPath,
    [
      path.join(root, "node_modules/typescript/bin/tsc"),
      "--noEmit",
      "--strict",
      "--skipLibCheck",
      "--esModuleInterop",
      "--target",
      "ES2022",
      "--module",
      "commonjs",
      "types.ts",
    ],
    consumer,
  );
  const entry = path.join(consumer, "smoke.js");
  fs.writeFileSync(
    entry,
    `
    import { Api } from 'fetch-run';
    import { createApiStore } from 'fetch-run-store';
    import { createElement } from 'react';
    import { renderToString } from 'react-dom/server';
    const store = createApiStore(Api.create('https://api.example.test'));
    const useUsers = store.route('users').search();
    function Probe() { const query = useUsers(); return createElement('span', null, query.error ? 'error' : 'ready'); }
    if (renderToString(createElement(Probe)) !== '<span>ready</span>') throw new Error('Consumer render failed');
  `,
  );
  const output = path.join(consumer, "smoke.cjs");
  esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: "node",
    format: "cjs",
    outfile: output,
  });
  run(process.execPath, [output], consumer);
  esbuild.buildSync({
    entryPoints: [entry],
    bundle: true,
    platform: "browser",
    write: false,
  });
  console.log(
    `Package verified: clean prepack, installed declarations, Node entrypoint, React ${react} render and browser bundle.`,
  );
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
