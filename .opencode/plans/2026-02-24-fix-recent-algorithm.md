# Fix Recent Algorithm Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Fix the recent list algorithm so only the project being OPENED goes to recent, not the one being left/closed.

**Architecture:** Remove the "stamp leaving project" logic from `getProjectIdsToMarkOpened`. Currently, switching from Project A to Project B in the same window stamps both — A (being left) and B (being opened). After the fix, only B (target) is stamped.

**Tech Stack:** TypeScript, Node.js test runner (`node:test`)

---

### Task 1: Fix `getProjectIdsToMarkOpened` in `recentSwitch.ts`

**Files:**
- Modify: `src/core/recentSwitch.ts`
- Modify: `test/projectSwitchService.test.ts`

**Step 1: Update the failing test first (TDD — write the new expectation)**

Open `test/projectSwitchService.test.ts` and replace test 1:

```typescript
// OLD:
test("getProjectIdsToMarkOpened prioritizes previous current project for same-window switch", () => {
  const result = getProjectIdsToMarkOpened({
    targetProjectId: "target",
    currentProjectId: "current",
    openInNewWindow: false
  });
  assert.deepEqual(result, ["current", "target"]);
});

// NEW:
test("getProjectIdsToMarkOpened returns only the target project for same-window switch", () => {
  const result = getProjectIdsToMarkOpened({
    targetProjectId: "target",
    currentProjectId: "current",
    openInNewWindow: false
  });
  assert.deepEqual(result, ["target"]);
});
```

Tests 2 and 3 remain unchanged.

**Step 2: Run tests to verify test 1 fails**

```bash
node --test test/projectSwitchService.test.ts
```

Expected: test 1 FAILS, tests 2 & 3 PASS.

**Step 3: Fix the implementation**

In `src/core/recentSwitch.ts`, remove the block that stamps the leaving project:

```typescript
// BEFORE:
export function getProjectIdsToMarkOpened({
  targetProjectId,
  currentProjectId,
  openInNewWindow
}: ProjectIdsToMarkOpenedInput): string[] {
  const ids: string[] = [];

  if (!openInNewWindow && currentProjectId && currentProjectId !== targetProjectId) {
    ids.push(currentProjectId);
  }

  ids.push(targetProjectId);
  return ids;
}

// AFTER:
export function getProjectIdsToMarkOpened({
  targetProjectId
}: ProjectIdsToMarkOpenedInput): string[] {
  return [targetProjectId];
}
```

**Step 4: Run tests to verify all pass**

```bash
node --test test/projectSwitchService.test.ts
```

Expected: all 3 tests PASS.

**Step 5: Run full test suite**

```bash
npm test
```

Expected: all tests pass. No regressions.

**Step 6: Commit**

```bash
git add src/core/recentSwitch.ts test/projectSwitchService.test.ts
git commit -m "fix: add to recent only when project is opened, not when left"
```

---

### Task 2 (Optional): Clean up unused parameters from the interface

Remove the now-unused `currentProjectId` and `openInNewWindow` from `ProjectIdsToMarkOpenedInput` and update all callers.

**Files:**
- Modify: `src/core/recentSwitch.ts`
- Modify: `src/core/projectSwitchService.ts` (remove unused fields from the call)
- Modify: `test/projectSwitchService.test.ts` (remove unused fields from test inputs)

**Step 1: Remove unused fields from the interface**

```typescript
// BEFORE:
export interface ProjectIdsToMarkOpenedInput {
  targetProjectId: string;
  currentProjectId?: string;
  openInNewWindow: boolean;
}

// AFTER:
export interface ProjectIdsToMarkOpenedInput {
  targetProjectId: string;
}
```

**Step 2: Find and update callers**

```bash
grep -rn "getProjectIdsToMarkOpened" src/
```

Remove `currentProjectId` and `openInNewWindow` from each call site object.

**Step 3: Update tests**

Remove `currentProjectId` and `openInNewWindow` from test input objects in `test/projectSwitchService.test.ts`. Tests 2 and 3 become redundant (same as test 1) and can be removed or merged.

**Step 4: Run full test suite**

```bash
npm test
```

Expected: all tests pass.

**Step 5: Commit**

```bash
git add src/ test/
git commit -m "refactor: remove unused params from getProjectIdsToMarkOpened"
```
