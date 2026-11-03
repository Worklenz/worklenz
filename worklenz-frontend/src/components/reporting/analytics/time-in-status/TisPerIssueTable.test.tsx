import React from 'react';
import { cleanup, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConfigProvider, theme } from 'antd';
import type { TimeInStatusIssueRow } from '@/types/reporting/analytics-time-in-status.types';
import { TisPerIssueTable } from './TisPerIssueTable';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));
vi.mock('@/shared/antd-imports', async () => ({
  ...(await import('antd')),
  ...(await import('@ant-design/icons')),
}));

afterEach(cleanup);

const issues: TimeInStatusIssueRow[] = [
  { task_id: 'a', task_key: 'KEY-003', task_name: 'Alpha', total_days: 2 },
  { task_id: 'b', task_key: 'KEY-001', task_name: 'Charlie', total_days: 3 },
  { task_id: 'c', task_key: 'KEY-002', task_name: 'Bravo', total_days: 1 },
].map(issue => ({
  ...issue,
  project_id: 'project',
  project_name: 'Project',
  issue_type: 'task',
  assignee_name: null,
  is_outlier: false,
  segments: [],
}));

const serverResults = [
  { sort: 'total_desc', rows: [issues[1], issues[0], issues[2]] },
  { sort: 'total_asc', rows: [issues[2], issues[0], issues[1]] },
  { sort: 'key_asc', rows: [issues[1], issues[2], issues[0]] },
  { sort: 'name_asc', rows: [issues[0], issues[2], issues[1]] },
];

const visibleKeys = () =>
  within(screen.getByRole('table'))
    .getAllByRole('row')
    .slice(1)
    .map(row => within(row).getAllByRole('cell')[0].textContent);

for (const [mode, algorithm] of [
  ['light', theme.defaultAlgorithm],
  ['dark', theme.darkAlgorithm],
] as const) {
  describe(`per-issue server sorting in ${mode} theme`, () => {
    it.each(serverResults)('preserves $sort order on mount and after a new response', ({ rows }) => {
      const table = (data: TimeInStatusIssueRow[]) => (
        <ConfigProvider theme={{ algorithm }}>
          <TisPerIssueTable issues={data} />
        </ConfigProvider>
      );
      const { rerender } = render(table(rows));
      expect(visibleKeys()).toEqual(rows.map(issue => issue.task_key));

      const nextRows = [...rows].reverse();
      rerender(table(nextRows));
      expect(visibleKeys()).toEqual(nextRows.map(issue => issue.task_key));
    });
  });
}
