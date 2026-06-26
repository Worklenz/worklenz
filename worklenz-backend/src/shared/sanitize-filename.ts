/**
 * Sanitizes a filename by removing or replacing characters that are invalid
 * or problematic in file systems (Windows, macOS, Linux)
 * 
 * Invalid characters: < > : " / \ | ? * # % & { } $ ! ' ` = @ + [ ]
 * Also removes control characters (0-31) and leading/trailing spaces/dots
 * 
 * @param filename - The filename to sanitize
 * @param replacement - Character to replace invalid characters with (default: '-')
 * @returns Sanitized filename safe for all file systems
 */
export function sanitizeFilename(filename: string, replacement: string = '-'): string {
  if (!filename) return 'export';

  return filename
    // Replace invalid filesystem characters
    .replace(/[<>:"/\\|?*#%&{}$!'`=@+\[\]]/g, replacement)
    // Replace control characters (0-31)
    .replace(/[\x00-\x1F]/g, replacement)
    // Replace multiple consecutive replacement characters with single one
    .replace(new RegExp(`${replacement}+`, 'g'), replacement)
    // Remove leading/trailing spaces and dots (problematic on Windows)
    .replace(/^[\s.]+|[\s.]+$/g, '')
    // Ensure filename is not empty after sanitization
    || 'export';
}
