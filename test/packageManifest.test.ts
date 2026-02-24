import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import test from "node:test";

interface PackageManifest {
  activationEvents?: unknown;
}

test("manifest activates extension after startup for background sync", () => {
  const manifestPath = path.resolve(__dirname, "..", "..", "package.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  const manifest = JSON.parse(raw) as PackageManifest;
  const activationEvents = Array.isArray(manifest.activationEvents) ? manifest.activationEvents : [];

  assert.ok(activationEvents.includes("onStartupFinished"));
});
