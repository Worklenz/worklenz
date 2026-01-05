import { NextFunction } from "express";

import { IWorkLenzRequest } from "../../interfaces/worklenz-request";
import { IWorkLenzResponse } from "../../interfaces/worklenz-response";
import { ServerResponse } from "../../models/server-response";
import { sanitizeSVG } from "../../shared/utils";

// Dangerous file extensions that should never be uploaded
const BLOCKED_EXTENSIONS = [
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js', 'jar',
  'app', 'deb', 'rpm', 'dmg', 'pkg', 'sh', 'ps1', 'dll', 'msi',
  'hta', 'cpl', 'msc', 'vb', 'wsf', 'wsh', 'scf', 'lnk', 'inf'
];

// File extensions that require special handling/sanitization
const SANITIZE_REQUIRED = ['svg', 'xml', 'html', 'htm'];

export default function (req: IWorkLenzRequest, res: IWorkLenzResponse, next: NextFunction): IWorkLenzResponse | void {
  const { attachments, task_id } = req.body;

  if (attachments.length === 0)
    return res.status(200).send(new ServerResponse(false, null, "Attachments are required!"));

  if (!task_id)
    return res.status(200).send(new ServerResponse(false, null, "Task ID is required!"));

  // Security: Validate and sanitize each attachment
  for (const attachment of attachments) {
    if (!attachment.file_name) {
      return res.status(200).send(new ServerResponse(false, null, "Attachment file name is required!"));
    }

    // Extract and validate file extension
    const fileExtension = attachment.file_name.split(".").pop()?.toLowerCase() || '';

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
        const base64Data = attachment.file.replace(/^data:.*;base64,/, '');
        const fileContent = Buffer.from(base64Data, 'base64').toString('utf-8');
        
        // Sanitize the content
        const sanitizedContent = sanitizeSVG(fileContent);
        
        // Re-encode to base64
        const sanitizedBase64 = Buffer.from(sanitizedContent, 'utf-8').toString('base64');
        attachment.file = `data:image/svg+xml;base64,${sanitizedBase64}`;
      } catch (error) {
        return res.status(200).send(
          new ServerResponse(false, null, `Failed to sanitize ${fileExtension.toUpperCase()} file. The file may be corrupted or contain invalid content.`)
            .withTitle("Upload failed!")
        );
      }
    }
  }
  
  return next();
}