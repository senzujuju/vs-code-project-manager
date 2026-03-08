import * as fs from "node:fs";
import * as path from "node:path";
import * as vscode from "vscode";
import { readGitBranchSync } from "../core/gitBranchReader";
import { resolveProjectGroupSections } from "../core/projectGroups";
import type { ProjectStore, StoredProject } from "../core/projectStore";
import { getInitials } from "../core/projectInitials";
import { selectRecentProjects } from "../core/viewSections";
import { resolveWorkspaceBadgeColor } from "../core/workspaceBadgeColorSync";
import type { ProjectSwitcherActions } from "./projectSwitcherViewProvider";

const QUICK_LAUNCHER_PREVIEW_VIEW_TYPE = "projectSwitcher.quickLauncherPreview";

interface QuickLauncherPreviewProject {
  id: string;
  name: string;
  uri: string;
  fullPath: string;
  displayPath: string;
  initials: string;
  branch?: string;
  isCurrent: boolean;
  isVirtual: boolean;
  pinned: boolean;
  badgeTone: number;
  badgeColorOverride?: string;
}

interface QuickLauncherPreviewState {
  projects: QuickLauncherPreviewProject[];
}

interface QuickLauncherOpenMessage {
  type: "openProject";
  projectId: string;
  newWindow?: boolean;
}

interface QuickLauncherRefreshMessage {
  type: "refresh" | "ready";
}

type QuickLauncherMessage = QuickLauncherOpenMessage | QuickLauncherRefreshMessage;

interface ResolvedPreviewProject {
  id: string;
  uri: string;
  isVirtual: boolean;
}

interface BuildQuickLauncherPreviewStateResult {
  state: QuickLauncherPreviewState;
  resolvedProjects: Map<string, ResolvedPreviewProject>;
}

export function showQuickLauncherPreview(
  extensionUri: vscode.Uri,
  store: ProjectStore,
  actions: ProjectSwitcherActions,
): void {
  const panel = vscode.window.createWebviewPanel(
    QUICK_LAUNCHER_PREVIEW_VIEW_TYPE,
    "Project Switcher: Quick Launcher (Preview)",
    vscode.ViewColumn.Active,
    {
      enableScripts: true,
      localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
    },
  );

  panel.webview.html = getHtml(panel.webview, extensionUri);

  let resolvedProjects = new Map<string, ResolvedPreviewProject>();

  const postState = () => {
    const next = buildQuickLauncherPreviewState(store);
    resolvedProjects = next.resolvedProjects;
    void panel.webview.postMessage({
      type: "state",
      payload: next.state,
    });
  };

  const unsubscribeStore = store.onDidChange(postState);

  const messageSubscription = panel.webview.onDidReceiveMessage(async (message: unknown) => {
    if (!message || typeof message !== "object") {
      return;
    }

    const quickLauncherMessage = message as Partial<QuickLauncherMessage>;
    if (quickLauncherMessage.type === "refresh" || quickLauncherMessage.type === "ready") {
      postState();
      return;
    }

    if (quickLauncherMessage.type !== "openProject") {
      return;
    }

    const projectId = quickLauncherMessage.projectId;
    if (typeof projectId !== "string") {
      return;
    }

    const targetProject = resolvedProjects.get(projectId);
    if (!targetProject) {
      return;
    }

    const openInNewWindow = quickLauncherMessage.newWindow === true;
    panel.dispose();

    if (targetProject.isVirtual) {
      await actions.openProjectUri(targetProject.uri, openInNewWindow);
    } else {
      await actions.openProject(targetProject.id, openInNewWindow);
    }
  });

  panel.onDidDispose(() => {
    messageSubscription.dispose();
    unsubscribeStore();
  });

  postState();
}

function buildQuickLauncherPreviewState(store: ProjectStore): BuildQuickLauncherPreviewStateResult {
  const currentWorkspaceUri = getCurrentWorkspaceUri();
  const currentBadgeColor = getCurrentWorkspaceBadgeColor();
  const savedProjects = store.getAllProjects();
  const groups = store.getAllGroups();

  const savedItems = savedProjects.map((project) => {
    return mapStoredProject(project, currentWorkspaceUri, currentBadgeColor);
  });

  const rawGroupSections = resolveProjectGroupSections({
    manualProjects: savedProjects,
    groups,
    listGroupChildren: (group) => {
      const rootPath = getFilePath(group.rootUri);
      if (!rootPath) {
        return [];
      }

      try {
        const entries = fs.readdirSync(rootPath, { withFileTypes: true });
        return entries
          .filter((entry) => entry.isDirectory())
          .map((entry) => {
            return {
              name: entry.name,
              uri: vscode.Uri.file(path.join(rootPath, entry.name)).toString(),
            };
          });
      } catch {
        return [];
      }
    },
  });

  const groupProjects = rawGroupSections.flatMap((section) => {
    return section.projects.map((project) => {
      return mapVirtualProject(project.id, project.name, project.uri, currentWorkspaceUri, currentBadgeColor);
    });
  });

  const currentProject = savedItems.find((project) => project.isCurrent) ?? groupProjects.find((project) => project.isCurrent);
  const currentSectionItems = currentProject ? [currentProject] : [];

  const restSaved = savedItems.filter((project) => !project.isCurrent);
  const recent = selectRecentProjects(restSaved, 5);
  const recentIds = new Set(recent.map((project) => project.id));
  const pinned = restSaved.filter((project) => project.pinned);
  const others = restSaved.filter((project) => !project.pinned && !recentIds.has(project.id));

  const filteredGroupProjects = groupProjects.filter((project) => !project.isCurrent);

  const projects = [
    ...currentSectionItems,
    ...recent,
    ...pinned,
    ...others,
    ...filteredGroupProjects,
  ];

  const resolvedProjects = new Map<string, ResolvedPreviewProject>();
  for (const project of projects) {
    resolvedProjects.set(project.id, {
      id: project.id,
      uri: project.uri,
      isVirtual: project.isVirtual,
    });
  }

  return {
    state: {
      projects,
    },
    resolvedProjects,
  };
}

function mapStoredProject(
  project: StoredProject,
  currentWorkspaceUri: string | undefined,
  currentBadgeColor: string | undefined,
): QuickLauncherPreviewProject {
  const fullPath = formatFullPath(project.uri);
  const isCurrent = currentWorkspaceUri === project.uri;

  return {
    id: project.id,
    name: project.name,
    uri: project.uri,
    fullPath,
    displayPath: compactPath(project.uri),
    initials: getInitials(project.name),
    branch: getBranchName(fullPath),
    isCurrent,
    isVirtual: false,
    pinned: project.pinned,
    badgeTone: getBadgeTone(project.id),
    badgeColorOverride: isCurrent ? currentBadgeColor ?? project.badgeColor : project.badgeColor,
  };
}

function mapVirtualProject(
  id: string,
  name: string,
  uri: string,
  currentWorkspaceUri: string | undefined,
  currentBadgeColor: string | undefined,
): QuickLauncherPreviewProject {
  const fullPath = formatFullPath(uri);
  const isCurrent = currentWorkspaceUri === uri;

  return {
    id,
    name,
    uri,
    fullPath,
    displayPath: compactPath(uri),
    initials: getInitials(name),
    branch: getBranchName(fullPath),
    isCurrent,
    isVirtual: true,
    pinned: false,
    badgeTone: getBadgeTone(id),
    badgeColorOverride: isCurrent ? currentBadgeColor : undefined,
  };
}

function getBranchName(fullPath: string): string | undefined {
  return readGitBranchSync(fullPath) ?? undefined;
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

function getCurrentWorkspaceBadgeColor(): string | undefined {
  const configuration = vscode.workspace.getConfiguration();
  return resolveWorkspaceBadgeColor({
    peacockColor: configuration.get("peacock.color"),
    colorCustomizations: configuration.get("workbench.colorCustomizations"),
  });
}

function formatFullPath(uriString: string): string {
  const filePath = getFilePath(uriString);
  return filePath ?? uriString;
}

function compactPath(uriString: string): string {
  const filePath = getFilePath(uriString);
  if (!filePath) {
    return uriString;
  }

  const home = process.env.HOME;
  if (home && filePath.startsWith(home)) {
    return `~${filePath.slice(home.length)}`;
  }

  return filePath;
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

function getBadgeTone(seed: string): number {
  const appleSystemColorCount = 10;

  let hash = 0;
  for (const char of seed) {
    hash = (hash << 5) - hash + char.charCodeAt(0);
    hash |= 0;
  }

  return Math.abs(hash) % appleSystemColorCount;
}

function getHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const styleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "view.css"));
  const previewStyleUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "quickLauncherPreview.css"));
  const scriptUri = webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", "quickLauncherPreview.js"));
  const nonce = getNonce();

  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src ${webview.cspSource} 'nonce-${nonce}';" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <link rel="stylesheet" href="${styleUri}" />
    <link rel="stylesheet" href="${previewStyleUri}" />
    <title>Project Switcher: Quick Launcher (Preview)</title>
  </head>
  <body>
    <div id="app"></div>
    <script nonce="${nonce}" src="${scriptUri}"></script>
  </body>
</html>`;
}

function getNonce(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let value = "";
  for (let index = 0; index < 32; index += 1) {
    value += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return value;
}
