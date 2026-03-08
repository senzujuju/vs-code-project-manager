import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import test from "node:test";

function readWorkspaceFile(relativePath: string): string {
  const absolutePath = path.resolve(__dirname, "..", "..", relativePath);
  return fs.readFileSync(absolutePath, "utf8");
}

test("quick launcher preview uses 3-column tile grid", () => {
  const css = readWorkspaceFile("media/quickLauncherPreview.css");

  assert.match(css, /grid-template-columns:\s*repeat\(3,\s*minmax\(0,\s*1fr\)\)/);
});

test("quick launcher preview handles 4-direction arrow navigation", () => {
  const script = readWorkspaceFile("media/quickLauncherPreview.js");

  assert.ok(script.includes("ArrowLeft"));
  assert.ok(script.includes("ArrowRight"));
  assert.ok(script.includes("ArrowUp"));
  assert.ok(script.includes("ArrowDown"));
});

test("quick launcher preview restores navigation when focus is lost", () => {
  const script = readWorkspaceFile("media/quickLauncherPreview.js");

  assert.ok(script.includes("window.addEventListener(\"keydown\""));
  assert.ok(script.includes("focusFirstProjectButton"));
});

test("quick launcher preview redirects typing to search input", () => {
  const script = readWorkspaceFile("media/quickLauncherPreview.js");

  assert.ok(script.includes("key.length === 1"));
  assert.ok(script.includes("focusSearchInput"));
});

test("quick launcher preview uses flat project list without sections", () => {
  const source = readWorkspaceFile("src/webview/quickLauncherPreview.ts");

  assert.ok(source.includes("projects: QuickLauncherPreviewProject[]"));
  assert.ok(!source.includes("interface QuickLauncherPreviewSection"));
});

test("quick launcher preview supports sidebar badge color overrides", () => {
  const source = readWorkspaceFile("src/webview/quickLauncherPreview.ts");
  const script = readWorkspaceFile("media/quickLauncherPreview.js");

  assert.ok(source.includes("badgeColorOverride?: string"));
  assert.ok(script.includes("customBadgeTemplate"));
  assert.ok(script.includes("badgeColorOverride"));
});

test("quick launcher preview disposes panel before opening project", () => {
  const source = readWorkspaceFile("src/webview/quickLauncherPreview.ts");

  const disposeIndex = source.indexOf("panel.dispose();");
  const openProjectIndex = source.indexOf("await actions.openProject(");
  const openProjectUriIndex = source.indexOf("await actions.openProjectUri(");

  assert.ok(disposeIndex >= 0);
  assert.ok(openProjectIndex >= 0);
  assert.ok(openProjectUriIndex >= 0);
  assert.ok(disposeIndex < openProjectIndex);
  assert.ok(disposeIndex < openProjectUriIndex);
});
