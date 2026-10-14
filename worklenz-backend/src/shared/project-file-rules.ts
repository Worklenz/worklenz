import path from "path";

/**
 * Upload rules for project files, shared by the main Files tab and the Client Portal so both
 * apply exactly the same limits.
 */

// Blocked extensions - kept in sync with the frontend and the validator middleware.
export const BLOCKED_EXTENSIONS = new Set([
  "exe", "bat", "cmd", "com", "pif", "scr", "vbs", "js",
  "jar", "app", "deb", "rpm", "dmg", "pkg", "sh", "ps1", "dll", "msi",
]);

// Extra restrictions for files a CLIENT uploads through the Client Portal. These are shown to other
// people (staff and other client users), so anything a browser can run as active content is refused:
// HTML-like documents, SVG (scriptable) and Windows script/shortcut hosts. The main Files tab keeps its own
// list (it sanitises SVG on upload), so these are deliberately not added to BLOCKED_EXTENSIONS.
export const CLIENT_BLOCKED_EXTENSIONS = new Set([
  ...BLOCKED_EXTENSIONS,
  "html", "htm", "xhtml", "xht", "shtml", "svg", "svgz", "hta", "jse", "wsf", "wsh", "msc", "mht", "mhtml",
  "xml", "xsl", "xslt",
]);

// A client-reported content type that is active content, whatever the extension says.
export const CLIENT_BLOCKED_MIME_TYPES = new Set([
  "text/html", "application/xhtml+xml", "image/svg+xml", "text/xml", "application/xml", "text/xsl",
  "application/hta", "message/rfc822", "multipart/related",
]);

// Maximum file size for presigned uploads (250 MB - Business plan ceiling).
export const MAX_PRESIGN_FILE_SIZE_BYTES = 250 * 1024 * 1024;

// How long (ms) a pending presign record is considered valid before it can be cleaned up.
// Matches the presigned URL expiry (15 min) plus a small buffer.
export const PRESIGN_EXPIRY_MS = 20 * 60 * 1000;

// Sanitize a filename for use as the *display name* (the `name` column shown in
// the UI). The storage key is derived from a random fileId, never the filename,
// so we only need to strip characters that are dangerous for display/paths —
// not flatten every space or parenthesis into underscores. This keeps names
// like "My Report (Final).pdf" readable instead of "My_Report__Final_.pdf".
export const sanitizeDisplayName = (fileName: string, extension: string): string => {
  const parsed = path.parse(fileName);
  const baseName = parsed.name || "file";
  // Strip characters that are dangerous for paths, filesystems and — critically
  // — the download Content-Disposition header (the stored name is reflected
  // unquoted into `attachment; filename=...`), while preserving spaces,
  // parentheses and other readable characters. Removed set: path separators
  // (/ \), ASCII control chars (incl. CR/LF), the header-breaking quote/
  // semicolon/comma, and Windows-reserved chars (< > : " | ? *). Then collapse
  // whitespace. The storage key is derived from a random fileId (never the
  // filename), so this name is purely for display and can stay human-readable.
  // eslint-disable-next-line no-control-regex
  const normalizedBase = baseName
    .replace(/[/\\<>:"|?*;,\x00-\x1f\x7f]/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const safeBase = normalizedBase || "file";
  const maxBaseLength = Math.max(1, 255 - (extension ? extension.length + 1 : 0));
  const trimmedBase = safeBase.slice(0, maxBaseLength);
  return extension ? `${trimmedBase}.${extension}` : trimmedBase;
};
