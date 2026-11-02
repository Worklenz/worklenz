import type { Chart } from 'chart.js';

const DEFAULT_EXPORT_BG = '#ffffff';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

/**
 * Export a Chart.js canvas as PNG with an opaque background.
 * Chart.js leaves the canvas transparent, so dark-theme axis/legend text
 * becomes invisible when the PNG/PDF is viewed on a white page.
 */
export function chartToPngDataUrl(
  chart: Chart | null | undefined,
  backgroundColor: string = DEFAULT_EXPORT_BG
): string | null {
  const source = chart?.canvas;
  if (!source || source.width === 0 || source.height === 0) return null;

  const canvas = document.createElement('canvas');
  canvas.width = source.width;
  canvas.height = source.height;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;

  ctx.fillStyle = backgroundColor || DEFAULT_EXPORT_BG;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(source, 0, 0);

  try {
    return canvas.toDataURL('image/png', 1);
  } catch {
    return null;
  }
}

/** SVG wrapper around the opaque PNG export (same visibility fix). */
export function chartToSvgMarkup(
  chart: Chart | null | undefined,
  title: string,
  backgroundColor: string = DEFAULT_EXPORT_BG
): string | null {
  const png = chartToPngDataUrl(chart, backgroundColor);
  if (!png) return null;

  const width = chart?.width || chart?.canvas.width || 800;
  const height = chart?.height || chart?.canvas.height || 400;
  const bg = backgroundColor || DEFAULT_EXPORT_BG;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <title>${escapeXml(title)}</title>
  <rect width="100%" height="100%" fill="${bg}" />
  <image href="${png}" width="${width}" height="${height}" />
</svg>`;
}
