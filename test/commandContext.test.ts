import test from "node:test";
import assert from "node:assert/strict";
import { resolveProjectGroupId } from "../src/core/commandContext";

test("resolveProjectGroupId reads groupId from command context object", () => {
  const groupId = resolveProjectGroupId({ groupId: "group-123" });
  assert.equal(groupId, "group-123");
});

test("resolveProjectGroupId ignores project context values", () => {
  const groupId = resolveProjectGroupId({ projectId: "project-1" });
  assert.equal(groupId, undefined);
});

test("resolveProjectGroupId returns undefined for invalid values", () => {
  assert.equal(resolveProjectGroupId(undefined), undefined);
  assert.equal(resolveProjectGroupId(null), undefined);
  assert.equal(resolveProjectGroupId("group-123"), undefined);
  assert.equal(resolveProjectGroupId({ groupId: 123 }), undefined);
});
