import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { getFreePlanSettings, getUsedStorage } from "../../shared/licensing-utils";
import { megabytesToBytes, sanitizeSVG } from "../../shared/utils";

// Dangerous file extensions that should never be uploaded
const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
  'app', 'deb', 'rpm', 'dmg', 'pkg', 'sh', 'ps1', 'dll', 'msi',
  'hta', 'cpl', 'msc', 'vb', 'wsf', 'wsh', 'scf', 'lnk', 'inf'
];

// File extensions that require special handling/sanitization
const SANITIZE_REQUIRED = ['svg', 'xml', 'html', 'htm'];

export default async function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): Promise<IWorkLenzResponse | void> {
  const { file, file_name, project_id, size } = req.body;

  if (!file || !file_name || !project_id || !size)
    return res.status(200).send(new ServerResponse(false, null, "Upload failed"));

  if (size > 5.243e+7)
    return res.status(200).send(new ServerResponse(false, null, "Max file size for attachments is 50 MB.").withTitle("Upload failed!"));

  if (req.user?.subscription_status === "free" && req.user?.owner_id) {
    const limits = await getFreePlanSettings();

    const usedStorage = await getUsedStorage(req.user?.owner_id);
    if ((parseInt(usedStorage) + size) > megabytesToBytes(parseInt(limits.free_tier_storage))) {
      return res.status(200).send(new ServerResponse(false, [], `Sorry, the free plan cannot exceed ${limits.free_tier_storage}MB of storage.`));
    }
  }

  // Extract and validate file extension
  const fileExtension = file_name.split(".").pop()?.toLowerCase() || '';
  req.body.type = fileExtension;

  // Security: Block dangerous file types that could execute code
  if (BLOCKED_EXTENSIONS.includes(fileExtension)) {
    return res.status(200).send(
      new ServerResponse(false, null, `File type .${fileExtension} is not allowed for security reasons.`)
        .withTitle("Upload blocked!")
    );
  }

  // Security: Sanitize SVG/XML/HTML files to remove potentially malicious scripts
  if (SANITIZE_REQUIRED.includes(fileExtension)) {
    try {
      // Decode base64 file content
      const base64Data = file.replace(/^data:.*;base64,/, '');
      const fileContent = Buffer.from(base64Data, 'base64').toString('utf-8');
      
      // Sanitize the content
      const sanitizedContent = sanitizeSVG(fileContent);
      
      // Re-encode to base64
      const sanitizedBase64 = Buffer.from(sanitizedContent, 'utf-8').toString('base64');
      req.body.file = `data:image/svg+xml;base64,${sanitizedBase64}`;
    } catch (error) {
      return res.status(200).send(
        new ServerResponse(false, null, `Failed to sanitize ${fileExtension.toUpperCase()} file. The file may be corrupted or contain invalid content.`)
          .withTitle("Upload failed!")
      );
    }
  }

  req.body.task_id = req.body.task_id || null;

  return next();
}
