export type ImportedIssueType = "bug" | "story" | "task";

const BUG_LABELS = new Set(["bug", "defect", "regression"]);
const STORY_LABELS = new Set(["enhancement", "feature", "story", "user story", "feature request"]);

/** Map GitHub labels to a Worklenz software issue type (bug wins over story). */
export function mapLabelsToIssueType(labels: string[]): ImportedIssueType {
  const normalised = labels.map(label => label.trim().toLowerCase());
  if (normalised.some(label => BUG_LABELS.has(label) || label.startsWith("bug"))) return "bug";
  if (normalised.some(label => STORY_LABELS.has(label))) return "story";
  return "task";
}

/**
 * True when the issue passes the project's label filter. An empty filter accepts everything;
 * otherwise at least one issue label must match (case-insensitive).
 */
export function matchesLabelFilter(issueLabels: string[], filter: string[] | undefined | null): boolean {
  const wanted = (filter || []).map(label => label.trim().toLowerCase()).filter(Boolean);
  if (!wanted.length) return true;
  const present = new Set(issueLabels.map(label => label.trim().toLowerCase()));
  return wanted.some(label => present.has(label));
}

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

const DESCRIPTION_MAX_LENGTH = 5000;

/**
 * Escaped HTML paragraphs for the description editor. The GitHub Markdown source is kept as
 * plain text (not rendered) with a link back to the original issue first.
 */
export function renderImportedDescription(
  body: string | null | undefined,
  source: { fullName: string; number: number; url: string },
): string {
  const header = `Imported from GitHub: ${source.fullName}#${source.number} (${source.url})`;
  const text = [header, "", (body || "").trim()].join("\n").slice(0, DESCRIPTION_MAX_LENGTH);
  return text
    .split(/\r?\n/)
    .map(line => `<p>${escapeHtml(line) || "<br>"}</p>`)
    .join("");
}
