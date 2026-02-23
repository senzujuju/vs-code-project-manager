# Project Groups, Clone, and Worktree Design

## Goal

Extend Project Switcher with three capabilities:

- clone a repository and immediately create a project from it
- add one folder as a project group and show its child folders as projects
- show git worktrees for a project when git metadata is available

This document defines the full design and the phase order. Implementation starts with project groups.

## Scope by Phase

### Phase 1 (now): Project Groups

- Add a new action in `+` flow: `Project Group`
- User picks a folder (for example `job`) and confirms group name
- Sidebar renders group section title from group name (`job`)
- Group projects are computed from direct child folders (depth = 1)
- Refresh behavior: recompute on extension refresh, store changes, and reload

### Phase 2: Clone Repository

- Add a new action in `+` flow: `Clone Repository`
- Ask repo URL
- Ask destination parent directory
- Clone into `<parent>/<repo-name>`
- Save as folder project and open it immediately

### Phase 3: Worktree Display

- For git-backed projects, resolve worktrees with `git worktree list --porcelain`
- Render collapsible worktree list under project card
- Open selected worktree path on click

## Chosen Architecture

Approach selected: sources + computed projects.

- Store keeps two persisted source sets:
  - manually saved projects
  - project groups (folder roots)
- Group child projects are not persisted as normal projects
- Group child projects are derived at runtime from filesystem state

Why this approach:

- avoids stale duplicated entries in storage
- preserves current saved-project behavior
- keeps group sync simple and deterministic

## Data Model Changes

State migrates from `version: 1` to `version: 2`.

```ts
interface ProjectGroup {
  id: string;
  name: string;
  rootUri: string;
  createdAt: number;
  updatedAt: number;
}

interface StoreState {
  version: 2;
  projects: StoredProject[];
  groups: ProjectGroup[];
}
```

Migration rule:

- `version: 1` -> keep `projects`, initialize `groups: []`

## Group Resolution Rules

- Only direct child folders are included
- Child folder URI must be `file://`
- If a child URI already exists as a manually saved project, hide group copy (manual project wins)
- Child order: alphabetical by folder name
- Group order: by existing store sort rule (updated timestamp fallback to name)

## UI Behavior

- Existing `Pinned` section remains for manually saved projects
- Existing `Projects` section remains for unpinned manually saved projects
- New dynamic sections are appended, one per group, section title = group name
- Group child cards support opening project and opening in new window
- Group child cards do not support rename/remove/pin in phase 1

## Error Handling

- Missing group root folder: section remains with no entries
- Permission denied while scanning: section remains with no entries
- Invalid URI in stored group: ignore entry during resolution

## "Folder moved" feasibility

Can it survive folder move automatically?

- Partially possible with heuristics, not reliable cross-platform without extra complexity
- Stable file identity APIs differ by OS and often require native integrations
- Recommended future option: explicit "Relink Group Root" action with folder picker

Decision:

- Do not implement automatic relink in phase 1

## Testing Strategy

- Extend `ProjectStore` tests for state migration and group CRUD
- Add pure resolver tests for dedupe and direct-child-only behavior
- Build + test gates:
  - `npm run build`
  - `npm test`
