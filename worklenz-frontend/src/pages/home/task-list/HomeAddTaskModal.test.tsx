import {fireEvent, render, screen, waitFor} from '@testing-library/react';
import {beforeEach, describe, expect, it, vi} from 'vitest';
import {ConfigProvider, theme} from 'antd';
import type {IProject} from '@/types/project/project.types';
import HomeAddTaskModal from './HomeAddTaskModal';

const mocks = vi.hoisted(() => ({
  dispatch: vi.fn(),
  projects: {body: [] as IProject[]},
  state: {priorityReducer: {priorities: [{id: 'medium', name: 'Medium'}]}, teamMembersReducer: {teamMembers: {data: []}}},
}));
vi.mock('react-i18next', () => ({useTranslation: () => ({t: (key: string, options?: {defaultValue?: string}) => options?.defaultValue ?? key})}));
vi.mock('@/hooks/useAppDispatch', () => ({useAppDispatch: () => mocks.dispatch}));
vi.mock('@/hooks/useAppSelector', () => ({useAppSelector: (selector: (state: typeof mocks.state) => unknown) => selector(mocks.state)}));
vi.mock('@/hooks/useAuth', () => ({useAuthService: () => ({getCurrentSession: () => null})}));
vi.mock('@/socket/socketContext', () => ({useSocket: () => ({socket: null})}));
vi.mock('@/api/home-page/home-page.api.service', () => ({useGetProjectsByTeamQuery: () => ({data: mocks.projects})}));
vi.mock('@/features/taskAttributes/taskPrioritySlice', () => ({fetchPriorities: vi.fn()}));
vi.mock('@/features/team-members/team-members.slice', () => ({getTeamMembers: vi.fn()}));
vi.mock('@/features/projects/singleProject/members/projectMembersSlice', () => ({toggleProjectMemberDrawer: vi.fn()}));
vi.mock('@/features/settings/member/memberSlice', () => ({toggleInviteMemberDrawer: vi.fn(), setInviteMemberPrefillEmail: vi.fn()}));
vi.mock('@/api/tasks/tasks.api.service', () => ({tasksApiService: {getTaskListV3: vi.fn()}}));
vi.mock('@/components/common/invite-project-members/InviteProjectMembers', () => ({default: () => null}));
vi.mock('@/components/projects/create-project-modal/create-project-modal', () => ({CreateProjectModal: () => null}));

const projects = [{id: 'p1', name: 'Research &amp; Development'}, {id: 'p2', name: 'Client &#x27;Portal&#x27;'}];
const onClose = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.projects = {body: projects};
});

describe.each(['light', 'dark'])('HomeAddTaskModal project defaults in %s theme', mode => {
  const modal = (defaultProjectId?: string, open = true) => <ConfigProvider theme={{algorithm: mode === 'dark' ? theme.darkAlgorithm : theme.defaultAlgorithm}}>
    <HomeAddTaskModal open={open} defaultDate={null} defaultProjectId={defaultProjectId} onClose={onClose} />
  </ConfigProvider>;

  it('preselects the supplied project and displays its decoded name', async () => {
    render(modal('p2'));
    expect(await screen.findByText("Client 'Portal'", {selector: '.ant-select-selection-item'})).toBeInTheDocument();
    expect(screen.queryByText('Client &#x27;Portal&#x27;')).not.toBeInTheDocument();
  });

  it('selects the first project when projects arrive late without resetting entered text', async () => {
    mocks.projects = {body: []};
    const {rerender} = render(modal());
    fireEvent.change(screen.getByPlaceholderText('Enter task name…'), {target: {value: 'Keep my draft'}});
    mocks.projects = {body: projects};
    rerender(modal());
    expect(await screen.findByText('Research & Development', {selector: '.ant-select-selection-item'})).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter task name…')).toHaveValue('Keep my draft');
  });

  it('preserves the chosen project and draft when options refresh', async () => {
    const {rerender} = render(modal('p2'));
    await screen.findByText("Client 'Portal'", {selector: '.ant-select-selection-item'});
    fireEvent.change(screen.getByPlaceholderText('Enter task name…'), {target: {value: 'Keep my draft'}});
    mocks.projects = {body: [...projects].reverse()};
    rerender(modal('p2'));
    expect(screen.getByText("Client 'Portal'", {selector: '.ant-select-selection-item'})).toBeInTheDocument();
    expect(screen.getByPlaceholderText('Enter task name…')).toHaveValue('Keep my draft');
  });

  it('uses the supplied project when options arrive after opening', async () => {
    mocks.projects = {body: []};
    const {rerender} = render(modal('p2'));
    mocks.projects = {body: projects};
    rerender(modal('p2'));
    await waitFor(() => expect(screen.getByText("Client 'Portal'", {selector: '.ant-select-selection-item'})).toBeInTheDocument());
  });
});
