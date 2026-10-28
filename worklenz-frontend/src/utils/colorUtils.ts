/**
 * Socket/status payloads append a 2-char alpha channel (e.g. "#1890ff69") for
 * translucent selectors. Ant Design Tags expect solid #RRGGBB — strip the alpha
 * so live updates match API-loaded colors in tables.
 */
export const toSolidTagColor = (color?: string): string | undefined => {
  if (!color) return undefined;
  if (color.length === 9 && color.startsWith('#')) {
    return color.slice(0, 7);
  }
  return color;
};

/**
 * Calculate the contrast color (black or white) for a given background color
 * @param hexColor - Hex color code (e.g., '#FF5733', '#F53', or '#FF573369')
 * @param backgroundColor - Optional solid surface behind a translucent color
 * @returns The foreground color with the higher WCAG contrast ratio
 */
export function getContrastColor(hexColor: string, backgroundColor?: string): string {
  const color = hexColor.trim().replace(/^#/, '');
  const expandedColor =
    color.length === 3
      ? color
          .split('')
          .map(channel => `${channel}${channel}`)
          .join('')
      : color.length === 8
        ? color.slice(0, 6)
        : color;

  if (!/^[0-9a-f]{6}$/i.test(expandedColor)) {
    return '#FFFFFF';
  }

  let [red, green, blue] = [0, 2, 4].map(offset =>
    parseInt(expandedColor.substring(offset, offset + 2), 16)
  );
  if (color.length === 8 && backgroundColor) {
    const backdrop = backgroundColor.trim().replace(/^#/, '');
    const expandedBackdrop =
      backdrop.length === 3
        ? backdrop
            .split('')
            .map(channel => `${channel}${channel}`)
            .join('')
        : backdrop.slice(0, 6);

    if (/^[0-9a-f]{6}$/i.test(expandedBackdrop)) {
      const alpha = parseInt(color.substring(6, 8), 16) / 255;
      const [backdropRed, backdropGreen, backdropBlue] = [0, 2, 4].map(offset =>
        parseInt(expandedBackdrop.substring(offset, offset + 2), 16)
      );
      red = Math.round(red * alpha + backdropRed * (1 - alpha));
      green = Math.round(green * alpha + backdropGreen * (1 - alpha));
      blue = Math.round(blue * alpha + backdropBlue * (1 - alpha));
    }
  }

  const linearizeChannel = (value: number): number => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  };
  const luminance =
    0.2126 * linearizeChannel(red) +
    0.7152 * linearizeChannel(green) +
    0.0722 * linearizeChannel(blue);
  const blackContrast = (luminance + 0.05) / 0.05;
  const whiteContrast = 1.05 / (luminance + 0.05);

  return blackContrast >= whiteContrast ? '#000000' : '#FFFFFF';
}

/**
 * Lighten a hex color by a percentage
 * @param hexColor - Hex color code
 * @param percent - Percentage to lighten (0-100)
 * @returns Lightened hex color
 */
export function lightenColor(hexColor: string, percent: number): string {
  const color = hexColor.replace('#', '');
  const num = parseInt(color, 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;

  return (
    '#' +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}

/**
 * Darken a hex color by a percentage
 * @param hexColor - Hex color code
 * @param percent - Percentage to darken (0-100)
 * @returns Darkened hex color
 */
export function darkenColor(hexColor: string, percent: number): string {
  const color = hexColor.replace('#', '');
  const num = parseInt(color, 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) - amt;
  const G = ((num >> 8) & 0x00ff) - amt;
  const B = (num & 0x0000ff) - amt;

  return (
    '#' +
    (
      0x1000000 +
      (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
      (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
      (B < 255 ? (B < 1 ? 0 : B) : 255)
    )
      .toString(16)
      .slice(1)
  );
}
