import React, { Profiler } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { configureStore } from '@reduxjs/toolkit';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import taskReducer, { setPriorities } from '@/features/tasks/tasks.slice';
import taskManagement from '@/features/task-management/task-management.slice';
import enhancedKanbanReducer from '@/features/enhanced-kanban/enhanced-kanban.slice';
import grouping from '@/features/task-management/grouping.slice';

const mocks = vi.hoisted(() => ({ refresh: vi.fn(), statusMount: vi.fn(), phaseMount: vi.fn() }));
vi.mock('@/hooks/useFilterDataLoader', () => ({
  useFilterDataLoader: () => ({ refreshFilterData: mocks.refresh }),
}));
vi.mock('@/hooks/useAuth', () => ({ useAuthService: () => ({ isOwnerOrAdmin: () => true }) }));
vi.mock('@/hooks/useIsProjectManager', () => ({ default: () => false }));
vi.mock('@/i18n', () => ({
  default: { t: (_key: string, options: { defaultValue: string }) => options.defaultValue },
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (_key: string, options: { defaultValue: string }) => options.defaultValue,
  }),
}));
vi.mock('@/components/task-management/assignee-scope-indicator', () => ({ default: () => null }));
vi.mock('./fields-dropdown', () => ({ FieldsDropdown: () => null }));
vi.mock('./filter-dropdown', () => ({ FilterDropdown: () => null }));
vi.mock('./sort-dropdown', () => ({ SortDropdown: () => null }));
vi.mock('./search-filter', () => ({ SearchFilter: () => null }));
vi.mock('./software-quick-filter-chips', () => ({ SoftwareQuickFilterChips: () => null }));
vi.mock('./filtered-task-export-button', () => ({
  FilteredTaskExportButton: ({ hasActiveFilters }: { hasActiveFilters: boolean }) =>
    hasActiveFilters ? <button>Export</button> : null,
}));
vi.mock('./filters-panel', () => ({
  Filters: ({
    onManageStatus,
    onManagePhase,
  }: {
    onManageStatus: () => void;
    onManagePhase: () => void;
  }) => (
    <>
      <button onClick={onManageStatus}>Manage statuses</button>
      <button onClick={onManagePhase}>Manage phases</button>
    </>
  ),
}));
vi.mock('@/components/task-management/ManageStatusModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    mocks.statusMount();
    return open ? <button onClick={onClose}>Close statuses</button> : null;
  },
}));
vi.mock('@/components/task-management/ManagePhaseModal', () => ({
  default: ({ open, onClose }: { open: boolean; onClose: () => void }) => {
    mocks.phaseMount();
    return open ? <button onClick={onClose}>Close phases</button> : null;
  },
}));

import ImprovedTaskFiltersContainer from './improved-task-filters-container';

const createTestStore = () =>
  configureStore({
    reducer: {
      taskReducer,
      taskManagement,
      enhancedKanbanReducer,
      grouping,
      priorityReducer: () => ({ priorities: [] }),
      boardReducer: () => ({ priorities: [], labels: [], taskAssignees: [] }),
      projectReducer: () => ({ projectId: 'project-1', project: null }),
      taskStatusReducer: () => ({ status: [] }),
      phaseReducer: () => ({ phaseList: [] }),
      themeReducer: () => ({ mode: 'light' }),
      softwareQuickFiltersReducer: () => ({ active: [] }),
    },
  });

const renderToolbar = (store: ReturnType<typeof createTestStore>, onRender = vi.fn()) =>
  render(
    <Provider store={store}>
      <MemoryRouter initialEntries={['/?tab=tasks-list']}>
        <Profiler id="filters" onRender={onRender}>
          <ImprovedTaskFiltersContainer position="list" />
        </Profiler>
      </MemoryRouter>
    </Provider>
  );

describe('task filter toolbar', () => {
  beforeEach(() => vi.clearAllMocks());

  it('shows restored selections in the first commit without follow-up state renders', () => {
    const store = createTestStore();
    store.dispatch(setPriorities(['high', 'low']));
    const onRender = vi.fn();
    renderToolbar(store, onRender);
    expect(screen.getByText('2 Filters Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    expect(onRender).toHaveBeenCalledTimes(1);
  });

  it('updates counts and export eligibility when Redux selections change or clear', () => {
    const store = createTestStore();
    renderToolbar(store);
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    act(() => {
      store.dispatch(setPriorities(['high']));
    });
    expect(screen.getByText('1 Filter Active')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
    act(() => {
      store.dispatch(setPriorities([]));
    });
    expect(screen.queryByText(/Filter Active/)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
  });

  it('clears selections through the toolbar and keeps grouping intact', () => {
    vi.useFakeTimers();
    try {
      const store = createTestStore();
      store.dispatch(setPriorities(['high']));
      renderToolbar(store);
      fireEvent.click(screen.getByRole('button', { name: 'Clear All' }));
      expect(store.getState().taskReducer.priorities).toEqual([]);
      expect(store.getState().grouping.currentGrouping).toBe('status');
      expect(screen.queryByText(/Filter Active/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Export' })).not.toBeInTheDocument();
    } finally {
      vi.clearAllTimers();
      vi.useRealTimers();
    }
  });

  it('mounts each management dialog on first activation and refreshes metadata on close', async () => {
    renderToolbar(createTestStore());
    expect(mocks.statusMount).not.toHaveBeenCalled();
    expect(mocks.phaseMount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Manage statuses' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close statuses' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(1);
    expect(mocks.phaseMount).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Manage phases' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Close phases' }));
    expect(mocks.refresh).toHaveBeenCalledTimes(2);
  });
});
