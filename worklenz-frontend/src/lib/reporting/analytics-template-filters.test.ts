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
});
