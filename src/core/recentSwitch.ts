export interface ProjectIdsToMarkOpenedInput {
  targetProjectId: string;
  currentProjectId?: string;
  openInNewWindow: boolean;
}

export function getProjectIdsToMarkOpened({
  targetProjectId,
  currentProjectId,
  openInNewWindow
}: ProjectIdsToMarkOpenedInput): string[] {
  const ids: string[] = [];

  if (!openInNewWindow && currentProjectId && currentProjectId !== targetProjectId) {
    ids.push(currentProjectId);
  }

  ids.push(targetProjectId);
  return ids;
}
