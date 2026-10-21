import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import type {
  IProgressTrackingList,
  IProgressTrackingProject,
  IProgressTrackingQuery,
} from '@/types/reporting/progress-tracking.types';

const mockGetProjects = vi.fn<(query: IProgressTrackingQuery) => Promise<unknown>>();

vi.mock('@/api/reporting/progress-tracking.api.service', () => ({
  progressTrackingApiService: {
    getProjects: (query: IProgressTrackingQuery) => mockGetProjects(query),
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? key,
  }),
}));

vi.mock('react-router-dom', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('@/hooks/useDoumentTItle', () => ({
  useDocumentTitle: vi.fn(),
}));

vi.mock('@/hooks/useMixpanelTracking', () => ({
  useMixpanelTracking: () => ({ trackMixpanelEvent: vi.fn() }),
}));

vi.mock('@/app/store', () => ({
  useAppSelector: (selector: (state: { themeReducer: { mode: string } }) => unknown) =>
    selector({ themeReducer: { mode: 'light' } }),
}));

vi.mock('@/utils/dateUtils', () => ({
  fromNow: (value: string) => value,
}));

vi.mock('@/utils/errorLogger', () => ({
  default: { error: vi.fn() },
}));

import ProgressTrackingPage from './progress-tracking-page';

const TOTAL_PROJECTS = 45;

const buildProject = (index: number): IProgressTrackingProject => ({
  id: `project-${index}`,
  name: `Project ${index}`,
  client_name: null,
  total_tasks: 0,
  done_tasks: 0,
  percent_complete: null,
  blocked_count: 0,
  confidence: null,
  confidence_note: null,
  confidence_updated_at: null,
  confidence_updated_by_name: null,
  can_edit: false,
});

const buildResponse = (query: IProgressTrackingQuery) => {
  const page = query.page ?? 1;
  const pageSize = query.page_size ?? 20;
  const start = (page - 1) * pageSize;
  const count = Math.max(0, Math.min(pageSize, TOTAL_PROJECTS - start));
  const body: IProgressTrackingList = {
    projects: Array.from({ length: count }, (_value, index) => buildProject(start + index + 1)),
    total: TOTAL_PROJECTS,
    page,
    page_size: pageSize,
    summary: {
      total: TOTAL_PROJECTS,
      on_track: 0,
      at_risk: 0,
      off_track: 0,
      not_set: TOTAL_PROJECTS,
      archived_excluded: 0,
    },
  };
  return { done: true, body };
};

const lastQuery = () => mockGetProjects.mock.calls[mockGetProjects.mock.calls.length - 1][0];

const expectLastQuery = async (expected: Partial<IProgressTrackingQuery>) => {
  await waitFor(() => {
    expect(lastQuery()).toEqual(expect.objectContaining(expected));
  });
};

const getHeader = (name: string) => screen.getByRole('columnheader', { name: new RegExp(name) });

const clickHeader = (name: string) => fireEvent.click(getHeader(name));

const goToPage = (page: number) => {
  fireEvent.click(screen.getByTitle(String(page)));
};

const changePageSize = async (label: string) => {
  const sizeChanger = document.querySelector('.ant-pagination-options .ant-select-selector');
  if (!sizeChanger) throw new Error('Page size changer not rendered');
  fireEvent.mouseDown(sizeChanger);
  const option = await screen.findByTitle(label);
  fireEvent.click(option);
};

const renderPage = async () => {
  render(<ProgressTrackingPage />);
  await screen.findByText('Project 1');
};

describe('ProgressTrackingPage sorting', { timeout: 15000 }, () => {
  beforeEach(() => {
    mockGetProjects.mockReset();
    mockGetProjects.mockImplementation(query => Promise.resolve(buildResponse(query)));
  });

  it('sends the initial request without a sort field and shows no sorted column', async () => {
    await renderPage();

    expect(mockGetProjects).toHaveBeenCalledTimes(1);
    const initialQuery = mockGetProjects.mock.calls[0][0];
    expect(initialQuery.field).toBeUndefined();
    expect(initialQuery.order).toBeUndefined();
    expect(initialQuery).toEqual(expect.objectContaining({ page: 1, page_size: 20 }));

    ['Project', 'Client', '% Complete', 'Blocked', 'Delivery Confidence', 'Last updated'].forEach(name => {
      expect(getHeader(name)).not.toHaveAttribute('aria-sort');
    });
  });

  it.each([
    ['Project', 'name'],
    ['Client', 'client'],
    ['% Complete', 'percent'],
    ['Blocked', 'blocked'],
    ['Delivery Confidence', 'confidence'],
    ['Last updated', 'updated'],
  ] as const)('clears the %s sort on the third header click', async (header, field) => {
    await renderPage();

    clickHeader(header);
    await expectLastQuery({ field, order: 'asc', page: 1 });
    expect(getHeader(header)).toHaveAttribute('aria-sort', 'ascending');

    clickHeader(header);
    await expectLastQuery({ field, order: 'desc', page: 1 });
    expect(getHeader(header)).toHaveAttribute('aria-sort', 'descending');

    clickHeader(header);
    await waitFor(() => {
      expect(lastQuery().field).toBeUndefined();
    });
    expect(lastQuery().order).toBeUndefined();
    expect(getHeader(header)).not.toHaveAttribute('aria-sort');
  });

  it('resets to page 1 when a sort is applied or cleared, and keeps the page while paging a sort', async () => {
    await renderPage();

    goToPage(2);
    await expectLastQuery({ page: 2 });
    expect(lastQuery().field).toBeUndefined();

    clickHeader('Blocked');
    await expectLastQuery({ field: 'blocked', order: 'asc', page: 1 });

    goToPage(2);
    await expectLastQuery({ field: 'blocked', order: 'asc', page: 2 });

    clickHeader('Blocked');
    await expectLastQuery({ field: 'blocked', order: 'desc', page: 1 });

    goToPage(2);
    await expectLastQuery({ field: 'blocked', order: 'desc', page: 2 });

    clickHeader('Blocked');
    await waitFor(() => {
      expect(lastQuery()).toEqual(expect.objectContaining({ page: 1, field: undefined, order: undefined }));
    });

    goToPage(2);
    await expectLastQuery({ page: 2 });
    expect(lastQuery().field).toBeUndefined();
  }, 15000);

  it('resets to page 1 on a page-size change, with and without an active sort', async () => {
    await renderPage();

    goToPage(2);
    await expectLastQuery({ page: 2, page_size: 20 });

    await changePageSize('10 / page');
    await expectLastQuery({ page: 1, page_size: 10 });
    expect(lastQuery().field).toBeUndefined();

    clickHeader('Client');
    await expectLastQuery({ field: 'client', order: 'asc', page: 1, page_size: 10 });

    goToPage(3);
    await expectLastQuery({ field: 'client', order: 'asc', page: 3, page_size: 10 });

    await changePageSize('50 / page');
    await expectLastQuery({ field: 'client', order: 'asc', page: 1, page_size: 50 });
  });

  it('keeps the chosen page size after a sort is cleared', async () => {
    await renderPage();

    await changePageSize('10 / page');
    await expectLastQuery({ page: 1, page_size: 10 });

    clickHeader('Project');
    clickHeader('Project');
    await expectLastQuery({ field: 'name', order: 'desc', page_size: 10 });

    goToPage(2);
    await expectLastQuery({ field: 'name', order: 'desc', page: 2, page_size: 10 });

    clickHeader('Project');
    await waitFor(() => {
      expect(lastQuery()).toEqual(
        expect.objectContaining({ page: 1, page_size: 10, field: undefined, order: undefined })
      );
    });

    const table = screen.getByRole('table');
    expect(within(table).getByText('Project 1')).toBeInTheDocument();
  });
});

describe('ProgressTrackingPage filter buttons and dropdown button', { timeout: 15000 }, () => {
  beforeEach(() => {
    mockGetProjects.mockReset();
    mockGetProjects.mockImplementation(query => Promise.resolve(buildResponse(query)));
  });

  it('renders status filter buttons and dropdown button without round shape and with standard styling', async () => {
    await renderPage();

    const confidenceGroup = screen.getByRole('group', { name: /Delivery Confidence/i });
    const buttons = within(confidenceGroup).getAllByRole('button');
    expect(buttons).toHaveLength(5);

    // Ensure none of the buttons have the obsolete ant-btn-round class
    buttons.forEach(button => {
      expect(button).not.toHaveClass('ant-btn-round');
    });

    const allBtn = screen.getByRole('button', { name: /^All/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');

    const dropdownBtn = screen.getByRole('button', { name: /Percent complete/i });
    expect(dropdownBtn).toBeInTheDocument();
    expect(dropdownBtn).not.toHaveClass('ant-btn-round');
    expect(dropdownBtn).toHaveTextContent('Any % complete');
  });

  it('filters by status when clicking status filter buttons and toggles back to all when clicking active status', async () => {
    await renderPage();

    const confidenceGroup = screen.getByRole('group', { name: /Delivery Confidence/i });
    const onTrackBtn = within(confidenceGroup).getByRole('button', { name: /^On track/i });
    fireEvent.click(onTrackBtn);
    await expectLastQuery({ confidence: 'green', page: 1 });
    expect(onTrackBtn).toHaveAttribute('aria-pressed', 'true');

    // Clicking an active status again toggles it off back to 'all'
    fireEvent.click(onTrackBtn);
    await expectLastQuery({ confidence: undefined, page: 1 });
    const allBtn = within(confidenceGroup).getByRole('button', { name: /^All/i });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
    expect(onTrackBtn).toHaveAttribute('aria-pressed', 'false');

    const atRiskBtn = within(confidenceGroup).getByRole('button', { name: /^At risk/i });
    fireEvent.click(atRiskBtn);
    await expectLastQuery({ confidence: 'amber', page: 1 });
    expect(atRiskBtn).toHaveAttribute('aria-pressed', 'true');
    expect(allBtn).toHaveAttribute('aria-pressed', 'false');

    fireEvent.click(allBtn);
    await expectLastQuery({ confidence: undefined, page: 1 });
    expect(allBtn).toHaveAttribute('aria-pressed', 'true');
  });

  it('filters by percent range using the dropdown button and clears it', async () => {
    await renderPage();

    const dropdownBtn = screen.getByRole('button', { name: /Percent complete/i });
    fireEvent.click(dropdownBtn);

    const option = await screen.findByText('0–25%');
    fireEvent.click(option);

    await expectLastQuery({ percent_range: '0_25', page: 1 });
    expect(dropdownBtn).toHaveTextContent('Percent complete: 0–25%');

    // Click clear icon to reset percent range
    const clearIcon = screen.getByRole('img', { name: /Any % complete/i });
    fireEvent.click(clearIcon);

    await expectLastQuery({ percent_range: undefined, page: 1 });
    expect(dropdownBtn).toHaveTextContent('Any % complete');
  });
});
