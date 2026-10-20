import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import dayjs from 'dayjs';
import { MemoryRouter, useLocation } from 'react-router-dom';
import { getDatePresetRange } from '@/utils/date-presets';
import { formatResolvedRange } from './components/time-logs/time-logs-filters';
import TimeLogsPage from './time-logs';

const mocks = vi.hoisted(() => ({
  getTimeLogs: vi.fn(),
  getTimeLogGroups: vi.fn(),
  getMembers: vi.fn(),
  getProjects: vi.fn(),
  getPractices: vi.fn(),
  getClients: vi.fn(),
  exportTimeLogs: vi.fn(),
}));

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
    getTimeLogGroups: (...args: unknown[]) => mocks.getTimeLogGroups(...args),
    getMembers: (...args: unknown[]) => mocks.getMembers(...args),
    getProjects: (...args: unknown[]) => mocks.getProjects(...args),
    exportTimeLogs: (...args: unknown[]) => mocks.exportTimeLogs(...args),
  },
}));
vi.mock('@/api/settings/practices/practices.api.service', () => ({
  practicesApiService: { getPractices: (...args: unknown[]) => mocks.getPractices(...args) },
}));

vi.mock('@/api/clients/clients.api.service', () => ({
  clientsApiService: { getClientsLookup: (...args: unknown[]) => mocks.getClients(...args) },
}));

/** Shows the router's current query string, so a test can read what the page wrote to the URL. */
const LocationProbe = () => <div data-testid="search">{useLocation().search}</div>;

const renderPage = (initialUrl = '/') =>
  render(
    <MemoryRouter initialEntries={[initialUrl]}>
      <LocationProbe />
      <TimeLogsPage />
    </MemoryRouter>
  );

const ENTRY = {
  id: 'log-1',
  log_day: '2026-09-17',
  user_id: 'u-kai',
  user_name: 'Kai Buhler',
  avatar_url: null,
  member_status: 'active',
  project_id: 'p1',
  client_id: 'cl1',
  client_name: 'Insolvenz GmbH',
  project_name: 'InsolvenzTool MASTER',
  task_id: 't1',
  task_key: 'INS-12',
  task_name: 'Project Management',
  billable: true,
  time_spent: 5400,
  description: 'Meeting',
};

const pageResponse = (overrides: Record<string, unknown> = {}) => ({
  done: true,
  body: {
    logs: [ENTRY],
    view: 'flat',
    total: 1,
    total_entries: 1,
    total_seconds: 5400,
    page: 1,
    page_size: 20,
    ...overrides,
  },
});

const TASK_ROW = {
  id: 't1',
  log_day: '2026-09-18',
  project_id: 'p1',
  client_id: 'cl1',
  client_name: 'Insolvenz GmbH',
  project_name: 'InsolvenzTool MASTER',
  task_id: 't1',
  task_key: 'INS-12',
  task_name: 'Project Management',
  billable: true,
  time_spent: 12600,
  entry_count: 3,
  description: 'Review • Meeting',
  user_name: 'Kai Buhler, Ushani',
  members: [
    {
      user_id: 'u-kai',
      user_name: 'Kai Buhler',
      avatar_url: null,
      member_status: 'active',
      color_code: '#ee87b4',
    },
    {
      user_id: 'u-ush',
      user_name: 'Ushani',
      avatar_url: null,
      member_status: 'active',
      color_code: '#75c9c8',
    },
  ],
};

const taskViewResponse = () =>
  pageResponse({
    logs: [TASK_ROW],
    view: 'task',
    total: 1,
    total_entries: 3,
    total_seconds: 12600,
  });

const GROUP = {
  group_key: 'u-kai',
  group_label: 'Kai Buhler',
  group_avatar_url: null,
  group_color: '#ee87b4',
  group_status: 'active',
  subtotal: 18000,
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
};

const groupsResponse = (groupBy: string, overrides: Record<string, unknown> = {}) => ({
  done: true,
  body: {
    groups: [GROUP],
    group_by: groupBy,
    total_groups: 1,
    total_entries: 6,
    total_seconds: 18000,
    page: 1,
    page_size: 20,
    ...overrides,
  },
});

const MEMBERS = [
  {
    user_id: 'u-kai',
    name: 'Kai Buhler',
    email: 'kai@x.io',
    avatar_url: null,
    team_member_id: 'tm1',
    is_active: true,
    is_removed: false,
  },
  {
    user_id: 'u-ush',
    name: 'Ushani',
    email: 'u@x.io',
    avatar_url: null,
    team_member_id: 'tm2',
    is_active: true,
    is_removed: false,
  },
  {
    user_id: 'u-tha',
    name: 'Tharindu Nishan',
    email: 't@x.io',
    avatar_url: null,
    team_member_id: 'tm3',
    is_active: false,
    is_removed: false,
  },
  {
    user_id: 'u-oli',
    name: 'Olivia Rose',
    email: 'o@x.io',
    avatar_url: null,
    team_member_id: null,
    is_active: false,
    is_removed: true,
  },
];

const lastListRequest = () =>
  mocks.getTimeLogs.mock.calls[mocks.getTimeLogs.mock.calls.length - 1][0];

const lastGroupsRequest = () =>
  mocks.getTimeLogGroups.mock.calls[mocks.getTimeLogGroups.mock.calls.length - 1][0];

/** Picks an option of the Group by menu. */
const chooseGroupBy = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(screen.getByRole('button', { name: /Group by:/ }));
  await user.click(await screen.findByRole('menuitem', { name: label }));
};

const openFilterPanel = async (user: ReturnType<typeof userEvent.setup>) => {
  await user.click(screen.getByRole('button', { name: /filter/i }));
  return await screen.findByText('Filters');
};

/**
 * A pill's accessible name is its caret icon followed by its label ("caret-down Members").
 * Matching on that also keeps it apart from the sortable "Project"/"Member" table headers.
 */
const pillButton = (label: string) =>
  screen.getByRole('button', { name: new RegExp(`^caret-down\\s+${label}`) });

/** Opens a pill inside the filter panel. */
const openPill = async (user: ReturnType<typeof userEvent.setup>, label: string) => {
  await user.click(pillButton(label));
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getTimeLogs.mockImplementation(async (request: { view?: string }) =>
    request.view === 'task' ? taskViewResponse() : pageResponse()
  );
  mocks.getTimeLogGroups.mockImplementation(async (request: { group_by: string }) =>
    groupsResponse(request.group_by)
  );
  mocks.getMembers.mockResolvedValue({ done: true, body: MEMBERS });
  mocks.getProjects.mockResolvedValue({
    done: true,
    body: [
      { id: 'p1', name: 'InsolvenzTool MASTER' },
      { id: 'p2', name: 'Bug Tracking' },
    ],
  });
  mocks.getClients.mockResolvedValue({
    done: true,
    body: [
      { id: 'cl1', name: 'Insolvenz GmbH' },
      { id: 'cl2', name: 'Ates' },
    ],
  });
  mocks.getPractices.mockResolvedValue({
    done: true,
    body: {
      total: 2,
      data: [
        { id: 'pr1', name: 'Development' },
        { id: 'pr2', name: 'Testing' },
      ],
    },
  });
});

// Several tests drive the filter popover through ~10 real user interactions; that is fast alone
// but can pass the 5s default when the whole suite runs in parallel.
describe('Time Logs page', { timeout: 20000 }, () => {
  it('loads this week by default and shows the entries with their total', async () => {
    renderPage();

    expect(await screen.findByText('Project Management')).toBeInTheDocument();
    const range = getDatePresetRange('this_week')!;
    expect(mocks.getTimeLogs).toHaveBeenCalledWith(
      expect.objectContaining({ date_from: range.from, date_to: range.to, page: 1, page_size: 20 })
    );
    expect(screen.getByText('Total time logged')).toBeInTheDocument();
    expect(screen.getByText('(1.50 h)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Time Logs' })).toBeInTheDocument();
  });

  it('shows the resolved date range next to the title', async () => {
    renderPage();
    await screen.findByText('Project Management');
    const range = getDatePresetRange('this_week')!;
    const text = `${dayjs(range.from).format('MMM D, YYYY')} – ${dayjs(range.to).format('MMM D, YYYY')}`;
    expect(screen.getByText(text)).toBeInTheDocument();
  });

  describe('filters', () => {
    it('lists deactivated and removed members (tagged) alongside active ones', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await openPill(user, 'Members');

      // scoped to the dropdown: "Kai Buhler" is also a row in the table behind it
      const list = within((await screen.findByText('Ushani')).closest('.ant-card') as HTMLElement);
      expect(list.getByText('Kai Buhler')).toBeInTheDocument();
      expect(list.getByText('Tharindu Nishan (Deactivated)')).toBeInTheDocument();
      expect(list.getByText('Olivia Rose (Removed)')).toBeInTheDocument();
    });

    it('searches the member list', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await openPill(user, 'Members');
      await user.type(await screen.findByPlaceholderText('Search...'), 'olivia');

      expect(screen.getByText('Olivia Rose (Removed)')).toBeInTheDocument();
      expect(screen.queryByText('Ushani')).not.toBeInTheDocument();
    });

    it('selects several members and applies them together, back on page 1', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await openPill(user, 'Members');
      await user.click(await screen.findByText('Ushani'));
      await user.click(screen.getByText('Tharindu Nishan (Deactivated)'));
      // nothing is requested until Apply
      const callsBeforeApply = mocks.getTimeLogs.mock.calls.length;
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() =>
        expect(lastListRequest()).toEqual(
          expect.objectContaining({ user_ids: ['u-ush', 'u-tha'], page: 1 })
        )
      );
      expect(mocks.getTimeLogs.mock.calls.length).toBeGreaterThan(callsBeforeApply);
    });

    it('filters by client, including entries whose project has no client', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await openPill(user, 'Client');
      // "Ates" only exists in the options; "Insolvenz GmbH" is also a table cell
      await user.click(await screen.findByText('Ates'));
      await user.click(screen.getByText('No client'));
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() =>
        expect(lastListRequest()).toEqual(
          expect.objectContaining({ client_ids: ['cl2', '__no_client__'], page: 1 })
        )
      );
    });

    it('lists every client of the team to choose from, searchable', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await openPill(user, 'Client');
      const list = within((await screen.findByText('Ates')).closest('.ant-card') as HTMLElement);
      expect(list.getByText('No client')).toBeInTheDocument();
      expect(list.getByText('Insolvenz GmbH')).toBeInTheDocument();

      await user.type(await screen.findByPlaceholderText('Search...'), 'ate');
      expect(list.getByText('Ates')).toBeInTheDocument();
      expect(list.queryByText('Insolvenz GmbH')).not.toBeInTheDocument();
    });

    it('sends the client filter with a filtered export, but not with "all entries"', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await openPill(user, 'Client');
      await user.click(await screen.findByText('Ates'));
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      await waitFor(() => expect(lastListRequest().client_ids).toEqual(['cl2']));

      await user.click(screen.getByRole('button', { name: /Export/ }));
      const filteredGroup = (await screen.findByText('Filtered results')).closest(
        '.ant-dropdown-menu-item-group'
      ) as HTMLElement;
      await user.click(within(filteredGroup).getByText('CSV'));
      expect(mocks.exportTimeLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          mode: 'filtered',
          filters: expect.objectContaining({ client_ids: ['cl2'] }),
        })
      );
    });

    it('combines project, practice (including "No practice") and billable filters', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await openPill(user, 'Project');
      await user.click(await screen.findByText('Bug Tracking'));
      await openPill(user, 'Practice');
      await user.click(await screen.findByText('Development'));
      await user.click(screen.getByText('No practice'));
      await openPill(user, 'Billable');
      // the pill's own list item (not the pill button)
      await user.click(screen.getAllByText('Billable').find(el => el.closest('.ant-list-item'))!);
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() =>
        expect(lastListRequest()).toEqual(
          expect.objectContaining({
            project_ids: ['p2'],
            practice_ids: ['pr1', '__no_practice__'],
            billable: { billable: true, nonBillable: false },
          })
        )
      );
    });

    it('lists the date presets from the shortest period to the longest, current before previous', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await user.click(pillButton('This Week'));
      await screen.findByRole('option', { name: /This Week/ });

      const names = screen
        .getAllByRole('option')
        // each option reads "<preset> <resolved dates>"; keep just the preset name
        .map(option => (option.textContent ?? '').replace(/\s*[A-Z][a-z]{2} \d.*$/, '').trim());
      expect(names).toEqual([
        'Today',
        'Yesterday',
        'This Week',
        'Last Week',
        'Last 7 Days',
        'This Month',
        'Last Month',
        'Last 30 Days',
        'Last 3 Months',
        'All Time',
        'Custom Range',
      ]);
    });

    it('can switch away from "This Week" and back, requesting the start of the week through today', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      const thisWeek = getDatePresetRange('this_week')!;
      const last7Days = getDatePresetRange('last_7_days')!;

      // away: "Last 7 Days" is a different range, so a new request goes out
      await openFilterPanel(user);
      await user.click(pillButton('This Week'));
      await user.click(await screen.findByRole('option', { name: /Last 7 Days/ }));
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      await waitFor(() =>
        expect(lastListRequest()).toEqual(
          expect.objectContaining({ date_from: last7Days.from, date_to: last7Days.to })
        )
      );

      // and back
      await openFilterPanel(user);
      await user.click(pillButton('Last 7 Days'));
      await user.click(await screen.findByRole('option', { name: /This Week/ }));
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      await waitFor(() =>
        expect(lastListRequest()).toEqual(
          expect.objectContaining({ date_from: thisWeek.from, date_to: thisWeek.to })
        )
      );
      expect(thisWeek.to).toBe(dayjs().format('YYYY-MM-DD'));
      // and the page header shows the range it stands for
      const header = screen.getByRole('heading', { name: 'Time Logs' })
        .parentElement as HTMLElement;
      expect(within(header).getByText(formatResolvedRange(thisWeek)!)).toBeInTheDocument();
    });

    it('offers "This Month" and requests the 1st through today', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await user.click(pillButton('This Week'));
      await user.click(await screen.findByRole('option', { name: /This Month/ }));
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      const range = getDatePresetRange('this_month')!;
      await waitFor(() =>
        expect(lastListRequest()).toEqual(
          expect.objectContaining({ date_from: range.from, date_to: range.to })
        )
      );
      expect(range.to).toBe(dayjs().format('YYYY-MM-DD'));
    });

    it('lets "All Time" through with no date bounds', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await user.click(pillButton('This Week'));
      await user.click(await screen.findByRole('option', { name: /All Time/ }));
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      await waitFor(() => expect(lastListRequest().date_from).toBeUndefined());
      expect(lastListRequest().date_to).toBeUndefined();
    });

    it('refetches the member options for the newly applied range', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      const initialMemberCalls = mocks.getMembers.mock.calls.length;

      await openFilterPanel(user);
      await user.click(pillButton('This Week'));
      await user.click(await screen.findByRole('option', { name: /Last Month/ }));
      await user.click(screen.getByRole('button', { name: 'Apply' }));

      const range = getDatePresetRange('last_month')!;
      await waitFor(() =>
        expect(mocks.getMembers).toHaveBeenLastCalledWith({
          date_from: range.from,
          date_to: range.to,
        })
      );
      expect(mocks.getMembers.mock.calls.length).toBeGreaterThan(initialMemberCalls);
    });

    it('forgets a selection that was never applied when the panel is reopened', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await openPill(user, 'Members');
      await user.click(await screen.findByText('Ushani'));
      expect(screen.getByRole('checkbox', { name: 'Ushani' })).toBeChecked();

      // close the panel without applying, then open it again
      await user.click(screen.getByRole('button', { name: /filter/i }));
      await waitFor(() => expect(screen.queryByText('Filters')).not.toBeVisible());
      const requestsBefore = mocks.getTimeLogs.mock.calls.length;
      await openFilterPanel(user);
      await openPill(user, 'Members');

      expect(screen.getByRole('checkbox', { name: 'Ushani' })).not.toBeChecked();
      // and nothing was requested on the way
      expect(mocks.getTimeLogs.mock.calls.length).toBe(requestsBefore);
    });

    it('Clear resets everything to the defaults (this week, no member) immediately', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      const thisWeek = getDatePresetRange('this_week')!;
      const last7Days = getDatePresetRange('last_7_days')!;

      await openFilterPanel(user);
      await user.click(pillButton('This Week'));
      await user.click(await screen.findByRole('option', { name: /Last 7 Days/ }));
      await openPill(user, 'Members');
      await user.click(await screen.findByText('Ushani'));
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      await waitFor(() =>
        expect(lastListRequest()).toEqual(
          expect.objectContaining({
            user_ids: ['u-ush'],
            date_from: last7Days.from,
            date_to: last7Days.to,
          })
        )
      );

      await openFilterPanel(user);
      await user.click(screen.getByRole('button', { name: 'Clear' }));
      await waitFor(() => expect(lastListRequest().user_ids).toBeUndefined());
      expect(lastListRequest()).toEqual(
        expect.objectContaining({ date_from: thisWeek.from, date_to: thisWeek.to })
      );
    });
  });

  describe('search', () => {
    it('is sent to the server (debounced), not filtered in the browser', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      const callsBefore = mocks.getTimeLogs.mock.calls.length;

      await user.type(screen.getByPlaceholderText('Search logs'), 'invoice');
      // still within the debounce window: no request per keystroke
      expect(mocks.getTimeLogs.mock.calls.length).toBe(callsBefore);

      await waitFor(() => expect(lastListRequest().search).toBe('invoice'));
      // a handful of requests at most — never one per character
      expect(mocks.getTimeLogs.mock.calls.length - callsBefore).toBeLessThanOrEqual(2);
    });
  });

  describe('sorting and paging', () => {
    it('sorts server-side and returns to page 1', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await user.click(screen.getByRole('button', { name: 'Duration' }));
      await waitFor(() =>
        expect(lastListRequest()).toEqual(
          expect.objectContaining({ sort_field: 'duration', sort_order: 'asc', page: 1 })
        )
      );
      await user.click(screen.getByRole('button', { name: 'Duration' }));
      await waitFor(() => expect(lastListRequest().sort_order).toBe('desc'));
    });
  });

  describe('export', () => {
    it('exports the filtered results as Excel with the current filters and sort', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await openPill(user, 'Members');
      await user.click(await screen.findByText('Ushani'));
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      await waitFor(() => expect(lastListRequest().user_ids).toEqual(['u-ush']));

      await user.click(screen.getByRole('button', { name: /Export/ }));
      const filteredGroup = (await screen.findByText('Filtered results')).closest(
        '.ant-dropdown-menu-item-group'
      )!;
      await user.click(within(filteredGroup as HTMLElement).getByText('Excel'));

      expect(mocks.exportTimeLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'filtered',
          format: 'xlsx',
          filters: expect.objectContaining({ user_ids: ['u-ush'] }),
        })
      );
    });

    it('exports all entries in the date range as CSV', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await user.click(screen.getByRole('button', { name: /Export/ }));
      const allGroup = (await screen.findByText('All entries in the date range')).closest(
        '.ant-dropdown-menu-item-group'
      )!;
      await user.click(within(allGroup as HTMLElement).getByText('CSV'));

      const range = getDatePresetRange('this_week')!;
      expect(mocks.exportTimeLogs).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'all',
          format: 'csv',
          filters: expect.objectContaining({ date_from: range.from, date_to: range.to }),
        })
      );
    });
  });

  describe('Flat / By task', () => {
    it('opens on Flat and asks for the entries as logged', async () => {
      renderPage();
      await screen.findByText('Project Management');
      expect(screen.getByRole('radio', { name: 'Flat' })).toBeChecked();
      expect(screen.getByRole('radio', { name: 'By task' })).not.toBeChecked();
      expect(lastListRequest().view).toBe('flat');
      expect(screen.getByRole('button', { name: 'Date' })).toBeInTheDocument();
    });

    it('explains each option in a tooltip', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await user.hover(screen.getByRole('radio', { name: 'Flat' }));
      expect(await screen.findByRole('tooltip')).toHaveTextContent(
        'Every time entry on its own row, as it was logged.'
      );
      await user.unhover(screen.getByRole('radio', { name: 'Flat' }));

      await user.hover(screen.getByRole('radio', { name: 'By task' }));
      await waitFor(() =>
        expect(screen.getByRole('tooltip')).toHaveTextContent(
          'One row per task, with the time of all its entries added up.'
        )
      );
    });

    it('By task asks for one row per task, relabels the date column and counts tasks', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await user.click(screen.getByRole('radio', { name: 'By task' }));
      await waitFor(() => expect(lastListRequest().view).toBe('task'));
      expect(await screen.findByText('Review • Meeting')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'By task' })).toBeChecked();
      expect(screen.getByRole('button', { name: 'Last logged' })).toBeInTheDocument();
      expect(screen.getByText('Tasks: 1')).toBeInTheDocument();
      // the whole set's time, summed across the task's entries
      expect(screen.getAllByText('3h 30m').length).toBeGreaterThanOrEqual(1);
    });

    it('does not draw the flat rows under the By task columns while the tasks load', async () => {
      const user = userEvent.setup();
      let resolveTasks: (value: unknown) => void = () => undefined;
      renderPage();
      await screen.findByText('Meeting');

      mocks.getTimeLogs.mockImplementation(
        (request: { view?: string }) =>
          new Promise(resolve => {
            if (request.view === 'task') resolveTasks = resolve;
            else resolve(pageResponse());
          })
      );
      await user.click(screen.getByRole('radio', { name: 'By task' }));
      // the entry of the other view is gone at once, replaced by the loading skeleton
      expect(screen.queryByText('Meeting')).not.toBeInTheDocument();
      expect(screen.getByRole('status', { name: 'Loading time logs' })).toBeInTheDocument();

      resolveTasks(taskViewResponse());
      expect(await screen.findByText('Review • Meeting')).toBeInTheDocument();
    });

    it('goes back to the first page and keeps the filters and the sort', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');

      await openFilterPanel(user);
      await openPill(user, 'Members');
      await user.click(await screen.findByText('Ushani'));
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      await user.click(screen.getByRole('button', { name: 'Duration' }));
      await waitFor(() => expect(lastListRequest().sort_field).toBe('duration'));

      await user.click(screen.getByRole('radio', { name: 'By task' }));
      await waitFor(() => expect(lastListRequest().view).toBe('task'));
      expect(lastListRequest()).toEqual(
        expect.objectContaining({
          user_ids: ['u-ush'],
          sort_field: 'duration',
          sort_order: 'asc',
          page: 1,
        })
      );
    });

    it('can switch back to Flat', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      await user.click(screen.getByRole('radio', { name: 'By task' }));
      await screen.findByText('Review • Meeting');
      await user.click(screen.getByRole('radio', { name: 'Flat' }));
      expect(await screen.findByText('Meeting')).toBeInTheDocument();
      expect(lastListRequest().view).toBe('flat');
      expect(screen.getByRole('button', { name: 'Date' })).toBeInTheDocument();
    });
  });

  describe('Group by', () => {
    it('lists None, Member, Project and Client, and starts on None', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      expect(screen.getByRole('button', { name: /Group by: None/ })).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Group by:/ }));
      const items = await screen.findAllByRole('menuitem');
      expect(items.map(item => item.textContent)).toEqual(['None', 'Member', 'Project', 'Client']);
      expect(items[0]).toHaveClass('ant-dropdown-menu-item-selected');
    });

    it('loads the groups instead of the table, with the same filters and the first page', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      expect(mocks.getTimeLogGroups).not.toHaveBeenCalled();
      const range = getDatePresetRange('this_week')!;

      await chooseGroupBy(user, 'Member');
      await waitFor(() => expect(mocks.getTimeLogGroups).toHaveBeenCalled());
      expect(lastGroupsRequest()).toEqual({
        date_from: range.from,
        date_to: range.to,
        group_by: 'member',
        page: 1,
        page_size: 20,
      });
      expect(await screen.findByText('Total Entries')).toBeInTheDocument();
      expect(screen.getByText('Kai Buhler')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Group by: Member/ })).toBeInTheDocument();
      // the table is gone
      expect(screen.queryByRole('button', { name: 'Task name' })).not.toBeInTheDocument();
      // and the footer totals every group
      expect(screen.getByText('Entries: 6')).toBeInTheDocument();
      // the group's own total, and the same figure as the grand total in the footer
      expect(screen.getAllByText('5h 0m')).toHaveLength(2);
    });

    it.each([
      ['Member', 'member', 'Projects'],
      ['Project', 'project', 'Members'],
      ['Client', 'client', 'Projects'],
    ])('groups by %s', async (label, groupBy, secondary) => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      await chooseGroupBy(user, label);
      await waitFor(() => expect(lastGroupsRequest().group_by).toBe(groupBy));
      expect(await screen.findByText(secondary)).toBeInTheDocument();
    });

    it('stops loading the table while grouped, and the groups while not', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      const listCalls = mocks.getTimeLogs.mock.calls.length;

      await chooseGroupBy(user, 'Project');
      await screen.findByText('Total Entries');
      expect(mocks.getTimeLogs.mock.calls.length).toBe(listCalls);

      const groupCalls = mocks.getTimeLogGroups.mock.calls.length;
      await chooseGroupBy(user, 'None');
      await screen.findByText('Project Management');
      expect(mocks.getTimeLogGroups.mock.calls.length).toBe(groupCalls);
    });

    it('hides the Flat / By task switch while grouped, and brings it back with the chosen view', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      await user.click(screen.getByRole('radio', { name: 'By task' }));
      await screen.findByText('Review • Meeting');

      await chooseGroupBy(user, 'Member');
      await screen.findByText('Total Entries');
      expect(screen.queryByRole('radio', { name: 'Flat' })).not.toBeInTheDocument();
      expect(screen.queryByRole('radio', { name: 'By task' })).not.toBeInTheDocument();

      await chooseGroupBy(user, 'None');
      expect(await screen.findByText('Review • Meeting')).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'By task' })).toBeChecked();
    });

    it('carries the filters and the search into the groups', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      await openFilterPanel(user);
      await openPill(user, 'Members');
      await user.click(await screen.findByText('Ushani'));
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      await chooseGroupBy(user, 'Project');
      await waitFor(() => expect(mocks.getTimeLogGroups).toHaveBeenCalled());
      expect(lastGroupsRequest()).toEqual(
        expect.objectContaining({ user_ids: ['u-ush'], group_by: 'project' })
      );

      await user.type(screen.getByPlaceholderText('Search logs'), 'invoice');
      await waitFor(() => expect(lastGroupsRequest().search).toBe('invoice'));
      expect(lastGroupsRequest().page).toBe(1);
    });

    it('opens a group onto its entries, narrowed to it', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      await chooseGroupBy(user, 'Member');
      await user.click(await screen.findByRole('button', { name: 'Expand Kai Buhler' }));
      await waitFor(() => expect(lastListRequest().user_ids).toEqual(['u-kai']));
      expect(lastListRequest()).toEqual(expect.objectContaining({ page: 1, page_size: 25 }));
      // a group lists its entries as logged, whatever the table's view was
      expect(lastListRequest().view).toBeUndefined();
      expect(await screen.findByText('Meeting')).toBeInTheDocument();
    });

    it('pages the groups', async () => {
      const user = userEvent.setup();
      mocks.getTimeLogGroups.mockImplementation(async (request: { group_by: string }) =>
        groupsResponse(request.group_by, { total_groups: 45 })
      );
      renderPage();
      await screen.findByText('Project Management');
      await chooseGroupBy(user, 'Client');
      await screen.findByText('1 – 20 of 45');

      await user.click(screen.getByRole('button', { name: '2' }));
      await waitFor(() => expect(lastGroupsRequest().page).toBe(2));
    });

    it('goes back to the first page when the grouping changes', async () => {
      const user = userEvent.setup();
      mocks.getTimeLogGroups.mockImplementation(async (request: { group_by: string }) =>
        groupsResponse(request.group_by, { total_groups: 45 })
      );
      renderPage();
      await screen.findByText('Project Management');
      await chooseGroupBy(user, 'Client');
      await screen.findByText('1 – 20 of 45');
      await user.click(screen.getByRole('button', { name: '2' }));
      await waitFor(() => expect(lastGroupsRequest().page).toBe(2));

      await chooseGroupBy(user, 'Project');
      await waitFor(() =>
        expect(lastGroupsRequest()).toEqual(
          expect.objectContaining({ group_by: 'project', page: 1 })
        )
      );
    });

    it('shows a retry when the groups cannot be loaded, and recovers on retry', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      mocks.getTimeLogGroups.mockResolvedValueOnce({ done: false, body: null });
      await chooseGroupBy(user, 'Member');
      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the time logs");

      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByText('Kai Buhler')).toBeInTheDocument();
    });

    it('explains an empty grouping and offers to clear the filters', async () => {
      const user = userEvent.setup();
      mocks.getTimeLogGroups.mockImplementation(async (request: { group_by: string }) =>
        groupsResponse(request.group_by, {
          groups: [],
          total_groups: 0,
          total_entries: 0,
          total_seconds: 0,
        })
      );
      renderPage();
      await screen.findByText('Project Management');
      await user.type(screen.getByPlaceholderText('Search logs'), 'zzz');
      await waitFor(() => expect(lastListRequest().search).toBe('zzz'));
      await chooseGroupBy(user, 'Member');
      expect(await screen.findByText('No time logged for these filters')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Clear filters' }));
      await waitFor(() => expect(lastGroupsRequest().search).toBeUndefined());
    });
  });

  describe('layout in the URL', () => {
    it('opens as the URL says: grouped', async () => {
      renderPage('/?group_by=project&view=task');
      await screen.findByText('Total Entries');
      expect(lastGroupsRequest().group_by).toBe('project');
      expect(screen.getByRole('button', { name: /Group by: Project/ })).toBeInTheDocument();
      expect(mocks.getTimeLogs).not.toHaveBeenCalled();
    });

    it('opens as the URL says: By task', async () => {
      renderPage('/?view=task');
      await screen.findByText('Review • Meeting');
      expect(lastListRequest().view).toBe('task');
      expect(screen.getByRole('radio', { name: 'By task' })).toBeChecked();
    });

    it('falls back to the defaults for a value it does not know', async () => {
      renderPage('/?group_by=task&view=nope');
      await screen.findByText('Project Management');
      expect(screen.getByRole('button', { name: /Group by: None/ })).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Flat' })).toBeChecked();
      expect(mocks.getTimeLogGroups).not.toHaveBeenCalled();
    });

    it('writes the layout to the URL as it changes, keeping other parameters', async () => {
      const user = userEvent.setup();
      renderPage('/?keep=me');
      await screen.findByText('Project Management');
      await waitFor(() =>
        expect(screen.getByTestId('search')).toHaveTextContent('keep=me&group_by=none&view=flat')
      );

      await user.click(screen.getByRole('radio', { name: 'By task' }));
      await waitFor(() => expect(screen.getByTestId('search')).toHaveTextContent('view=task'));
      expect(screen.getByTestId('search')).toHaveTextContent('keep=me');

      await chooseGroupBy(user, 'Client');
      await waitFor(() =>
        expect(screen.getByTestId('search')).toHaveTextContent('group_by=client')
      );
    });
  });

  describe('export follows the layout', () => {
    const exportFiltered = async (user: ReturnType<typeof userEvent.setup>) => {
      await user.click(screen.getByRole('button', { name: /Export/ }));
      const group = (await screen.findByText('Filtered results')).closest(
        '.ant-dropdown-menu-item-group'
      )!;
      await user.click(within(group as HTMLElement).getByText('CSV'));
    };

    it('exports one row per task from the By task view', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      await user.click(screen.getByRole('radio', { name: 'By task' }));
      await screen.findByText('Review • Meeting');
      await user.click(screen.getByRole('button', { name: 'Duration' }));
      await exportFiltered(user);
      expect(mocks.exportTimeLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'task', sortField: 'duration', mode: 'filtered' })
      );
    });

    it('exports the entries as logged from the Flat view', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      await exportFiltered(user);
      expect(mocks.exportTimeLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ view: 'flat' })
      );
    });

    it.each([
      ['Member', 'member'],
      ['Project', 'project'],
      ['Client', 'client'],
    ])(
      'exports the groups, not the entries, from a screen grouped by %s',
      async (label, groupBy) => {
        const user = userEvent.setup();
        renderPage();
        await screen.findByText('Project Management');
        await user.click(screen.getByRole('radio', { name: 'By task' }));
        await user.click(await screen.findByRole('button', { name: 'Duration' }));
        await chooseGroupBy(user, label);
        await screen.findByText('Total Entries');
        await exportFiltered(user);
        const params =
          mocks.exportTimeLogs.mock.calls[mocks.exportTimeLogs.mock.calls.length - 1][0];
        expect(params).toEqual(
          expect.objectContaining({ mode: 'filtered', format: 'csv', groupBy })
        );
        // a table's view and sort mean nothing to a grouped file
        expect(params.view).toBeUndefined();
        expect(params.sortField).toBeUndefined();
        expect(params.sortOrder).toBeUndefined();
        expect(params.filters).toEqual(expect.objectContaining({ date_from: expect.any(String) }));
      }
    );

    it('exports every page of the groups: the request carries the filters, never a page', async () => {
      const user = userEvent.setup();
      mocks.getTimeLogGroups.mockImplementation(async (request: { group_by: string }) =>
        groupsResponse(request.group_by, { total_groups: 45 })
      );
      renderPage();
      await screen.findByText('Project Management');
      await chooseGroupBy(user, 'Member');
      await screen.findByText('1 – 20 of 45');
      await user.click(screen.getByRole('button', { name: '2' }));
      await waitFor(() => expect(lastGroupsRequest().page).toBe(2));

      await exportFiltered(user);
      const params = mocks.exportTimeLogs.mock.calls[mocks.exportTimeLogs.mock.calls.length - 1][0];
      expect(params.groupBy).toBe('member');
      expect(params).not.toHaveProperty('page');
      expect(params.filters).not.toHaveProperty('page');
      expect(params.filters).not.toHaveProperty('page_size');
    });

    it('carries the filters into a grouped export', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      await openFilterPanel(user);
      await openPill(user, 'Members');
      await user.click(await screen.findByText('Ushani'));
      await user.click(screen.getByRole('button', { name: 'Apply' }));
      await chooseGroupBy(user, 'Project');
      await screen.findByText('Total Entries');

      await exportFiltered(user);
      expect(mocks.exportTimeLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({
          groupBy: 'project',
          filters: expect.objectContaining({ user_ids: ['u-ush'] }),
        })
      );
    });

    it('still exports the entries as logged for "All entries in the date range", even when grouped', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      await chooseGroupBy(user, 'Member');
      await screen.findByText('Total Entries');

      await user.click(screen.getByRole('button', { name: /Export/ }));
      const allGroup = (await screen.findByText('All entries in the date range')).closest(
        '.ant-dropdown-menu-item-group'
      )!;
      await user.click(within(allGroup as HTMLElement).getByText('CSV'));
      // the page still names the grouping; the API layer drops it for "all" (see its tests)
      expect(mocks.exportTimeLogs).toHaveBeenLastCalledWith(
        expect.objectContaining({ mode: 'all' })
      );
    });

    it('exports no grouping from the table', async () => {
      const user = userEvent.setup();
      renderPage();
      await screen.findByText('Project Management');
      await exportFiltered(user);
      expect(
        mocks.exportTimeLogs.mock.calls[mocks.exportTimeLogs.mock.calls.length - 1][0].groupBy
      ).toBeUndefined();
    });
  });

  describe('failure and empty states', () => {
    it('shows a retry when the request fails, and recovers on retry', async () => {
      const user = userEvent.setup();
      mocks.getTimeLogs.mockResolvedValueOnce({ done: false, body: null });
      renderPage();

      expect(await screen.findByRole('alert')).toHaveTextContent("Couldn't load the time logs");
      await user.click(screen.getByRole('button', { name: 'Retry' }));
      expect(await screen.findByText('Project Management')).toBeInTheDocument();
    });

    it('treats a rejected request the same way', async () => {
      mocks.getTimeLogs.mockRejectedValueOnce(new Error('network'));
      renderPage();
      expect(await screen.findByRole('alert')).toBeInTheDocument();
    });

    it('explains an empty result', async () => {
      mocks.getTimeLogs.mockResolvedValue(pageResponse({ logs: [], total: 0, total_seconds: 0 }));
      renderPage();
      expect(await screen.findByText('No time logged for these filters')).toBeInTheDocument();
      expect(screen.getByText('(0.00 h)')).toBeInTheDocument();
    });

    it('survives the member, project, client and practice option requests failing', async () => {
      const user = userEvent.setup();
      mocks.getMembers.mockRejectedValue(new Error('boom'));
      mocks.getProjects.mockRejectedValue(new Error('boom'));
      mocks.getPractices.mockRejectedValue(new Error('boom'));
      mocks.getClients.mockRejectedValue(new Error('boom'));
      renderPage();

      // the table still works, and the pills say why they are empty
      expect(await screen.findByText('Project Management')).toBeInTheDocument();
      await openFilterPanel(user);
      await openPill(user, 'Members');
      expect(await screen.findByText('Could not load the options')).toBeInTheDocument();

      // the Client pill degrades the same way (its message joins the Members one), and the
      // table is unaffected
      await openPill(user, 'Client');
      await waitFor(() =>
        expect(screen.getAllByText('Could not load the options')).toHaveLength(2)
      );
      expect(screen.getByText('Project Management')).toBeInTheDocument();
    });
  });
});
