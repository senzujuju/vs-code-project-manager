import test from "node:test";
import assert from "node:assert/strict";
import {
  ProjectStore,
  ProjectStorageAdapter,
  StoreState,
  StoredProject
} from "../src/core/projectStore";

function createMemoryAdapter(initial?: StoreState): ProjectStorageAdapter {
  let state = initial;

  return {
    read: () => state,
    write: (next) => {
      state = next;
    }
  };
}

function createStore(nowValues: number[]): ProjectStore {
  let cursor = 0;
  const now = () => {
    const value = nowValues[cursor] ?? nowValues[nowValues.length - 1];
    cursor += 1;
    return value;
  };

  let idSequence = 0;
  const idFactory = () => `id-${++idSequence}`;

  return new ProjectStore(createMemoryAdapter(), now, idFactory);
}

test("saveProject updates existing project with same uri", () => {
  const store = createStore([1, 2, 3]);

  const first = store.saveProject({
    name: "Core API",
    kind: "folder",
    uri: "file:///tmp/core-api"
  });

  const second = store.saveProject({
    name: "Core API Renamed",
    kind: "folder",
    uri: "file:///tmp/core-api"
  });

  assert.equal(second.id, first.id);
  assert.equal(store.getAllProjects().length, 1);
  assert.equal(store.getAllProjects()[0].name, "Core API Renamed");
});

test("renameProject changes name and updatedAt", () => {
  const store = createStore([10, 20, 30]);

  const project = store.saveProject({
    name: "Old Name",
    kind: "workspace",
    uri: "file:///tmp/app.code-workspace"
  });

  const updated = store.renameProject(project.id, "New Name");

  assert.ok(updated);
  assert.equal(updated?.name, "New Name");
  assert.equal(updated?.updatedAt, 20);
});

test("togglePin flips pinned state", () => {
  const store = createStore([1, 2, 3]);

  const project = store.saveProject({
    name: "Pinned Candidate",
    kind: "folder",
    uri: "file:///tmp/pinned"
  });

  const firstToggle = store.togglePin(project.id);
  const secondToggle = store.togglePin(project.id);

  assert.equal(firstToggle?.pinned, true);
  assert.equal(secondToggle?.pinned, false);
});

test("removeProject deletes project", () => {
  const store = createStore([1, 2]);

  const project = store.saveProject({
    name: "Delete Me",
    kind: "folder",
    uri: "file:///tmp/delete-me"
  });

  const deleted = store.removeProject(project.id);

  assert.equal(deleted, true);
  assert.equal(store.getAllProjects().length, 0);
});

test("getAllProjects returns pinned first then by recent open", () => {
  const store = createStore([1, 2, 3, 4, 5, 6]);

  const alpha = store.saveProject({
    name: "Alpha",
    kind: "folder",
    uri: "file:///tmp/alpha"
  });

  const beta = store.saveProject({
    name: "Beta",
    kind: "folder",
    uri: "file:///tmp/beta"
  });

  const gamma = store.saveProject({
    name: "Gamma",
    kind: "workspace",
    uri: "file:///tmp/gamma.code-workspace"
  });

  store.markOpened(beta.id);
  store.togglePin(gamma.id);

  const orderedNames = store.getAllProjects().map((item: StoredProject) => item.name);
  assert.deepEqual(orderedNames, ["Gamma", "Beta", "Alpha"]);
});

test("setBadgeColor stores and clears snapshot color", () => {
  const store = createStore([10, 20, 30]);

  const project = store.saveProject({
    name: "Accent",
    kind: "folder",
    uri: "file:///tmp/accent"
  });

  const updated = store.setBadgeColor(project.id, "#A5C322");
  assert.equal(updated?.badgeColor, "#a5c322");

  const cleared = store.setBadgeColor(project.id, undefined);
  assert.equal(cleared?.badgeColor, undefined);
});

test("setBadgeColorByUri updates project without touching updatedAt", () => {
  const store = createStore([5, 15, 25]);

  const project = store.saveProject({
    name: "Workspace",
    kind: "workspace",
    uri: "file:///tmp/workspace.code-workspace"
  });

  const updated = store.setBadgeColorByUri(project.uri, "#bfdd3b");
  assert.equal(updated?.badgeColor, "#bfdd3b");
  assert.equal(updated?.updatedAt, 5);

  const loaded = store.getProject(project.id);
  assert.equal(loaded?.badgeColor, "#bfdd3b");
  assert.equal(loaded?.updatedAt, 5);
});

test("migrates legacy v1 state and initializes groups", () => {
  const legacyState = {
    version: 1,
    projects: [
      {
        id: "p1",
        name: "Legacy",
        kind: "folder",
        uri: "file:///tmp/legacy",
        pinned: false,
        createdAt: 1,
        updatedAt: 1
      }
    ]
  } as unknown as StoreState;

  const store = new ProjectStore(createMemoryAdapter(legacyState), () => 2, () => "id-1");

  assert.equal(store.getAllProjects().length, 1);
  assert.deepEqual(store.getAllGroups(), []);
});

test("saveGroup adds a group", () => {
  const store = createStore([1, 2]);

  const group = store.saveGroup({
    name: "job",
    rootUri: "file:///tmp/job"
  });

  assert.equal(group.name, "job");
  assert.equal(group.collapsed, false);
  const groups = store.getAllGroups();
  assert.equal(groups.length, 1);
  assert.equal(groups[0].rootUri, "file:///tmp/job");
  assert.equal(groups[0].collapsed, false);
});

test("saveGroup updates existing group by root uri", () => {
  const store = createStore([1, 2, 3]);

  const first = store.saveGroup({
    name: "job",
    rootUri: "file:///tmp/job"
  });

  const second = store.saveGroup({
    name: "work",
    rootUri: "file:///tmp/job"
  });

  assert.equal(second.id, first.id);
  assert.equal(second.name, "work");
  assert.equal(store.getAllGroups().length, 1);
});

test("removeGroup deletes group", () => {
  const store = createStore([1, 2]);

  const group = store.saveGroup({
    name: "job",
    rootUri: "file:///tmp/job"
  });

  const deleted = store.removeGroup(group.id);

  assert.equal(deleted, true);
  assert.equal(store.getAllGroups().length, 0);
});

test("toggleGroupCollapsed flips collapsed state", () => {
  const store = createStore([1, 2, 3]);

  const group = store.saveGroup({
    name: "job",
    rootUri: "file:///tmp/job"
  });

  const collapsed = store.toggleGroupCollapsed(group.id);
  const expanded = store.toggleGroupCollapsed(group.id);

  assert.equal(collapsed?.collapsed, true);
  assert.equal(expanded?.collapsed, false);
});
