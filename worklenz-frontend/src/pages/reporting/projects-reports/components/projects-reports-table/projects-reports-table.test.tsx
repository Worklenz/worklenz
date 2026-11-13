import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { setField, setIndex, setOrder } from '@/features/reporting/projectReports/project-reports-slice';
import ProjectsReportsTable from './projects-reports-table';

const { dispatch, reportState } = vi.hoisted(() => ({
  dispatch: vi.fn(),
  reportState: {
    projectList: [], isLoading: false, total: 30, index: 2, pageSize: 10,
    order: '', field: 'name', searchQuery: '', archived: false,
    selectedProjectStatuses: [], selectedProjectHealths: [], selectedProjectCategories: [],
    selectedProjectManagers: [], selectedClients: [], selectedProjectPriorities: [], teams: [],
  },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (select: (state: unknown) => unknown) => select({
    projectReportsReducer: reportState,
    projectStatusesReducer: { projectStatuses: [], loading: false },
    projectReportsTableColumnsReducer: {
      name: true, lastActivity: true, status: true, priority: true, daysLeft: true,
      projectHealth: true, category: true, projectUpdate: true, client: true,
      team: true, projectManager: true,
    },
  }),
}));
vi.mock('@/socket/socketContext', () => ({ useSocket: () => ({ socket: null, connected: false }) }));
vi.mock('@/hooks/useProjectRoomSync', () => ({ useProjectRoomSync: vi.fn() }));
vi.mock('@/features/reporting/projectReports/projectReportsDrawer/ProjectReportsDrawer', () => ({ default: () => null }));

describe('project report server sorting', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    reportState.field = 'name';
    reportState.order = '';
  });

  it.each([
    ['projectColumn', 'name'], ['lastActivityColumn', 'last_activity'],
    ['statusColumn', 'status_name'], ['priorityColumn', 'priority_name'],
    ['daysLeftColumn', 'days_left'], ['projectHealthColumn', 'health_name'],
    ['categoryColumn', 'category_name'], ['projectUpdateColumn', 'comment'],
    ['clientColumn', 'client'], ['teamColumn', 'team_name'],
    ['projectManagerColumn', 'project_manager_name'],
  ])('sends %s sorting to the server and returns to page one', (label, field) => {
    render(<ProjectsReportsTable />);
    dispatch.mockClear();

    const header = screen.getAllByText(label).map(node => node.closest('th')).find(Boolean);
    expect(header).toBeTruthy();
    fireEvent.click(header!);

    expect(dispatch).toHaveBeenCalledWith(setField(field));
    expect(dispatch).toHaveBeenCalledWith(setOrder('ascend'));
    expect(dispatch).toHaveBeenCalledWith(setIndex(1));
  });

  it('preserves page navigation without changing the sort', () => {
    reportState.field = 'health_name';
    reportState.order = 'descend';
    render(<ProjectsReportsTable />);
    dispatch.mockClear();
    fireEvent.click(screen.getByTitle('3'));
    expect(dispatch).toHaveBeenCalledWith(setIndex(3));
    expect(dispatch).not.toHaveBeenCalledWith(setIndex(1));
    expect(dispatch.mock.calls.some(([action]) => action?.type === setField.type)).toBe(false);
  });

  it('clears an active sort and resets to the first page', () => {
    reportState.field = 'health_name';
    reportState.order = 'descend';
    render(<ProjectsReportsTable />);
    dispatch.mockClear();

    const header = screen.getAllByText('projectHealthColumn')
      .map(node => node.closest('th')).find(Boolean);
    fireEvent.click(header!);

    expect(dispatch).toHaveBeenCalledWith(setField('name'));
    expect(dispatch).toHaveBeenCalledWith(setOrder(''));
    expect(dispatch).toHaveBeenCalledWith(setIndex(1));
  });
});
