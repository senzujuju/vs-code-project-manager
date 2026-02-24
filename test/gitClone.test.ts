import test from "node:test";
import assert from "node:assert/strict";
import { extractRepoNameFromUrl, convertSshScpToUri } from "../src/core/repoNameExtractor";

test("extractRepoNameFromUrl extracts name from https URL", () => {
  assert.equal(extractRepoNameFromUrl("https://github.com/microsoft/vscode.git"), "vscode");
  assert.equal(extractRepoNameFromUrl("https://github.com/owner/repo"), "repo");
});

test("extractRepoNameFromUrl extracts name from SSH URL", () => {
  assert.equal(extractRepoNameFromUrl("git@github.com:owner/repo.git"), "repo");
});

test("extractRepoNameFromUrl handles trailing slash", () => {
  assert.equal(extractRepoNameFromUrl("https://github.com/owner/repo/"), "repo");
});

test("extractRepoNameFromUrl returns fallback for invalid URL", () => {
  assert.equal(extractRepoNameFromUrl(""), "repository");
  assert.equal(extractRepoNameFromUrl("not-a-url"), "repository");
});

test("convertSshScpToUri converts git@ SCP format to ssh:// URI", () => {
  assert.equal(
    convertSshScpToUri("git@github.com:owner/repo.git"),
    "ssh://git@github.com/owner/repo.git"
  );
  assert.equal(
    convertSshScpToUri("git@gitlab.com:group/subgroup/project.git"),
    "ssh://git@gitlab.com/group/subgroup/project.git"
  );
});

test("convertSshScpToUri returns unchanged if not SCP format", () => {
  assert.equal(convertSshScpToUri("https://github.com/owner/repo.git"), "https://github.com/owner/repo.git");
  assert.equal(convertSshScpToUri("ssh://git@github.com/owner/repo.git"), "ssh://git@github.com/owner/repo.git");
  assert.equal(convertSshScpToUri("not-a-url"), "not-a-url");
});
