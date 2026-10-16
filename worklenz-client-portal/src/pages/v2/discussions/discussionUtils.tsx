import { Avatar } from '@/shared/antd-imports';

/** The colour of an avatar for a first letter. Same palette as the admin console's discussion avatars. */
const AVATAR_COLORS: Record<string, string> = {
  A: '#154c9b',
  B: '#3b7ad4',
  C: '#70a6f3',
  D: '#7781ca',
  E: '#9877ca',
  F: '#c178c9',
  G: '#ee87c5',
  H: '#ca7881',
  I: '#75c9c0',
  J: '#75c997',
  K: '#80ca79',
  L: '#aacb78',
  M: '#cbbc78',
  N: '#cb9878',
  O: '#bb774c',
  P: '#905b39',
  Q: '#903737',
  R: '#bf4949',
  S: '#f37070',
  T: '#ff9c3c',
  U: '#fbc84c',
  V: '#cbc8a1',
  W: '#a9a9a9',
  X: '#767676',
  Y: '#cb9878',
  Z: '#903737',
};
const FALLBACK_AVATAR_COLOR = '#9e9e9e';

/** The first letter of a name on the colour mapped to that letter. */
export const ThreadAvatar = ({ name, size = 28 }: { name: string; size?: number }) => {
  const letter = name.trim().charAt(0).toUpperCase();
  return (
    <Avatar
      size={size}
      aria-hidden
      style={{
        backgroundColor: AVATAR_COLORS[letter] ?? FALLBACK_AVATAR_COLOR,
        flexShrink: 0,
        fontSize: Math.round(size * 0.5),
      }}
    >
      {letter || '?'}
    </Avatar>
  );
};

/** "1.2 MB" style size. */
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
