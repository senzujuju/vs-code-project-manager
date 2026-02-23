# Project Groups (Phase 1) Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add folder-based project groups that render dynamic project sections from direct child folders.

**Architecture:** Persist project groups in `ProjectStore` as root-folder sources, then resolve visible group projects dynamically at runtime. Keep existing saved projects untouched and dedupe group entries when the same URI already exists as a saved project.

**Tech Stack:** VS Code Extension API, TypeScript, Node test runner (`node:test`), webview HTML/CSS/JS.

---

### Task 1: Add failing store tests for group support

**Files:**
- Modify: `test/projectStore.test.ts`

**Step 1: Write failing migration test**

Add a test that initializes store with `version: 1` state and asserts that store still loads projects and initializes empty `groups`.

**Step 2: Write failing group CRUD tests**

Add tests for:
- `saveGroup` adds new group
- `saveGroup` updates existing group by `rootUri`
- `removeGroup` removes group

**Step 3: Run tests to verify RED**

Run: `npm test`
Expected: FAIL with missing group APIs/types.

### Task 2: Implement ProjectStore v2 with groups

**Files:**
- Modify: `src/core/projectStore.ts`

**Step 1: Add `ProjectGroup` type and state v2 schema**

Add persisted `groups` array and migration from `version: 1`.

**Step 2: Add store methods**

Implement:
- `getAllGroups()`
- `saveGroup({ name, rootUri })`
- `removeGroup(groupId)`

**Step 3: Keep existing project behavior unchanged**

Ensure project CRUD/sort still passes previous tests.

**Step 4: Run tests to verify GREEN**

Run: `npm test`
Expected: PASS for old and new store tests.

### Task 3: Add failing resolver tests for computed group projects

**Files:**
- Create: `test/projectGroups.test.ts`
- Create: `src/core/projectGroups.ts`

**Step 1: Write failing test for direct-child projection**

Test that resolver outputs one section per group and maps child folders to virtual projects.

**Step 2: Write failing dedupe test**

Test that manually saved project URI wins and duplicate from group is excluded.

**Step 3: Write failing stability/sort test**

Test deterministic sorting by group name and child name.

**Step 4: Run tests to verify RED**

Run: `npm test`
Expected: FAIL with missing resolver implementation.

### Task 4: Implement group resolver and folder scanner helpers

**Files:**
- Modify: `src/core/projectGroups.ts`

**Step 1: Implement pure resolver API**

Implement pure function that takes:
- manual projects
- groups
- callback for child folders

Return grouped sections with virtual project IDs.

**Step 2: Implement dedupe and sorting**

Apply manual-project URI dedupe and deterministic ordering.

**Step 3: Run tests to verify GREEN**

Run: `npm test`
Expected: PASS including new resolver tests.

### Task 5: Integrate groups into extension commands and webview state

**Files:**
- Modify: `src/extension.ts`
- Modify: `src/webview/projectSwitcherViewProvider.ts`
- Modify: `media/view.js`
- Modify: `media/view.css`
- Modify: `package.json`
- Modify: `README.md`

**Step 1: Add command and add-project flow option**

Add `projectSwitcher.addProjectGroup` and include it in `addProject` quick pick.

**Step 2: Add group creation action**

Pick folder, ask group name, save group in store.

**Step 3: Resolve and publish grouped sections in webview state**

Build group sections from store groups + filesystem child folders.

**Step 4: Render group sections in webview**

Show each section title from group name; keep existing project sections.

**Step 5: Restrict phase-1 actions for group projects**

Group cards support open and open-in-new-window only.

**Step 6: Run build for verification**

Run: `npm run build`
Expected: PASS.

### Task 6: Final validation

**Files:**
- No new files

**Step 1: Run full validation**

Run: `npm test && npm run build`
Expected: PASS.

**Step 2: Manual smoke test in Extension Development Host**

Validate:
- add group folder (for example `job`)
- see section title `job`
- child folders appear as projects
- opening child folder works
- saved-project duplicate hides group duplicate
