import { describe, expect, it, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { ITimeLogEntry, ITimeLogTaskRow } from '@/types/reporting/time-logs.types';
import { TimeLogsTable } from './TimeLogsTable';

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: unknown) => unknown) =>
    selector({ themeReducer: { mode: 'light' } }),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: Record<string, unknown> & { defaultValue?: string }) =>
      (options?.defaultValue ?? key).replace(/\{\{(\w+)\}\}/g, (_, name: string) =>
        String(options?.[name] ?? '')
      ),
  }),
}));

const makeLog = (overrides: Partial<ITimeLogEntry> = {}): ITimeLogEntry => ({
  id: 'log-1',
  log_day: '2026-09-17',
  user_id: 'u1',
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
  time_spent: 5400, // 1h 30m
  description: 'Meeting with Wolfgang',
  ...overrides,
});

const makeTaskRow = (overrides: Partial<ITimeLogTaskRow> = {}): ITimeLogTaskRow => ({
  id: 't1',
  log_day: '2026-09-18',
  project_id: 'p1',
  client_id: 'c1',
  client_name: 'Insolvenz GmbH',
  project_name: 'InsolvenzTool MASTER',
  task_id: 't1',
  task_key: 'INS-12',
  task_name: 'Project Management',
  billable: true,
  time_spent: 12600, // 3h 30m, summed over 3 entries
  entry_count: 3,
  description: 'Review • Meeting',
  user_name: 'Kai Buhler, Ushani',
  members: [
    {
      user_id: 'u1',
      user_name: 'Kai Buhler',
      avatar_url: null,
      member_status: 'active',
      color_code: '#ee87b4',
    },
    {
      user_id: 'u2',
      user_name: 'Ushani',
      avatar_url: null,
      member_status: 'active',
      color_code: '#75c9c8',
    },
  ],
  ...overrides,
});

const renderTable = (overrides: Partial<React.ComponentProps<typeof TimeLogsTable>> = {}) => {
  const props: React.ComponentProps<typeof TimeLogsTable> = {
    logs: [makeLog()],
    view: 'flat',
    loading: false,
    failed: false,
    onRetry: vi.fn(),
    total: 1,
    totalSeconds: 5400,
    page: 1,
    pageSize: 20,
    onPageChange: vi.fn(),
    sortField: null,
    sortOrder: 'desc',
    onSortChange: vi.fn(),
    ...overrides,
  };
  return { props, ...render(<TimeLogsTable {...props} />) };
};

// A sortable header is the whole <th> (antd's own sorter), named by its title.
const columnHeader = (name: string) =>
  screen.getByRole('columnheader', { name: new RegExp(`^${name}`) });

describe('TimeLogsTable', () => {
  it('renders each entry with date, member, client, project, task, description and duration', () => {
    renderTable();
    expect(screen.getByText('Sep 17, 2026')).toBeInTheDocument();
    expect(screen.getByText('Kai Buhler')).toBeInTheDocument();
    expect(screen.getByText('Insolvenz GmbH')).toBeInTheDocument();
    expect(screen.getByText('InsolvenzTool MASTER')).toBeInTheDocument();
    expect(screen.getByText('Project Management')).toBeInTheDocument();
    expect(screen.getByText('Meeting with Wolfgang')).toBeInTheDocument();
    // row duration (the footer total is a separate element)
    expect(screen.getAllByText('1h 30m').length).toBeGreaterThanOrEqual(1);
  });

  it('shows a dash for an entry without a description', () => {
    renderTable({ logs: [makeLog({ description: null })] });
    expect(screen.getByText('—')).toBeInTheDocument();
  });

  it('tags deactivated and removed members, but not active ones', () => {
    renderTable({
      logs: [
        makeLog({ id: 'a', user_name: 'Active Anna', member_status: 'active' }),
        makeLog({ id: 'b', user_name: 'Tharindu Nishan', member_status: 'deactivated' }),
        makeLog({ id: 'c', user_name: 'Olivia Rose', member_status: 'removed' }),
      ],
      total: 3,
    });
    expect(screen.getByText('Deactivated')).toBeInTheDocument();
    expect(screen.getByText('Removed')).toBeInTheDocument();
    expect(screen.getAllByText(/Deactivated|Removed/)).toHaveLength(2);
  });

  describe('total row', () => {
    it('shows the total for the whole filtered set in hours/minutes and decimal hours, plus the entry count', () => {
      // 42h 15m across 128 entries, even though only one row is on this page
      renderTable({ total: 128, totalSeconds: 42 * 3600 + 15 * 60 });
      expect(screen.getByText('Total time logged')).toBeInTheDocument();
      expect(screen.getByText('42h 15m')).toBeInTheDocument();
      expect(screen.getByText('(42.25 h)')).toBeInTheDocument();
      expect(screen.getByText('Entries: 128')).toBeInTheDocument();
    });

    it('is exposed as a polite live region so a changed total is announced', () => {
      renderTable({ total: 128, totalSeconds: 42 * 3600 + 15 * 60 });
      const region = screen.getByText('42h 15m').closest('[role="status"]');
      expect(region).toHaveAttribute('aria-live', 'polite');
      expect(region).toHaveTextContent('(42.25 h)');
    });

    describe('alignment with the data rows', () => {
      const cellOf = (text: string) => screen.getByText(text).closest('td') as HTMLTableCellElement;

      it("is the table's summary row, pinned below the scrolling rows", () => {
        renderTable({ total: 128, totalSeconds: 3600 });
        const row = screen.getByText('Total time logged').closest('tr') as HTMLTableRowElement;
        expect(row).not.toBeNull();
        expect(row.closest('.ant-table-summary')).not.toBeNull();
        // outside the scrolling body, so it never scrolls out of view
        expect(row.closest('.ant-table-body')).toBeNull();
      });

      it('puts the total under the Duration column, aligned like the durations above it', () => {
        renderTable({ total: 128, totalSeconds: 42 * 3600 + 15 * 60 });
        const labelCell = cellOf('Total time logged');
        const totalCell = cellOf('42h 15m');
        // the label spans the seven columns before Duration; the total is the last cell
        expect(labelCell.colSpan).toBe(7);
        expect(totalCell).toBe(totalCell.parentElement!.lastElementChild);
        expect(totalCell).toHaveClass('ant-table-cell');
        // left-aligned, like the Duration data cells above it (and every other column)
        const durationCell = screen.getAllByText('1h 30m')[0].closest('td') as HTMLElement;
        expect(durationCell).toHaveClass('ant-table-cell');
        expect(totalCell.style.textAlign).toBe('');
        expect(getComputedStyle(totalCell).textAlign).not.toBe('right');
        expect(getComputedStyle(totalCell).textAlign).toBe(
          getComputedStyle(durationCell).textAlign
        );
      });

      it('starts "Entries" in the first column, left-aligned with the data text', () => {
        renderTable({ total: 128, totalSeconds: 3600 });
        const entriesCell = cellOf('Entries: 128');
        expect(entriesCell).toBe(entriesCell.parentElement!.firstElementChild);
      });
    });

    it('still renders for an empty result', () => {
      renderTable({ logs: [], total: 0, totalSeconds: 0 });
      expect(screen.getByText('0h 0m')).toBeInTheDocument();
      expect(screen.getByText('(0.00 h)')).toBeInTheDocument();
    });
  });

  describe('columns', () => {
    const cellText = (el: Element) => (el.textContent ?? '').replace(/\s+/g, ' ').trim();
    const headerLabels = () => Array.from(document.querySelectorAll('thead th')).map(cellText);

    it('are ordered Date, Task ID, Task name, Member, Project, Client, Description, Duration', () => {
      renderTable();
      expect(headerLabels()).toEqual([
        'Date',
        'Task ID',
        'Task name',
        'Member',
        'Project',
        'Client',
        'Description',
        'Duration',
      ]);
    });

    it('put each value in its own column, in that order', () => {
      renderTable({
        logs: [makeLog({ description: 'Meeting with Wolfgang', client_name: 'Insolvenz GmbH' })],
      });
      const cells = Array.from(document.querySelectorAll('tr.ant-table-row td'));
      expect(cells.map(cellText)).toEqual([
        'Sep 17, 2026',
        'INS-12',
        'Project Management',
        // the member cell also holds the avatar's initial
        expect.stringContaining('Kai Buhler'),
        'InsolvenzTool MASTER',
        'Insolvenz GmbH',
        'Meeting with Wolfgang',
        '1h 30m',
      ]);
    });

    it('keeps the total under Duration, the last column, after the reorder', () => {
      renderTable({ total: 5, totalSeconds: 3600 });
      const labelCell = screen.getByText('Total time logged').closest('td') as HTMLTableCellElement;
      // the label spans the seven columns before Duration; the total is the only cell after it
      expect(labelCell.colSpan).toBe(7);
      expect(labelCell.nextElementSibling).toBe(labelCell.parentElement!.lastElementChild);
    });
  });

  describe('Task ID and Task name columns', () => {
    it("shows each entry's Task ID (project key + number) between Date and Task name", () => {
      renderTable({
        logs: [
          makeLog({ id: 'a', task_key: 'INS-12' }),
          makeLog({ id: 'b', task_key: 'WL-7', task_name: 'Second task' }),
        ],
        total: 2,
      });
      expect(screen.getByText('INS-12')).toBeInTheDocument();
      expect(screen.getByText('WL-7')).toBeInTheDocument();

      const headers = Array.from(document.querySelectorAll('thead th')).map(th =>
        (th.textContent ?? '').replace(/\s+/g, ' ').trim()
      );
      expect(headers.indexOf('Task ID')).toBe(headers.indexOf('Date') + 1);
      expect(headers.indexOf('Task name')).toBe(headers.indexOf('Task ID') + 1);
    });

    it('shows the Task ID and the task name in their own cells, in that order', () => {
      renderTable();
      const row = document.querySelector('tr.ant-table-row') as HTMLElement;
      const cells = Array.from(row.querySelectorAll('td')).map(td => td.textContent);
      expect(cells[1]).toBe('INS-12');
      expect(cells[2]).toBe('Project Management');
    });

    it('shows a dash when an entry has no Task ID', () => {
      renderTable({ logs: [makeLog({ task_key: null, client_name: 'Insolvenz GmbH' })] });
      const row = document.querySelector('tr.ant-table-row') as HTMLElement;
      expect(row.querySelectorAll('td')[1].textContent).toBe('—');
    });

    it('calls the "Task" column "Task name" now', () => {
      renderTable();
      expect(columnHeader('Task name')).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /^Task$/ })).not.toBeInTheDocument();
    });

    it('sorts by Task ID and by task name independently', () => {
      const { props } = renderTable();
      fireEvent.click(columnHeader('Task ID'));
      expect(props.onSortChange).toHaveBeenLastCalledWith('task_key');
      fireEvent.click(columnHeader('Task name'));
      expect(props.onSortChange).toHaveBeenLastCalledWith('task');
    });

    it('reports a Task ID sort to assistive technology', () => {
      renderTable({ sortField: 'task_key', sortOrder: 'desc' });
      expect(columnHeader('Task ID')).toHaveAttribute('aria-sort', 'descending');
      expect(columnHeader('Task name')).not.toHaveAttribute('aria-sort');
    });
  });

  describe('Project column', () => {
    it("shows the project's colour dot before its name", () => {
      const { container } = renderTable({ logs: [makeLog({ project_color: '#ff0000' })] });
      const cell = screen.getByText('InsolvenzTool MASTER').closest('td') as HTMLElement;
      expect(cell.querySelector('.ant-badge-status-dot')).toHaveStyle({ background: '#ff0000' });
      expect(container.querySelectorAll('.ant-badge-status-dot').length).toBeGreaterThan(0);
    });
  });

  describe('opening a task from its name', () => {
    it('opens the task with its project when the task name is clicked', () => {
      const onOpenTask = vi.fn();
      renderTable({ onOpenTask });
      fireEvent.click(screen.getByRole('button', { name: 'Open task Project Management' }));
      expect(onOpenTask).toHaveBeenCalledWith('t1', 'p1');
    });

    it('opens it from the keyboard too', () => {
      const onOpenTask = vi.fn();
      renderTable({ onOpenTask });
      fireEvent.keyDown(screen.getByRole('button', { name: 'Open task Project Management' }), {
        key: 'Enter',
      });
      expect(onOpenTask).toHaveBeenCalledWith('t1', 'p1');
    });

    it('shows an expand icon in the task cell, revealed when the row is hovered', () => {
      renderTable({ onOpenTask: vi.fn() });
      const cell = screen.getByText('Project Management').closest('td') as HTMLElement;
      const icon = cell.querySelector('.anticon-expand-alt') as HTMLElement;
      expect(icon).not.toBeNull();
      expect(icon).toHaveClass('hidden', 'group-hover:flex');
      // the row carries the `group` class the hover relies on
      expect(cell.closest('tr')).toHaveClass('group');
    });

    it('opens a task from a By task row as well', () => {
      const onOpenTask = vi.fn();
      renderTable({ view: 'task', logs: [makeTaskRow()], onOpenTask });
      fireEvent.click(screen.getByRole('button', { name: 'Open task Project Management' }));
      expect(onOpenTask).toHaveBeenCalledWith('t1', 'p1');
    });

    it('is plain text when nothing can open the task', () => {
      renderTable();
      expect(screen.queryByRole('button', { name: /Open task/ })).not.toBeInTheDocument();
      const cell = screen.getByText('Project Management').closest('td') as HTMLElement;
      expect(cell.querySelector('.anticon-expand-alt')).toBeNull();
    });
  });

  describe('Client column', () => {
    it('shows the client of each entry', () => {
      renderTable({
        logs: [
          makeLog({ id: 'a', client_name: 'Insolvenz GmbH' }),
          makeLog({ id: 'b', client_id: 'c2', client_name: 'Ates' }),
        ],
        total: 2,
      });
      expect(screen.getByText('Insolvenz GmbH')).toBeInTheDocument();
      expect(screen.getByText('Ates')).toBeInTheDocument();
    });

    it('shows a dash when the project has no client', () => {
      renderTable({ logs: [makeLog({ client_id: null, client_name: null, description: 'x' })] });
      expect(screen.getByText('—')).toBeInTheDocument();
    });

    it('is sortable', () => {
      const { props } = renderTable();
      fireEvent.click(columnHeader('Client'));
      expect(props.onSortChange).toHaveBeenCalledWith('client');
    });
  });

  describe('Duration column alignment', () => {
    it('is left-aligned, header and data, like every other column', () => {
      renderTable();
      const th = columnHeader('Duration');
      const dateTh = columnHeader('Date');
      const durationCell = screen.getAllByText('1h 30m')[0].closest('td') as HTMLElement;
      const dateCell = screen.getByText('Sep 17, 2026').closest('td') as HTMLElement;
      for (const el of [th, durationCell]) {
        expect(getComputedStyle(el).textAlign).not.toBe('right');
        expect(el.className).not.toContain('ant-table-cell-align-right');
      }
      expect(getComputedStyle(th).textAlign).toBe(getComputedStyle(dateTh).textAlign);
      expect(getComputedStyle(durationCell).textAlign).toBe(getComputedStyle(dateCell).textAlign);
    });

    it("shows antd's sort arrows in the Duration header, as in the other sortable headers", () => {
      renderTable();
      expect(columnHeader('Duration').querySelector('.ant-table-column-sorter')).not.toBeNull();
    });
  });

  describe('sorting', () => {
    const headerOf = (name: string) => columnHeader(name);

    it('reports the sort column and direction to assistive technology (aria-sort)', () => {
      renderTable({ sortField: 'client', sortOrder: 'asc' });
      expect(headerOf('Client')).toHaveAttribute('aria-sort', 'ascending');
      // every other column is simply not the sorted one
      for (const name of ['Date', 'Task ID', 'Task name', 'Member', 'Project', 'Duration']) {
        expect(headerOf(name)).not.toHaveAttribute('aria-sort');
      }
    });

    it('announces a descending sort, and no sort at all when none is active', () => {
      const { unmount } = renderTable({ sortField: 'duration', sortOrder: 'desc' });
      expect(headerOf('Duration')).toHaveAttribute('aria-sort', 'descending');
      unmount();

      renderTable({ sortField: null });
      expect(document.querySelectorAll('thead th[aria-sort]')).toHaveLength(0);
    });

    it('asks to sort by the clicked column', () => {
      const { props } = renderTable();
      fireEvent.click(columnHeader('Duration'));
      expect(props.onSortChange).toHaveBeenCalledWith('duration');
      fireEvent.click(columnHeader('Member'));
      expect(props.onSortChange).toHaveBeenCalledWith('member');
    });

    it('is reachable from the keyboard', () => {
      const { props } = renderTable();
      fireEvent.keyDown(columnHeader('Date'), { key: 'Enter', keyCode: 13 });
      expect(props.onSortChange).toHaveBeenCalledWith('date');
    });

    it('does not offer sorting on the free-text description column', () => {
      renderTable();
      expect(columnHeader('Description').querySelector('.ant-table-column-sorter')).toBeNull();
    });
  });

  describe('layout (the Projects report table)', () => {
    // jsdom does no layout, so these pin the structure that makes the browser behave: a card that
    // fills the height it is given, a table whose body scrolls under a fixed header, and a
    // pagination bar below it.
    const manyLogs = Array.from({ length: 100 }, (_, i) => makeLog({ id: `log-${i}` }));

    it('fills the height it is given, in a bordered rounded card', () => {
      const { container } = renderTable({ logs: manyLogs, total: 100, pageSize: 100 });
      const card = container.firstElementChild as HTMLElement;
      expect(card).toHaveClass('rounded-lg', 'border', 'flex-col');
      expect(card).toHaveStyle({ height: '100%' });
    });

    it('scrolls the rows in the table body, under a fixed header', () => {
      const { container } = renderTable({ logs: manyLogs, total: 100, pageSize: 100 });
      expect(container.querySelector('.ant-table-body')).not.toBeNull();
      expect(container.querySelector('.ant-table-header')).not.toBeNull();
      expect(container.querySelectorAll('tr.ant-table-row')).toHaveLength(100);
    });

    it('keeps the pagination outside the scrolling table', () => {
      const { container } = renderTable({ logs: manyLogs, total: 100, pageSize: 100 });
      const label = screen.getByText('Rows per page:');
      expect(container.querySelector('.ant-table-wrapper')?.contains(label)).toBe(false);
      expect(container.firstElementChild).toContainElement(label);
    });
  });

  describe('pagination (the Projects report bar)', () => {
    it('has a "Rows per page" select and a "start-end of total" summary', () => {
      renderTable({ logs: [makeLog()], total: 15, pageSize: 20 });
      expect(screen.getByLabelText('Rows per page:')).toHaveValue('20');
      expect(screen.getByText('1-15 of 15')).toBeInTheDocument();
    });

    it('changes the page size through the select and returns to page 1', () => {
      const { props } = renderTable({ logs: [makeLog()], total: 120, pageSize: 20, page: 3 });
      fireEvent.change(screen.getByLabelText('Rows per page:'), { target: { value: '50' } });
      expect(props.onPageChange).toHaveBeenCalledWith(1, 50);
    });

    it('offers 10, 20, 50 and 100 rows per page', () => {
      renderTable({ logs: [makeLog()], total: 120, pageSize: 20 });
      const options = Array.from(
        (screen.getByLabelText('Rows per page:') as HTMLSelectElement).options
      ).map(option => option.value);
      expect(options).toEqual(['10', '20', '50', '100']);
    });

    it('jumps to the first and last page', () => {
      const { props } = renderTable({ logs: [makeLog()], total: 120, pageSize: 20, page: 3 });
      fireEvent.click(screen.getByRole('button', { name: 'Last page' }));
      expect(props.onPageChange).toHaveBeenLastCalledWith(6, 20);
      fireEvent.click(screen.getByRole('button', { name: 'First page' }));
      expect(props.onPageChange).toHaveBeenLastCalledWith(1, 20);
    });
  });

  describe('By task view', () => {
    const renderByTask = (overrides: Partial<React.ComponentProps<typeof TimeLogsTable>> = {}) =>
      renderTable({
        view: 'task',
        logs: [makeTaskRow()],
        total: 1,
        totalSeconds: 12600,
        ...overrides,
      });

    it('shows one row per task with its time summed', () => {
      renderByTask();
      expect(screen.getByText('INS-12')).toBeInTheDocument();
      expect(screen.getByText('Project Management')).toBeInTheDocument();
      expect(screen.getByText('Review • Meeting')).toBeInTheDocument();
      // the row's duration, and the same figure as the total in the footer
      expect(screen.getAllByText('3h 30m')).toHaveLength(2);
    });

    it('calls the date column "Last logged", because a row spans several days', () => {
      renderByTask();
      expect(columnHeader('Last logged')).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /^Date/ })).not.toBeInTheDocument();
      expect(screen.getByText('Sep 18, 2026')).toBeInTheDocument();
    });

    it('keeps the flat view\'s header as "Date"', () => {
      renderTable({ view: 'flat' });
      expect(columnHeader('Date')).toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: /^Last logged/ })).not.toBeInTheDocument();
    });

    it('still sorts the date column by the same field', () => {
      const { props } = renderByTask();
      fireEvent.click(columnHeader('Last logged'));
      expect(props.onSortChange).toHaveBeenCalledWith('date');
    });

    it('lists every member of the task as avatars, named for assistive technology', () => {
      renderByTask();
      const members = screen.getByRole('group', { name: 'Kai Buhler, Ushani' });
      expect(members).toBeInTheDocument();
      // avatars only: the names are not printed in the cell
      const cell = members.closest('td') as HTMLElement;
      expect(cell).not.toHaveTextContent('Kai Buhler');
    });

    it('marks a member who is no longer active, so a former member is not mistaken for a current one', () => {
      renderByTask({
        logs: [
          makeTaskRow({
            members: [
              {
                user_id: 'u1',
                user_name: 'Kai Buhler',
                avatar_url: null,
                member_status: 'active',
                color_code: '#ee87b4',
              },
              {
                user_id: 'u3',
                user_name: 'Tharindu Nishan',
                avatar_url: null,
                member_status: 'deactivated',
                color_code: '#75c9c8',
              },
              {
                user_id: 'u4',
                user_name: 'Olivia Rose',
                avatar_url: null,
                member_status: 'removed',
                color_code: '#f5a623',
              },
            ],
          }),
        ],
      });
      expect(
        screen.getByRole('group', {
          name: 'Kai Buhler, Tharindu Nishan (Deactivated), Olivia Rose (Removed)',
        })
      ).toBeInTheDocument();
    });

    it('counts tasks, not entries, in the footer — and pages by them', () => {
      renderByTask({ total: 42, pageSize: 20 });
      expect(screen.getByText('Tasks: 42')).toBeInTheDocument();
      expect(screen.queryByText(/^Entries:/)).not.toBeInTheDocument();
      expect(screen.getByText('1-20 of 42')).toBeInTheDocument();
    });

    it('keeps the flat footer counting entries', () => {
      renderTable({ view: 'flat', total: 42 });
      expect(screen.getByText('Entries: 42')).toBeInTheDocument();
      expect(screen.queryByText(/^Tasks:/)).not.toBeInTheDocument();
    });

    it('has the same columns, in the same order, as the flat view apart from the date label', () => {
      renderByTask();
      const labels = Array.from(document.querySelectorAll('thead th')).map(th =>
        (th.textContent ?? '').replace(/\s+/g, ' ').trim()
      );
      expect(labels).toEqual([
        'Last logged',
        'Task ID',
        'Task name',
        'Member',
        'Project',
        'Client',
        'Description',
        'Duration',
      ]);
    });

    it('shows dashes for a task without a client or descriptions', () => {
      renderByTask({
        logs: [makeTaskRow({ client_id: null, client_name: null, description: null })],
      });
      expect(screen.getAllByText('—')).toHaveLength(2);
    });
  });

  describe('states', () => {
    it('explains an empty result and offers to clear the filters', () => {
      const onClearFilters = vi.fn();
      renderTable({ logs: [], total: 0, totalSeconds: 0, onClearFilters });
      expect(screen.getByText('No time logged for these filters')).toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Clear filters' }));
      expect(onClearFilters).toHaveBeenCalledTimes(1);
    });

    it('does not offer "Clear filters" when nothing is narrowing the result', () => {
      renderTable({ logs: [], total: 0, totalSeconds: 0 });
      expect(screen.queryByRole('button', { name: 'Clear filters' })).not.toBeInTheDocument();
    });

    it('shows a recoverable error instead of a misleading empty state', () => {
      const { props } = renderTable({
        failed: true,
        logs: [makeLog()],
        total: 1,
        totalSeconds: 5400,
      });
      expect(screen.getByRole('alert')).toHaveTextContent("Couldn't load the time logs");
      expect(screen.queryByText('Kai Buhler')).not.toBeInTheDocument();
      expect(screen.queryByText('No time logged for these filters')).not.toBeInTheDocument();
      // no stale total next to an error
      expect(screen.getByText('—')).toBeInTheDocument();
      expect(screen.queryByText('(1.50 h)')).not.toBeInTheDocument();
      fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
      expect(props.onRetry).toHaveBeenCalledTimes(1);
    });

    it('shows skeleton rows (not "nothing logged") while the first response is loading', () => {
      renderTable({ logs: [], loading: true, total: 0, totalSeconds: 0 });
      expect(screen.queryByText('No time logged for these filters')).not.toBeInTheDocument();
      const skeleton = screen.getByRole('status', { name: 'Loading time logs' });
      expect(skeleton).toHaveAttribute('aria-busy', 'true');
      expect(skeleton.querySelectorAll('.ant-skeleton').length).toBeGreaterThan(0);
    });

    it('keeps the current rows on screen while a later response loads', () => {
      renderTable({ loading: true });
      expect(screen.getByText('Project Management')).toBeInTheDocument();
      expect(screen.queryByRole('status', { name: 'Loading time logs' })).not.toBeInTheDocument();
    });
  });
});
