import { IconsMap } from '@/shared/constants';

export const formatFileSize = (bytes?: number): string => {
  if (bytes === undefined || bytes === null) return '--';

  const thresh = 1024;
  if (bytes < thresh) return `${bytes} B`;

  const units = ['KB', 'MB', 'GB', 'TB'];
  let u = -1;
  let value = bytes;

  do {
    value /= thresh;
    ++u;
  } while (value >= thresh && u < units.length - 1);

  const precision = value >= 10 ? 0 : 1;
  return `${value.toFixed(precision)} ${units[u]}`;
};

export const getFileTypeIcon = (type?: string) => {
  if (!type) return IconsMap['search'];
  return IconsMap[type] || IconsMap['search'];
};

export const isBlockedExtension = (
  fileName: string,
  blockedExtensions: readonly string[]
): boolean => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  return blockedExtensions.includes(ext);
};
