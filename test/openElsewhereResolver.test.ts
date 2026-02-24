import assert from "node:assert/strict";
import test from "node:test";
import {
  resolveOpenElsewhereState,
  ResolvedOpenElsewhereProject
} from "../src/core/openElsewhereResolver";

test("resolveOpenElsewhereState includes group-derived project when its URI is open elsewhere", () => {
  const savedProjects = [
    { id: "saved-1", uri: "file:///work/saved-a", pinned: false, lastOpenedAt: 100 }
  ];
  const groupSections = [
    {
      id: "group-1",
      title: "Group",
      projects: [{ id: "group:1:child", uri: "file:///work/group-child" }]
    }
  ];
  const openElsewhereUris = new Set(["file:///work/group-child"]);

  const result = resolveOpenElsewhereState({
    savedProjects,
    groupSections,
    openElsewhereUris,
    currentUri: "file:///work/current"
  });

  assert.ok(result.openElsewhere.length === 1);
  assert.equal(result.openElsewhere[0].id, "group:1:child");
  assert.equal(result.openElsewhere[0].uri, "file:///work/group-child");
  assert.equal(result.openElsewhere[0].isVirtual, true);
});

test("resolveOpenElsewhereState prefers saved project over group-derived for same URI", () => {
  const savedProjects = [
    { id: "saved-1", uri: "file:///work/shared", pinned: false, lastOpenedAt: 100 }
  ];
  const groupSections = [
    {
      id: "group-1",
      title: "Group",
      projects: [{ id: "group:1:shared", uri: "file:///work/shared" }]
    }
  ];
  const openElsewhereUris = new Set(["file:///work/shared"]);

  const result = resolveOpenElsewhereState({
    savedProjects,
    groupSections,
    openElsewhereUris,
    currentUri: "file:///work/current"
  });

  assert.ok(result.openElsewhere.length === 1);
  assert.equal(result.openElsewhere[0].id, "saved-1");
  assert.equal(result.openElsewhere[0].isVirtual, false);
});

test("resolveOpenElsewhereState hides duplicates from group sections when promoted to openElsewhere", () => {
  const savedProjects: { id: string; uri: string; pinned: boolean; lastOpenedAt?: number }[] = [];
  const groupSections = [
    {
      id: "group-1",
      title: "Group",
      projects: [{ id: "group:1:child", uri: "file:///work/group-child" }]
    }
  ];
  const openElsewhereUris = new Set(["file:///work/group-child"]);

  const result = resolveOpenElsewhereState({
    savedProjects,
    groupSections,
    openElsewhereUris,
    currentUri: "file:///work/current"
  });

  assert.ok(result.restGroups.length === 1);
  assert.ok(result.restGroups[0].projects.length === 0);
});

test("resolveOpenElsewhereState excludes current project from openElsewhere", () => {
  const savedProjects = [
    { id: "saved-1", uri: "file:///work/current", pinned: false, lastOpenedAt: 100 }
  ];
  const groupSections: { id: string; title: string; projects: { id: string; uri: string }[] }[] = [];
  const openElsewhereUris = new Set(["file:///work/current"]);

  const result = resolveOpenElsewhereState({
    savedProjects,
    groupSections,
    openElsewhereUris,
    currentUri: "file:///work/current"
  });

  assert.ok(result.openElsewhere.length === 0);
});

test("resolveOpenElsewhereState keeps group project in group when not open elsewhere", () => {
  const savedProjects: { id: string; uri: string; pinned: boolean; lastOpenedAt?: number }[] = [];
  const groupSections = [
    {
      id: "group-1",
      title: "Group",
      projects: [{ id: "group:1:child", uri: "file:///work/group-child" }]
    }
  ];
  const openElsewhereUris = new Set<string>();

  const result = resolveOpenElsewhereState({
    savedProjects,
    groupSections,
    openElsewhereUris,
    currentUri: "file:///work/current"
  });

  assert.ok(result.openElsewhere.length === 0);
  assert.ok(result.restGroups.length === 1);
  assert.ok(result.restGroups[0].projects.length === 1);
  assert.equal(result.restGroups[0].projects[0].id, "group:1:child");
});

test("resolveOpenElsewhereState removes promoted saved projects from restSaved", () => {
  const savedProjects = [
    { id: "saved-1", uri: "file:///work/saved-a", pinned: false, lastOpenedAt: 100 },
    { id: "saved-2", uri: "file:///work/saved-b", pinned: false, lastOpenedAt: 90 }
  ];
  const groupSections: { id: string; title: string; projects: { id: string; uri: string }[] }[] = [];
  const openElsewhereUris = new Set(["file:///work/saved-a"]);

  const result = resolveOpenElsewhereState({
    savedProjects,
    groupSections,
    openElsewhereUris,
    currentUri: "file:///work/current"
  });

  assert.ok(result.openElsewhere.length === 1);
  assert.equal(result.openElsewhere[0].id, "saved-1");
  assert.ok(result.restSaved.length === 1);
  assert.equal(result.restSaved[0].id, "saved-2");
});
