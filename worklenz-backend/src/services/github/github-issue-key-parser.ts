export interface IParsedIssueKey {
  /** Upper-cased project key, e.g. "PROJ". */
  projectKey: string;
  taskNo: number;
  /** True when preceded by a closing keyword (closes/fixes/resolves). */
  closes: boolean;
}

// Candidate: letters/digits prefix, dash, number. Delimited by non-alphanumerics so branch
// names like `feature/PROJ-104-login` and `PROJ-104_fix` match, but `XPROJ-1` does not.
const KEY_CANDIDATE = /(?<![A-Za-z0-9])([A-Za-z][A-Za-z0-9]*)-(\d+)(?![A-Za-z0-9])/g;
const CLOSING_KEYWORD = /(?:close[sd]?|fix(?:e[sd])?|resolve[sd]?)\s*:?\s*$/i;
const ONLY_SEPARATORS = /^\s*(?:,|&|and)?\s*$/i;

/**
 * Extract issue keys from free text (commit message, PR title/body, branch name).
 * Only prefixes present in `knownKeys` are returned, so text like "UTF-8" or "CVE-2024"
 * is ignored unless a linked project actually uses that key.
 */
export function parseIssueKeys(text: string | null | undefined, knownKeys: Iterable<string>): IParsedIssueKey[] {
  if (!text) return [];

  const known = new Set<string>();
  for (const key of knownKeys) known.add(key.toUpperCase());
  if (!known.size) return [];

  const results = new Map<string, IParsedIssueKey>();
  let previousEnd = 0;
  let previousCloses = false;

  KEY_CANDIDATE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = KEY_CANDIDATE.exec(text)) !== null) {
    const projectKey = match[1].toUpperCase();
    const taskNo = parseInt(match[2], 10);
    const start = match.index;
    const between = text.slice(previousEnd, start);

    // "Fixes A-1 and A-2" -> both close; otherwise inspect the text just before the key.
    const closes: boolean = results.size > 0 && ONLY_SEPARATORS.test(between)
      ? previousCloses
      : CLOSING_KEYWORD.test(between);

    previousEnd = start + match[0].length;
    previousCloses = closes;

    if (!known.has(projectKey) || !Number.isSafeInteger(taskNo) || taskNo <= 0) continue;

    const id = `${projectKey}-${taskNo}`;
    const existing = results.get(id);
    if (existing) {
      existing.closes = existing.closes || closes;
    } else {
      results.set(id, { projectKey, taskNo, closes });
    }
  }

  return [...results.values()];
}
