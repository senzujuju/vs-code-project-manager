"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectSwitchService = void 0;
const vscode = __importStar(require("vscode"));
const recentSwitch_1 = require("./recentSwitch");
class ProjectSwitchService {
    store;
    constructor(store) {
        this.store = store;
    }
    async openProject(project, forceNewWindow) {
        let targetUri;
        try {
            targetUri = vscode.Uri.parse(project.uri);
        }
        catch {
            await vscode.window.showErrorMessage(`Invalid project URI: ${project.uri}`);
            return;
        }
        const openInNewWindow = forceNewWindow ??
            vscode.workspace.getConfiguration("projectSwitcher").get("openInNewWindow", false);
        const currentProjectId = openInNewWindow ? undefined : this.getCurrentProjectId();
        const markOpenedIds = (0, recentSwitch_1.getProjectIdsToMarkOpened)({
            targetProjectId: project.id,
            currentProjectId,
            openInNewWindow
        });
        for (const projectId of markOpenedIds) {
            this.store.markOpened(projectId);
        }
        await vscode.commands.executeCommand("vscode.openFolder", targetUri, {
            forceNewWindow: openInNewWindow
        });
    }
    getCurrentProjectId() {
        const currentUri = getCurrentWorkspaceUri();
        if (!currentUri) {
            return undefined;
        }
        const project = this.store.getProjectByUri(currentUri);
        return project?.id;
    }
}
exports.ProjectSwitchService = ProjectSwitchService;
function getCurrentWorkspaceUri() {
    if (vscode.workspace.workspaceFile) {
        return vscode.workspace.workspaceFile.toString();
    }
    const folders = vscode.workspace.workspaceFolders;
    if (!folders || folders.length !== 1) {
        return undefined;
    }
    return folders[0].uri.toString();
}
