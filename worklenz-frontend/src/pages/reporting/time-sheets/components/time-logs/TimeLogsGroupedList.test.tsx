import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  ITimeLogEntry,
  ITimeLogGroup,
  ITimeLogsFilterRequest,
  TimeLogsGroupDimension,
} from '@/types/reporting/time-logs.types';
import { TimeLogsGroupedList } from './TimeLogsGroupedList';

const mocks = vi.hoisted(() => ({ getTimeLogs: vi.fn() }));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> & { defaultValue?: string }) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? '')
      ),
  }),
}));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ themeReducer: { mode: 'light' } }),
}));
vi.mock('@/api/reporting/reporting-time-logs.api.service', () => ({
  reportingTimeLogsApiService: {
    getTimeLogs: (...args: unknown[]) => mocks.getTimeLogs(...args),
  },
}));

const makeGroup = (overrides: Partial<ITimeLogGroup> = {}): ITimeLogGroup => ({
  group_key: 'u-kai',
  group_label: 'Kai Buhler',
  group_avatar_url: null,
  group_color: '#ee87b4',
  group_status: 'active',
  subtotal: 18000, // 5h 0m = 3h 30m billable + 1h 30m not
  entry_count: 6,
  task_count: 4,
  project_count: 2,
  member_count: 1,
  billable_entry_count: 4,
  billable_task_count: 3,
  billable_time: 12600,
  non_billable_entry_count: 2,
  non_billable_task_count: 1,
  non_billable_time: 5400,
  ...overrides,
});

const makeEntry = (overrides: Partial<ITimeLogEntry> = {}): ITimeLogEntry => ({
  id: 'log-1',
  log_day: '2026-09-17',
  user_id: 'u-kai',
  user_name: 'Kai Buhler',
  avatar_url: null,
  member_status: 'active',
  project_id: 'p1',
  client_id: 'c1',
  client_name: 'Insolvenz GmbH',
  project_name: 'InsolvenzTool MASTER',
  task_id: 't1',
  task_key: 'INS-12',
  task_name: 'Project Management',
  billable: true,
  time_spent: 5400,
  description: 'Meeting with Wolfgang',
  ...overrides,
});

const entriesResponse = (entries: ITimeLogEntry[], total = entries.length) => ({
  done: true,
  body: {
    logs: entries,
    view: 'flat',
    total,
    total_entries: total,
    total_seconds: 0,
    page: 1,
    page_size: 25,
  },
});

const FILTERS: ITimeLogsFilterRequest = { date_from: '2026-09-14', date_to: '2026-09-20' };

const renderList = (overrides: Partial<React.ComponentProps<typeof TimeLogsGroupedList>> = {}) => {
  const props: React.ComponentProps<typeof TimeLogsGroupedList> = {
    groups: [makeGroup()],
    groupBy: 'member',
    filterRequest: FILTERS,
    loading: false,
    failed: false,
    onRetry: vi.fn(),
    totalGroups: 1,
    totalEntries: 6,
    totalSeconds: 18000,
    page: 1,
    pageSize: 20,
    onPageChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<TimeLogsGroupedList {...props} />) };
};

const groupRows = () => screen.getAllByRole('listitem');
const headerTexts = () =>
  Array.from(document.querySelectorAll('.time-logs-groups-head > span'))
    .map(el => (el.textContent ?? '').trim())
    .filter(Boolean);

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTimeLogs.mockResolvedValue(entriesResponse([makeEntry()], 6));
});

describe('TimeLogsGroupedList', () => {
  describe('the rollup row', () => {
    it('shows a group with its counts and its billable, non-billable and total time', () => {
      renderList();
      const row = within(groupRows()[0]);
      expect(row.getByText('Kai Buhler')).toBeInTheDocument();
      const cells = Array.from(
        groupRows()[0].querySelectorAll('.time-logs-group-row > .time-logs-group-cell')
      ).map(el => (el.textContent ?? '').trim());
      // name | projects | entries | billable entries | billable tasks | billable time |
      // non-billable entries | non-billable tasks | non-billable time | total time
      expect(cells.slice(1)).toEqual(['2', '6', '4', '3', '3h 30m', '2', '1', '1h 30m', '5h 0m']);
    });

    it.each<[TimeLogsGroupDimension, string[]]>([
      ['member', ['Member', 'Projects']],
      ['project', ['Project', 'Members']],
      ['client', ['Client', 'Projects']],
    ])('heads the columns for a %s grouping', (groupBy, [identity, secondary]) => {
      renderList({ groupBy, groups: [makeGroup()] });
      expect(headerTexts()).toEqual([
        identity,
        secondary,
        'Total Entries',
        'Billable Entries',
        'Billable Tasks',
        'Billable Time',
        'Non-billable Entries',
        'Non-billable Tasks',
        'Non-billable Time',
        'Total Time',
      ]);
    });

    it("counts a project's members, not its projects", () => {
      renderList({
        groupBy: 'project',
        groups: [
          makeGroup({ group_key: 'p1', group_label: 'Website', member_count: 5, project_count: 1 }),
        ],
      });
      const cells = Array.from(
        groupRows()[0].querySelectorAll('.time-logs-group-row > .time-logs-group-cell')
      ).map(el => (el.textContent ?? '').trim());
      expect(cells[1]).toBe('5');
    });

    it('names the projects without a client "No client"', () => {
      renderList({
        groupBy: 'client',
        groups: [makeGroup({ group_key: '__no_client__', group_label: null, group_status: null })],
      });
      expect(screen.getByText('No client')).toBeInTheDocument();
    });

    it('tags a member who is no longer active', () => {
      renderList({
        groups: [
          makeGroup({
            group_key: 'u-1',
            group_label: 'Tharindu Nishan',
            group_status: 'deactivated',
          }),
          makeGroup({ group_key: 'u-2', group_label: 'Olivia Rose', group_status: 'removed' }),
          makeGroup({ group_key: 'u-3', group_label: 'Active Anna', group_status: 'active' }),
        ],
        totalGroups: 3,
      });
      expect(screen.getByText('Deactivated')).toBeInTheDocument();
      expect(screen.getByText('Removed')).toBeInTheDocument();
      expect(screen.getAllByText(/Deactivated|Removed/)).toHaveLength(2);
    });

    it("colours a project's dot with the project colour", () => {
      const { container } = renderList({
        groupBy: 'project',
        groups: [makeGroup({ group_key: 'p1', group_label: 'Website', group_color: '#ff0000' })],
      });
      const dot = container.querySelector(
        '.time-logs-group-row span[aria-hidden="true"]'
      ) as HTMLElement;
      expect(dot).toHaveStyle({ background: '#ff0000' });
    });
  });

  describe('total row', () => {
    it('totals every group, not just this page, under the Total Time column', () => {
      renderList({ totalEntries: 128, totalSeconds: 42 * 3600 + 15 * 60, totalGroups: 40 });
      expect(screen.getByText('Entries: 128')).toBeInTheDocument();
      expect(screen.getByText('Total time logged')).toBeInTheDocument();
      expect(screen.getByText('42h 15m')).toBeInTheDocument();
      expect(screen.getByText('(42.25 h)')).toBeInTheDocument();
      const foot = document.querySelector('.time-logs-groups-foot') as HTMLElement;
      // the label spans every column but the last, which holds the total
      expect(foot.children).toHaveLength(2);
      expect((foot.children[0] as HTMLElement).style.gridColumn).toBe('1 / span 10');
    });

    it('is exposed as a polite live region', () => {
      renderList({ totalSeconds: 3600 });
      expect(screen.getByText('1h 0m').closest('[role="status"]')).toHaveAttribute(
        'aria-live',
        'polite'
      );
    });

    it('sits inside the scroll area, where CSS pins it to the bottom', () => {
      const { container } = renderList();
      const area = container.querySelector('.time-logs-groups-scroll') as HTMLElement;
      expect(area.style.overflow).toBe('auto');
      expect(area).toContainElement(screen.getByText('Total time logged'));
      expect(area.contains(screen.getByText('Rows per page'))).toBe(false);
    });
  });

  describe('opening a group', () => {
    const openFirst = async () => {
      fireEvent.click(screen.getByRole('button', { name: 'Expand Kai Buhler' }));
      await screen.findByText('Meeting with Wolfgang');
    };

    it('starts closed, and loads nothing until a group is opened', () => {
      renderList();
      expect(screen.getByRole('button', { name: 'Expand Kai Buhler' })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
      expect(mocks.getTimeLogs).not.toHaveBeenCalled();
    });

    it("loads the group's entries with the page's filters, narrowed to the group", async () => {
      renderList({
        groupBy: 'member',
        filterRequest: { ...FILTERS, user_ids: ['u-kai', 'u-ush'], search: 'x' },
      });
      await openFirst();
      expect(mocks.getTimeLogs).toHaveBeenCalledTimes(1);
      expect(mocks.getTimeLogs).toHaveBeenCalledWith({
        date_from: '2026-09-14',
        date_to: '2026-09-20',
        search: 'x',
        user_ids: ['u-kai'],
        page: 1,
        page_size: 25,
      });
    });

    it.each<[TimeLogsGroupDimension, string, Record<string, string[]>]>([
      ['member', 'u-kai', { user_ids: ['u-kai'] }],
      ['project', 'p-web', { project_ids: ['p-web'] }],
      ['client', '__no_client__', { client_ids: ['__no_client__'] }],
    ])('narrows a %s group by its own key', async (groupBy, key, narrowing) => {
      renderList({ groupBy, groups: [makeGroup({ group_key: key, group_label: 'Group' })] });
      fireEvent.click(screen.getByRole('button', { name: 'Expand Group' }));
      await waitFor(() => expect(mocks.getTimeLogs).toHaveBeenCalled());
      expect(mocks.getTimeLogs).toHaveBeenCalledWith(expect.objectContaining(narrowing));
    });

    it('shows the entries, with the toggle announcing that it is open', async () => {
      renderList();
      await openFirst();
      expect(screen.getByRole('button', { name: 'Collapse Kai Buhler' })).toHaveAttribute(
        'aria-expanded',
        'true'
      );
      const entries = screen.getByRole('table', { name: 'Entries of Kai Buhler' });
      expect(within(entries).getByText('Sep 17, 2026')).toBeInTheDocument();
      expect(within(entries).getByText('INS-12')).toBeInTheDocument();
      expect(within(entries).getByText('Project Management')).toBeInTheDocument();
      expect(within(entries).getByText('InsolvenzTool MASTER')).toBeInTheDocument();
      expect(within(entries).getByText('Insolvenz GmbH')).toBeInTheDocument();
      expect(within(entries).getByText('1h 30m')).toBeInTheDocument();
      // the toggle points at what it opens
      expect(screen.getByRole('button', { name: 'Collapse Kai Buhler' })).toHaveAttribute(
        'aria-controls',
        entries.id
      );
    });

    it.each<[TimeLogsGroupDimension, string[]]>([
      ['member', ['Date', 'Task ID', 'Task name', 'Project', 'Client', 'Description', 'Duration']],
      ['project', ['Date', 'Task ID', 'Task name', 'Member', 'Client', 'Description', 'Duration']],
      ['client', ['Date', 'Task ID', 'Task name', 'Member', 'Project', 'Description', 'Duration']],
    ])('does not repeat the grouped %s as a column of its entries', async (groupBy, expected) => {
      renderList({ groupBy, groups: [makeGroup({ group_label: 'Group' })] });
      fireEvent.click(screen.getByRole('button', { name: 'Expand Group' }));
      const entries = await screen.findByRole('table', { name: 'Entries of Group' });
      await within(entries).findByText('Meeting with Wolfgang');
      expect(
        within(entries)
          .getAllByRole('columnheader')
          .map(h => h.textContent)
      ).toEqual(expected);
    });

    it('closes again, and a click on the row toggles it exactly once', async () => {
      renderList();
      await openFirst();
      fireEvent.click(screen.getByRole('button', { name: 'Collapse Kai Buhler' }));
      expect(screen.queryByText('Meeting with Wolfgang')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Expand Kai Buhler' })).toBeInTheDocument();

      // the whole row is a target too — but the chevron's click must not toggle twice
      fireEvent.click(document.querySelector('.time-logs-group-row') as HTMLElement);
      expect(await screen.findByText('Meeting with Wolfgang')).toBeInTheDocument();
    });

    it('opens several groups independently', async () => {
      mocks.getTimeLogs.mockImplementation(async (request: { user_ids?: string[] }) =>
        entriesResponse([
          makeEntry({
            id: `log-${request.user_ids?.[0]}`,
            description: `entry of ${request.user_ids?.[0]}`,
          }),
        ])
      );
      renderList({
        groups: [
          makeGroup({ group_key: 'u-1', group_label: 'Ann' }),
          makeGroup({ group_key: 'u-2', group_label: 'Bob' }),
        ],
        totalGroups: 2,
      });
      fireEvent.click(screen.getByRole('button', { name: 'Expand Ann' }));
      fireEvent.click(screen.getByRole('button', { name: 'Expand Bob' }));
      expect(await screen.findByText('entry of u-1')).toBeInTheDocument();
      expect(await screen.findByText('entry of u-2')).toBeInTheDocument();
    });

    it('closes every group when the filters change, so no stale entries stay open', async () => {
      const { rerender, props } = renderList();
      await openFirst();
      rerender(
        <TimeLogsGroupedList {...props} filterRequest={{ ...FILTERS, search: 'new search' }} />
      );
      expect(screen.queryByText('Meeting with Wolfgang')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Expand Kai Buhler' })).toBeInTheDocument();
    });

    it('closes every group on another page', async () => {
      const { rerender, props } = renderList({ totalGroups: 60 });
      await openFirst();
      rerender(<TimeLogsGroupedList {...props} page={2} />);
      expect(screen.queryByText('Meeting with Wolfgang')).not.toBeInTheDocument();
    });

    it('shows a skeleton while the first entries load', () => {
      mocks.getTimeLogs.mockReturnValue(new Promise(() => undefined));
      renderList();
      fireEvent.click(screen.getByRole('button', { name: 'Expand Kai Buhler' }));
      const entries = screen.getByRole('table', { name: 'Entries of Kai Buhler' });
      expect(entries).toHaveAttribute('aria-busy', 'true');
      expect(entries.querySelectorAll('.ant-skeleton').length).toBeGreaterThan(0);
    });

    it('offers "Load more" until every entry is shown, appending each page', async () => {
      const page = (ids: number[], total: number) =>
        entriesResponse(
          ids.map(i => makeEntry({ id: `log-${i}`, description: `entry ${i}` })),
          total
        );
      mocks.getTimeLogs.mockResolvedValueOnce(page([1, 2], 3)).mockResolvedValueOnce(page([3], 3));
      renderList({ groups: [makeGroup({ entry_count: 3 })] });
      fireEvent.click(screen.getByRole('button', { name: 'Expand Kai Buhler' }));
      await screen.findByText('entry 2');
      expect(screen.getByText('Showing 2 of 3 entries')).toBeInTheDocument();

      fireEvent.click(screen.getByRole('button', { name: 'Load more' }));
      await screen.findByText('entry 3');
      // the first page is still there, and the second request asked for page 2
      expect(screen.getByText('entry 1')).toBeInTheDocument();
      expect(mocks.getTimeLogs).toHaveBeenLastCalledWith(expect.objectContaining({ page: 2 }));
      expect(screen.getByText('Showing 3 of 3 entries')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('doesn\'t offer "Load more" when a group\'s entries all fit on the first page', async () => {
      renderList({ groups: [makeGroup({ entry_count: 1 })] });
      await openFirst();
      expect(screen.getByText('Showing 1 of 1 entries')).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Load more' })).not.toBeInTheDocument();
    });

    it('says so, and offers a retry, when the entries cannot be loaded', async () => {
      mocks.getTimeLogs.mockRejectedValueOnce(new Error('boom'));
      renderList();
      fireEvent.click(screen.getByRole('button', { name: 'Expand Kai Buhler' }));
      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load these entries");

      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByText('Meeting with Wolfgang')).toBeInTheDocument();
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('treats a refused response like a failure', async () => {
      mocks.getTimeLogs.mockResolvedValueOnce({ done: false, body: null });
      renderList();
      fireEvent.click(screen.getByRole('button', { name: 'Expand Kai Buhler' }));
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });
  });

  describe('states', () => {
    it('shows skeleton rows (not "nothing logged") while the first response is loading', () => {
      renderList({ groups: [], loading: true, totalGroups: 0, totalEntries: 0, totalSeconds: 0 });
      expect(screen.queryByText('No time logged for these filters')).not.toBeInTheDocument();
      const skeleton = screen.getByRole('status', { name: 'Loading time logs' });
      expect(skeleton).toHaveAttribute('aria-busy', 'true');
      expect(skeleton.querySelectorAll('.ant-skeleton').length).toBeGreaterThan(0);
    });

    it('keeps the current groups on screen, dimmed, while a later response loads', () => {
      renderList({ loading: true });
      expect(screen.getByText('Kai Buhler')).toBeInTheDocument();
      expect(screen.getByRole('list')).toHaveAttribute('aria-busy', 'true');
      expect(screen.queryByRole('status', { name: 'Loading time logs' })).not.toBeInTheDocument();
    });

    it('explains an empty result and offers to clear the filters', () => {
      const onClearFilters = vi.fn();
      renderList({ groups: [], totalGroups: 0, totalEntries: 0, totalSeconds: 0, onClearFilters });
      expect(screen.getByText('No time logged for these filters')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(onClearFilters).toHaveBeenCalledTimes(1);
    });

    it('shows a recoverable error instead of a misleading empty state, and no stale total', () => {
      const { props } = renderList({ failed: true });
      expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the time logs");
      expect(screen.queryByText('Kai Buhler')).not.toBeInTheDocument();
      expect(screen.queryByText('(5.00 h)')).not.toBeInTheDocument();
      expect(screen.getByText('Entries: 0')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(props.onRetry).toHaveBeenCalledTimes(1);
    });
  });

  describe('pagination', () => {
    it('pages the groups, with the same dropdown bar as the table', () => {
      renderList({ totalGroups: 45, pageSize: 20 });
      expect(screen.getByRole('button', { name: 'Rows per page 20' })).toBeInTheDocument();
      expect(screen.getByText('1 – 20 of 45')).toBeInTheDocument();
    });

    it('changes the page size through the menu and returns to page 1', async () => {
      const { props } = renderList({ totalGroups: 120, page: 3 });
      fireEvent.click(screen.getByRole('button', { name: 'Rows per page 20' }));
      fireEvent.click(await screen.findByText('50'));
      expect(props.onPageChange).toHaveBeenCalledWith(1, 50);
    });

    it('insets itself by the same padding as the rows', () => {
      renderList({ totalGroups: 45 });
      const bar = screen.getByText('Rows per page').parentElement!.parentElement as HTMLElement;
      expect(bar.style.paddingLeft).toBe('8px');
      expect(bar.style.paddingRight).toBe('8px');
    });

    it('counts no groups when the load failed', () => {
      renderList({ failed: true, totalGroups: 45 });
      expect(screen.queryByText(/of 45/)).not.toBeInTheDocument();
    });
  });

  describe('scrolling', () => {
    it('is a card capped at the height it is given, with one scrolling element for the rows', () => {
      const { container } = renderList();
      const card = container.querySelector('.time-logs-table') as HTMLElement;
      expect(card).toHaveStyle({ maxHeight: '100%', display: 'flex', flexDirection: 'column' });
      expect(card.style.height).toBe('');
      const area = container.querySelector('.time-logs-groups-scroll') as HTMLElement;
      expect(area).toContainElement(
        document.querySelector('.time-logs-groups-head') as HTMLElement
      );
      expect(area).toContainElement(groupRows()[0]);
    });

    it('hands the theme colours to the sticky cells as CSS variables', () => {
      const { container } = renderList();
      const area = container.querySelector('.time-logs-groups-scroll') as HTMLElement;
      for (const name of [
        '--time-logs-sticky-bg',
        '--time-logs-summary-bg',
        '--time-logs-summary-border',
        '--time-logs-border',
        '--time-logs-hover-bg',
        '--time-logs-billable',
      ]) {
        expect(area.style.getPropertyValue(name)).not.toBe('');
      }
    });
  });
});
