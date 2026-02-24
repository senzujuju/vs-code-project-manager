export function extractRepoNameFromUrl(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) {
    return "repository";
  }

  let path = trimmed;

  if (path.endsWith("/")) {
    path = path.slice(0, -1);
  }

  if (path.endsWith(".git")) {
    path = path.slice(0, -4);
  }

  const lastSlash = Math.max(path.lastIndexOf("/"), path.lastIndexOf(":"));
  if (lastSlash === -1) {
    return "repository";
  }

  const name = path.slice(lastSlash + 1);
  return name || "repository";
}

export function convertSshScpToUri(url: string): string {
  const match = url.match(/^git@([^:]+):(.+)$/);
  if (!match) {
    return url;
  }
  const [, host, path] = match;
  return `ssh://git@${host}/${path}`;
}
