/**
 * Returns black or white text color based on the background color's
 * perceived luminance (WCAG formula).
 *
 * Use this everywhere a label badge is rendered to ensure consistent
 * text contrast across Settings → Labels, Task List, Kanban, etc.
 */
export const getLabelTextColor = (hexColor: string): string => {
  const hex = (hexColor || '').replace('#', '');
  if (hex.length < 6) return '#000000';

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.5 ? '#000000' : '#ffffff';
};