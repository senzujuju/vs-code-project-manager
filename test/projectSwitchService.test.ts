import test from "node:test";
import assert from "node:assert/strict";
import { getProjectIdsToMarkOpened } from "../src/core/recentSwitch";

test("getProjectIdsToMarkOpened prioritizes previous current project for same-window switch", () => {
  const result = getProjectIdsToMarkOpened({
    targetProjectId: "target",
    currentProjectId: "current",
    openInNewWindow: false
  });

  assert.deepEqual(result, ["current", "target"]);
});

test("getProjectIdsToMarkOpened skips current project in new-window mode", () => {
  const result = getProjectIdsToMarkOpened({
    targetProjectId: "target",
    currentProjectId: "current",
    openInNewWindow: true
  });

  assert.deepEqual(result, ["target"]);
});

test("getProjectIdsToMarkOpened avoids duplicate when target already current", () => {
  const result = getProjectIdsToMarkOpened({
    targetProjectId: "same",
    currentProjectId: "same",
    openInNewWindow: false
  });

  assert.deepEqual(result, ["same"]);
});
