import * as vscode from "vscode";
import { extractRepoNameFromUrl, convertSshScpToUri } from "./repoNameExtractor";

export { extractRepoNameFromUrl, convertSshScpToUri };

export interface GitCloneResult {
  success: boolean;
  uri?: vscode.Uri;
  error?: string;
}

interface GitExtension {
  enabled: boolean;
  getAPI(version: 1): GitAPI;
}

interface GitAPI {
  clone(uri: vscode.Uri, options?: { parentPath?: vscode.Uri; postCloneAction?: "none" }): Thenable<vscode.Uri | null>;
}

function isSshScpUrl(url: string): boolean {
  return url.startsWith("git@");
}

function repoUrlToUri(url: string): vscode.Uri {
  let uriString = url;
  if (isSshScpUrl(url)) {
    uriString = convertSshScpToUri(url);
  }
  return vscode.Uri.parse(uriString);
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
    const repoUri = repoUrlToUri(repoUrl);
    const clonedUri = await gitApi.clone(repoUri, {
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
