import moment from "moment";

import whatsNewService from "../services/whats-new/whats-new.service";
import ReleaseNotesConstants from "../shared/release-notes-constants";
import db from "../config/db";

jest.mock("../config/db", () => ({
  query: jest.fn()
}));
jest.mock("../shared/utils", () => ({
  log_error: jest.fn(),
  sanitizePlainText: (value: string) => value
}));
jest.mock("../shared/release-notes-constants", () => ({
  __esModule: true,
  default: {
    listMarkdownFiles: jest.fn(),
    readMarkdownFile: jest.fn()
  }
}));

interface IFixtureRelease {
  id: string;
  daysAgo: number;
  isActive?: boolean;
  changelogUrl?: string;
}

const dateDaysAgo = (daysAgo: number) => moment().subtract(daysAgo, "days").format("YYYY-MM-DD");

// The date is quoted so YAML keeps it a string, not a Date (which moment would
// read in local time and could shift a day near midnight).
const toMarkdown = ({ id, daysAgo, isActive = true, changelogUrl }: IFixtureRelease) =>
  [
    "---",
    `title: "Release ${id}"`,
    `published_at: "${dateDaysAgo(daysAgo)}"`,
    changelogUrl ? `changelog_url: ${changelogUrl}` : null,
    `is_active: ${isActive}`,
    "---",
    "",
    `## Notes for ${id}`,
    "",
    "Something **new** shipped."
  ]
    .filter(line => line !== null)
    .join("\n");

const givenReleases = (releases: IFixtureRelease[]) => {
  const files = new Map(releases.map(release => [`${release.id}.md`, toMarkdown(release)]));
  (ReleaseNotesConstants.listMarkdownFiles as jest.Mock).mockReturnValue([...files.keys()]);
  (ReleaseNotesConstants.readMarkdownFile as jest.Mock).mockImplementation((fileName: string) => files.get(fileName));
};

describe("whats-new service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (db.query as jest.Mock).mockResolvedValue({ rows: [] });
  });

  describe("getLatestRelease", () => {
    it("should return null when nothing is published", () => {
      givenReleases([]);

      expect(whatsNewService.getLatestRelease()).toBeNull();
    });

    it("should return a release older than the 7-day window with is_new false", () => {
      givenReleases([{ id: "old-release", daysAgo: 30, changelogUrl: "https://worklenz.com/changelog/old" }]);

      const latest = whatsNewService.getLatestRelease();

      expect(latest).toMatchObject({
        id: "old-release",
        title: "Release old-release",
        changelog_url: "https://worklenz.com/changelog/old",
        is_new: false
      });
      expect(latest?.preview_text).toContain("Something new shipped.");
    });

    it("should flag a release inside the window as is_new", () => {
      givenReleases([{ id: "fresh-release", daysAgo: 2 }]);

      expect(whatsNewService.getLatestRelease()).toMatchObject({ id: "fresh-release", is_new: true });
    });

    it("should treat 6 days ago as inside the window and 7 days ago as outside it", () => {
      givenReleases([{ id: "six-days", daysAgo: 6 }]);
      expect(whatsNewService.getLatestRelease()?.is_new).toBe(true);

      givenReleases([{ id: "seven-days", daysAgo: 7 }]);
      expect(whatsNewService.getLatestRelease()?.is_new).toBe(false);
    });

    it("should skip inactive and future-dated releases", () => {
      givenReleases([
        { id: "published", daysAgo: 20 },
        { id: "inactive-newer", daysAgo: 1, isActive: false },
        { id: "scheduled", daysAgo: -3 }
      ]);

      expect(whatsNewService.getLatestRelease()?.id).toBe("published");
    });

    it("should return null when every release is inactive or future-dated", () => {
      givenReleases([
        { id: "inactive", daysAgo: 1, isActive: false },
        { id: "scheduled", daysAgo: -1 }
      ]);

      expect(whatsNewService.getLatestRelease()).toBeNull();
    });

    it("should pick the newest release, breaking a same-day tie by id descending", () => {
      givenReleases([
        { id: "a-older", daysAgo: 10 },
        { id: "b-same-day", daysAgo: 3 },
        { id: "c-same-day", daysAgo: 3 }
      ]);

      expect(whatsNewService.getLatestRelease()?.id).toBe("c-same-day");
    });

    it("should not consult per-user dismissals", () => {
      givenReleases([{ id: "dismissed-by-everyone", daysAgo: 1 }]);

      whatsNewService.getLatestRelease();

      expect(db.query).not.toHaveBeenCalled();
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
      (db.query as jest.Mock).mockResolvedValue({ rows: [{ release_id: "newest" }] });

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
