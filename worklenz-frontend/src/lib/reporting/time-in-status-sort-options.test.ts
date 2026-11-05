import { describe, expect, it } from 'vitest';
import { getTimeInStatusSortOptions } from './time-in-status-sort-options';

const labels = {
  avgDesc: 'Avg (high → low)',
  avgAsc: 'Avg (low → high)',
  medianDesc: 'Median (high → low)',
  countDesc: 'Count (high → low)',
  statusName: 'Status name',
  totalDesc: 'Total (high → low)',
  totalAsc: 'Total (low → high)',
  taskKey: 'Task key',
  taskName: 'Task name',
};

describe('getTimeInStatusSortOptions', () => {
  it('exposes aggregate server sorts including avg and status name', () => {
    expect(getTimeInStatusSortOptions('aggregate', labels).map(o => o.value)).toEqual([
      'avg_desc',
      'avg_asc',
      'median_desc',
      'count_desc',
      'name_asc',
    ]);
  });

  it('exposes per-issue server sorts so users can retrieve rows beyond the default first 100', () => {
    const values = getTimeInStatusSortOptions('per_issue', labels).map(o => o.value);
    expect(values).toEqual(['total_desc', 'total_asc', 'key_asc', 'name_asc']);
    // key_asc / name_asc reorder the capped window vs total_desc.
    expect(values).toContain('key_asc');
    expect(values).toContain('name_asc');
  });
});
