import { describe, expect, it, vi } from 'vitest';
import type { Chart } from 'chart.js';
import { chartToPngDataUrl } from './chart-export';

describe('chartToPngDataUrl', () => {
  it('restores colors on the current options after an update replaces them', () => {
    const source = document.createElement('canvas');
    source.width = 100;
    source.height = 100;
    const chart = {
      canvas: source,
      options: { scales: { x: { ticks: { color: 'white' }, grid: { color: 'gray' } } } },
      update: vi.fn(),
    };
    chart.update.mockImplementation(() => {
      chart.options = structuredClone(chart.options);
    });
    const context = { fillRect: vi.fn(), drawImage: vi.fn(), fillStyle: '', imageSmoothingEnabled: true };
    const getContext = vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(context as unknown as CanvasRenderingContext2D);
    const toDataURL = vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockReturnValue('data:image/png;base64,test');
    try {
      expect(chartToPngDataUrl(chart as unknown as Chart)).toBe('data:image/png;base64,test');
      expect(chart.options.scales.x.ticks.color).toBe('white');
      expect(chart.options.scales.x.grid.color).toBe('gray');
    } finally {
      getContext.mockRestore();
      toDataURL.mockRestore();
    }
  });
});
