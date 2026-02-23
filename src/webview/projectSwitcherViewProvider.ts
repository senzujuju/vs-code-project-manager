import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { GroupChildFolder, resolveProjectGroupSections, ResolvedGroupProject } from "../core/projectGroups";
import { ProjectGroup, ProjectStore, StoredProject } from "../core/projectStore";
import {
  DEFAULT_SECTION_COLLAPSE_STATE,
  DEFAULT_SECTION_VISIBILITY,
  SectionCollapseState,
  SectionVisibility,
  selectRecentProjects
} from "../core/viewSections";

const ENABLE_WORKSPACE_ACCENT_BADGE_COLOR = true;

export interface ProjectSwitcherActions {
  saveCurrentProject(): Promise<void>;
  addProject(): Promise<void>;
  addFolderProject(): Promise<void>;
  addWorkspaceProject(): Promise<void>;
  addProjectGroup(): Promise<void>;
  toggleSectionCollapsed(section: keyof SectionCollapseState): Promise<void>;
  toggleGroupCollapsed(groupId: string): Promise<void>;
  removeProjectGroup(groupId: string): Promise<void>;
  openProject(projectId: string, newWindow?: boolean): Promise<void>;
  openProjectUri(uri: string, newWindow?: boolean): Promise<void>;
  renameProject(projectId: string): Promise<void>;
  removeProject(projectId: string): Promise<void>;
  togglePinProject(projectId: string): Promise<void>;
  revealInFinder(projectId: string): Promise<void>;
  refresh(): void;
}

interface WebviewProject {
  id: string;
  name: string;
  kind: "folder" | "workspace";
  uri: string;
  fullPath: string;
  displayPath: string;
  pinned: boolean;
  isCurrent: boolean;
  isVirtual: boolean;
  lastOpenedAt?: number;
  initials: string;
  badgeTone: number;
  badgeColorOverride?: string;
}

interface WebviewGroupSection {
  id: string;
  title: string;
  collapsed: boolean;
  projects: WebviewProject[];
}

interface WebviewState {
  current: WebviewProject | null;
  recent: WebviewProject[];
  pinned: WebviewProject[];
  others: WebviewProject[];
  groups: WebviewGroupSection[];
  sectionCollapseState: SectionCollapseState;
}

interface GroupChildrenCacheEntry {
  rootUri: string;
  children: GroupChildFolder[];
}

type IncomingMessage =
  | { type: "saveCurrent" }
  | { type: "addProject" }
  | { type: "addFolder" }
  | { type: "addWorkspace" }
  | { type: "addGroup" }
  | { type: "toggleSectionCollapsed"; section: keyof SectionCollapseState }
  | { type: "toggleGroupCollapsed"; groupId: string }
  | { type: "removeGroup"; groupId: string }
  | { type: "refresh" }
  | { type: "openProject"; projectId: string; newWindow?: boolean }
  | { type: "renameProject"; projectId: string }
  | { type: "removeProject"; projectId: string }
  | { type: "togglePinProject"; projectId: string }
  | { type: "revealInFinder"; projectId: string };

export class ProjectSwitcherViewProvider implements vscode.WebviewViewProvider, vscode.Disposable {
  public static readonly viewType = "projectSwitcher.main";

  private readonly disposables: vscode.Disposable[] = [];
  private readonly virtualProjectUriById = new Map<string, string>();
  private readonly groupChildrenCache = new Map<string, GroupChildrenCacheEntry>();
  private sectionVisibility: SectionVisibility;
  private sectionCollapseState: SectionCollapseState;
  private view?: vscode.WebviewView;

  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly store: ProjectStore,
    private readonly actions: ProjectSwitcherActions,
    sectionVisibility: SectionVisibility = DEFAULT_SECTION_VISIBILITY,
    sectionCollapseState: SectionCollapseState = DEFAULT_SECTION_COLLAPSE_STATE
  ) {
    this.sectionVisibility = { ...sectionVisibility };
    this.sectionCollapseState = { ...sectionCollapseState };

    const unsubscribe = this.store.onDidChange(() => {
      this.postState();
    });

    this.disposables.push({
      dispose: unsubscribe
    });

    if (ENABLE_WORKSPACE_ACCENT_BADGE_COLOR) {
      this.disposables.push(
        vscode.workspace.onDidChangeConfiguration((event) => {
          if (
            event.affectsConfiguration("peacock.color") ||
            event.affectsConfiguration("workbench.colorCustomizations")
          ) {
            this.postState();
          }
        })
      );
    }
  }

  resolveWebviewView(webviewView: vscode.WebviewView): void {
    this.view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(this.extensionUri, "media")]
    };

    webviewView.webview.html = this.getHtml(webviewView.webview);

    this.disposables.push(
      webviewView.webview.onDidReceiveMessage(async (message: IncomingMessage) => {
        await this.handleIncomingMessage(message);
      })
    );

    this.postState();
  }

  refresh(): void {
    this.groupChildrenCache.clear();
    this.postState();
  }

  setSectionVisibility(sectionVisibility: SectionVisibility): void {
    this.sectionVisibility = { ...sectionVisibility };
    this.postState();
  }

  setSectionCollapseState(sectionCollapseState: SectionCollapseState): void {
    this.sectionCollapseState = { ...sectionCollapseState };
    this.postState();
  }

  reveal(): Thenable<void> {
    return vscode.commands.executeCommand(`${ProjectSwitcherViewProvider.viewType}.focus`);
  }

  showError(message: string): void {
    this.view?.webview.postMessage({
      type: "error",
      message
    });
  }

  dispose(): void {
    while (this.disposables.length > 0) {
      this.disposables.pop()?.dispose();
    }
  }

  private async handleIncomingMessage(message: IncomingMessage): Promise<void> {
    switch (message.type) {
      case "saveCurrent":
        await this.actions.saveCurrentProject();
        return;
      case "addProject":
        await this.actions.addProject();
        return;
      case "addFolder":
        await this.actions.addFolderProject();
        return;
      case "addWorkspace":
        await this.actions.addWorkspaceProject();
        return;
      case "addGroup":
        await this.actions.addProjectGroup();
        return;
      case "toggleSectionCollapsed":
        await this.actions.toggleSectionCollapsed(message.section);
        return;
      case "toggleGroupCollapsed":
        await this.actions.toggleGroupCollapsed(message.groupId);
        return;
      case "removeGroup":
        await this.actions.removeProjectGroup(message.groupId);
        return;
      case "refresh":
        this.actions.refresh();
        return;
      case "openProject":
        {
          const projectUri = this.virtualProjectUriById.get(message.projectId);
          if (projectUri) {
            await this.actions.openProjectUri(projectUri, message.newWindow);
            return;
          }
        }

        await this.actions.openProject(message.projectId, message.newWindow);
        return;
      case "renameProject":
        if (this.virtualProjectUriById.has(message.projectId)) {
          this.showError("This action is only available for saved projects.");
          return;
        }

        await this.actions.renameProject(message.projectId);
        return;
      case "removeProject":
        if (this.virtualProjectUriById.has(message.projectId)) {
          this.showError("This action is only available for saved projects.");
          return;
        }

        await this.actions.removeProject(message.projectId);
        return;
      case "togglePinProject":
        if (this.virtualProjectUriById.has(message.projectId)) {
          this.showError("This action is only available for saved projects.");
          return;
        }

        await this.actions.togglePinProject(message.projectId);
        return;
      case "revealInFinder":
        if (this.virtualProjectUriById.has(message.projectId)) {
          this.showError("This action is only available for saved projects.");
          return;
        }

        await this.actions.revealInFinder(message.projectId);
        return;
      default:
        return;
    }
  }

  private postState(): void {
    if (!this.view) {
      return;
    }

    if (this.syncCurrentWorkspaceBadgeColorSnapshot()) {
      return;
    }

    const state = this.buildState();
    this.view.webview.postMessage({
      type: "state",
      payload: state
    });
  }

  private buildState(): WebviewState {
    const currentUri = this.getCurrentWorkspaceUri();
    const currentBadgeColor = this.getCurrentWorkspaceBadgeColor();
    const savedProjects = this.store.getAllProjects();
    const groups = this.store.getAllGroups();
    this.syncGroupChildrenCache(groups);
    const savedWebviewProjects = savedProjects.map((project) => {
      return mapStoredProjectToWebviewProject(project, currentUri, currentBadgeColor);
    });

    this.virtualProjectUriById.clear();

    const groupSections = resolveProjectGroupSections({
      manualProjects: savedProjects,
      groups,
      listGroupChildren: (group) => this.listGroupChildren(group)
    }).map((section) => {
      return {
        id: section.id,
        title: section.title,
        collapsed: section.collapsed,
        projects: section.projects.map((project) => {
          const webviewProject = mapResolvedGroupProjectToWebviewProject(project, currentUri, currentBadgeColor);
          this.virtualProjectUriById.set(webviewProject.id, webviewProject.uri);
          return webviewProject;
        })
      };
    });

    const groupedProjects = groupSections.flatMap((section) => section.projects);

    const current =
      savedWebviewProjects.find((item) => item.isCurrent) ?? groupedProjects.find((item) => item.isCurrent) ?? null;
    const restSaved = savedWebviewProjects.filter((item) => !item.isCurrent);
    const restGroups = groupSections.map((section) => ({
      ...section,
      projects: section.projects.filter((item) => !item.isCurrent)
    }));

    const recent = selectRecentProjects(restSaved, 5);
    const recentIds = new Set(recent.map((item) => item.id));
    const pinned = restSaved.filter((item) => item.pinned);
    const others = restSaved.filter((item) => !item.pinned && !recentIds.has(item.id));

    return {
      current: this.sectionVisibility.current ? current : null,
      recent: this.sectionVisibility.recent ? recent : [],
      pinned: this.sectionVisibility.pinned ? pinned : [],
      others: this.sectionVisibility.projects ? others : [],
      groups: this.sectionVisibility.groups ? restGroups : [],
      sectionCollapseState: this.sectionCollapseState
    };
  }

  private syncGroupChildrenCache(groups: ProjectGroup[]): void {
    const validGroupIds = new Set(groups.map((group) => group.id));

    for (const groupId of Array.from(this.groupChildrenCache.keys())) {
      if (!validGroupIds.has(groupId)) {
        this.groupChildrenCache.delete(groupId);
      }
    }

    for (const group of groups) {
      const cached = this.groupChildrenCache.get(group.id);
      if (cached && cached.rootUri !== group.rootUri) {
        this.groupChildrenCache.delete(group.id);
      }
    }
  }

  private getCurrentWorkspaceUri(): string | undefined {
    if (vscode.workspace.workspaceFile) {
      return vscode.workspace.workspaceFile.toString();
    }

    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length !== 1) {
      return undefined;
    }

    return folders[0].uri.toString();
  }

  private getCurrentWorkspaceBadgeColor(): string | undefined {
    if (!ENABLE_WORKSPACE_ACCENT_BADGE_COLOR) {
      return undefined;
    }

    const configuration = vscode.workspace.getConfiguration();
    const peacockColor = normalizeBadgeColor(configuration.get("peacock.color"));
    if (peacockColor) {
      return peacockColor;
    }

    const colorCustomizations = configuration.get<Record<string, unknown>>("workbench.colorCustomizations");
    if (!colorCustomizations || typeof colorCustomizations !== "object") {
      return undefined;
    }

    return normalizeBadgeColor(colorCustomizations["activityBar.activeBackground"]);
  }

  private syncCurrentWorkspaceBadgeColorSnapshot(): boolean {
    if (!ENABLE_WORKSPACE_ACCENT_BADGE_COLOR) {
      return false;
    }

    const currentUri = this.getCurrentWorkspaceUri();
    if (!currentUri) {
      return false;
    }

    const savedCurrentProject = this.store.getProjectByUri(currentUri);
    if (!savedCurrentProject) {
      return false;
    }

    const currentBadgeColor = this.getCurrentWorkspaceBadgeColor();
    if (savedCurrentProject.badgeColor === currentBadgeColor) {
      return false;
    }

    this.store.setBadgeColor(savedCurrentProject.id, currentBadgeColor);
    return true;
  }

  private listGroupChildren(group: ProjectGroup): GroupChildFolder[] {
    const cached = this.groupChildrenCache.get(group.id);
    if (cached && cached.rootUri === group.rootUri) {
      return cached.children;
    }

    const rootPath = getFilePath(group.rootUri);
    if (!rootPath) {
      this.groupChildrenCache.set(group.id, {
        rootUri: group.rootUri,
        children: []
      });
      return [];
    }

    try {
      const entries = fs.readdirSync(rootPath, { withFileTypes: true });
      const children = entries
        .filter((entry) => entry.isDirectory())
        .map((entry) => {
          const folderPath = path.join(rootPath, entry.name);
          return {
            name: entry.name,
            uri: vscode.Uri.file(folderPath).toString()
          };
        });

      this.groupChildrenCache.set(group.id, {
        rootUri: group.rootUri,
        children
      });

      return children;
    } catch {
      this.groupChildrenCache.set(group.id, {
        rootUri: group.rootUri,
        children: []
      });
      return [];
    }
  }

  private getHtml(webview: vscode.Webview): string {
    const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "view.css"));
    const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(this.extensionUri, "media", "view.js"));
    const nonce = getNonce();

    return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'nonce-${nonce}'; script-src ${webview.cspSource} 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link nonce="${nonce}" rel="stylesheet" href="${styleUri}" />
    <title>Project Switcher</title>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
  }
}

function mapStoredProjectToWebviewProject(
  project: StoredProject,
  currentUri: string | undefined,
  currentBadgeColor: string | undefined
): WebviewProject {
  const isCurrent = currentUri === project.uri;

  return {
    id: project.id,
    name: project.name,
    kind: project.kind,
    uri: project.uri,
    fullPath: formatFullPath(project.uri),
    displayPath: formatPath(project.uri),
    pinned: project.pinned,
    isCurrent,
    isVirtual: false,
    lastOpenedAt: project.lastOpenedAt,
    initials: getInitials(project.name),
    badgeTone: getBadgeTone(project.id),
    badgeColorOverride: isCurrent ? currentBadgeColor ?? project.badgeColor : project.badgeColor
  };
}

function mapResolvedGroupProjectToWebviewProject(
  project: ResolvedGroupProject,
  currentUri: string | undefined,
  currentBadgeColor: string | undefined
): WebviewProject {
  const isCurrent = currentUri === project.uri;

  return {
    id: project.id,
    name: project.name,
    kind: project.kind,
    uri: project.uri,
    fullPath: formatFullPath(project.uri),
    displayPath: formatPath(project.uri),
    pinned: false,
    isCurrent,
    isVirtual: true,
    lastOpenedAt: undefined,
    initials: getInitials(project.name),
    badgeTone: getBadgeTone(project.id),
    badgeColorOverride: isCurrent ? currentBadgeColor : undefined
  };
}

function formatFullPath(uriString: string): string {
  try {
    const uri = vscode.Uri.parse(uriString);
    if (uri.scheme !== "file") {
      return uriString;
    }

    return uri.fsPath;
  } catch {
    return uriString;
  }
}

function formatPath(uriString: string): string {
  try {
    const uri = vscode.Uri.parse(uriString);
    if (uri.scheme !== "file") {
      return uriString;
    }

    const filePath = uri.fsPath;
    const home = process.env.HOME;
    if (home && filePath.startsWith(home)) {
      return `~${filePath.slice(home.length)}`;
    }

    return filePath;
  } catch {
    return uriString;
  }
}

function getFilePath(uriString: string): string | undefined {
  try {
    const uri = vscode.Uri.parse(uriString);
    if (uri.scheme !== "file") {
      return undefined;
    }

    return uri.fsPath;
  } catch {
    return undefined;
  }
}

function getInitials(name: string): string {
  const tokens = name
    .trim()
    .split(/[\s_-]+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return "PR";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}

function getBadgeTone(seed: string): number {
  const appleSystemColorCount = 10;

  let hash = 0;
  for (const char of seed) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }

  return Math.abs(hash) % appleSystemColorCount;
}

function normalizeBadgeColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{4}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{8}$/.test(normalized)) {
    return normalized.slice(0, 7).toLowerCase();
  }

  return undefined;
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
