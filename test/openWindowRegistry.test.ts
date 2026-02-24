import assert from "node:assert/strict";
import test from "node:test";
import { collectOpenElsewhereUris, OpenWindowSessionRecord } from "../src/core/openWindowRegistry";

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
