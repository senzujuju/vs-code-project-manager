"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DEFAULT_SECTION_VISIBILITY = void 0;
exports.normalizeSectionVisibility = normalizeSectionVisibility;
exports.selectRecentProjects = selectRecentProjects;
exports.DEFAULT_SECTION_VISIBILITY = {
    current: true,
    recent: true,
    pinned: true,
    projects: true,
    groups: true
};
function normalizeSectionVisibility(value) {
    if (!value || typeof value !== "object") {
        return { ...exports.DEFAULT_SECTION_VISIBILITY };
    }
    const input = value;
    return {
        current: typeof input.current === "boolean" ? input.current : exports.DEFAULT_SECTION_VISIBILITY.current,
        recent: typeof input.recent === "boolean" ? input.recent : exports.DEFAULT_SECTION_VISIBILITY.recent,
        pinned: typeof input.pinned === "boolean" ? input.pinned : exports.DEFAULT_SECTION_VISIBILITY.pinned,
        projects: typeof input.projects === "boolean" ? input.projects : exports.DEFAULT_SECTION_VISIBILITY.projects,
        groups: typeof input.groups === "boolean" ? input.groups : exports.DEFAULT_SECTION_VISIBILITY.groups
    };
}
function selectRecentProjects(projects, limit) {
    if (!Number.isFinite(limit) || limit <= 0) {
        return [];
    }
    return projects
        .filter((project) => {
        return !project.pinned && !project.isCurrent && typeof project.lastOpenedAt === "number";
    })
        .slice()
        .sort((left, right) => {
        return (right.lastOpenedAt ?? Number.MIN_SAFE_INTEGER) - (left.lastOpenedAt ?? Number.MIN_SAFE_INTEGER);
    })
        .slice(0, limit);
}
