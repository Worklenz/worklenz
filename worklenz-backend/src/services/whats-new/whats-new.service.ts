import moment from "moment";
import matter from "gray-matter";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

import db from "../../config/db";
import ReleaseNotesConstants from "../../shared/release-notes-constants";
import { log_error, sanitizePlainText } from "../../shared/utils";
import { ICurrentRelease, IReleaseNote } from "../../interfaces/whats-new";

const WINDOW_DAYS = 7;
const PREVIEW_LENGTH = 150;
const DATE_FORMAT = "YYYY-MM-DD";

// Degrades to "nothing dismissed" on failure rather than throwing, so a
// missing/un-migrated table takes out this one user's dismissal state
// instead of 500ing the whole /whats-new/current endpoint for everyone —
// same reasoning as ensureNotificationsForEligibleReleases's per-insert guard.
async function getDismissedReleaseIds(userId: string): Promise<Set<string>> {
  try {
    const result = await db.query(
      "SELECT release_id FROM user_release_dismissals WHERE user_id = $1",
      [userId]
    );
    return new Set(result.rows.map(row => row.release_id));
  } catch (error) {
    log_error(error, null, false);
    return new Set<string>();
  }
}

async function recordDismissal(userId: string, releaseId: string): Promise<void> {
  if (!userId || !releaseId) return;
  await db.query(
    `INSERT INTO user_release_dismissals (user_id, release_id)
     VALUES ($1, $2)
     ON CONFLICT (user_id, release_id) DO NOTHING`,
    [userId, releaseId]
  );
}

function isValidChangelogUrl(value: unknown): value is string {
  return typeof value === "string" && /^https?:\/\//i.test(value.trim());
}

/** YAML parses an unquoted `YYYY-MM-DD` scalar into a native Date, but a
 * quoted value stays a string — accept either. */
function parsePublishedAt(value: unknown): moment.Moment | null {
  if (value instanceof Date) {
    const parsed = moment(value);
    return parsed.isValid() ? parsed : null;
  }
  if (typeof value === "string") {
    const parsed = moment(value, DATE_FORMAT, true);
    return parsed.isValid() ? parsed : null;
  }
  return null;
}

function loadReleaseNotes(): IReleaseNote[] {
  const releases: IReleaseNote[] = [];

  for (const fileName of ReleaseNotesConstants.listMarkdownFiles()) {
    try {
      const raw = ReleaseNotesConstants.readMarkdownFile(fileName);
      const { data, content } = matter(raw);

      const id = fileName.replace(/\.md$/i, "");
      const title = typeof data.title === "string" ? data.title.trim() : "";
      const body = content.trim();
      const publishedAt = parsePublishedAt(data.published_at);

      if (!title || !body || !publishedAt) {
        // A malformed frontmatter field is a content-authoring mistake, not a
        // system error — log it for visibility without paging anyone via Slack.
        log_error(new Error(`Skipping malformed release note "${fileName}": missing/invalid title, body, or published_at`), null, false);
        continue;
      }

      releases.push({
        id,
        title: title.slice(0, 120),
        body_markdown: body,
        published_at: publishedAt.format(DATE_FORMAT),
        changelog_url: isValidChangelogUrl(data.changelog_url) ? (data.changelog_url as string).trim() : null,
        is_active: data.is_active === true,
      });
    } catch (error) {
      // A read/parse failure on one release file (e.g. invalid YAML) is also
      // a content mistake, not a system error — same reasoning as above.
      log_error(error, null, false);
    }
  }

  return releases;
}

function getEligibleReleases(): IReleaseNote[] {
  const now = moment();
  const windowStart = moment().subtract(WINDOW_DAYS, "days");

  return loadReleaseNotes()
    .filter(release => {
      if (!release.is_active) return false;
      const publishedAt = moment(release.published_at, DATE_FORMAT);
      return publishedAt.isSameOrBefore(now, "day") && publishedAt.isAfter(windowStart, "day");
    })
    .sort((a, b) => (a.published_at < b.published_at ? 1 : a.published_at > b.published_at ? -1 : 0));
}

function buildPreviewText(markdown: string): string {
  const html = marked.parse(markdown, { async: false }) as string;
  const plainText = sanitizeHtml(html, { allowedTags: [], allowedAttributes: {} })
    .replace(/\s+/g, " ")
    .trim();

  if (plainText.length <= PREVIEW_LENGTH) return plainText;
  return `${plainText.slice(0, PREVIEW_LENGTH).trimEnd()}…`;
}

function toCurrentRelease(release: IReleaseNote): ICurrentRelease {
  return {
    id: release.id,
    title: release.title,
    body_markdown: release.body_markdown,
    published_at: release.published_at,
    changelog_url: release.changelog_url,
    preview_text: buildPreviewText(release.body_markdown),
  };
}

async function getCurrentReleaseForUser(userId: string): Promise<ICurrentRelease | null> {
  const dismissed = await getDismissedReleaseIds(userId);
  const release = getEligibleReleases().find(candidate => !dismissed.has(candidate.id));
  if (!release) return null;

  return toCurrentRelease(release);
}

// Ignores is_active and the 7-day window for a release the requesting user has
// already been notified about (a row in user_notifications) — a What's New
// notification persisted in the drawer must stay clickable long after the
// release stopped being "current". A release that's currently eligible for
// everyone (active + within the window) is also returned, matching what
// getCurrentReleaseForUser would show. Anything else (a draft/inactive
// release, or one this user was never notified of) is denied — otherwise any
// authenticated user could read a not-yet-published release by guessing its
// slug. Looks up the id in already-parsed releases rather than building a
// filename from the param directly, to avoid path traversal via an
// attacker-controlled id. Fails closed on a DB error.
async function getReleaseById(releaseId: string, userId?: string): Promise<ICurrentRelease | null> {
  if (!releaseId) return null;
  const release = loadReleaseNotes().find(candidate => candidate.id === releaseId);
  if (!release) return null;

  const isCurrentlyEligible = getEligibleReleases().some(candidate => candidate.id === releaseId);
  if (isCurrentlyEligible) return toCurrentRelease(release);

  if (!userId) return null;

  try {
    const result = await db.query(
      "SELECT 1 FROM user_notifications WHERE user_id = $1 AND release_id = $2 LIMIT 1",
      [userId, releaseId]
    );
    if (result.rows.length === 0) return null;
  } catch (error) {
    log_error(error, null, false);
    return null;
  }

  return toCurrentRelease(release);
}

// Fan-out is deliberately independent of user_release_dismissals — dismissing
// the nav tag must never prevent (or remove) the drawer notification. Idempotent
// via the partial unique index on (user_id, release_id), so safe to call on
// every app load. Each insert is isolated so one bad row can't block the rest
// or fail the caller (e.g. before the accompanying migration has been run).
//
// Checks which eligible releases already have a notification row before
// inserting, rather than attempting (and conflicting on) an INSERT for every
// eligible release on every call — this is invoked once per app session load,
// so in steady state (nothing new to notify about) this is one cheap SELECT
// and zero INSERTs instead of N guaranteed-to-conflict INSERTs forever.
async function ensureNotificationsForEligibleReleases(userId?: string, teamId?: string): Promise<void> {
  if (!userId || !teamId) return;
  const eligibleReleases = getEligibleReleases();
  if (!eligibleReleases.length) return;

  let existingReleaseIds = new Set<string>();
  try {
    const result = await db.query(
      "SELECT release_id FROM user_notifications WHERE user_id = $1 AND release_id = ANY($2::varchar[])",
      [userId, eligibleReleases.map(release => release.id)]
    );
    existingReleaseIds = new Set(result.rows.map(row => row.release_id));
  } catch (error) {
    log_error(error, null, false);
    // Fall through with an empty set — worst case we attempt inserts that
    // ON CONFLICT DO NOTHING will simply no-op against.
  }

  for (const release of eligibleReleases) {
    if (existingReleaseIds.has(release.id)) continue;
    try {
      await db.query(
        `INSERT INTO user_notifications (message, user_id, team_id, release_id)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, release_id) WHERE release_id IS NOT NULL DO NOTHING`,
        [`<b>What's New:</b> ${sanitizePlainText(release.title)}`, userId, teamId, release.id]
      );
    } catch (error) {
      log_error(error, null, false);
    }
  }
}

export default {
  getCurrentReleaseForUser,
  recordDismissal,
  getReleaseById,
  ensureNotificationsForEligibleReleases,
};
