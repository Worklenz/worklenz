import { describe, expect, it } from 'vitest';
import {
  buildAnalyticsNavGroups,
  CUSTOM_REPORTS_GROUP_KEY,
} from './analytics-nav';

describe('buildAnalyticsNavGroups', () => {
  it('includes the Custom reports section when there are no saved reports', () => {
    const groups = buildAnalyticsNavGroups([]);
    const customGroup = groups.find(group => group.key === CUSTOM_REPORTS_GROUP_KEY);

    expect(customGroup).toMatchObject({
      defaultLabel: 'Custom reports',
      items: [],
    });
    expect(groups.findIndex(group => group.key === CUSTOM_REPORTS_GROUP_KEY)).toBe(
      groups.findIndex(group => group.key === 'share') - 1
    );
  });

  it('lists saved reports in the Custom reports section', () => {
    const groups = buildAnalyticsNavGroups([{ id: 'report-1', name: 'My report' }]);
    const customGroup = groups.find(group => group.key === CUSTOM_REPORTS_GROUP_KEY);

    expect(customGroup?.items).toMatchObject([
      { key: 'custom-report-1', path: 'custom/report-1', defaultLabel: 'My report' },
    ]);
  });
});
