import assert from "node:assert/strict";
import test from "node:test";
import { normalizeBadgeColor, resolveWorkspaceBadgeColor } from "../src/core/workspaceBadgeColorSync";

test("normalizeBadgeColor normalizes hex variants", () => {
  assert.equal(normalizeBadgeColor("#abc"), "#aabbcc");
  assert.equal(normalizeBadgeColor("#ABCD"), "#aabbcc");
  assert.equal(normalizeBadgeColor("#12abEF"), "#12abef");
  assert.equal(normalizeBadgeColor("#12abefcc"), "#12abef");
});

test("normalizeBadgeColor returns undefined for invalid values", () => {
  assert.equal(normalizeBadgeColor(undefined), undefined);
  assert.equal(normalizeBadgeColor(""), undefined);
  assert.equal(normalizeBadgeColor("rgb(1,2,3)"), undefined);
  assert.equal(normalizeBadgeColor("#12"), undefined);
});

test("resolveWorkspaceBadgeColor prefers peacock color over activity bar", () => {
  const color = resolveWorkspaceBadgeColor({
    peacockColor: "#f04732",
    colorCustomizations: {
      "activityBar.activeBackground": "#1f9d55"
    }
  });

  assert.equal(color, "#f04732");
});

test("resolveWorkspaceBadgeColor falls back to activity bar color", () => {
  const color = resolveWorkspaceBadgeColor({
    peacockColor: undefined,
    colorCustomizations: {
      "activityBar.activeBackground": "#A5C322AA"
    }
  });

  assert.equal(color, "#a5c322");
});

test("resolveWorkspaceBadgeColor returns undefined for unsupported customization payload", () => {
  const color = resolveWorkspaceBadgeColor({
    peacockColor: undefined,
    colorCustomizations: "#ff00ff"
  });

  assert.equal(color, undefined);
});
