# Releasing

The first public version is **0.1.0**. It is an initial-development release;
the API can change before 1.0.0. Use patch releases for compatible fixes and
minor releases for breaking changes while on 0.x.

## Prepare and verify

1. Merge the release-preparation PR after all CI jobs pass. CI checks Node
   22/24 and installs the actual tarball with React 18/19.
2. Check out `main`, run `git pull --ff-only`, and confirm `git status --short`
   is empty. Confirm `package.json` and the lockfile carry the intended version.
3. Run `npm ci`, `npm test`, and `npm run test:package`. The package test creates
   a temporary source snapshot without `dist`, packs it, installs it into a
   consumer, compiles the route type tests against the installed declarations,
   and checks React rendering and browser bundling.
4. Confirm access to the npm account that will own `fetch-run-store` with
   `npm whoami`. For the first publish, confirm the name is still available.
   Configure the account's authentication/2FA as required by npm.

## Publish (explicit maintainer action)

Run `npm run release` from that clean, verified `main` checkout. This invokes
`npm publish --access public`. `prepublishOnly` runs runtime/type/package checks,
and `prepack` builds the compiled JavaScript, declarations and source maps.
No workflow publishes automatically and no global `np` installation is needed.

After npm confirms success, verify `npm view fetch-run-store@0.1.0 version`.
Tag the exact published commit with `git tag -a v0.1.0 -m 'Release v0.1.0'`,
push it with `git push origin v0.1.0`, and create a GitHub release from that tag
using the changelog notes. Record the publication date in the changelog in a
follow-up commit. Do not tag a failed publish or attempt to overwrite a version.

For later versions, update both version fields with
`npm version <version> --no-git-tag-version` as part of the preparation PR.
