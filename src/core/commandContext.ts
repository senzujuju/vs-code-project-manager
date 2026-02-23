export function resolveProjectGroupId(value: unknown): string | undefined {
  if (!value || typeof value !== "object") {
    return undefined;
  }

  const groupId = (value as Record<string, unknown>).groupId;
  return typeof groupId === "string" ? groupId : undefined;
}
