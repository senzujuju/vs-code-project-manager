export type ProjectKind = "folder" | "workspace";

export interface StoredProject {
  id: string;
  name: string;
  kind: ProjectKind;
  uri: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  badgeColor?: string;
}

export interface ProjectGroup {
  id: string;
  name: string;
  rootUri: string;
  collapsed: boolean;
  createdAt: number;
  updatedAt: number;
}

interface LegacyStoreState {
  version: 1;
  projects: StoredProject[];
}

export interface StoreState {
  version: 2;
  projects: StoredProject[];
  groups: ProjectGroup[];
}

type PersistedStoreState = StoreState | LegacyStoreState;

export interface ProjectStorageAdapter {
  read(): PersistedStoreState | undefined;
  write(next: StoreState): void;
}

export interface SaveProjectInput {
  name: string;
  kind: ProjectKind;
  uri: string;
}

export interface SaveProjectGroupInput {
  name: string;
  rootUri: string;
}

function createFallbackId(): string {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function cloneProject(project: StoredProject): StoredProject {
  return { ...project };
}

function cloneGroup(group: ProjectGroup): ProjectGroup {
  return { ...group };
}

function sanitizeName(name: string): string {
  const trimmed = name.trim();
  if (trimmed.length > 0) {
    return trimmed;
  }

  return "Unnamed Project";
}

function sanitizeUri(uri: string): string {
  const trimmed = uri.trim();
  if (trimmed.length === 0) {
    throw new Error("Project URI must not be empty");
  }

  return trimmed;
}

function sanitizeRootUri(uri: string): string {
  const trimmed = uri.trim();
  if (trimmed.length === 0) {
    throw new Error("Project group root URI must not be empty");
  }

  return trimmed;
}

function sanitizeBadgeColor(color: unknown): string | undefined {
  if (typeof color !== "string") {
    return undefined;
  }

  const normalized = color.trim();
  if (/^#[0-9a-fA-F]{3}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{4}$/.test(normalized)) {
    return `#${normalized[1]}${normalized[1]}${normalized[2]}${normalized[2]}${normalized[3]}${normalized[3]}`.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{6}$/.test(normalized)) {
    return normalized.toLowerCase();
  }

  if (/^#[0-9a-fA-F]{8}$/.test(normalized)) {
    return normalized.slice(0, 7).toLowerCase();
  }

  return undefined;
}

function sanitizeProjects(projects: unknown): StoredProject[] {
  if (!Array.isArray(projects)) {
    return [];
  }

  return projects
    .filter((project): project is StoredProject => {
      return Boolean(
        project &&
          typeof project.id === "string" &&
          typeof project.name === "string" &&
          (project.kind === "folder" || project.kind === "workspace") &&
          typeof project.uri === "string" &&
          typeof project.createdAt === "number" &&
          typeof project.updatedAt === "number"
      );
    })
    .map((project) => ({
      ...project,
      pinned: Boolean(project.pinned),
      lastOpenedAt: typeof project.lastOpenedAt === "number" ? project.lastOpenedAt : undefined,
      badgeColor: sanitizeBadgeColor(project.badgeColor)
    }));
}

function sanitizeGroups(groups: unknown): ProjectGroup[] {
  if (!Array.isArray(groups)) {
    return [];
  }

  return groups
    .filter((group): group is ProjectGroup => {
      return Boolean(
        group &&
          typeof group.id === "string" &&
          typeof group.name === "string" &&
          typeof group.rootUri === "string" &&
          group.rootUri.trim().length > 0 &&
          typeof group.createdAt === "number" &&
          typeof group.updatedAt === "number"
      );
    })
    .map((group) => ({
      ...group,
      name: sanitizeName(group.name),
      rootUri: sanitizeRootUri(group.rootUri),
      collapsed: Boolean(group.collapsed)
    }));
}

function sanitizeState(input: PersistedStoreState | undefined): StoreState {
  if (!input || typeof input !== "object") {
    return {
      version: 2,
      projects: [],
      groups: []
    };
  }

  if (input.version === 1) {
    return {
      version: 2,
      projects: sanitizeProjects(input.projects),
      groups: []
    };
  }

  if (input.version !== 2) {
    return {
      version: 2,
      projects: [],
      groups: []
    };
  }

  return {
    version: 2,
    projects: sanitizeProjects(input.projects),
    groups: sanitizeGroups(input.groups)
  };
}

export class ProjectStore {
  private readonly now: () => number;
  private readonly createId: () => string;
  private state: StoreState;
  private readonly listeners = new Set<() => void>();

  constructor(
    private readonly storage: ProjectStorageAdapter,
    now: () => number = () => Date.now(),
    createId: () => string = createFallbackId
  ) {
    this.now = now;
    this.createId = createId;
    this.state = sanitizeState(this.storage.read());
  }

  getAllProjects(): StoredProject[] {
    return this.state.projects
      .slice()
      .sort((left, right) => {
        if (left.pinned !== right.pinned) {
          return left.pinned ? -1 : 1;
        }

        const leftOpened = left.lastOpenedAt ?? Number.MIN_SAFE_INTEGER;
        const rightOpened = right.lastOpenedAt ?? Number.MIN_SAFE_INTEGER;
        if (leftOpened !== rightOpened) {
          return rightOpened - leftOpened;
        }

        if (left.updatedAt !== right.updatedAt) {
          return right.updatedAt - left.updatedAt;
        }

        return left.name.localeCompare(right.name);
      })
      .map(cloneProject);
  }

  getAllGroups(): ProjectGroup[] {
    return this.state.groups
      .slice()
      .sort((left, right) => {
        if (left.updatedAt !== right.updatedAt) {
          return right.updatedAt - left.updatedAt;
        }

        return left.name.localeCompare(right.name);
      })
      .map(cloneGroup);
  }

  onDidChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  saveProject(input: SaveProjectInput): StoredProject {
    const name = sanitizeName(input.name);
    const uri = sanitizeUri(input.uri);
    const timestamp = this.now();

    const existing = this.state.projects.find((project) => project.uri === uri);
    if (existing) {
      existing.name = name;
      existing.kind = input.kind;
      existing.updatedAt = timestamp;
      this.persist();
      return cloneProject(existing);
    }

    const created: StoredProject = {
      id: this.createId(),
      name,
      kind: input.kind,
      uri,
      pinned: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.state.projects.push(created);
    this.persist();
    return cloneProject(created);
  }

  saveGroup(input: SaveProjectGroupInput): ProjectGroup {
    const name = sanitizeName(input.name);
    const rootUri = sanitizeRootUri(input.rootUri);
    const timestamp = this.now();

    const existing = this.state.groups.find((group) => group.rootUri === rootUri);
    if (existing) {
      existing.name = name;
      existing.updatedAt = timestamp;
      this.persist();
      return cloneGroup(existing);
    }

    const created: ProjectGroup = {
      id: this.createId(),
      name,
      rootUri,
      collapsed: false,
      createdAt: timestamp,
      updatedAt: timestamp
    };

    this.state.groups.push(created);
    this.persist();
    return cloneGroup(created);
  }

  getProject(projectId: string): StoredProject | undefined {
    const project = this.state.projects.find((item) => item.id === projectId);
    return project ? cloneProject(project) : undefined;
  }

  getProjectByUri(uri: string): StoredProject | undefined {
    const normalizedUri = uri.trim();
    if (normalizedUri.length === 0) {
      return undefined;
    }

    const project = this.state.projects.find((item) => item.uri === normalizedUri);
    return project ? cloneProject(project) : undefined;
  }

  renameProject(projectId: string, nextName: string): StoredProject | undefined {
    const project = this.state.projects.find((item) => item.id === projectId);
    if (!project) {
      return undefined;
    }

    project.name = sanitizeName(nextName);
    project.updatedAt = this.now();
    this.persist();
    return cloneProject(project);
  }

  removeProject(projectId: string): boolean {
    const before = this.state.projects.length;
    this.state.projects = this.state.projects.filter((item) => item.id !== projectId);

    if (this.state.projects.length === before) {
      return false;
    }

    this.persist();
    return true;
  }

  removeGroup(groupId: string): boolean {
    const before = this.state.groups.length;
    this.state.groups = this.state.groups.filter((item) => item.id !== groupId);

    if (this.state.groups.length === before) {
      return false;
    }

    this.persist();
    return true;
  }

  toggleGroupCollapsed(groupId: string): ProjectGroup | undefined {
    const group = this.state.groups.find((item) => item.id === groupId);
    if (!group) {
      return undefined;
    }

    group.collapsed = !group.collapsed;
    this.persist();
    return cloneGroup(group);
  }

  togglePin(projectId: string): StoredProject | undefined {
    const project = this.state.projects.find((item) => item.id === projectId);
    if (!project) {
      return undefined;
    }

    project.pinned = !project.pinned;
    project.updatedAt = this.now();
    this.persist();
    return cloneProject(project);
  }

  markOpened(projectId: string): StoredProject | undefined {
    const project = this.state.projects.find((item) => item.id === projectId);
    if (!project) {
      return undefined;
    }

    const timestamp = this.now();
    project.lastOpenedAt = timestamp;
    project.updatedAt = timestamp;
    this.persist();
    return cloneProject(project);
  }

  setBadgeColor(projectId: string, badgeColor: string | undefined): StoredProject | undefined {
    const project = this.state.projects.find((item) => item.id === projectId);
    if (!project) {
      return undefined;
    }

    const normalized = sanitizeBadgeColor(badgeColor);
    if (project.badgeColor === normalized) {
      return cloneProject(project);
    }

    project.badgeColor = normalized;
    this.persist();
    return cloneProject(project);
  }

  setBadgeColorByUri(uri: string, badgeColor: string | undefined): StoredProject | undefined {
    const normalizedUri = uri.trim();
    if (normalizedUri.length === 0) {
      return undefined;
    }

    const project = this.state.projects.find((item) => item.uri === normalizedUri);
    if (!project) {
      return undefined;
    }

    return this.setBadgeColor(project.id, badgeColor);
  }

  private persist(): void {
    this.storage.write({
      version: 2,
      projects: this.state.projects.map(cloneProject),
      groups: this.state.groups.map(cloneGroup)
    });

    for (const listener of this.listeners) {
      listener();
    }
  }
}
