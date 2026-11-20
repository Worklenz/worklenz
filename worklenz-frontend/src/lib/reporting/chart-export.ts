import type { Chart } from 'chart.js';

const DEFAULT_EXPORT_BG = '#ffffff';

/** Light-theme chart chrome so exports stay readable on a white PDF/PNG page. */
const LIGHT_EXPORT_TEXT = 'rgba(0, 0, 0, 0.65)';
const LIGHT_EXPORT_GRID = '#f0f0f0';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

interface ColorRestore {
  path: string[];
  value: unknown;
}

const findOption = (options: Record<string, unknown>, path: string[]): Record<string, unknown> | undefined => {
  let current: unknown = options;
  for (const part of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current && typeof current === 'object' ? current as Record<string, unknown> : undefined;
};

/** Temporarily apply export colors, restoring the current options after Chart.js updates. */
function withLightExportTheme<T>(chart: Chart, run: () => T): T {
  const restores: ColorRestore[] = [];
  const options = chart.options as unknown as Record<string, unknown>;
  const setColor = (path: string[], color: string) => {
    const target = findOption(options, path);
    if (!target) return;
    restores.push({ path, value: target.color });
    target.color = color;
  };
  const scales = options.scales as Record<string, unknown> | undefined;
  Object.keys(scales || {}).forEach(id => {
    setColor(['scales', id, 'ticks'], LIGHT_EXPORT_TEXT);
    setColor(['scales', id, 'grid'], LIGHT_EXPORT_GRID);
    setColor(['scales', id, 'title'], LIGHT_EXPORT_TEXT);
  });
  setColor(['plugins', 'legend', 'labels'], LIGHT_EXPORT_TEXT);

  try {
    chart.update('none');
    return run();
  } finally {
    const currentOptions = chart.options as unknown as Record<string, unknown>;
    restores.forEach(({ path, value }) => {
      const target = findOption(currentOptions, path);
      if (target) target.color = value;
    });
    chart.update('none');
  }
}

/**
 * Export a Chart.js canvas as PNG with an opaque white background.
 * Axis/legend text is briefly switched to dark colours so dark-mode charts
 * stay readable in PDFs, without changing the on-screen report theme.
 */
export function chartToPngDataUrl(
  chart: Chart | null | undefined,
  backgroundColor: string = DEFAULT_EXPORT_BG
): string | null {
  const source = chart?.canvas;
  if (!chart || !source || source.width === 0 || source.height === 0) return null;

  const bg = backgroundColor || DEFAULT_EXPORT_BG;

  return withLightExportTheme(chart, () => {
    const canvas = document.createElement('canvas');
    canvas.width = source.width;
    canvas.height = source.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) return null;

    // Keep pixel-perfect chart text when drawing the export canvas.
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(source, 0, 0);

    try {
      return canvas.toDataURL('image/png', 1);
    } catch {
      return null;
    }
  });
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
