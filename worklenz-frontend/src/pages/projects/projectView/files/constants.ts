export const MAX_FILE_SIZE_BYTES = 104_857_600; // 100 MB

export const BLOCKED_EXTENSIONS = [
  'exe',
  'bat',
  'cmd',
  'com',
  'pif',
  'scr',
  'vbs',
  'js',
  'jar',
  'app',
  'deb',
  'rpm',
  'dmg',
  'pkg',
  'sh',
  'ps1',
  'dll',
  'msi',
] as const;

export const DEFAULT_SORT_CONFIG = {
  field: 'created_at' as const,
  order: 'desc' as const,
};
