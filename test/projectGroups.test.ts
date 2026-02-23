import test from "node:test";
import assert from "node:assert/strict";
import { ProjectGroup, StoredProject } from "../src/core/projectStore";
import { resolveProjectGroupSections } from "../src/core/projectGroups";

test("resolveProjectGroupSections maps groups to direct child folder projects", () => {
  const groups: ProjectGroup[] = [
    {
      id: "g-1",
      name: "job",
      rootUri: "file:///tmp/job",
      collapsed: false,
      createdAt: 1,
      updatedAt: 1
    }
  ];

  const sections = resolveProjectGroupSections({
    manualProjects: [],
    groups,
    listGroupChildren: () => [
      { name: "api", uri: "file:///tmp/job/api" },
      { name: "web", uri: "file:///tmp/job/web" }
    ]
  });

  assert.equal(sections.length, 1);
  assert.equal(sections[0].title, "job");
  assert.deepEqual(
    sections[0].projects.map((project) => project.name),
    ["api", "web"]
  );
});

test("resolveProjectGroupSections removes duplicates already saved as manual projects", () => {
  const groups: ProjectGroup[] = [
    {
      id: "g-1",
      name: "job",
      rootUri: "file:///tmp/job",
      collapsed: false,
      createdAt: 1,
      updatedAt: 1
    }
  ];

  const manualProjects: StoredProject[] = [
    {
      id: "p-1",
      name: "api-manual",
      kind: "folder",
      uri: "file:///tmp/job/api",
      pinned: false,
      createdAt: 1,
      updatedAt: 1
    }
  ];

  const sections = resolveProjectGroupSections({
    manualProjects,
    groups,
    listGroupChildren: () => [
      { name: "api", uri: "file:///tmp/job/api" },
      { name: "web", uri: "file:///tmp/job/web" }
    ]
  });

  assert.equal(sections.length, 1);
  assert.deepEqual(
    sections[0].projects.map((project) => project.uri),
    ["file:///tmp/job/web"]
  );
});

test("resolveProjectGroupSections sorts group projects by name", () => {
  const groups: ProjectGroup[] = [
    {
      id: "g-1",
      name: "job",
      rootUri: "file:///tmp/job",
      collapsed: false,
      createdAt: 1,
      updatedAt: 1
    }
  ];

  const sections = resolveProjectGroupSections({
    manualProjects: [],
    groups,
    listGroupChildren: () => [
      { name: "web", uri: "file:///tmp/job/web" },
      { name: "api", uri: "file:///tmp/job/api" }
    ]
  });

  assert.deepEqual(
    sections[0].projects.map((project) => project.name),
    ["api", "web"]
  );
});

test("resolveProjectGroupSections does not scan child folders when group is collapsed", () => {
  const groups: ProjectGroup[] = [
    {
      id: "g-1",
      name: "job",
      rootUri: "file:///tmp/job",
      collapsed: true,
      createdAt: 1,
      updatedAt: 1
    }
  ];

  let calls = 0;
  const sections = resolveProjectGroupSections({
    manualProjects: [],
    groups,
    listGroupChildren: () => {
      calls += 1;
      return [{ name: "api", uri: "file:///tmp/job/api" }];
    }
  });

  assert.equal(calls, 0);
  assert.equal(sections.length, 1);
  assert.equal(sections[0].collapsed, true);
  assert.deepEqual(sections[0].projects, []);
});
