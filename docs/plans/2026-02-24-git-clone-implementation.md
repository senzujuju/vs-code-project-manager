# Git Clone Project Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add "Clone Repository" option to Project Switcher that clones a Git repo and automatically adds it as a project.

**Architecture:** Integrate with VS Code built-in Git extension API (`vscode.git`) to perform clone with native auth/UX. Clone returns the final folder URI which is then saved as a folder project via existing `store.saveProject()`.

**Tech Stack:** VS Code Extension API, TypeScript, Node test runner (`node:test`), existing ProjectStore.

---

### Task 1: Add Git API types and utility module

**Files:**
- Create: `src/core/gitClone.ts`
- Create: `test/gitClone.test.ts`

**Step 1: Write failing test for name extraction from URL**

```typescript
import test from "node:test";
import assert from "node:assert/strict";
import { extractRepoNameFromUrl } from "../src/core/gitClone";

test("extractRepoNameFromUrl extracts name from https URL", () => {
  assert.equal(extractRepoNameFromUrl("https://github.com/microsoft/vscode.git"), "vscode");
  assert.equal(extractRepoNameFromUrl("https://github.com/owner/repo"), "repo");
});

test("extractRepoNameFromUrl extracts name from SSH URL", () => {
  assert.equal(extractRepoNameFromUrl("git@github.com:owner/repo.git"), "repo");
});

test("extractRepoNameFromUrl handles trailing slash", () => {
  assert.equal(extractRepoNameFromUrl("https://github.com/owner/repo/"), "repo");
});

test("extractRepoNameFromUrl returns fallback for invalid URL", () => {
  assert.equal(extractRepoNameFromUrl(""), "repository");
  assert.equal(extractRepoNameFromUrl("not-a-url"), "repository");
});
```

**Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL with "Cannot find module '../src/core/gitClone'"

**Step 3: Write minimal implementation**

```typescript
export function extractRepoNameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "repository";
  }

  let path = trimmed;
  
  // Remove trailing slash
  if (path.endsWith("/")) {
    path = path.slice(0, -1);
  }
  
  // Remove .git suffix
  if (path.endsWith(".git")) {
    path = path.slice(0, -4);
  }
  
  // Extract last segment
  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf(":"));
  if (lastSlash === -1) {
    return "repository";
  }
  
  const name = path.slice(lastSlash + 1);
  return name || "repository";
}
```

**Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

**Step 5: Commit**

```bash
git add src/core/gitClone.ts test/gitClone.test.ts
git commit -m "feat: add extractRepoNameFromUrl utility"
```

---

### Task 2: Add Git extension API wrapper

**Files:**
- Modify: `src/core/gitClone.ts`

**Step 1: Add Git extension types and wrapper**

```typescript
import * as vscode from "vscode";

export interface GitCloneResult {
  success: boolean;
  uri?: vscode.Uri;
  error?: string;
}

export async function cloneWithGitExtension(
  repoUrl: string,
  parentPath: vscode.Uri
): Promise<GitCloneResult> {
  const gitExtension = vscode.extensions.getExtension<GitExtension>("vscode.git");
  
  if (!gitExtension) {
    return {
      success: false,
      error: "Git extension is not available. Please ensure Git is installed and the Git extension is enabled."
    };
  }

  if (!gitExtension.isActive) {
    await gitExtension.activate();
  }

  const gitApi = gitExtension.exports.getAPI(1);
  
  try {
    const clonedUri = await gitApi.clone(vscode.Uri.parse(repoUrl), {
      parentPath,
      postCloneAction: "none"
    });

    if (!clonedUri) {
      return {
        success: false,
        error: "Clone was cancelled or failed."
      };
    }

    return {
      success: true,
      uri: clonedUri
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error during clone";
    return {
      success: false,
      error: message
    };
  }
}

interface GitExtension {
  enabled: boolean;
  getAPI(version: 1): GitAPI;
}

interface GitAPI {
  clone(uri: vscode.Uri, options?: { parentPath?: vscode.Uri; postCloneAction?: "none" }): Thenable<vscode.Uri | null>;
}
```

**Step 2: Run build to verify compilation**

Run: `npm run build`
Expected: PASS

**Step 3: Commit**

```bash
git add src/core/gitClone.ts
git commit -m "feat: add cloneWithGitExtension wrapper"
```

---

### Task 3: Add clone action to ProjectSwitcherActions

**Files:**
- Modify: `src/webview/projectSwitcherViewProvider.ts`

**Step 1: Add cloneProject to actions interface**

Update interface `ProjectSwitcherActions`:

```typescript
export interface ProjectSwitcherActions {
  // ... existing actions
  cloneProject(): Promise<void>;
}
```

**Step 2: Commit**

```bash
git add src/webview/projectSwitcherViewProvider.ts
git commit -m "feat: add cloneProject to ProjectSwitcherActions interface"
```

---

### Task 4: Implement clone action in extension.ts

**Files:**
- Modify: `src/extension.ts`

**Step 1: Import gitClone module**

Add at top of file:

```typescript
import { cloneWithGitExtension, extractRepoNameFromUrl } from "./core/gitClone";
```

**Step 2: Add cloneProject action implementation**

Add to `actions` object after `addProjectGroup`:

```typescript
    cloneProject: async () => {
      const repoUrl = await vscode.window.showInputBox({
        title: "Clone Repository",
        prompt: "Enter repository URL",
        placeHolder: "https://github.com/owner/repo",
        validateInput: (value) => {
          const trimmed = value.trim();
          if (!trimmed) {
            return "Repository URL is required";
          }
          return null;
        }
      });

      if (!repoUrl) {
        return;
      }

      const parentFolder = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Parent Folder"
      });

      if (!parentFolder || parentFolder.length === 0) {
        return;
      }

      const parentUri = parentFolder[0];
      const defaultName = extractRepoNameFromUrl(repoUrl);
      const projectName = await askProjectName("Project name", defaultName);
      
      if (!projectName) {
        return;
      }

      await vscode.window.withProgress(
        {
          location: vscode.ProgressLocation.Notification,
          title: `Cloning ${defaultName}...`,
          cancellable: false
        },
        async () => {
          const result = await cloneWithGitExtension(repoUrl, parentUri);

          if (!result.success) {
            vscode.window.showErrorMessage(result.error || "Failed to clone repository");
            return;
          }

          store.saveProject({
            name: projectName,
            kind: "folder",
            uri: result.uri!.toString()
          });

          vscode.window.showInformationMessage(`Cloned and added "${projectName}" to projects.`);
        }
      );
    },
```

**Step 3: Update addProject quick pick to include Clone option**

Modify `addProject` action to include clone option:

```typescript
    addProject: async () => {
      const selected = await vscode.window.showQuickPick(
        [
          {
            label: "$(folder-opened) Folder",
            description: "Save a folder as project",
            projectKind: "folder" as const
          },
          {
            label: "$(files) Workspace",
            description: "Save a .code-workspace as project",
            projectKind: "workspace" as const
          },
          {
            label: "$(folder) Project Group",
            description: "Use direct child folders as projects",
            projectKind: "group" as const
          },
          {
            label: "$(repo) Clone Repository",
            description: "Clone a Git repository and add as project",
            projectKind: "clone" as const
          }
        ],
        {
          placeHolder: "What do you want to add?"
        }
      );

      if (!selected) {
        return;
      }

      if (selected.projectKind === "folder") {
        await actions.addFolderProject();
        return;
      }

      if (selected.projectKind === "group") {
        await actions.addProjectGroup();
        return;
      }

      if (selected.projectKind === "clone") {
        await actions.cloneProject();
        return;
      }

      await actions.addWorkspaceProject();
    },
```

**Step 4: Commit**

```bash
git add src/extension.ts
git commit -m "feat: implement cloneProject action"
```

---

### Task 5: Add webview message handler for clone

**Files:**
- Modify: `src/webview/projectSwitcherViewProvider.ts`

**Step 1: Add clone message type**

Add to `IncomingMessage` type:

```typescript
type IncomingMessage =
  | { type: "saveCurrent" }
  | { type: "addProject" }
  | { type: "addFolder" }
  | { type: "addWorkspace" }
  | { type: "addGroup" }
  | { type: "cloneProject" }
  | { type: "toggleSectionCollapsed"; section: keyof SectionCollapseState }
  // ... rest
```

**Step 2: Add handler in handleIncomingMessage**

Add case in switch:

```typescript
      case "cloneProject":
        await this.actions.cloneProject();
        return;
```

**Step 3: Commit**

```bash
git add src/webview/projectSwitcherViewProvider.ts
git commit -m "feat: add cloneProject webview message handler"
```

---

### Task 6: Add standalone command (optional but useful)

**Files:**
- Modify: `package.json`
- Modify: `src/extension.ts`

**Step 1: Add command to package.json**

Add to `commands` array:

```json
{
  "command": "projectSwitcher.cloneProject",
  "title": "Project Switcher: Clone Repository",
  "category": "Project Switcher",
  "icon": "$(repo)"
}
```

Add to `activationEvents`:

```json
"onCommand:projectSwitcher.cloneProject"
```

**Step 2: Register command in extension.ts**

Add to `COMMANDS` constant:

```typescript
const COMMANDS = {
  // ... existing
  cloneProject: "projectSwitcher.cloneProject"
} as const;
```

Add registration:

```typescript
  register(COMMANDS.cloneProject, async () => {
    await actions.cloneProject();
  });
```

**Step 3: Commit**

```bash
git add package.json src/extension.ts
git commit -m "feat: add projectSwitcher.cloneProject command"
```

---

### Task 7: Update README

**Files:**
- Modify: `README.md`

**Step 1: Add clone to MVP features**

Add to list after "Add project group":

```markdown
- Add project by cloning a Git repository
```

**Step 2: Add to Commands list**

Add after "Project Switcher: Add Project Group":

```markdown
- `Project Switcher: Clone Repository`
```

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: add clone repository to README"
```

---

### Task 8: Final validation

**Files:**
- No new files

**Step 1: Run full test suite**

Run: `npm test`
Expected: PASS (all tests)

**Step 2: Run build**

Run: `npm run build`
Expected: PASS (no errors)

**Step 3: Manual smoke test**

Launch Extension Development Host (F5) and verify:
- `+` shows "Clone Repository" option
- Clone public repo (e.g., https://github.com/octocat/Hello-World)
- Project appears in list after clone
- Command palette: "Project Switcher: Clone Repository" works
- Cancel at URL input: no error
- Cancel at folder picker: no error
