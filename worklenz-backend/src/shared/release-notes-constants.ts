import fs from "node:fs";
import path from "node:path";

/** Mirrors FileConstants' EMAIL_TEMPLATES_BASE pattern (same directory depth,
 * same relative path shape) so the release-notes folder resolves the same
 * way the email templates folder already does in both dev and deployment. */
class ReleaseNotesConstants {
  private static readonly RELEASE_NOTES_BASE = "../../release-notes";

  static getDir(): string {
    return path.join(__dirname, ReleaseNotesConstants.RELEASE_NOTES_BASE);
  }

  static listMarkdownFiles(): string[] {
    const dir = ReleaseNotesConstants.getDir();
    if (!fs.existsSync(dir)) return [];
    return fs.readdirSync(dir).filter(fileName => {
      const lower = fileName.toLowerCase();
      return lower.endsWith(".md") && lower !== "readme.md";
    });
  }

  static readMarkdownFile(fileName: string): string {
    return fs.readFileSync(path.join(ReleaseNotesConstants.getDir(), fileName), "utf8");
  }
}

export default ReleaseNotesConstants;
