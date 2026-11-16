import { describe, expect, it, vi } from 'vitest';
import { applyCommonAnalyticsTemplateFilters } from './analytics-template-filters';

describe('applyCommonAnalyticsTemplateFilters', () => {
  it.each(['last_14_days', 'last_60_days', 'last_90_days', 'this_quarter'])(
    'restores the previously supported %s preset',
    preset => {
      const setDateFilter = vi.fn();
      applyCommonAnalyticsTemplateFilters({ date_preset: preset }, { setDateFilter });
      expect(setDateFilter).toHaveBeenCalledWith(preset, null);
    }
  );
  it('restores valid custom dates and rejects nonexistent dates', () => {
    const setDateFilter = vi.fn();
    applyCommonAnalyticsTemplateFilters(
      { date_preset: 'custom', custom_range: ['2026-02-28', '2026-03-01'] },
      { setDateFilter }
    );
    expect(setDateFilter).toHaveBeenCalledWith('custom', ['2026-02-28', '2026-03-01']);
    setDateFilter.mockClear();
    applyCommonAnalyticsTemplateFilters(
      { date_preset: 'custom', custom_range: ['2026-02-30', '2026-03-01'] },
      { setDateFilter }
    );
    expect(setDateFilter).not.toHaveBeenCalled();
  });
});
