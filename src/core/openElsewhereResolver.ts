export interface ResolvedOpenElsewhereProject {
  id: string;
  uri: string;
  isVirtual: boolean;
}

export interface SavedProjectCandidate {
  id: string;
  uri: string;
  pinned: boolean;
  lastOpenedAt?: number;
}

export interface GroupProjectCandidate {
  id: string;
  uri: string;
}

export interface GroupSectionCandidate {
  id: string;
  title: string;
  projects: GroupProjectCandidate[];
}

export interface ResolveOpenElsewhereStateInput {
  savedProjects: SavedProjectCandidate[];
  groupSections: GroupSectionCandidate[];
  openElsewhereUris: Set<string>;
  currentUri: string | undefined;
}

export interface ResolveOpenElsewhereStateOutput {
  openElsewhere: ResolvedOpenElsewhereProject[];
  restSaved: SavedProjectCandidate[];
  restGroups: GroupSectionCandidate[];
}

export function resolveOpenElsewhereState(
  input: ResolveOpenElsewhereStateInput
): ResolveOpenElsewhereStateOutput {
  const { savedProjects, groupSections, openElsewhereUris, currentUri } = input;

  const openElsewhere: ResolvedOpenElsewhereProject[] = [];
  const openElsewhereUrisById = new Map<string, string>();

  for (const project of savedProjects) {
    if (project.uri === currentUri) {
      continue;
    }

    if (!openElsewhereUris.has(project.uri)) {
      continue;
    }

    openElsewhere.push({
      id: project.id,
      uri: project.uri,
      isVirtual: false
    });
    openElsewhereUrisById.set(project.id, project.uri);
  }

  const savedUris = new Set(savedProjects.map((p) => p.uri));
  const openElsewhereUriSet = new Set(openElsewhere.map((p) => p.uri));

  for (const section of groupSections) {
    for (const project of section.projects) {
      if (project.uri === currentUri) {
        continue;
      }

      if (!openElsewhereUris.has(project.uri)) {
        continue;
      }

      if (savedUris.has(project.uri)) {
        continue;
      }

      if (openElsewhereUriSet.has(project.uri)) {
        continue;
      }

      openElsewhere.push({
        id: project.id,
        uri: project.uri,
        isVirtual: true
      });
      openElsewhereUriSet.add(project.uri);
      openElsewhereUrisById.set(project.id, project.uri);
    }
  }

  const openElsewhereIds = new Set(openElsewhere.map((p) => p.id));
  const restSaved = savedProjects.filter(
    (project) => project.uri !== currentUri && !openElsewhereIds.has(project.id)
  );

  const restGroups = groupSections.map((section) => ({
    id: section.id,
    title: section.title,
    projects: section.projects.filter((project) => {
      if (project.uri === currentUri) {
        return false;
      }
      return !openElsewhereUriSet.has(project.uri);
    })
  }));

  return {
    openElsewhere,
    restSaved,
    restGroups
  };
}
