import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_SECTION_COLLAPSE_STATE,
  DEFAULT_SECTION_VISIBILITY,
  normalizeSectionCollapseState,
  normalizeSectionVisibility,
  selectRecentProjects
} from "../src/core/viewSections";

test("normalizeSectionVisibility returns defaults for invalid input", () => {
  assert.deepEqual(normalizeSectionVisibility(undefined), DEFAULT_SECTION_VISIBILITY);
  assert.deepEqual(normalizeSectionVisibility(null), DEFAULT_SECTION_VISIBILITY);
  assert.deepEqual(normalizeSectionVisibility("invalid"), DEFAULT_SECTION_VISIBILITY);
});

test("normalizeSectionVisibility merges known flags", () => {
  const result = normalizeSectionVisibility({
    current: false,
    recent: false,
    groups: false,
    unknownFlag: true
  });

  assert.deepEqual(result, {
    current: false,
    recent: false,
    pinned: true,
    projects: true,
    groups: false
  });
});

test("normalizeSectionCollapseState returns defaults for invalid input", () => {
  assert.deepEqual(normalizeSectionCollapseState(undefined), DEFAULT_SECTION_COLLAPSE_STATE);
  assert.deepEqual(normalizeSectionCollapseState(null), DEFAULT_SECTION_COLLAPSE_STATE);
  assert.deepEqual(normalizeSectionCollapseState("invalid"), DEFAULT_SECTION_COLLAPSE_STATE);
});

test("normalizeSectionCollapseState merges known flags", () => {
  const result = normalizeSectionCollapseState({
    current: true,
    recent: true,
    unknownFlag: true
  });

  assert.deepEqual(result, {
    current: true,
    recent: true,
    pinned: false,
    projects: false
  });
});

test("selectRecentProjects returns latest five non-pinned non-current projects", () => {
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

  const recentIds = selectRecentProjects(projects, 5).map((project) => project.id);
  assert.deepEqual(recentIds, ["p7", "p8", "p5", "p4", "p10"]);
});
