# Project Switcher Extension

Webview-first project switcher for Visual Studio Code.

## Current MVP

- Activity Bar container with sidebar Webview UI (`Projects`)
- Save current project (folder or workspace)
- Add project from folder picker
- Add project from `.code-workspace` picker
- Add project group from folder (direct child folders become projects)
- Open, rename, remove, pin/unpin saved projects
- Show saved projects currently open in other VS Code windows
- Status bar quick button to focus the switcher

## Commands

- `Project Switcher: Focus`
- `Project Switcher: Focus Search`
- `Project Switcher: Save Current Project`
- `Project Switcher: Add Project`
- `Project Switcher: Add Folder`
- `Project Switcher: Add Workspace`
- `Project Switcher: Add Project Group`
- `Project Switcher: Open Project`
- `Project Switcher: Rename Project`
- `Project Switcher: Remove Project`
- `Project Switcher: Toggle Pin`

## Development

```bash
npm install
npm run build
npm test
```

Then press `F5` in VS Code to launch the Extension Development Host.

## Configuration

- `projectSwitcher.openInNewWindow` (boolean, default `false`)
  - When enabled, opening a saved project always uses a new window.
