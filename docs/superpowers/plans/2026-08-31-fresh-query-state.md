# Fresh Query State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restore production-style `fresh` semantics for query invalidation.

**Architecture:** Replace the internal inverse `stale` map with `fresh`. A
missing freshness entry is treated as invalid by the hook, so broad
invalidation can clear metadata while preserving cached data.

**Tech Stack:** TypeScript 5.9, React 19, Zustand 5, Jest 30.

---

## File structure

- `src/store.ts` — owns `fresh` state transitions.
- `src/query.ts` — refetches entries that are not fresh.
- `src/api.test.ts` — updates its existing internal assertion for `fresh`.
- `README.md` — states the public invalidation outcome without exposing state.

### Task 1: Align freshness state

**Files:**
- Modify: `src/store.ts`
- Modify: `src/query.ts`
- Modify: `src/api.test.ts`

- [ ] **Step 1: Update existing test state access**

In `src/api.test.ts`, replace the existing whole-store assertion with:

```ts
expect(store.getState().namespaces[baseUrl].fresh.users).toBeUndefined();
```

No new test is added.

- [ ] **Step 2: Implement production-style freshness**

In `src/store.ts`, rename `stale` to `fresh`. Set it to `true` on success;
set a single invalidation to `false`; and make broad invalidation return the
namespace's reset metadata with preserved `data` and an empty `fresh` map.

In `src/query.ts`, select `isFresh` with `s.fresh[id] === true` and fetch when
`!data || !isFresh`.

- [ ] **Step 3: Verify existing coverage and build**

Run: `npm test && npm run build && git diff --check`

Expected: existing tests pass and the project builds.

- [ ] **Step 4: Commit implementation**

```bash
git add src/store.ts src/query.ts src/api.test.ts
git commit -m "refactor: align query freshness semantics"
```

### Task 2: Correct public wording

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Describe behavior, not internal state**

State that `invalidateQueries()` invalidates every cached query while keeping
data available until its refetch completes. Do not mention `stale`.

- [ ] **Step 2: Verify and commit documentation**

Run: `npm test && npm run build && git diff --check`

```bash
git add README.md
git commit -m "docs: clarify query invalidation behavior"
```
