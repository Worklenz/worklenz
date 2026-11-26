import type { Chart, ChartDataset } from 'chart.js';

const DEFAULT_EXPORT_BG = '#ffffff';

/** Light-theme chart chrome so exports stay readable on a white PDF/PNG page. */
const LIGHT_EXPORT_TEXT = 'rgba(0, 0, 0, 0.65)';
const LIGHT_EXPORT_GRID = '#f0f0f0';
/** Dataset strokes that would vanish on white (e.g. dark-mode Average line). */
const LIGHT_EXPORT_DATASET_STROKE = '#595959';

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

interface OptionColorRestore {
  kind: 'option';
  path: string[];
  value: unknown;
}

interface DatasetColorRestore {
  kind: 'dataset';
  dataset: ChartDataset;
  key: 'borderColor' | 'backgroundColor' | 'pointBorderColor';
  value: unknown;
}

type ColorRestore = OptionColorRestore | DatasetColorRestore;

const findOption = (options: Record<string, unknown>, path: string[]): Record<string, unknown> | undefined => {
  let current: unknown = options;
  for (const part of path) {
    if (!current || typeof current !== 'object') return undefined;
    current = (current as Record<string, unknown>)[part];
  }
  return current && typeof current === 'object' ? (current as Record<string, unknown>) : undefined;
};

/** True when a Chart.js color would be near-white / translucent white on a white export canvas. */
export function isLightExportColor(color: unknown): boolean {
  if (typeof color !== 'string') return false;
  const trimmed = color.trim().toLowerCase();
  if (!trimmed || trimmed === 'transparent') return false;

  if (trimmed.startsWith('#')) {
    const hex = trimmed.slice(1);
    const full =
      hex.length === 3
        ? hex
            .split('')
            .map(ch => ch + ch)
            .join('')
        : hex.length === 6 || hex.length === 8
          ? hex.slice(0, 6)
          : '';
    if (full.length !== 6) return false;
    const r = Number.parseInt(full.slice(0, 2), 16);
    const g = Number.parseInt(full.slice(2, 4), 16);
    const b = Number.parseInt(full.slice(4, 6), 16);
    if ([r, g, b].some(n => Number.isNaN(n))) return false;
    return (r + g + b) / 3 >= 200;
  }

  const rgba = trimmed.match(
    /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/
  );
  if (!rgba) return false;
  const r = Number(rgba[1]);
  const g = Number(rgba[2]);
  const b = Number(rgba[3]);
  const a = rgba[4] == null ? 1 : Number(rgba[4]);
  if ([r, g, b, a].some(n => Number.isNaN(n))) return false;
  // Dark-mode Ant Design secondary text is typically rgba(255,255,255,0.65).
  return a > 0.2 && (r + g + b) / 3 >= 200;
}

/** Temporarily apply export colors, restoring the current options after Chart.js updates. */
function withLightExportTheme<T>(chart: Chart, run: () => T): T {
  const restores: ColorRestore[] = [];
  const options = chart.options as unknown as Record<string, unknown>;
  const setColor = (path: string[], color: string) => {
    const target = findOption(options, path);
    if (!target) return;
    restores.push({ kind: 'option', path, value: target.color });
    target.color = color;
  };
  const scales = options.scales as Record<string, unknown> | undefined;
  Object.keys(scales || {}).forEach(id => {
    setColor(['scales', id, 'ticks'], LIGHT_EXPORT_TEXT);
    setColor(['scales', id, 'grid'], LIGHT_EXPORT_GRID);
    setColor(['scales', id, 'title'], LIGHT_EXPORT_TEXT);
  });
  setColor(['plugins', 'legend', 'labels'], LIGHT_EXPORT_TEXT);

  // Keep line overlays (Average / Trend) visible on the white export canvas.
  const datasets = chart.data?.datasets;
  if (Array.isArray(datasets)) {
    datasets.forEach(dataset => {
      (['borderColor', 'pointBorderColor'] as const).forEach(key => {
        const value = dataset[key];
        if (!isLightExportColor(value)) return;
        restores.push({ kind: 'dataset', dataset, key, value });
        dataset[key] = LIGHT_EXPORT_DATASET_STROKE;
      });
    });
  }

  try {
    chart.update('none');
    return run();
  } finally {
    const currentOptions = chart.options as unknown as Record<string, unknown>;
    restores.forEach(entry => {
      if (entry.kind === 'option') {
        const target = findOption(currentOptions, entry.path);
        if (target) target.color = entry.value;
        return;
      }
      entry.dataset[entry.key] = entry.value as never;
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
