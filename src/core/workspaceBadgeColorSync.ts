export interface ResolveWorkspaceBadgeColorInput {
  peacockColor: unknown;
  colorCustomizations: unknown;
}

export function resolveWorkspaceBadgeColor({
  peacockColor,
  colorCustomizations
}: ResolveWorkspaceBadgeColorInput): string | undefined {
  const normalizedPeacockColor = normalizeBadgeColor(peacockColor);
  if (normalizedPeacockColor) {
    return normalizedPeacockColor;
  }

  if (!colorCustomizations || typeof colorCustomizations !== "object") {
    return undefined;
  }

  const activityBarColor = (colorCustomizations as Record<string, unknown>)["activityBar.activeBackground"];
  return normalizeBadgeColor(activityBarColor);
}

export function normalizeBadgeColor(value: unknown): string | undefined {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim();

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
