export function getInitials(name: string): string {
  const tokens = name
    .trim()
    .split(/[\s_-]+/)
    .filter((token) => token.length > 0);

  if (tokens.length === 0) {
    return "PR";
  }

  if (tokens.length === 1) {
    return tokens[0].slice(0, 2).toUpperCase();
  }

  return `${tokens[0][0]}${tokens[1][0]}`.toUpperCase();
}
