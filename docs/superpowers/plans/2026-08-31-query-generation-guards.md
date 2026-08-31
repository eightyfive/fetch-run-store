# Query Generation Guards Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ignore obsolete query completions after targeted or broad cache invalidation.

**Architecture:** Track a generation per flight key. Invalidation advances the
generation and removes affected shared-flight entries, allowing a replacement
request while the obsolete request completes harmlessly in the background.

**Tech Stack:** TypeScript 5.9, Zustand 5, Jest 30.

---

## File structure

- `src/store.ts` — generation lifecycle and guarded cache writes.
- `src/store.test.ts` — targeted and reset race coverage.

### Task 1: Guard obsolete flights

**Files:**
- Modify: `src/store.ts`
- Modify: `src/store.test.ts`

- [ ] **Step 1: Write failing race tests**

Add deferred-request tests showing that invalidating or resetting an active
query permits a second request, ignores the old completion, and stores only
the replacement result.

- [ ] **Step 2: Verify the tests fail**

Run: `npm run test:runtime -- store.test.ts`

Expected: the existing shared flight prevents the replacement request or the
old completion writes data.

- [ ] **Step 3: Add generation guards**

In `src/store.ts`, add a generation map keyed like `flights`. Capture the
generation in `executeQuery`; guard `setQueryExecuted` and `setQueryErrored`.
Advance generations and delete flights on targeted, broad, and reset
invalidation.

- [ ] **Step 4: Verify and commit**

Run: `npm test && npm run build && git diff --check`

```bash
git add src/store.ts src/store.test.ts
git commit -m "fix: ignore obsolete query flights"
```
