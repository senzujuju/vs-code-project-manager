import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { readGitBranchSync, readWorkspaceBranchSync } from "../src/core/gitBranchReader";

function makeTmpDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), "git-branch-test-"));
}

test("readGitBranchSync returns branch name for normal repo", () => {
  const dir = makeTmpDir();
  const gitDir = path.join(dir, ".git");
  fs.mkdirSync(gitDir);
  fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/main\n", "utf8");

  assert.equal(readGitBranchSync(dir), "main");
});

test("readGitBranchSync returns branch with slashes", () => {
  const dir = makeTmpDir();
  const gitDir = path.join(dir, ".git");
  fs.mkdirSync(gitDir);
  fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/feature/my-thing\n", "utf8");

  assert.equal(readGitBranchSync(dir), "feature/my-thing");
});

test("readGitBranchSync returns null for detached HEAD", () => {
  const dir = makeTmpDir();
  const gitDir = path.join(dir, ".git");
  fs.mkdirSync(gitDir);
  fs.writeFileSync(path.join(gitDir, "HEAD"), "a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4e5f6a1b2\n", "utf8");

  assert.equal(readGitBranchSync(dir), null);
});

test("readGitBranchSync returns null when .git does not exist", () => {
  const dir = makeTmpDir();

  assert.equal(readGitBranchSync(dir), null);
});

test("readGitBranchSync returns null for non-existent path", () => {
  assert.equal(readGitBranchSync("/this/path/does/not/exist"), null);
});

test("readGitBranchSync follows gitdir for worktree", () => {
  const dir = makeTmpDir();
  // Simulate a worktree: project/.git is a file pointing to worktree HEAD
  const worktreeHeadDir = path.join(dir, "worktree-head");
  fs.mkdirSync(worktreeHeadDir, { recursive: true });
  fs.writeFileSync(path.join(worktreeHeadDir, "HEAD"), "ref: refs/heads/feature-wt\n", "utf8");

  const projectDir = path.join(dir, "project");
  fs.mkdirSync(projectDir);
  fs.writeFileSync(path.join(projectDir, ".git"), `gitdir: ${worktreeHeadDir}\n`, "utf8");

  assert.equal(readGitBranchSync(projectDir), "feature-wt");
});

test("readGitBranchSync returns null for worktree with invalid gitdir line", () => {
  const dir = makeTmpDir();
  const projectDir = path.join(dir, "project");
  fs.mkdirSync(projectDir);
  fs.writeFileSync(path.join(projectDir, ".git"), "not a gitdir line\n", "utf8");

  assert.equal(readGitBranchSync(projectDir), null);
});

// readWorkspaceBranchSync tests

test("readWorkspaceBranchSync returns branch for workspace with single folder (absolute path)", () => {
  const dir = makeTmpDir();
  const projectDir = path.join(dir, "my-project");
  fs.mkdirSync(projectDir);
  const gitDir = path.join(projectDir, ".git");
  fs.mkdirSync(gitDir);
  fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/workspace-feature\n", "utf8");

  const workspaceFile = path.join(dir, "project.code-workspace");
  fs.writeFileSync(workspaceFile, JSON.stringify({ folders: [{ path: projectDir }] }), "utf8");

  assert.equal(readWorkspaceBranchSync(workspaceFile), "workspace-feature");
});

test("readWorkspaceBranchSync returns branch for workspace with single folder (relative path)", () => {
  const dir = makeTmpDir();
  const projectDir = path.join(dir, "my-project");
  fs.mkdirSync(projectDir);
  const gitDir = path.join(projectDir, ".git");
  fs.mkdirSync(gitDir);
  fs.writeFileSync(path.join(gitDir, "HEAD"), "ref: refs/heads/relative-branch\n", "utf8");

  const workspaceFile = path.join(dir, "project.code-workspace");
  fs.writeFileSync(workspaceFile, JSON.stringify({ folders: [{ path: "my-project" }] }), "utf8");

  assert.equal(readWorkspaceBranchSync(workspaceFile), "relative-branch");
});

test("readWorkspaceBranchSync returns null for workspace with multiple folders", () => {
  const dir = makeTmpDir();
  const workspaceFile = path.join(dir, "multi.code-workspace");
  fs.writeFileSync(workspaceFile, JSON.stringify({ folders: [{ path: "/a" }, { path: "/b" }] }), "utf8");

  assert.equal(readWorkspaceBranchSync(workspaceFile), null);
});

test("readWorkspaceBranchSync returns null for workspace with no folders", () => {
  const dir = makeTmpDir();
  const workspaceFile = path.join(dir, "empty.code-workspace");
  fs.writeFileSync(workspaceFile, JSON.stringify({ folders: [] }), "utf8");

  assert.equal(readWorkspaceBranchSync(workspaceFile), null);
});

test("readWorkspaceBranchSync returns null for workspace without folders key", () => {
  const dir = makeTmpDir();
  const workspaceFile = path.join(dir, "no-folders.code-workspace");
  fs.writeFileSync(workspaceFile, JSON.stringify({ settings: {} }), "utf8");

  assert.equal(readWorkspaceBranchSync(workspaceFile), null);
});

test("readWorkspaceBranchSync returns null for invalid JSON", () => {
  const dir = makeTmpDir();
  const workspaceFile = path.join(dir, "invalid.code-workspace");
  fs.writeFileSync(workspaceFile, "not valid json", "utf8");

  assert.equal(readWorkspaceBranchSync(workspaceFile), null);
});

test("readWorkspaceBranchSync returns null for non-existent file", () => {
  assert.equal(readWorkspaceBranchSync("/non/existent/workspace.code-workspace"), null);
});
