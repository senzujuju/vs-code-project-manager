import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { readGitBranchSync } from "../src/core/gitBranchReader";

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
