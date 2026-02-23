"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const projectGroups_1 = require("../src/core/projectGroups");
(0, node_test_1.default)("resolveProjectGroupSections maps groups to direct child folder projects", () => {
    const groups = [
        {
            id: "g-1",
            name: "job",
            rootUri: "file:///tmp/job",
            collapsed: false,
            createdAt: 1,
            updatedAt: 1
        }
    ];
    const sections = (0, projectGroups_1.resolveProjectGroupSections)({
        manualProjects: [],
        groups,
        listGroupChildren: () => [
            { name: "api", uri: "file:///tmp/job/api" },
            { name: "web", uri: "file:///tmp/job/web" }
        ]
    });
    strict_1.default.equal(sections.length, 1);
    strict_1.default.equal(sections[0].title, "job");
    strict_1.default.deepEqual(sections[0].projects.map((project) => project.name), ["api", "web"]);
});
(0, node_test_1.default)("resolveProjectGroupSections removes duplicates already saved as manual projects", () => {
    const groups = [
        {
            id: "g-1",
            name: "job",
            rootUri: "file:///tmp/job",
            collapsed: false,
            createdAt: 1,
            updatedAt: 1
        }
    ];
    const manualProjects = [
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
    const sections = (0, projectGroups_1.resolveProjectGroupSections)({
        manualProjects,
        groups,
        listGroupChildren: () => [
            { name: "api", uri: "file:///tmp/job/api" },
            { name: "web", uri: "file:///tmp/job/web" }
        ]
    });
    strict_1.default.equal(sections.length, 1);
    strict_1.default.deepEqual(sections[0].projects.map((project) => project.uri), ["file:///tmp/job/web"]);
});
(0, node_test_1.default)("resolveProjectGroupSections sorts group projects by name", () => {
    const groups = [
        {
            id: "g-1",
            name: "job",
            rootUri: "file:///tmp/job",
            collapsed: false,
            createdAt: 1,
            updatedAt: 1
        }
    ];
    const sections = (0, projectGroups_1.resolveProjectGroupSections)({
        manualProjects: [],
        groups,
        listGroupChildren: () => [
            { name: "web", uri: "file:///tmp/job/web" },
            { name: "api", uri: "file:///tmp/job/api" }
        ]
    });
    strict_1.default.deepEqual(sections[0].projects.map((project) => project.name), ["api", "web"]);
});
(0, node_test_1.default)("resolveProjectGroupSections does not scan child folders when group is collapsed", () => {
    const groups = [
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
    const sections = (0, projectGroups_1.resolveProjectGroupSections)({
        manualProjects: [],
        groups,
        listGroupChildren: () => {
            calls += 1;
            return [{ name: "api", uri: "file:///tmp/job/api" }];
        }
    });
    strict_1.default.equal(calls, 0);
    strict_1.default.equal(sections.length, 1);
    strict_1.default.equal(sections[0].collapsed, true);
    strict_1.default.deepEqual(sections[0].projects, []);
});
