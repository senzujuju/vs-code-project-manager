import * as vscode from "vscode";
import { ProjectStore, StoredProject } from "./projectStore";

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

    this.store.markOpened(project.id);

    const openInNewWindow =
      forceNewWindow ??
      vscode.workspace.getConfiguration("projectSwitcher").get<boolean>("openInNewWindow", false);

    await vscode.commands.executeCommand("vscode.openFolder", targetUri, {
      forceNewWindow: openInNewWindow
    });
  }
}
