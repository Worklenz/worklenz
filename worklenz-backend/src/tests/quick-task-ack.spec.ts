import { Server, Socket } from 'socket.io';
import { on_quick_task } from '../socket.io/commands/on-quick-task';
import { SocketEvents } from '../socket.io/events';
import { verifyNonGuestProjectAccessSocket } from '../socket.io/authorization';
import { createQuickTaskRecord } from '../shared/create-quick-task-record';
import TasksControllerV2 from '../controllers/tasks-controller-v2';
import { getLoggedInUserIdFromSocket } from '../socket.io/util';

jest.mock('../socket.io/authorization', () => ({
  verifyNonGuestProjectAccessSocket: jest.fn(),
}));

jest.mock('../shared/create-quick-task-record', () => ({
  createQuickTaskRecord: jest.fn(),
}));

jest.mock('../controllers/tasks-controller-v2', () => ({
  __esModule: true,
  default: {
    updateTaskViewModel: jest.fn((task: unknown) => task),
    getTaskCompleteRatio: jest.fn().mockResolvedValue(null),
  },
}));

jest.mock('../socket.io/util', () => ({
  getLoggedInUserIdFromSocket: jest.fn(),
  notifyProjectUpdates: jest.fn(),
  log_error: jest.fn(),
}));

jest.mock('../shared/task-creation-restriction', () => ({
  isTaskCreationRestricted: jest.fn().mockResolvedValue(false),
}));

jest.mock('../services/activity-logs/activity-logs.service', () => ({
  logEndDateChange: jest.fn(),
  logStartDateChange: jest.fn(),
  logStatusChange: jest.fn(),
}));

jest.mock('../services/external-notifications.service', () => ({
  ExternalNotificationsService: { sendExternalNotifications: jest.fn() },
}));

jest.mock('../config/db', () => ({
  __esModule: true,
  default: { query: jest.fn().mockResolvedValue({ rows: [] }) },
}));

const mockVerifyAccess = verifyNonGuestProjectAccessSocket as jest.MockedFunction<
  typeof verifyNonGuestProjectAccessSocket
>;
const mockCreateQuickTask = createQuickTaskRecord as jest.MockedFunction<typeof createQuickTaskRecord>;
const mockGetUserId = getLoggedInUserIdFromSocket as jest.MockedFunction<typeof getLoggedInUserIdFromSocket>;
const mockUpdateTaskViewModel = TasksControllerV2.updateTaskViewModel as jest.MockedFunction<
  typeof TasksControllerV2.updateTaskViewModel
>;

describe('quick task responses', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetUserId.mockReturnValue('user-1');
    mockVerifyAccess.mockResolvedValue(true);
    mockUpdateTaskViewModel.mockImplementation((task: unknown) => task as never);
  });

  it('sends failures only to the request acknowledgement when provided', async () => {
    const emit = jest.fn();
    const acknowledge = jest.fn();
    await on_quick_task(
      {} as Server,
      { emit } as unknown as Socket,
      JSON.stringify({ name: '' }),
      acknowledge
    );
    expect(acknowledge).toHaveBeenCalledWith(null);
    expect(emit).not.toHaveBeenCalled();
  });

  it('preserves the legacy response event for existing callers', async () => {
    const emit = jest.fn();
    await on_quick_task({} as Server, { emit } as unknown as Socket, JSON.stringify({ name: '' }));
    expect(emit).toHaveBeenCalledWith(SocketEvents.QUICK_TASK.toString(), null);
  });

  it('acks and emits successful creates so shared UI handlers still update', async () => {
    const emit = jest.fn();
    const acknowledge = jest.fn();
    const createdTask = { id: 'task-1', name: 'New task', project_id: 'project-1', status: 'todo' };

    mockCreateQuickTask.mockResolvedValue({ rows: [{ task: createdTask }] } as never);

    await on_quick_task(
      {} as Server,
      { emit } as unknown as Socket,
      JSON.stringify({ name: 'New task', project_id: 'project-1' }),
      acknowledge
    );

    expect(acknowledge).toHaveBeenCalledWith(expect.objectContaining({ id: 'task-1' }));
    expect(emit).toHaveBeenCalledWith(
      SocketEvents.QUICK_TASK.toString(),
      expect.objectContaining({ id: 'task-1' })
    );
  });

  it('acks permission failures without emitting when acknowledgement is provided', async () => {
    const emit = jest.fn();
    const acknowledge = jest.fn();
    mockVerifyAccess.mockResolvedValue(false);

    await on_quick_task(
      {} as Server,
      { emit } as unknown as Socket,
      JSON.stringify({ name: 'Blocked', project_id: 'project-1' }),
      acknowledge
    );

    expect(acknowledge).toHaveBeenCalledWith(
      expect.objectContaining({ error: true })
    );
    expect(emit).not.toHaveBeenCalled();
  });
});
