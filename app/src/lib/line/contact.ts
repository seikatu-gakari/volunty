export interface LineContactInput {
  url: string | null;
  id: string | null;
}

export interface LineFriendContact {
  addUrl: string | null;
  displayId: string | null;
}

const ALLOWED_HOSTS = new Set(["line.me", "lin.ee"]);
const BASIC_ID_PATTERN = /^@?[A-Za-z0-9._-]+$/;

function normalizeFriendAddUrl(url: string | null): string | null {
  if (!url) return null;

  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "https:") return null;
    if (!ALLOWED_HOSTS.has(parsed.hostname)) return null;

    return trimmed;
  } catch {
    return null;
  }
}

function buildUrlFromId(id: string | null): string | null {
  if (!id) return null;

  const trimmed = id.trim();
  if (!trimmed || !BASIC_ID_PATTERN.test(trimmed)) return null;

  const withAt = trimmed.startsWith("@") ? trimmed : `@${trimmed}`;
  return `https://line.me/R/ti/p/${withAt}`;
}

export function buildLineFriendContact(
  input: LineContactInput,
): LineFriendContact {
  const addUrl = normalizeFriendAddUrl(input.url) ?? buildUrlFromId(input.id);
  const trimmedId = input.id?.trim();
  const displayId = trimmedId ? trimmedId : null;

  return { addUrl, displayId };
}
