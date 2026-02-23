"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = __importDefault(require("node:test"));
const strict_1 = __importDefault(require("node:assert/strict"));
const viewSections_1 = require("../src/core/viewSections");
(0, node_test_1.default)("normalizeSectionVisibility returns defaults for invalid input", () => {
    strict_1.default.deepEqual((0, viewSections_1.normalizeSectionVisibility)(undefined), viewSections_1.DEFAULT_SECTION_VISIBILITY);
    strict_1.default.deepEqual((0, viewSections_1.normalizeSectionVisibility)(null), viewSections_1.DEFAULT_SECTION_VISIBILITY);
    strict_1.default.deepEqual((0, viewSections_1.normalizeSectionVisibility)("invalid"), viewSections_1.DEFAULT_SECTION_VISIBILITY);
});
(0, node_test_1.default)("normalizeSectionVisibility merges known flags", () => {
    const result = (0, viewSections_1.normalizeSectionVisibility)({
        current: false,
        recent: false,
        groups: false,
        unknownFlag: true
    });
    strict_1.default.deepEqual(result, {
        current: false,
        recent: false,
        pinned: true,
        projects: true,
        groups: false
    });
});
(0, node_test_1.default)("normalizeSectionCollapseState returns defaults for invalid input", () => {
    strict_1.default.deepEqual((0, viewSections_1.normalizeSectionCollapseState)(undefined), viewSections_1.DEFAULT_SECTION_COLLAPSE_STATE);
    strict_1.default.deepEqual((0, viewSections_1.normalizeSectionCollapseState)(null), viewSections_1.DEFAULT_SECTION_COLLAPSE_STATE);
    strict_1.default.deepEqual((0, viewSections_1.normalizeSectionCollapseState)("invalid"), viewSections_1.DEFAULT_SECTION_COLLAPSE_STATE);
});
(0, node_test_1.default)("normalizeSectionCollapseState merges known flags", () => {
    const result = (0, viewSections_1.normalizeSectionCollapseState)({
        current: true,
        recent: true,
        unknownFlag: true
    });
    strict_1.default.deepEqual(result, {
        current: true,
        recent: true,
        pinned: false,
        projects: false
    });
});
(0, node_test_1.default)("selectRecentProjects returns latest five non-pinned non-current projects", () => {
    const projects = [
        { id: "p1", pinned: false, isCurrent: false, lastOpenedAt: 10 },
        { id: "p2", pinned: false, isCurrent: true, lastOpenedAt: 90 },
        { id: "p3", pinned: true, isCurrent: false, lastOpenedAt: 80 },
        { id: "p4", pinned: false, isCurrent: false, lastOpenedAt: 40 },
        { id: "p5", pinned: false, isCurrent: false, lastOpenedAt: 50 },
        { id: "p6", pinned: false, isCurrent: false, lastOpenedAt: 20 },
        { id: "p7", pinned: false, isCurrent: false, lastOpenedAt: 70 },
        { id: "p8", pinned: false, isCurrent: false, lastOpenedAt: 60 },
        { id: "p9", pinned: false, isCurrent: false },
        { id: "p10", pinned: false, isCurrent: false, lastOpenedAt: 30 }
    ];
    const recentIds = (0, viewSections_1.selectRecentProjects)(projects, 5).map((project) => project.id);
    strict_1.default.deepEqual(recentIds, ["p7", "p8", "p5", "p4", "p10"]);
});
