import archiver from "archiver";
import { PassThrough } from "stream";

import { sanitizeFilename } from "../../shared/sanitize-filename";

export interface ZipEntry {
  /** Path inside the ZIP, using forward slashes (e.g. tasks.csv or PROJ-1/file.png). */
  path: string;
  data: Buffer | string;
}

/**
 * Builds unique in-ZIP paths: `{taskKey}/{sanitizedName}`.
 * On filename collisions within the same task folder, appends ` (n)` before the extension.
 */
export const buildUniqueAttachmentZipPath = (
  taskKey: string,
  originalName: string,
  usedPaths: Set<string>
): string => {
  const folder = sanitizeFilename(taskKey || "unknown-task");
  const safeName = sanitizeFilename(originalName || "attachment");
  const lastDot = safeName.lastIndexOf(".");
  const base = lastDot > 0 ? safeName.slice(0, lastDot) : safeName;
  const ext = lastDot > 0 ? safeName.slice(lastDot) : "";

  let candidate = `${folder}/${base}${ext}`;
  let suffix = 1;
  while (usedPaths.has(candidate.toLowerCase())) {
    candidate = `${folder}/${base} (${suffix})${ext}`;
    suffix += 1;
  }
  usedPaths.add(candidate.toLowerCase());
  return candidate;
};

/**
 * Creates a ZIP buffer from path→data entries (CSVs + attachment files).
 * TE-31: only file paths are added — directory-only paths (e.g. `PROJ-1/`) are
 * skipped so tasks with zero attachments never get an empty folder in the ZIP.
 */
export const createZipBuffer = async (entries: ZipEntry[]): Promise<Buffer> => {
  return new Promise((resolve, reject) => {
    const archive = archiver("zip", { zlib: { level: 5 } });
    const passthrough = new PassThrough();
    const chunks: Buffer[] = [];

    passthrough.on("data", (chunk: Buffer) => {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    });
    passthrough.on("end", () => resolve(Buffer.concat(chunks)));
    passthrough.on("error", reject);
    archive.on("error", reject);

    archive.pipe(passthrough);

    for (const entry of entries) {
      const name = entry.path.replace(/\\/g, "/").replace(/^\/+/, "");
      // Skip empty names and explicit directory markers (trailing slash).
      if (!name || name.endsWith("/")) {
        continue;
      }
      const data =
        typeof entry.data === "string" ? Buffer.from(entry.data, "utf8") : entry.data;
      archive.append(data, { name });
    }

    void archive.finalize();
  });
};
