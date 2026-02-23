"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const projectStore_1 = require("../src/core/projectStore");
function createMemoryAdapter(initial) {
    let state = initial;
    return {
        read: () => state,
        write: (next) => {
            state = next;
        }
    };
}
function createStore(nowValues) {
    let cursor = 0;
    const now = () => {
        const value = nowValues[cursor] ?? nowValues[nowValues.length - 1];
        cursor += 1;
        return value;
    };
    let idSequence = 0;
    const idFactory = () => `id-${++idSequence}`;
    return new projectStore_1.ProjectStore(createMemoryAdapter(), now, idFactory);
}
(0, node_test_1.default)("saveProject updates existing project with same uri", () => {
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
    strict_1.default.equal(second.id, first.id);
    strict_1.default.equal(store.getAllProjects().length, 1);
    strict_1.default.equal(store.getAllProjects()[0].name, "Core API Renamed");
});
(0, node_test_1.default)("renameProject changes name and updatedAt", () => {
    const store = createStore([10, 20, 30]);
    const project = store.saveProject({
        name: "Old Name",
        kind: "workspace",
        uri: "file:///tmp/app.code-workspace"
    });
    const updated = store.renameProject(project.id, "New Name");
    strict_1.default.ok(updated);
    strict_1.default.equal(updated?.name, "New Name");
    strict_1.default.equal(updated?.updatedAt, 20);
});
(0, node_test_1.default)("togglePin flips pinned state", () => {
    const store = createStore([1, 2, 3]);
    const project = store.saveProject({
        name: "Pinned Candidate",
        kind: "folder",
        uri: "file:///tmp/pinned"
    });
    const firstToggle = store.togglePin(project.id);
    const secondToggle = store.togglePin(project.id);
    strict_1.default.equal(firstToggle?.pinned, true);
    strict_1.default.equal(secondToggle?.pinned, false);
});
(0, node_test_1.default)("removeProject deletes project", () => {
    const store = createStore([1, 2]);
    const project = store.saveProject({
        name: "Delete Me",
        kind: "folder",
        uri: "file:///tmp/delete-me"
    });
    const deleted = store.removeProject(project.id);
    strict_1.default.equal(deleted, true);
    strict_1.default.equal(store.getAllProjects().length, 0);
});
(0, node_test_1.default)("getAllProjects returns pinned first then by recent open", () => {
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
    const orderedNames = store.getAllProjects().map((item) => item.name);
    strict_1.default.deepEqual(orderedNames, ["Gamma", "Beta", "Alpha"]);
});
(0, node_test_1.default)("setBadgeColor stores and clears snapshot color", () => {
    const store = createStore([10, 20, 30]);
    const project = store.saveProject({
        name: "Accent",
        kind: "folder",
        uri: "file:///tmp/accent"
    });
    const updated = store.setBadgeColor(project.id, "#A5C322");
    strict_1.default.equal(updated?.badgeColor, "#a5c322");
    const cleared = store.setBadgeColor(project.id, undefined);
    strict_1.default.equal(cleared?.badgeColor, undefined);
});
(0, node_test_1.default)("setBadgeColorByUri updates project without touching updatedAt", () => {
    const store = createStore([5, 15, 25]);
    const project = store.saveProject({
        name: "Workspace",
        kind: "workspace",
        uri: "file:///tmp/workspace.code-workspace"
    });
    const updated = store.setBadgeColorByUri(project.uri, "#bfdd3b");
    strict_1.default.equal(updated?.badgeColor, "#bfdd3b");
    strict_1.default.equal(updated?.updatedAt, 5);
    const loaded = store.getProject(project.id);
    strict_1.default.equal(loaded?.badgeColor, "#bfdd3b");
    strict_1.default.equal(loaded?.updatedAt, 5);
});
(0, node_test_1.default)("migrates legacy v1 state and initializes groups", () => {
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
    };
    const store = new projectStore_1.ProjectStore(createMemoryAdapter(legacyState), () => 2, () => "id-1");
    strict_1.default.equal(store.getAllProjects().length, 1);
    strict_1.default.deepEqual(store.getAllGroups(), []);
});
(0, node_test_1.default)("saveGroup adds a group", () => {
    const store = createStore([1, 2]);
    const group = store.saveGroup({
        name: "job",
        rootUri: "file:///tmp/job"
    });
    strict_1.default.equal(group.name, "job");
    strict_1.default.equal(group.collapsed, false);
    const groups = store.getAllGroups();
    strict_1.default.equal(groups.length, 1);
    strict_1.default.equal(groups[0].rootUri, "file:///tmp/job");
    strict_1.default.equal(groups[0].collapsed, false);
});
(0, node_test_1.default)("saveGroup updates existing group by root uri", () => {
    const store = createStore([1, 2, 3]);
    const first = store.saveGroup({
        name: "job",
        rootUri: "file:///tmp/job"
    });
    const second = store.saveGroup({
        name: "work",
        rootUri: "file:///tmp/job"
    });
    strict_1.default.equal(second.id, first.id);
    strict_1.default.equal(second.name, "work");
    strict_1.default.equal(store.getAllGroups().length, 1);
});
(0, node_test_1.default)("removeGroup deletes group", () => {
    const store = createStore([1, 2]);
    const group = store.saveGroup({
        name: "job",
        rootUri: "file:///tmp/job"
    });
    const deleted = store.removeGroup(group.id);
    strict_1.default.equal(deleted, true);
    strict_1.default.equal(store.getAllGroups().length, 0);
});
(0, node_test_1.default)("toggleGroupCollapsed flips collapsed state", () => {
    const store = createStore([1, 2, 3]);
    const group = store.saveGroup({
        name: "job",
        rootUri: "file:///tmp/job"
    });
    const collapsed = store.toggleGroupCollapsed(group.id);
    const expanded = store.toggleGroupCollapsed(group.id);
    strict_1.default.equal(collapsed?.collapsed, true);
    strict_1.default.equal(expanded?.collapsed, false);
});
