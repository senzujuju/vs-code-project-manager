import * as path from "node:path";
import * as vscode from "vscode";
import { resolveProjectGroupId } from "./core/commandContext";
import { cloneWithGitExtension, extractRepoNameFromUrl } from "./core/gitClone";
import { OpenWindowRegistry } from "./core/openWindowRegistry";
import { ProjectStore, ProjectStorageAdapter, SaveProjectInput, StoreState, StoredProject } from "./core/projectStore";
import { ProjectSwitchService } from "./core/projectSwitchService";
import { resolveWorkspaceBadgeColor } from "./core/workspaceBadgeColorSync";
import {
  normalizeSectionCollapseState,
  normalizeSectionVisibility,
  SectionCollapseState,
  SectionVisibility
} from "./core/viewSections";
import { ProjectSwitcherActions, ProjectSwitcherViewProvider } from "./webview/projectSwitcherViewProvider";

const STORAGE_KEY = "projectSwitcher.state";
const SECTION_VISIBILITY_STORAGE_KEY = "projectSwitcher.sectionVisibility";
const SECTION_COLLAPSE_STORAGE_KEY = "projectSwitcher.sectionCollapseState";
const OPEN_WINDOW_HEARTBEAT_MS = 30_000;

const SECTION_VISIBILITY_CONTEXT = {
  current: "projectSwitcher.sectionVisible.current",
  recent: "projectSwitcher.sectionVisible.recent",
  pinned: "projectSwitcher.sectionVisible.pinned",
  projects: "projectSwitcher.sectionVisible.projects",
  groups: "projectSwitcher.sectionVisible.groups"
} as const;

const COMMANDS = {
  focus: "projectSwitcher.focus",
  focusSearch: "projectSwitcher.focusSearch",
  saveCurrent: "projectSwitcher.saveCurrentProject",
  addProject: "projectSwitcher.addProject",
  addFolder: "projectSwitcher.addFolderProject",
  addWorkspace: "projectSwitcher.addWorkspaceProject",
  addGroup: "projectSwitcher.addProjectGroup",
  cloneProject: "projectSwitcher.cloneProject",
  refresh: "projectSwitcher.refresh",
  openProject: "projectSwitcher.openProject",
  openProjectInNewWindow: "projectSwitcher.openProjectInNewWindow",
  renameProject: "projectSwitcher.renameProject",
  removeProject: "projectSwitcher.removeProject",
  removeGroup: "projectSwitcher.removeProjectGroup",
  togglePinProject: "projectSwitcher.togglePinProject",
  pinProject: "projectSwitcher.pinProject",
  unpinProject: "projectSwitcher.unpinProject",
  revealInFinder: "projectSwitcher.revealInFinder",
  toggleCurrentSection: "projectSwitcher.toggleCurrentSection",
  toggleRecentSection: "projectSwitcher.toggleRecentSection",
  togglePinnedSection: "projectSwitcher.togglePinnedSection",
  toggleProjectsSection: "projectSwitcher.toggleProjectsSection",
  toggleGroupsSection: "projectSwitcher.toggleGroupsSection"
} as const;

class GlobalStateStorageAdapter implements ProjectStorageAdapter {
  constructor(private readonly context: vscode.ExtensionContext) {}

  read(): StoreState | undefined {
    return this.context.globalState.get<StoreState>(STORAGE_KEY);
  }

  write(next: StoreState): void {
    void this.context.globalState.update(STORAGE_KEY, next);
  }
}

export function activate(context: vscode.ExtensionContext): void {
  const store = new ProjectStore(new GlobalStateStorageAdapter(context));
  const switchService = new ProjectSwitchService(store);
  let sectionVisibility = normalizeSectionVisibility(context.globalState.get(SECTION_VISIBILITY_STORAGE_KEY));
  let sectionCollapseState = normalizeSectionCollapseState(context.globalState.get(SECTION_COLLAPSE_STORAGE_KEY));
  applySectionVisibilityContext(sectionVisibility);

  let viewProvider: ProjectSwitcherViewProvider;
  let openWindowRegistry: OpenWindowRegistry | undefined;

  const actions: ProjectSwitcherActions = {
    saveCurrentProject: async () => {
      const currentInput = getCurrentProjectInput();
      if (!currentInput) {
        await vscode.window.showWarningMessage("No active workspace folder or workspace file to save.");
        return;
      }

      const name = await askProjectName("Save current project", currentInput.defaultName);
      if (!name) {
        return;
      }

      store.saveProject({
        name,
        kind: currentInput.kind,
        uri: currentInput.uri
      });
    },

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

    addFolderProject: async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Folder"
      });

      if (!picked || picked.length === 0) {
        return;
      }

      const folderUri = picked[0];
      const defaultName = path.basename(folderUri.fsPath) || "Folder Project";
      const name = await askProjectName("Save folder project", defaultName);
      if (!name) {
        return;
      }

      store.saveProject({
        name,
        kind: "folder",
        uri: folderUri.toString()
      });
    },

    addWorkspaceProject: async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: true,
        canSelectFolders: false,
        canSelectMany: false,
        openLabel: "Select Workspace",
        filters: {
          Workspace: ["code-workspace"]
        }
      });

      if (!picked || picked.length === 0) {
        return;
      }

      const workspaceUri = picked[0];
      const defaultName = path.basename(workspaceUri.fsPath, ".code-workspace") || "Workspace";
      const name = await askProjectName("Save workspace project", defaultName);
      if (!name) {
        return;
      }

      store.saveProject({
        name,
        kind: "workspace",
        uri: workspaceUri.toString()
      });
    },

    addProjectGroup: async () => {
      const picked = await vscode.window.showOpenDialog({
        canSelectFiles: false,
        canSelectFolders: true,
        canSelectMany: false,
        openLabel: "Select Group Folder"
      });

      if (!picked || picked.length === 0) {
        return;
      }

      const groupUri = picked[0];
      const defaultName = path.basename(groupUri.fsPath) || "Project Group";
      const name = await askProjectName("Save project group", defaultName);
      if (!name) {
        return;
      }

      store.saveGroup({
        name,
        rootUri: groupUri.toString()
      });
    },

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
            void vscode.window.showErrorMessage(result.error || "Failed to clone repository");
            return;
          }

          store.saveProject({
            name: projectName,
            kind: "folder",
            uri: result.uri!.toString()
          });

          void vscode.window.showInformationMessage(`Cloned and added "${projectName}" to projects.`);
        }
      );
    },

    toggleSectionCollapsed: async (section: keyof SectionCollapseState) => {
      sectionCollapseState = {
        ...sectionCollapseState,
        [section]: !sectionCollapseState[section]
      };
      void context.globalState.update(SECTION_COLLAPSE_STORAGE_KEY, sectionCollapseState);
      viewProvider.setSectionCollapseState(sectionCollapseState);
    },

    toggleGroupCollapsed: async (groupId: string) => {
      const group = store.toggleGroupCollapsed(groupId);
      if (!group) {
        viewProvider.showError("Project group not found");
      }
    },

    removeProjectGroup: async (groupId: string) => {
      const group = store.getAllGroups().find((item) => item.id === groupId);
      if (!group) {
        viewProvider.showError("Project group not found");
        return;
      }

      const removeChoice = "Remove";
      const choice = await vscode.window.showWarningMessage(
        `Remove ${group.name} project group?`,
        { modal: true },
        removeChoice
      );
      if (choice !== removeChoice) {
        return;
      }

      store.removeGroup(groupId);
    },

    openProject: async (projectId: string, newWindow?: boolean) => {
      const project = store.getProject(projectId);
      if (!project) {
        viewProvider.showError("Project not found");
        return;
      }

      await switchService.openProject(project, newWindow);
    },

    openProjectUri: async (uri: string, newWindow?: boolean) => {
      const project = createEphemeralFolderProject(uri);
      if (!project) {
        viewProvider.showError("Project not found");
        return;
      }

      await switchService.openProject(project, newWindow);
    },

    renameProject: async (projectId: string) => {
      const project = store.getProject(projectId);
      if (!project) {
        viewProvider.showError("Project not found");
        return;
      }

      const nextName = await askProjectName("Rename project", project.name);
      if (!nextName) {
        return;
      }

      store.renameProject(projectId, nextName);
    },

    removeProject: async (projectId: string) => {
      const project = store.getProject(projectId);
      if (!project) {
        viewProvider.showError("Project not found");
        return;
      }

      const removeChoice = "Remove";
      const choice = await vscode.window.showWarningMessage(`Remove ${project.name}?`, { modal: true }, removeChoice);
      if (choice !== removeChoice) {
        return;
      }

      store.removeProject(projectId);
    },

    togglePinProject: async (projectId: string) => {
      const toggled = store.togglePin(projectId);
      if (!toggled) {
        viewProvider.showError("Project not found");
      }
    },

    revealInFinder: async (projectId: string) => {
      const project = store.getProject(projectId);
      if (!project) {
        viewProvider.showError("Project not found");
        return;
      }

      try {
        await vscode.commands.executeCommand("revealFileInOS", vscode.Uri.parse(project.uri));
      } catch {
        viewProvider.showError("Failed to reveal project in Finder");
      }
    },

    refresh: () => {
      openWindowRegistry?.refresh();
      viewProvider.refresh();
    }
  };

  viewProvider = new ProjectSwitcherViewProvider(
    context.extensionUri,
    store,
    actions,
    sectionVisibility,
    sectionCollapseState
  );

  openWindowRegistry = new OpenWindowRegistry({
    sessionsDirectoryPath: path.join(context.globalStorageUri.fsPath, "open-window-sessions")
  });
  const activeOpenWindowRegistry = openWindowRegistry;

  const syncOpenElsewhere = () => {
    viewProvider.setOpenElsewhereUris(activeOpenWindowRegistry.getOpenElsewhereUris());
  };

  const syncCurrentBadgeColorToRegistry = () => {
    const configuration = vscode.workspace.getConfiguration();
    const badgeColor = resolveWorkspaceBadgeColor({
      peacockColor: configuration.get("peacock.color"),
      colorCustomizations: configuration.get("workbench.colorCustomizations")
    });
    activeOpenWindowRegistry.setBadgeColor(badgeColor);
  };

  const syncRemoteBadgeColorsToStore = () => {
    const snapshots = activeOpenWindowRegistry.getOpenElsewhereSnapshots();
    for (const snapshot of snapshots) {
      if (!snapshot.workspaceUri || !snapshot.badgeColor) {
        continue;
      }

      store.setBadgeColorByUri(snapshot.workspaceUri, snapshot.badgeColor);
    }
  };

  const unsubscribeOpenWindowRegistry = activeOpenWindowRegistry.onDidChange(() => {
    syncRemoteBadgeColorsToStore();
    syncOpenElsewhere();
  });

  activeOpenWindowRegistry.start({
    workspaceUri: getCurrentWorkspaceUri(),
    focused: vscode.window.state.focused,
    heartbeatMs: OPEN_WINDOW_HEARTBEAT_MS
  });

  syncCurrentBadgeColorToRegistry();
  syncRemoteBadgeColorsToStore();
  syncOpenElsewhere();

  const setSectionVisibility = (next: SectionVisibility) => {
    sectionVisibility = next;
    void context.globalState.update(SECTION_VISIBILITY_STORAGE_KEY, next);
    applySectionVisibilityContext(next);
    viewProvider.setSectionVisibility(next);
  };

  const toggleSectionVisibility = (section: keyof SectionVisibility) => {
    setSectionVisibility({
      ...sectionVisibility,
      [section]: !sectionVisibility[section]
    });
  };

  context.subscriptions.push(
    activeOpenWindowRegistry,
    {
      dispose: unsubscribeOpenWindowRegistry
    },
    viewProvider,
    vscode.window.registerWebviewViewProvider(ProjectSwitcherViewProvider.viewType, viewProvider, {
      webviewOptions: {
        retainContextWhenHidden: true
      }
    }),
    vscode.window.onDidChangeWindowState((state) => {
      activeOpenWindowRegistry.setFocused(state.focused);
      if (state.focused) {
        activeOpenWindowRegistry.refresh();
      }
    }),
    vscode.workspace.onDidChangeWorkspaceFolders(() => {
      activeOpenWindowRegistry.setWorkspaceUri(getCurrentWorkspaceUri());
      activeOpenWindowRegistry.refresh();
    }),
    vscode.workspace.onDidChangeConfiguration((event) => {
      if (
        event.affectsConfiguration("peacock.color") ||
        event.affectsConfiguration("workbench.colorCustomizations")
      ) {
        syncCurrentBadgeColorToRegistry();
      }
    })
  );

  const register = (commandId: string, handler: (...args: unknown[]) => unknown) => {
    context.subscriptions.push(vscode.commands.registerCommand(commandId, handler));
  };

  register(COMMANDS.focus, async () => {
    await focusView(viewProvider);
  });

  register(COMMANDS.focusSearch, async () => {
    await focusView(viewProvider);
    viewProvider.focusSearch();
  });

  register(COMMANDS.saveCurrent, async () => {
    await actions.saveCurrentProject();
  });

  register(COMMANDS.addProject, async () => {
    await actions.addProject();
  });

  register(COMMANDS.addFolder, async () => {
    await actions.addFolderProject();
  });

  register(COMMANDS.addWorkspace, async () => {
    await actions.addWorkspaceProject();
  });

  register(COMMANDS.addGroup, async () => {
    await actions.addProjectGroup();
  });

  register(COMMANDS.cloneProject, async () => {
    await actions.cloneProject();
  });

  register(COMMANDS.refresh, () => {
    actions.refresh();
  });

  register(COMMANDS.openProject, async (projectContext?: unknown) => {
    const id = resolveProjectId(projectContext) ?? (await pickProjectId(store, "Open project"));
    if (!id) {
      return;
    }

    await actions.openProject(id);
  });

  register(COMMANDS.openProjectInNewWindow, async (projectContext?: unknown) => {
    const id = resolveProjectId(projectContext) ?? (await pickProjectId(store, "Open project in new window"));
    if (!id) {
      return;
    }

    await actions.openProject(id, true);
  });

  register(COMMANDS.renameProject, async (projectContext?: unknown) => {
    const id = resolveProjectId(projectContext) ?? (await pickProjectId(store, "Rename project"));
    if (!id) {
      return;
    }

    await actions.renameProject(id);
  });

  register(COMMANDS.removeProject, async (projectContext?: unknown) => {
    const id = resolveProjectId(projectContext) ?? (await pickProjectId(store, "Remove project"));
    if (!id) {
      return;
    }

    await actions.removeProject(id);
  });

  register(COMMANDS.removeGroup, async (groupContext?: unknown) => {
    const id = resolveProjectGroupId(groupContext) ?? (await pickGroupId(store, "Remove project group"));
    if (!id) {
      return;
    }

    await actions.removeProjectGroup(id);
  });

  register(COMMANDS.togglePinProject, async (projectContext?: unknown) => {
    const id = resolveProjectId(projectContext) ?? (await pickProjectId(store, "Pin or unpin project"));
    if (!id) {
      return;
    }

    await actions.togglePinProject(id);
  });

  register(COMMANDS.pinProject, async (projectContext?: unknown) => {
    const id = resolveProjectId(projectContext) ?? (await pickProjectId(store, "Pin project"));
    if (!id) {
      return;
    }

    const project = store.getProject(id);
    if (!project) {
      viewProvider.showError("Project not found");
      return;
    }

    if (!project.pinned) {
      await actions.togglePinProject(id);
    }
  });

  register(COMMANDS.unpinProject, async (projectContext?: unknown) => {
    const id = resolveProjectId(projectContext) ?? (await pickProjectId(store, "Unpin project"));
    if (!id) {
      return;
    }

    const project = store.getProject(id);
    if (!project) {
      viewProvider.showError("Project not found");
      return;
    }

    if (project.pinned) {
      await actions.togglePinProject(id);
    }
  });

  register(COMMANDS.revealInFinder, async (projectContext?: unknown) => {
    const id = resolveProjectId(projectContext) ?? (await pickProjectId(store, "Reveal project in Finder"));
    if (!id) {
      return;
    }

    await actions.revealInFinder(id);
  });

  register(COMMANDS.toggleCurrentSection, () => {
    toggleSectionVisibility("current");
  });

  register(COMMANDS.toggleRecentSection, () => {
    toggleSectionVisibility("recent");
  });

  register(COMMANDS.togglePinnedSection, () => {
    toggleSectionVisibility("pinned");
  });

  register(COMMANDS.toggleProjectsSection, () => {
    toggleSectionVisibility("projects");
  });

  register(COMMANDS.toggleGroupsSection, () => {
    toggleSectionVisibility("groups");
  });

  const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 50);
  statusBarItem.name = "Project Switcher";
  statusBarItem.text = "$(list-tree) Projects";
  statusBarItem.tooltip = "Open Project Switcher";
  statusBarItem.command = COMMANDS.focus;
  statusBarItem.show();
  context.subscriptions.push(statusBarItem);
}

export function deactivate(): void {}

async function focusView(viewProvider: ProjectSwitcherViewProvider): Promise<void> {
  await vscode.commands.executeCommand("workbench.view.extension.projectSwitcher");
  await viewProvider.reveal();
}

async function askProjectName(title: string, defaultValue: string): Promise<string | undefined> {
  const value = await vscode.window.showInputBox({
    title,
    value: defaultValue,
    valueSelection: [0, defaultValue.length],
    prompt: "Project name",
    validateInput: (candidate) => {
      return candidate.trim().length > 0 ? null : "Project name is required";
    }
  });

  if (typeof value !== "string") {
    return undefined;
  }

  return value.trim();
}

function getCurrentProjectInput(): SaveProjectInput & { defaultName: string } | undefined {
  if (vscode.workspace.workspaceFile) {
    const uri = vscode.workspace.workspaceFile;
    const defaultName = path.basename(uri.fsPath, ".code-workspace") || "Workspace";

    return {
      name: defaultName,
      defaultName,
      kind: "workspace",
      uri: uri.toString()
    };
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length === 0) {
    return undefined;
  }

  if (folders.length > 1) {
    return undefined;
  }

  const folder = folders[0];
  const defaultName = path.basename(folder.uri.fsPath) || folder.name || "Folder";

  return {
    name: defaultName,
    defaultName,
    kind: "folder",
    uri: folder.uri.toString()
  };
}

function getCurrentWorkspaceUri(): string | undefined {
  if (vscode.workspace.workspaceFile) {
    return vscode.workspace.workspaceFile.toString();
  }

  const folders = vscode.workspace.workspaceFolders;
  if (!folders || folders.length !== 1) {
    return undefined;
  }

  return folders[0].uri.toString();
}

function resolveProjectId(value: unknown): string | undefined {
  if (typeof value === "string") {
    return value;
  }

  if (!value || typeof value !== "object") {
    return undefined;
  }

  const projectId = (value as Record<string, unknown>).projectId;
  return typeof projectId === "string" ? projectId : undefined;
}

async function pickProjectId(store: ProjectStore, placeHolder: string): Promise<string | undefined> {
  const projects = store.getAllProjects();
  if (projects.length === 0) {
    await vscode.window.showInformationMessage("No saved projects.");
    return undefined;
  }

  const selected = await vscode.window.showQuickPick(
    projects.map((project) => ({
      label: project.name,
      description: compactPath(project.uri),
      detail: project.kind,
      project
    })),
    { placeHolder }
  );

  return selected?.project.id;
}

async function pickGroupId(store: ProjectStore, placeHolder: string): Promise<string | undefined> {
  const groups = store.getAllGroups();
  if (groups.length === 0) {
    await vscode.window.showInformationMessage("No saved project groups.");
    return undefined;
  }

  const selected = await vscode.window.showQuickPick(
    groups.map((group) => ({
      label: group.name,
      description: compactPath(group.rootUri),
      group
    })),
    { placeHolder }
  );

  return selected?.group.id;
}

function compactPath(uriString: string): string {
  try {
    const uri = vscode.Uri.parse(uriString);
    if (uri.scheme !== "file") {
      return uriString;
    }

    const home = process.env.HOME;
    if (home && uri.fsPath.startsWith(home)) {
      return `~${uri.fsPath.slice(home.length)}`;
    }

    return uri.fsPath;
  } catch {
    return uriString;
  }
}

function applySectionVisibilityContext(sectionVisibility: SectionVisibility): void {
  void vscode.commands.executeCommand("setContext", SECTION_VISIBILITY_CONTEXT.current, sectionVisibility.current);
  void vscode.commands.executeCommand("setContext", SECTION_VISIBILITY_CONTEXT.recent, sectionVisibility.recent);
  void vscode.commands.executeCommand("setContext", SECTION_VISIBILITY_CONTEXT.pinned, sectionVisibility.pinned);
  void vscode.commands.executeCommand("setContext", SECTION_VISIBILITY_CONTEXT.projects, sectionVisibility.projects);
  void vscode.commands.executeCommand("setContext", SECTION_VISIBILITY_CONTEXT.groups, sectionVisibility.groups);
}

function createEphemeralFolderProject(uriString: string): StoredProject | undefined {
  try {
    const uri = vscode.Uri.parse(uriString);
    const defaultName = path.basename(uri.fsPath) || "Folder";

    return {
      id: `virtual:${uriString}`,
      name: defaultName,
      kind: "folder",
      uri: uriString,
      pinned: false,
      createdAt: 0,
      updatedAt: 0
    };
  } catch {
    return undefined;
  }
}
