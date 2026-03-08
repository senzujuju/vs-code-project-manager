import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import test from "node:test";

interface PackageManifest {
  activationEvents?: unknown;
  contributes?: {
    commands?: unknown;
    keybindings?: unknown;
  };
}

function readManifest(): PackageManifest {
  const manifestPath = path.resolve(__dirname, "..", "..", "package.json");
  const raw = fs.readFileSync(manifestPath, "utf8");
  return JSON.parse(raw) as PackageManifest;
}

test("manifest activates extension after startup for background sync", () => {
  const manifest = readManifest();
  const activationEvents = Array.isArray(manifest.activationEvents) ? manifest.activationEvents : [];

  assert.ok(activationEvents.includes("onStartupFinished"));
});

test("manifest contributes quick launcher preview command", () => {
  const manifest = readManifest();
  const commands = Array.isArray(manifest.contributes?.commands) ? manifest.contributes.commands : [];

  assert.ok(
    commands.some((candidate) => {
      if (!candidate || typeof candidate !== "object") {
        return false;
      }

      const command = (candidate as { command?: unknown }).command;
      return command === "projectSwitcher.quickLauncherPreview";
    })
  );
});

test("manifest binds quick launcher preview to legacy quick peek shortcut", () => {
  const manifest = readManifest();
  const keybindings = Array.isArray(manifest.contributes?.keybindings)
    ? manifest.contributes.keybindings
    : [];

  assert.ok(
    keybindings.some((candidate) => {
      if (!candidate || typeof candidate !== "object") {
        return false;
      }

      const binding = candidate as { command?: unknown; key?: unknown; mac?: unknown };
      return (
        binding.command === "projectSwitcher.quickLauncherPreview" &&
        binding.key === "ctrl+alt+k" &&
        binding.mac === "cmd+alt+k"
      );
    })
  );
});
