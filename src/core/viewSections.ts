export interface SectionVisibility {
  current: boolean;
  recent: boolean;
  pinned: boolean;
  projects: boolean;
  groups: boolean;
}

export const DEFAULT_SECTION_VISIBILITY: SectionVisibility = {
  current: true,
  recent: true,
  pinned: true,
  projects: true,
  groups: true
};

type RecentCandidate = {
  pinned: boolean;
  isCurrent: boolean;
  lastOpenedAt?: number;
};

export function normalizeSectionVisibility(value: unknown): SectionVisibility {
  if (!value || typeof value !== "object") {
    return { ...DEFAULT_SECTION_VISIBILITY };
  }

  const input = value as Partial<Record<keyof SectionVisibility, unknown>>;

  return {
    current: typeof input.current === "boolean" ? input.current : DEFAULT_SECTION_VISIBILITY.current,
    recent: typeof input.recent === "boolean" ? input.recent : DEFAULT_SECTION_VISIBILITY.recent,
    pinned: typeof input.pinned === "boolean" ? input.pinned : DEFAULT_SECTION_VISIBILITY.pinned,
    projects: typeof input.projects === "boolean" ? input.projects : DEFAULT_SECTION_VISIBILITY.projects,
    groups: typeof input.groups === "boolean" ? input.groups : DEFAULT_SECTION_VISIBILITY.groups
  };
}

export function selectRecentProjects<T extends RecentCandidate>(projects: T[], limit: number): T[] {
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
