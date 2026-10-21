import moment from "moment";
import { marked } from "marked";
import sanitizeHtml from "sanitize-html";

import db from "../../config/db";
import { DEFAULT_RELEASE_NOTE_LOCALE, normalizeReleaseNoteLocale } from "../../shared/release-note-locales";
import { log_error, sanitizePlainText } from "../../shared/utils";
import { ICurrentRelease, ILatestRelease, IReleaseNote } from "../../interfaces/whats-new";

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

/** Loads releases from the DB (authored in the admin app), each with the title/body
 * in the user's locale, falling back to English. Releases with no English row are skipped. */
async function loadReleaseNotes(locale: string = DEFAULT_RELEASE_NOTE_LOCALE): Promise<IReleaseNote[]> {
  const result = await db.query(
    `SELECT rn.slug, TO_CHAR(rn.published_at, 'YYYY-MM-DD') AS published_at, rn.changelog_url, rn.is_active,
            COALESCE(loc.title, en.title) AS title,
            COALESCE(loc.body_markdown, en.body_markdown) AS body_markdown
     FROM release_notes rn
              JOIN release_note_translations en ON en.release_note_id = rn.id AND en.locale = $1
              LEFT JOIN release_note_translations loc ON loc.release_note_id = rn.id AND loc.locale = $2`,
    [DEFAULT_RELEASE_NOTE_LOCALE, locale]
  );

  return result.rows.map(row => ({
    id: row.slug,
    title: String(row.title).slice(0, 120),
    body_markdown: row.body_markdown,
    published_at: row.published_at,
    changelog_url: isValidChangelogUrl(row.changelog_url) ? row.changelog_url.trim() : null,
    is_active: row.is_active === true,
  }));
}

async function getUserLocale(userId?: string): Promise<string> {
  if (!userId) return DEFAULT_RELEASE_NOTE_LOCALE;
  try {
    const result = await db.query("SELECT language FROM users WHERE id = $1", [userId]);
    return normalizeReleaseNoteLocale(result.rows[0]?.language) ?? DEFAULT_RELEASE_NOTE_LOCALE;
  } catch (error) {
    log_error(error, null, false);
    return DEFAULT_RELEASE_NOTE_LOCALE;
  }
}

/** Records that the user opened a release (feeds the admin app's viewer list). Never throws. */
async function recordView(userId: string, releaseId: string): Promise<void> {
  if (!userId || !releaseId) return;
  try {
    await db.query(
      `INSERT INTO user_release_views (user_id, release_id)
       VALUES ($1, $2)
       ON CONFLICT (user_id, release_id)
         DO UPDATE SET view_count = user_release_views.view_count + 1, last_viewed_at = NOW()`,
      [userId, releaseId]
    );
  } catch (error) {
    log_error(error, null, false);
  }
}

// Shared window rule for the nav tag and the latest release's New badge.
function isWithinWindow(release: IReleaseNote): boolean {
  const windowStart = moment().subtract(WINDOW_DAYS, "days");
  return moment(release.published_at, DATE_FORMAT).isAfter(windowStart, "day");
}

function getPublishedReleases(releases: IReleaseNote[]): IReleaseNote[] {
  const now = moment();
  return releases
    .filter(release => release.is_active && moment(release.published_at, DATE_FORMAT).isSameOrBefore(now, "day"))
    .sort((a, b) => {
      if (a.published_at !== b.published_at) return a.published_at < b.published_at ? 1 : -1;
      return a.id < b.id ? 1 : a.id > b.id ? -1 : 0;
    });
}

function getEligibleReleases(releases: IReleaseNote[]): IReleaseNote[] {
  return getPublishedReleases(releases).filter(isWithinWindow);
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
  const releases = await loadReleaseNotes(await getUserLocale(userId));
  const release = getEligibleReleases(releases).find(candidate => !dismissed.has(candidate.id));
  if (!release) return null;

  return toCurrentRelease(release);
}

// Settings Help always offers the latest published release, even after its
// New badge expires or the user dismisses it. Use the same localized database
// content as the nav tag without reading or changing per-user dismissals.
async function getLatestRelease(userId?: string): Promise<ILatestRelease | null> {
  const releases = await loadReleaseNotes(await getUserLocale(userId));
  const [release] = getPublishedReleases(releases);
  if (!release) return null;

  return { ...toCurrentRelease(release), is_new: isWithinWindow(release) };
}

// Ignores is_active and the 7-day window for a release the requesting user has
// already been notified about (a row in user_notifications) — a What's New
// notification persisted in the drawer must stay clickable long after the
// release stopped being "current". A release that's currently eligible for
// everyone (active + within the window) is also returned, matching what
// getCurrentReleaseForUser would show. Anything else (a draft/inactive
// release, or one this user was never notified of) is denied — otherwise any
// authenticated user could read a not-yet-published release by guessing its
// slug. Looks up the id in the localized database releases. Fails closed
// on a DB error.
async function getReleaseById(releaseId: string, userId?: string): Promise<ICurrentRelease | null> {
  if (!releaseId) return null;
  const releases = await loadReleaseNotes(await getUserLocale(userId));
  const release = releases.find(candidate => candidate.id === releaseId);
  if (!release) return null;

  const isCurrentlyEligible = getEligibleReleases(releases).some(candidate => candidate.id === releaseId);
  if (isCurrentlyEligible) {
    await recordView(userId as string, releaseId);
    return toCurrentRelease(release);
  }

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

  await recordView(userId, releaseId);
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
  const eligibleReleases = getEligibleReleases(await loadReleaseNotes());
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
  getLatestRelease,
  recordDismissal,
  getReleaseById,
  ensureNotificationsForEligibleReleases,
};
