import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ExampleTaskRows } from './ExampleTaskRows';

const mocks = vi.hoisted(() => ({ emit: vi.fn(), error: vi.fn(), assign: vi.fn() }));
vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (_: string, options: { defaultValue: string }) => options.defaultValue }) }));
vi.mock('@/shared/antd-imports', () => ({ Input: React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>((props, ref) => <input {...props} ref={ref} />), message: { error: mocks.error } }));
vi.mock('@/hooks/useAppSelector', () => ({ useAppSelector: (selector: (state: object) => unknown) => selector({ priorityReducer: { priorities: [] }, projectReducer: { project: {} } }) }));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ getCurrentSession: () => ({ id: 'user', team_id: 'team' }) }) }));
vi.mock('@/features/task-management/task-list-mode-context', () => ({ UNMAPPED_PHASE_ID: 'unmapped', useTaskListMode: () => 'list' }));
vi.mock('@/utils/assign-task-to-member', () => ({ assignTaskToMember: mocks.assign }));
vi.mock('@/lib/project/software-project', () => ({ isSoftwareProjectType: () => false }));
vi.mock('@/socket/socketContext', () => ({ useSocket: () => ({ connected: true, socket: { timeout: () => ({ emit: mocks.emit }) } }) }));
vi.mock('./EpicColumn', () => ({ EpicColumn: () => <button>Mock epic</button> }));
vi.mock('./PointsColumn', () => ({ PointsColumn: () => null }));
vi.mock('./DatePickerColumn', () => ({ DatePickerColumn: () => null }));
vi.mock('./TaskRowColumns', () => new Proxy({}, { get: (_target, property) => property === 'then' ? undefined : () => <button>Mock control</button> }));

const props = { visibleColumns: [{ id: 'title', width: '200px' }, { id: 'epic', width: '100px' }], groupId: 'g', groupType: 'assignee', groupValue: 'member', groupName: 'Group', groupColor: '', projectId: 'project', onTaskCreated: vi.fn() };

describe('ExampleTaskRows', () => {
  beforeEach(() => vi.clearAllMocks());
  it('keeps the draft on failure and accepts the correlated retry response', () => {
    render(<ExampleTaskRows {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Define project scope/ }));
    const input = screen.getByPlaceholderText('Type task name and press Enter to save');
    fireEvent.change(input, { target: { value: 'My task' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    act(() => mocks.emit.mock.calls[0][2](new Error('timeout'), null));
    expect(input).toHaveValue('My task');
    expect(mocks.error).toHaveBeenCalled();
    fireEvent.keyDown(input, { key: 'Enter' });
    act(() => mocks.emit.mock.calls[0][2](null, { id: 'late-task' }));
    expect(mocks.assign).not.toHaveBeenCalled();
    act(() => mocks.emit.mock.calls[1][2](null, { id: 'own-task' }));
    expect(mocks.assign).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'own-task' }));
    expect(props.onTaskCreated).toHaveBeenCalledWith({ id: 'own-task' }, expect.anything());
  });
  it('assigns the created task after unmount without calling UI callbacks', () => {
    const { unmount } = render(<ExampleTaskRows {...props} />);
    fireEvent.click(screen.getByRole('button', { name: /Define project scope/ }));
    const input = screen.getByPlaceholderText('Type task name and press Enter to save');
    fireEvent.change(input, { target: { value: 'My task' } });
    fireEvent.keyDown(input, { key: 'Enter' });
    unmount();
    act(() => mocks.emit.mock.calls[0][2](null, { id: 'created-task' }));
    expect(mocks.assign).toHaveBeenCalledWith(expect.objectContaining({ taskId: 'created-task' }));
    expect(props.onTaskCreated).not.toHaveBeenCalled();
    act(() => mocks.emit.mock.calls[0][2](null, { id: 'created-task' }));
    expect(mocks.assign).toHaveBeenCalledTimes(1);
  });

  it('makes placeholder controls inert and the title focusable', () => {
    render(<ExampleTaskRows {...props} />);
    const example = screen.getByRole('button', { name: /Define project scope/ });
    example.focus();
    expect(example).toHaveFocus();
    fireEvent.click(example);
    expect(screen.getByPlaceholderText('Type task name and press Enter to save')).toBeInTheDocument();
    expect(screen.getAllByText('Mock epic')[0].parentElement).toHaveProperty('inert', true);
  });
});
