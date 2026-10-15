/** Upload rules for portal files. They mirror the backend (`shared/project-file-rules.ts`), which enforces them. */

export const BLOCKED_UPLOAD_EXTENSIONS: ReadonlySet<string> = new Set([
  'exe', 'bat', 'cmd', 'com', 'pif', 'scr', 'vbs', 'js',
  'jar', 'app', 'deb', 'rpm', 'dmg', 'pkg', 'sh', 'ps1', 'dll', 'msi',
]);

/** 250 MB, the Business plan ceiling. */
export const MAX_UPLOAD_BYTES = 250 * 1024 * 1024;

export type UploadProblem = 'blocked_type' | 'too_large' | 'empty';

export const getUploadProblem = (file: Pick<File, 'name' | 'size'>): UploadProblem | null => {
  const extension = file.name.includes('.') ? file.name.split('.').pop()?.toLowerCase() ?? '' : '';
  if (BLOCKED_UPLOAD_EXTENSIONS.has(extension)) return 'blocked_type';
  if (file.size <= 0) return 'empty';
  if (file.size > MAX_UPLOAD_BYTES) return 'too_large';
  return null;
};

/** "1.2 MB" style size for the picker. */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB'];
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[unit]}`;
};
