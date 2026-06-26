import path from "path";
import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { sanitizeSVG } from "../../shared/utils";

export const MAX_PROJECT_FILE_SIZE_BYTES = 100 * 1024 * 1024; // 100 MB

const BLOCKED_EXTENSIONS = [
  "exe",
  "bat",
  "cmd",
  "com",
  "pif",
  "scr",
  "vbs",
  "js",
  "jar",
  "app",
  "deb",
  "rpm",
  "dmg",
  "pkg",
  "sh",
  "ps1",
  "dll",
  "msi",
];

const SANITIZE_REQUIRED = ["svg", "xml"];

const sanitizeFileName = (fileName: string, extension: string): string => {
  const parsed = path.parse(fileName);
  const baseName = parsed.name || "file";
  const normalizedBase = baseName.replace(/[^a-zA-Z0-9._-]/g, "_");
  const maxBaseLength = Math.max(
    1,
    255 - (extension ? extension.length + 1 : 0),
  );
  const trimmedBase = normalizedBase.slice(0, maxBaseLength);
  return extension ? `${trimmedBase}.${extension}` : trimmedBase;
};

const sanitizeXmlContent = (content: string): string => {
  return content
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gi, "")
    .replace(/on\w+\s*=\s*'[^']*'/gi, "");
};

export default function projectFilesValidator(
  req: IWorkLenzRequest,
  res: IWorkLenzResponse,
  next: NextFunction,
): IWorkLenzResponse | void {
  const file = req.file;

  if (!file) {
    return res
      .status(400)
      .send(
        new ServerResponse(false, null, "File is required").withTitle(
          "Upload failed!",
        ),
      );
  }

  const originalName = file.originalname || "file";
  const extension = path.extname(originalName).replace(".", "").toLowerCase();

  if (!extension) {
    return res
      .status(400)
      .send(
        new ServerResponse(
          false,
          null,
          "A valid file extension is required.",
        ).withTitle("Upload failed!"),
      );
  }

  if (file.size > MAX_PROJECT_FILE_SIZE_BYTES) {
    return res
      .status(400)
      .send(
        new ServerResponse(
          false,
          null,
          "Max file size is 100 MB per file.",
        ).withTitle("Upload failed!"),
      );
  }

  if (BLOCKED_EXTENSIONS.includes(extension)) {
    return res
      .status(400)
      .send(
        new ServerResponse(
          false,
          null,
          `File type .${extension} is not allowed for security.`,
        ).withTitle("Upload blocked!"),
      );
  }

  let sanitizedBuffer = file.buffer;

  if (SANITIZE_REQUIRED.includes(extension)) {
    const content = sanitizedBuffer.toString("utf-8");
    const sanitizedContent =
      extension === "svg" ? sanitizeSVG(content) : sanitizeXmlContent(content);
    sanitizedBuffer = Buffer.from(sanitizedContent, "utf-8");
  }

  const cleanFileName = sanitizeFileName(originalName, extension);

  // Mutate the multer file and attach metadata for downstream handlers
  file.buffer = sanitizedBuffer;
  file.originalname = cleanFileName;

  req.projectFileMeta = {
    extension,
    cleanFileName,
  };

  return next();
}
