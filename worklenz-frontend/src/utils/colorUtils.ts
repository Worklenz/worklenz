export const tagBackground = (color: string): string => {
  return `${color}1A`; // 1A is 10% opacity in hex
};

export const getContrastColor = (hexcolor: string): string => {
  // If a color is not a valid hex, default to a sensible contrast
  if (!/^#([A-Fa-f0-9]{3}){1,2}$/.test(hexcolor)) {
    return '#000000'; // Default to black for invalid colors
  }

  const r = parseInt(hexcolor.slice(1, 3), 16);
  const g = parseInt(hexcolor.slice(3, 5), 16);
  const b = parseInt(hexcolor.slice(5, 7), 16);

  // Perceptual luminance calculation (from WCAG 2.0)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  // Use a threshold to decide between black and white text
  return luminance > 0.5 ? '#000000' : '#FFFFFF';
};
