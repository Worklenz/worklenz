jest.mock("../shared/storage", () => ({
  getKey: jest.fn(),
  getTaskAttachmentKey: jest.fn(),
  getObjectBuffer: jest.fn(),
}));

jest.unmock("../services/task-export/task-export-zip");
jest.unmock("../services/task-export/task-export-bundler");
jest.unmock("../shared/sanitize-filename");
jest.unmock("archiver");
jest.unmock("stream");

import {
  buildUniqueAttachmentZipPath,
  createZipBuffer,
} from "../services/task-export/task-export-zip";
import { collectAttachmentZipEntries } from "../services/task-export/task-export-bundler";
import {
  getKey,
  getObjectBuffer,
  getTaskAttachmentKey,
} from "../shared/storage";

describe("task-export-zip (TE-16)", () => {
  it("places files under one folder per task key", () => {
    const used = new Set<string>();
    const path = buildUniqueAttachmentZipPath(
      "ACME-12",
      "design.png",
      used
    );
    expect(path).toBe("ACME-12/design.png");
  });

  it("avoids filename collisions within the same task folder", () => {
    const used = new Set<string>();
    const first = buildUniqueAttachmentZipPath("ACME-1", "file.pdf", used);
    const second = buildUniqueAttachmentZipPath("ACME-1", "file.pdf", used);
    const third = buildUniqueAttachmentZipPath("ACME-1", "file.pdf", used);

    expect(first).toBe("ACME-1/file.pdf");
    expect(second).toBe("ACME-1/file (1).pdf");
    expect(third).toBe("ACME-1/file (2).pdf");
  });

  it("allows the same filename under different task keys", () => {
    const used = new Set<string>();
    const a = buildUniqueAttachmentZipPath("ACME-1", "notes.txt", used);
    const b = buildUniqueAttachmentZipPath("ACME-2", "notes.txt", used);
    expect(a).toBe("ACME-1/notes.txt");
    expect(b).toBe("ACME-2/notes.txt");
  });

  it("sanitizes unsafe characters in task keys and filenames", () => {
    const used = new Set<string>();
    const path = buildUniqueAttachmentZipPath(
      'PROJ/1: "x"',
      "bad/name?.txt",
      used
    );
    const parts = path.split("/");
    expect(parts).toHaveLength(2);
    expect(parts[0]).not.toMatch(/[/"<>|?]/);
    expect(parts[1]).not.toMatch(/[/"<>|?]/);
  });

  it("creates a non-empty zip buffer from entries", async () => {
    const buffer = await createZipBuffer([
      { path: "tasks.csv", data: "a,b\n1,2\n" },
      { path: "ACME-1/readme.txt", data: Buffer.from("hello") },
    ]);
    expect(Buffer.isBuffer(buffer)).toBe(true);
    expect(buffer.length).toBeGreaterThan(20);
    expect(buffer[0]).toBe(0x50);
    expect(buffer[1]).toBe(0x4b);
  });

  it("TE-31: skips trailing-slash paths (no empty attachment folders)", async () => {
    const buffer = await createZipBuffer([
      { path: "comments.csv", data: "x\n" },
      { path: "EMPTY-TASK/", data: "" },
    ]);
    const asString = buffer.toString("binary");
    expect(asString).toContain("comments.csv");
    expect(asString).not.toContain("EMPTY-TASK/");
  });
});

describe("comment attachments in Files ZIP", () => {
  beforeEach(() => {
    (getKey as jest.Mock).mockReturnValue("task-key");
    (getTaskAttachmentKey as jest.Mock).mockReturnValue("comment-key");
    (getObjectBuffer as jest.Mock).mockImplementation(async (key: string) => {
      if (key === "comment-key") return Buffer.from("comment-bytes");
      if (key === "task-key") return Buffer.from("task-bytes");
      return null;
    });
  });

  it("downloads comment files via getTaskAttachmentKey and packs under the task folder", async () => {
    const result = await collectAttachmentZipEntries([
      {
        id: "att-task",
        name: "task-file.png",
        type: "png",
        size: 10,
        task_id: "t1",
        task_key: "ACME-1",
        team_id: "team",
        project_id: "proj",
        source: "task",
      },
      {
        id: "att-comment",
        name: "comment-photo.jpg",
        type: "jpg",
        size: 20,
        task_id: "t1",
        task_key: "ACME-1",
        team_id: "team",
        project_id: "proj",
        source: "comment",
        comment_id: "c1",
      },
    ]);

    expect(getTaskAttachmentKey).toHaveBeenCalledWith(
      "team",
      "proj",
      "t1",
      "c1",
      "att-comment",
      "jpg"
    );
    expect(getKey).toHaveBeenCalledWith("team", "proj", "att-task", "png");
    expect(result.fileCount).toBe(2);
    expect(result.entries.map((e) => e.path)).toEqual([
      "ACME-1/task-file.png",
      "ACME-1/comment-photo.jpg",
    ]);
  });
});
