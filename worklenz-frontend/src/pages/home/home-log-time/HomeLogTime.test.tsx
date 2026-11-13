import {act, fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ConfigProvider, theme} from 'antd';
import type {ReactNode} from 'react';
import type {IMyTask} from '@/types/home/my-tasks.types';
import HomeLogTime from './HomeLogTime';

const mocks = vi.hoisted(() => ({
  getTasks: vi.fn(),
  dispatch: vi.fn(),
  projectId: 'p2',
  state: {
    themeReducer: {mode: 'light'},
    priorityReducer: {priorities: []},
    taskDrawerReducer: {selectedTaskId: undefined, showTaskDrawer: false, taskFormViewModel: undefined},
    taskManagement: {entities: {}},
  },
}));
vi.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string, options?: {defaultValue?: string}) => options?.defaultValue ?? key})}));
vi.mock('react-router-dom', () => ({useNavigate: () => vi.fn()}));
vi.mock('@/hooks/useAppSelector', () => ({useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state)}));
vi.mock('@/hooks/useAppDispatch', () => ({useAppDispatch: () => mocks.dispatch}));
vi.mock('@/hooks/useResponsive', () => ({useResponsive: () => ({isDesktop: true})}));
vi.mock('@/socket/socketContext', () => ({useSocket: () => ({socket: null})}));
vi.mock('@/app/store', () => ({store: {getState: () => mocks.state}}));
vi.mock('@/features/task-drawer/task-drawer.slice', () => ({setSelectedTaskId: vi.fn(), setShowTaskDrawer: vi.fn(), fetchTask: vi.fn(), setNavigationContext: vi.fn(), setTargetDrawerTab: vi.fn()}));
vi.mock('@/features/project/project.slice', () => ({setProjectId: vi.fn()}));
vi.mock('@/features/task-management/task-management.slice', () => ({updateTask: vi.fn()}));
vi.mock('@/features/taskAttributes/taskPrioritySlice', () => ({fetchPriorities: vi.fn()}));
vi.mock('@/api/home-page/home-page.api.service', () => ({useGetProjectsByTeamQuery: () => ({data: {body: [
  {id: 'p1', name: 'Original &amp; project'},
  {id: 'p2', name: 'New project', start_date: '2099-01-01'},
]}})}));
vi.mock('@/api/tasks/task-time-logs.api.service', () => ({taskTimeLogsApiService: {
  getMyTasksInProject: (...args: unknown[]) => mocks.getTasks(...args),
  getMySummary: async () => ({done: true, body: {}}),
  getMyWeeklyBreakdown: async () => ({done: true, body: []}),
  getRecentTimeLogs: async () => ({done: true, body: []}),
}}));
vi.mock('../task-list/HomeAddTaskModal', () => ({default: ({open, defaultProjectId, onTaskCreated, onClose}: {
  open: boolean; defaultProjectId?: string; onTaskCreated: (task: IMyTask) => void; onClose: () => void;
}) => open ? <div role="dialog" data-project={defaultProjectId}>
  <button onClick={() => {onTaskCreated({id: 'new-task', project_id: mocks.projectId, is_task: true, done: false}); onClose();}}>Create task</button>
  <button onClick={onClose}>Cancel creation</button>
</div> : null}));

// Keep the Select contract observable while exercising the real page state and request effects.
vi.mock('@/shared/antd-imports', async importOriginal => {
  const actual = await importOriginal<typeof import('@/shared/antd-imports')>();
  return {...actual, Select: ({options, value, onChange, onSearch, placeholder, disabled, loading, popupRender}: {
    options: {value: string; label: string}[]; value?: string; onChange: (value: string) => void;
    onSearch?: (value: string) => void; placeholder: string; disabled?: boolean; loading?: boolean;
    popupRender?: (menu: ReactNode) => ReactNode;
  }) => <>
    <select aria-label={onSearch ? 'Task' : 'Project'} aria-busy={loading} disabled={disabled} value={value ?? ''} onChange={event => onChange(event.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
    </select>
    {onSearch && <input aria-label="Search tasks" onChange={event => onSearch(event.target.value)} />}
    {popupRender?.(null)}
  </>};
});

const deferred = () => {
  let resolve!: (value: {done: boolean; body: {id: string; name: string}[]}) => void;
  let reject!: (error: Error) => void;
  const promise = new Promise<{done: boolean; body: {id: string; name: string}[]}>((res, rej) => {resolve = res; reject = rej;});
  return {promise, resolve, reject};
};
const openCreation = () => fireEvent.click(screen.getByRole('button', {name: '+ Add New Task'}));
const chooseProject = () => fireEvent.change(screen.getByRole('combobox', {name: 'Project'}), {target: {value: 'p1'}});

beforeEach(() => {
  vi.clearAllMocks();
  mocks.projectId = 'p2';
  mocks.getTasks.mockResolvedValue({done: true, body: []});
});

describe.each(['light', 'dark'])('HomeLogTime task creation in %s theme', mode => {
  const renderPage = () => {
    mocks.state.themeReducer.mode = mode;
    return render(<ConfigProvider theme={{algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm}}><HomeLogTime /></ConfigProvider>);
  };

  it('switches to the created task project and applies its date restrictions', async () => {
    mocks.getTasks.mockResolvedValue({done: true, body: [{id: 'new-task', name: 'Created task'}]});
    renderPage();
    chooseProject();
    await waitFor(() => expect(mocks.getTasks).toHaveBeenCalledWith('p1', undefined));
    openCreation();
    expect(screen.getByRole('dialog')).toHaveAttribute('data-project', 'p1');
    mocks.getTasks.mockClear();
    fireEvent.click(screen.getByRole('button', {name: 'Create task'}));
    await waitFor(() => expect(screen.getByRole('combobox', {name: 'Task'})).toHaveValue('new-task'));
    expect(screen.getByRole('combobox', {name: 'Project'})).toHaveValue('p2');
    expect(mocks.getTasks).toHaveBeenCalledExactlyOnceWith('p2', undefined);
    expect(screen.getByText('Project has not started yet')).toBeInTheDocument();
    expect(screen.getAllByRole('button', {name: 'Log Time'})[0]).toBeDisabled();
  });

  it('refreshes the same project, clears the old search and ignores stale responses', async () => {
    const stale = deferred();
    const fresh = deferred();
    mocks.getTasks.mockResolvedValueOnce({done: true, body: []}).mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise);
    mocks.projectId = 'p1';
    renderPage();
    chooseProject();
    await waitFor(() => expect(mocks.getTasks).toHaveBeenCalledTimes(1));
    fireEvent.change(screen.getByRole('textbox', {name: 'Search tasks'}), {target: {value: 'old search'}});
    await waitFor(() => expect(mocks.getTasks).toHaveBeenCalledWith('p1', 'old search'));
    openCreation();
    fireEvent.click(screen.getByRole('button', {name: 'Create task'}));
    await waitFor(() => expect(mocks.getTasks).toHaveBeenLastCalledWith('p1', undefined));
    await act(async () => {fresh.resolve({done: true, body: [{id: 'new-task', name: 'Created task'}]});});
    await act(async () => {stale.resolve({done: true, body: [{id: 'old-task', name: 'Stale task'}]});});
    expect(screen.getByRole('combobox', {name: 'Task'})).toHaveValue('new-task');
    expect(screen.queryByRole('option', {name: 'Stale task'})).not.toBeInTheDocument();
  });

  it('keeps loading the new project when a stale request fails', async () => {
    const stale = deferred();
    const fresh = deferred();
    mocks.getTasks.mockReturnValueOnce(stale.promise).mockReturnValueOnce(fresh.promise);
    renderPage();
    chooseProject();
    openCreation();
    fireEvent.click(screen.getByRole('button', {name: 'Create task'}));
    await act(async () => {stale.reject(new Error('Old project failed'));});
    expect(screen.getByRole('combobox', {name: 'Task'})).toHaveAttribute('aria-busy', 'true');
    await act(async () => {fresh.resolve({done: true, body: [{id: 'new-task', name: 'Created task'}]});});
    expect(screen.getByRole('combobox', {name: 'Task'})).toHaveValue('new-task');
    expect(screen.getByRole('combobox', {name: 'Task'})).toHaveAttribute('aria-busy', 'false');
  });

  it('does not refresh tasks when task creation is cancelled', async () => {
    renderPage();
    chooseProject();
    await waitFor(() => expect(mocks.getTasks).toHaveBeenCalledTimes(1));
    openCreation();
    fireEvent.click(screen.getByRole('button', {name: 'Cancel creation'}));
    expect(mocks.getTasks).toHaveBeenCalledTimes(1);
  });
});
