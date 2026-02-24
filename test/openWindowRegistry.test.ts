import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import test from "node:test";
import { collectOpenElsewhereUris, OpenWindowRegistry, OpenWindowSessionRecord } from "../src/core/openWindowRegistry";

test("collectOpenElsewhereUris excludes current and stale sessions", () => {
  const sessions: OpenWindowSessionRecord[] = [
    {
      sessionId: "self",
      workspaceUri: "file:///work/current",
      focused: true,
      updatedAt: 1_000
    },
    {
      sessionId: "other-1",
      workspaceUri: "file:///work/api",
      focused: false,
      updatedAt: 970
    },
    {
      sessionId: "other-stale",
      workspaceUri: "file:///work/old",
      focused: false,
      updatedAt: 800
    }
  ];

  const result = collectOpenElsewhereUris({
    sessions,
    currentSessionId: "self",
    now: 1_000,
    staleAfterMs: 120
  });

  assert.deepEqual(result, ["file:///work/api"]);
});

test("collectOpenElsewhereUris deduplicates workspace URIs", () => {
  const sessions: OpenWindowSessionRecord[] = [
    {
      sessionId: "other-1",
      workspaceUri: "file:///work/shared",
      focused: true,
      updatedAt: 1_000
    },
    {
      sessionId: "other-2",
      workspaceUri: "file:///work/shared",
      focused: false,
      updatedAt: 1_000
    }
  ];

  const result = collectOpenElsewhereUris({
    sessions,
    currentSessionId: "self",
    now: 1_000,
    staleAfterMs: 120
  });

  assert.deepEqual(result, ["file:///work/shared"]);
});

test("collectOpenElsewhereUris ignores sessions without valid workspace URI", () => {
  const sessions: OpenWindowSessionRecord[] = [
    {
      sessionId: "other-1",
      focused: false,
      updatedAt: 1_000
    },
    {
      sessionId: "other-2",
      workspaceUri: "   ",
      focused: false,
      updatedAt: 1_000
    },
    {
      sessionId: "other-3",
      workspaceUri: "file:///work/valid",
      focused: false,
      updatedAt: 1_000
    }
  ];

  const result = collectOpenElsewhereUris({
    sessions,
    currentSessionId: "self",
    now: 1_000,
    staleAfterMs: 120
  });

  assert.deepEqual(result, ["file:///work/valid"]);
});

test("collectOpenElsewhereUris includes badgeColor when present", () => {
  const sessions: OpenWindowSessionRecord[] = [
    {
      sessionId: "other-1",
      workspaceUri: "file:///work/api",
      focused: false,
      updatedAt: 1_000,
      badgeColor: "#ff0000"
    },
    {
      sessionId: "other-2",
      workspaceUri: "file:///work/no-color",
      focused: false,
      updatedAt: 1_000
    }
  ];

  const result = collectOpenElsewhereUris({
    sessions,
    currentSessionId: "self",
    now: 1_000,
    staleAfterMs: 120
  });

  assert.deepEqual(result, ["file:///work/api", "file:///work/no-color"]);
});

test("OpenWindowRegistry writes branch to session file", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-branch-test-"));

  try {
    const registry = new OpenWindowRegistry({
      sessionsDirectoryPath: tmpDir,
      writeDebounceMs: 0
    });

    registry.start({ workspaceUri: "file:///test", focused: false });
    registry.setBranch("feature-x");

    await new Promise((r) => setTimeout(r, 50));

    const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".json"));
    assert.equal(files.length, 1);

    const record = JSON.parse(fs.readFileSync(path.join(tmpDir, files[0]), "utf8"));
    assert.equal(record.branch, "feature-x");

    registry.dispose();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});

test("OpenWindowRegistry clears branch when setBranch called with undefined", async () => {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "registry-branch-test-"));

  try {
    const registry = new OpenWindowRegistry({
      sessionsDirectoryPath: tmpDir,
      writeDebounceMs: 0
    });

    registry.start({ workspaceUri: "file:///test", focused: false });
    registry.setBranch("main");
    registry.setBranch(undefined);

    await new Promise((r) => setTimeout(r, 50));

    const files = fs.readdirSync(tmpDir).filter((f) => f.endsWith(".json"));
    const record = JSON.parse(fs.readFileSync(path.join(tmpDir, files[0]), "utf8"));
    assert.equal(record.branch, undefined);

    registry.dispose();
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
});
