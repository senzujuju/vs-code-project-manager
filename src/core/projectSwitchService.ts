import * as vscode from "vscode";
import { ProjectStore, StoredProject } from "./projectStore";
import { getProjectIdsToMarkOpened } from "./recentSwitch";

export class ProjectSwitchService {
  constructor(private readonly store: ProjectStore) {}

  async openProject(project: StoredProject, forceNewWindow?: boolean): Promise<void> {
    let targetUri: vscode.Uri;

    try {
      targetUri = vscode.Uri.parse(project.uri);
    } catch {
      await vscode.window.showErrorMessage(`Invalid project URI: ${project.uri}`);
      return;
    }

    const openInNewWindow =
      forceNewWindow ??
      vscode.workspace.getConfiguration("projectSwitcher").get<boolean>("openInNewWindow", false);

    const currentProjectId = openInNewWindow ? undefined : this.getCurrentProjectId();
    const markOpenedIds = getProjectIdsToMarkOpened({
      targetProjectId: project.id,
      currentProjectId,
      openInNewWindow
    });

    for (const projectId of markOpenedIds) {
      this.store.markOpened(projectId);
    }

    await vscode.commands.executeCommand("vscode.openFolder", targetUri, {
      forceNewWindow: openInNewWindow
    });
  }

  private getCurrentProjectId(): string | undefined {
    const currentUri = getCurrentWorkspaceUri();
    if (!currentUri) {
      return undefined;
    }

    const project = this.store.getProjectByUri(currentUri);
    return project?.id;
  }
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
