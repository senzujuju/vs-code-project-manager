"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resolveProjectGroupSections = resolveProjectGroupSections;
function resolveProjectGroupSections({ manualProjects, groups, listGroupChildren }) {
    const manualUris = new Set(manualProjects.map((project) => project.uri));
    return groups.map((group) => {
        const rawChildren = safeListChildren(listGroupChildren, group);
        const uniqueUris = new Set();
        const projects = rawChildren
            .filter((child) => {
            const name = child.name.trim();
            const uri = child.uri.trim();
            if (name.length === 0 || uri.length === 0) {
                return false;
            }
            if (manualUris.has(uri) || uniqueUris.has(uri)) {
                return false;
            }
            uniqueUris.add(uri);
            return true;
        })
            .sort((left, right) => left.name.localeCompare(right.name))
            .map((child) => {
            const uri = child.uri.trim();
            return {
                id: createVirtualGroupProjectId(group.id, uri),
                name: child.name.trim(),
                kind: "folder",
                uri,
                sourceGroupId: group.id,
                sourceGroupName: group.name
            };
        });
        return {
            id: group.id,
            title: group.name,
            rootUri: group.rootUri,
            collapsed: group.collapsed,
            projects
        };
    });
}
function safeListChildren(listGroupChildren, group) {
    try {
        const children = listGroupChildren(group);
        return Array.isArray(children) ? children : [];
    }
    catch {
        return [];
    }
}
function createVirtualGroupProjectId(groupId, uri) {
    const encodedUri = Buffer.from(uri).toString("base64url");
    return `group:${groupId}:${encodedUri}`;
}
