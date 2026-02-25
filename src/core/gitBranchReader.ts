import * as fs from "node:fs";
import * as path from "node:path";

export function readGitBranchSync(fsPath: string): string | null {
  try {
    const gitPath = path.join(fsPath, ".git");

    let headPath: string;

    let stat: fs.Stats;
    try {
      stat = fs.statSync(gitPath);
    } catch {
      return null;
    }

    if (stat.isDirectory()) {
      headPath = path.join(gitPath, "HEAD");
    } else {
      // Worktree: .git is a file containing "gitdir: /abs/path/to/worktree"
      const content = fs.readFileSync(gitPath, "utf8").trim();
      const match = content.match(/^gitdir:\s+(.+)$/);
      if (!match) {
        return null;
      }
      headPath = path.join(match[1].trim(), "HEAD");
    }

    const head = fs.readFileSync(headPath, "utf8").trim();
    const match = head.match(/^ref: refs\/heads\/(.+)$/);
    return match ? match[1] : null;
  } catch {
    return null;
  }
}
