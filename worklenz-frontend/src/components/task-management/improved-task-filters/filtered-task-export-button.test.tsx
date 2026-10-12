import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/shared/antd-imports', () => ({
  Button: ({
    children,
    onClick,
    disabled,
    loading,
    ...rest
  }: {
    children?: React.ReactNode;
    onClick?: () => void;
    disabled?: boolean;
    loading?: boolean;
    'aria-label'?: string;
  }) => (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled || loading}
      aria-label={rest['aria-label']}
    >
      {children}
    </button>
  ),
  Tooltip: ({ children }: { children?: React.ReactNode }) => <>{children}</>,
  ExportOutlined: () => null,
}));

const mockCreateFiltered = vi.fn();
const mockDownloadBlobFile = vi.fn();
const mockIsOwnerOrAdmin = vi.fn(() => true);
const mockIsProjectManager = vi.fn(() => false);
const mockAuthRole = vi.fn(() => 'Member');
const mockGetCurrentSession = vi.fn(() => ({
  subscription_type: 'PADDLE',
  plan_name: 'Business Plan',
}));
const mockHasBusinessFeatureAccess = vi.fn((..._args: unknown[]) => true);
const mockDispatch = vi.fn();
const mockToggleUpgradeModal = vi.fn(() => ({ type: 'upgrade/toggle' }));

vi.mock('@/api/projects/task-export.api.service', () => ({
  taskExportApiService: {
    createFiltered: (...args: unknown[]) => mockCreateFiltered(...args),
  },
  downloadBlobFile: (...args: unknown[]) => mockDownloadBlobFile(...args),
}));

vi.mock('@/hooks/useAppDispatch', () => ({
  useAppDispatch: () => mockDispatch,
}));

vi.mock('@/features/admin-center/admin-center.slice', () => ({
  toggleUpgradeModal: () => mockToggleUpgradeModal(),
}));

vi.mock('@/hooks/useAuth', () => ({
  useAuthService: () => ({
    isOwnerOrAdmin: () => mockIsOwnerOrAdmin(),
    getCurrentSession: () => mockGetCurrentSession(),
    get role() {
      return mockAuthRole();
    },
  }),
}));

vi.mock('@/utils/subscription-utils', () => ({
  hasBusinessFeatureAccess: (...args: unknown[]) =>
    mockHasBusinessFeatureAccess(...args),
}));

vi.mock('@/hooks/useIsProjectManager', () => ({
  default: () => mockIsProjectManager(),
}));

vi.mock('@/services/alerts/alertService', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('@/utils/errorLogger', () => ({
  default: { error: vi.fn() },
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, opts?: { defaultValue?: string }) =>
      opts?.defaultValue ?? _key,
  }),
}));

let mockState: {
  projectReducer: { projectId: string | null };
  taskManagement: { groups: Array<{ taskIds?: string[] }> };
  enhancedKanbanReducer: {
    taskGroups: Array<{
      tasks?: Array<{ id?: string; sub_tasks?: Array<{ id?: string }> }>;
    }>;
  };
};

vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (state: typeof mockState) => unknown) =>
    selector(mockState),
}));

import {
  FilteredTaskExportButton,
  selectBoardFilteredTaskIds,
  selectListFilteredTaskIds,
} from './filtered-task-export-button';
import { canAccessTaskExport } from '@/utils/task-export-access';

describe('canAccessTaskExport (TE-33 UI gate)', () => {
  it('allows owner/admin, project manager, or team lead only with Business plan', () => {
    expect(canAccessTaskExport(false, false)).toBe(false);
    expect(canAccessTaskExport(true, false)).toBe(false);
    expect(canAccessTaskExport(false, true)).toBe(false);
    expect(canAccessTaskExport(false, false, true)).toBe(false);
    expect(canAccessTaskExport(true, false, false, true)).toBe(true);
    expect(canAccessTaskExport(false, true, false, true)).toBe(true);
    expect(canAccessTaskExport(false, false, true, true)).toBe(true);
  });
});

describe('filtered task id selectors (TE-37)', () => {
  it('selectListFilteredTaskIds matches on-screen list groups (deduped)', () => {
    const ids = selectListFilteredTaskIds({
      taskManagement: {
        groups: [
          { taskIds: ['a', 'b'] },
          { taskIds: ['b', 'c'] },
        ],
      },
    });
    expect(ids).toEqual(['a', 'b', 'c']);
  });

  it('selectBoardFilteredTaskIds includes top-level tasks only (aligned with List)', () => {
    const ids = selectBoardFilteredTaskIds({
      enhancedKanbanReducer: {
        taskGroups: [
          {
            tasks: [
              { id: 't1', sub_tasks: [{ id: 's1' }] },
              { id: 't2' },
            ],
          },
        ],
      },
    });
    expect(ids).toEqual(['t1', 't2']);
  });
});

describe('FilteredTaskExportButton (TE-33 / TE-38 Flows 3–5)', () => {
  beforeEach(() => {
    mockCreateFiltered.mockReset();
    mockDownloadBlobFile.mockReset();
    mockIsOwnerOrAdmin.mockReturnValue(true);
    mockIsProjectManager.mockReturnValue(false);
    mockAuthRole.mockReturnValue('Admin');
    mockHasBusinessFeatureAccess.mockReturnValue(true);
    mockState = {
      projectReducer: { projectId: 'proj-1' },
      taskManagement: {
        groups: [{ taskIds: ['task-1', 'task-2'] }],
      },
      enhancedKanbanReducer: {
        taskGroups: [{ tasks: [{ id: 'board-1' }] }],
      },
    };
  });

  it('Flow 5 — hides Export for non-admin / non-PM / non-team-lead members', () => {
    mockIsOwnerOrAdmin.mockReturnValue(false);
    mockIsProjectManager.mockReturnValue(false);
    mockAuthRole.mockReturnValue('Member');

    const { container } = render(
      <FilteredTaskExportButton position="list" hasActiveFilters />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('shows Export for Free/Pro and opens upgrade modal on click', async () => {
    mockHasBusinessFeatureAccess.mockReturnValue(false);
    const user = userEvent.setup();

    render(<FilteredTaskExportButton position="list" hasActiveFilters />);
    await user.click(screen.getByRole('button', { name: 'Upgrade plan' }));

    expect(mockDispatch).toHaveBeenCalled();
    expect(mockCreateFiltered).not.toHaveBeenCalled();
  });

  it('shows Export for team leads when filters are active', () => {
    mockIsOwnerOrAdmin.mockReturnValue(false);
    mockIsProjectManager.mockReturnValue(false);
    mockAuthRole.mockReturnValue('Team Lead');

    render(<FilteredTaskExportButton position="list" hasActiveFilters />);
    expect(
      screen.getByRole('button', { name: 'Export' })
    ).toBeInTheDocument();
  });

  it('hides Export when no filters are active (List/Board)', () => {
    const { container } = render(
      <FilteredTaskExportButton position="list" hasActiveFilters={false} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('Flow 3 — shows Export on List when filters are active for admins', () => {
    render(<FilteredTaskExportButton position="list" hasActiveFilters />);
    expect(
      screen.getByRole('button', { name: 'Export' })
    ).toBeInTheDocument();
  });

  it('Flow 4 — shows Export on Board when filters are active for admins', () => {
    render(<FilteredTaskExportButton position="board" hasActiveFilters />);
    expect(
      screen.getByRole('button', { name: 'Export' })
    ).toBeInTheDocument();
  });

  it('TE-37 — exports exactly the on-screen filtered task ids', async () => {
    const user = userEvent.setup();
    mockCreateFiltered.mockResolvedValue({
      blob: new Blob(['csv']),
      fileName: 'tasks.csv',
    });

    render(<FilteredTaskExportButton position="list" hasActiveFilters />);
    await user.click(screen.getByRole('button', { name: 'Export' }));

    expect(mockCreateFiltered).toHaveBeenCalledWith('proj-1', [
      'task-1',
      'task-2',
    ]);
    expect(mockDownloadBlobFile).toHaveBeenCalled();
  });

  it('TE-5 — disables Export when filtered count is zero', () => {
    mockState.taskManagement.groups = [{ taskIds: [] }];
    render(<FilteredTaskExportButton position="list" hasActiveFilters />);
    expect(screen.getByRole('button', { name: 'Export' })).toBeDisabled();
  });
});
