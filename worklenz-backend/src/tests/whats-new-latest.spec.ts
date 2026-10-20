import moment from "moment";

import whatsNewService from "../services/whats-new/whats-new.service";
import db from "../config/db";

jest.mock("../config/db", () => ({
  query: jest.fn()
}));
jest.mock("../shared/utils", () => ({
  log_error: jest.fn(),
  sanitizePlainText: (value: string) => value
}));
interface IFixtureRelease {
  id: string;
  daysAgo: number;
  isActive?: boolean;
  changelogUrl?: string;
}

const dateDaysAgo = (daysAgo: number) => moment().subtract(daysAgo, "days").format("YYYY-MM-DD");

interface IFixtureReleaseRow {
  slug: string;
  title: string;
  body_markdown: string;
  published_at: string;
  changelog_url: string | null;
  is_active: boolean;
}

let releaseRows: IFixtureReleaseRow[] = [];
let dismissedIds: string[] = [];

const givenReleases = (releases: IFixtureRelease[]) => {
  releaseRows = releases.map(({ id, daysAgo, isActive = true, changelogUrl }) => ({
    slug: id,
    title: `Release ${id}`,
    body_markdown: `## Notes for ${id}\n\nSomething **new** shipped.`,
    published_at: dateDaysAgo(daysAgo),
    changelog_url: changelogUrl ?? null,
    is_active: isActive,
  }));
};

describe("whats-new service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    releaseRows = [];
    dismissedIds = [];
    (db.query as jest.Mock).mockReset();
    (db.query as jest.Mock).mockImplementation(async (sql: string) => {
      if (sql.includes("FROM release_notes")) return { rows: releaseRows };
      if (sql.includes("FROM user_release_dismissals")) {
        return { rows: dismissedIds.map(release_id => ({ release_id })) };
      }
      if (sql.includes("SELECT language")) return { rows: [{ language: "de" }] };
      return { rows: [] };
    });
  });

  describe("getLatestRelease", () => {
    it("should return null when nothing is published", async () => {
      givenReleases([]);

      expect(await whatsNewService.getLatestRelease()).toBeNull();
    });

    it("should return a release older than the 7-day window with is_new false", async () => {
      givenReleases([{ id: "old-release", daysAgo: 30, changelogUrl: "https://worklenz.com/changelog/old" }]);

      const latest = await whatsNewService.getLatestRelease();

      expect(latest).toMatchObject({
        id: "old-release",
        title: "Release old-release",
        changelog_url: "https://worklenz.com/changelog/old",
        is_new: false
      });
      expect(latest?.preview_text).toContain("Something new shipped.");
    });

    it("should flag a release inside the window as is_new", async () => {
      givenReleases([{ id: "fresh-release", daysAgo: 2 }]);

      expect(await whatsNewService.getLatestRelease()).toMatchObject({ id: "fresh-release", is_new: true });
    });

    it("should treat 6 days ago as inside the window and 7 days ago as outside it", async () => {
      givenReleases([{ id: "six-days", daysAgo: 6 }]);
      expect((await whatsNewService.getLatestRelease())?.is_new).toBe(true);

      givenReleases([{ id: "seven-days", daysAgo: 7 }]);
      expect((await whatsNewService.getLatestRelease())?.is_new).toBe(false);
    });

    it("should skip inactive and future-dated releases", async () => {
      givenReleases([
        { id: "published", daysAgo: 20 },
        { id: "inactive-newer", daysAgo: 1, isActive: false },
        { id: "scheduled", daysAgo: -3 }
      ]);

      expect((await whatsNewService.getLatestRelease())?.id).toBe("published");
    });

    it("should return null when every release is inactive or future-dated", async () => {
      givenReleases([
        { id: "inactive", daysAgo: 1, isActive: false },
        { id: "scheduled", daysAgo: -1 }
      ]);

      expect(await whatsNewService.getLatestRelease()).toBeNull();
    });

    it("should pick the newest release, breaking a same-day tie by id descending", async () => {
      givenReleases([
        { id: "a-older", daysAgo: 10 },
        { id: "b-same-day", daysAgo: 3 },
        { id: "c-same-day", daysAgo: 3 }
      ]);

      expect((await whatsNewService.getLatestRelease())?.id).toBe("c-same-day");
    });

    it("should not consult per-user dismissals", async () => {
      givenReleases([{ id: "dismissed-by-everyone", daysAgo: 1 }]);

      await whatsNewService.getLatestRelease();

      const statements = (db.query as jest.Mock).mock.calls.map(([sql]: [string]) => sql);
      expect(statements.some(sql => sql.includes("user_release_dismissals"))).toBe(false);
      expect(statements.some(sql => /INSERT|UPDATE|DELETE/.test(sql))).toBe(false);
    });
  });

  describe("database integration", () => {
    it("loads the latest release using the user's locale and English fallback", async () => {
      givenReleases([{ id: "localized", daysAgo: 1 }]);
      releaseRows[0].title = "Neue Version";

      await expect(whatsNewService.getLatestRelease("user-1")).resolves.toMatchObject({ title: "Neue Version" });
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("SELECT language"), ["user-1"]);
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("COALESCE(loc.title, en.title)"), ["en", "de"]);
    });

    it("uses English when no user is supplied", async () => {
      await whatsNewService.getLatestRelease();
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("FROM release_notes"), ["en", "en"]);
    });

    it("propagates release database failures instead of reporting an empty release list", async () => {
      (db.query as jest.Mock).mockRejectedValueOnce(new Error("Database unavailable"));
      await expect(whatsNewService.getLatestRelease()).rejects.toThrow("Database unavailable");
    });

    it("preserves view tracking for releases opened by ID", async () => {
      givenReleases([{ id: "viewed", daysAgo: 1 }]);
      await expect(whatsNewService.getReleaseById("viewed", "user-1")).resolves.toMatchObject({ id: "viewed" });
      expect(db.query).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO user_release_views"), ["user-1", "viewed"]);
    });
  });

  // Guards the refactor that made the tag and the `is_new` flag share one window rule.
  describe("getCurrentReleaseForUser", () => {
    it("should return the newest in-window release the user has not dismissed", async () => {
      givenReleases([
        { id: "newest", daysAgo: 1 },
        { id: "older-in-window", daysAgo: 4 }
      ]);

      await expect(whatsNewService.getCurrentReleaseForUser("user-1")).resolves.toMatchObject({ id: "newest" });
    });

    it("should fall back to the next in-window release when the newest is dismissed", async () => {
      givenReleases([
        { id: "newest", daysAgo: 1 },
        { id: "older-in-window", daysAgo: 4 }
      ]);
      dismissedIds = ["newest"];

      await expect(whatsNewService.getCurrentReleaseForUser("user-1")).resolves.toMatchObject({
        id: "older-in-window"
      });
    });

    it("should return null once every release is outside the window", async () => {
      givenReleases([{ id: "stale", daysAgo: 30 }]);

      await expect(whatsNewService.getCurrentReleaseForUser("user-1")).resolves.toBeNull();
    });
  });
});
