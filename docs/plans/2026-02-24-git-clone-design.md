# Git Clone Project Design

## Goal

Allow users to clone a Git repository directly from the Project Switcher and automatically add it as a project.

## User Flow

1. Click `+` button in Project Switcher
2. Select `Clone Repository` option
3. Enter repository URL (via input box)
4. Select parent folder (via folder picker)
5. Repository clones into `<parent>/<repo-name>`
6. Project automatically appears in the list

## Chosen Approach

Use VS Code built-in Git extension API (`vscode.git`) instead of spawning `git clone` process.

**Why:**
- Reuses VS Code's Git authentication (GitHub, GitLab, SSH, credentials)
- Consistent with VS Code's native clone experience
- Returns cloned repository URI for immediate project save
- Handles edge cases (existing folders get `-1`, `-2` suffixes)

## Architecture

```
User clicks + → QuickPick "Clone Repository"
     ↓
InputBox for repo URL
     ↓
OpenDialog for parent folder
     ↓
vscode.git API: clone(url, { parentPath, postCloneAction: 'none' })
     ↓
Store.saveProject({ kind: 'folder', uri: clonedUri, name })
     ↓
Project appears in list (existing store subscription updates UI)
```

## Integration Points

### 1. Extension Commands

- Add `addCloneProject` action to `ProjectSwitcherActions` interface
- Add option `Clone Repository` to existing `addProject` quick pick
- Optionally add standalone command `projectSwitcher.cloneProject`

### 2. Git Extension Integration

```typescript
const gitExtension = vscode.extensions.getExtension('vscode.git');
const gitApi = gitExtension.exports.getAPI(1);
const clonedUri = await gitApi.clone(repoUrl, { 
  parentPath: parentFolderUri,
  postCloneAction: 'none'  // Don't auto-open, we'll add to list
});
```

### 3. Error Handling

- Git extension disabled: show info message with link to enable
- Clone fails (auth, network, invalid URL): show error from Git API
- User cancels: silently return
- Clone returns null: show generic error

## Data Model

No changes required. Clone produces a folder project with existing schema:

```typescript
{
  name: string;       // Derived from folder name
  kind: 'folder';
  uri: string;        // file://... path to cloned repo
}
```

## Edge Cases

1. **Folder already exists:** Git API appends `-1`, `-2`, etc. We use the returned URI.
2. **Private repo without auth:** Git API prompts for credentials.
3. **Invalid URL:** Git API shows error dialog.
4. **User cancels folder picker:** Silent return.

## Dependencies

- VS Code built-in Git extension must be available
- Git must be installed on system
- User must have network access

## Testing Strategy

- Unit test for URL validation utility
- Unit test for name extraction from URL
- Manual test in Extension Development Host:
  - Clone public repo
  - Clone private repo (auth flow)
  - Cancel at each step
  - Handle existing folder
