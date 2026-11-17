import React from 'react';
import { renderHook, act } from '@testing-library/react';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import { useTaskListColumns } from './useTaskListColumns';
import taskManagementReducer, { addCustomColumn } from '@/features/task-management/task-management.slice';
import taskManagementFieldsReducer from '@/features/task-management/taskListFields.slice';
import customColumnsReducer from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));

const createTestStore = () => {
  return configureStore({
    reducer: {
      taskManagement: taskManagementReducer,
      taskManagementFields: taskManagementFieldsReducer,
      customColumns: customColumnsReducer,
    },
  });
};

describe('useTaskListColumns', () => {
  const projectId = 'test-proj-1';

  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
  });

  const wrapper = ({ children }: { children: React.ReactNode }) => (
    <Provider store={createTestStore()}>{children}</Provider>
  );

  it('provides default visible columns including essential sticky controls', () => {
    const { result } = renderHook(
      () =>
        useTaskListColumns({
          projectId,
          isBacklogMode: false,
          isSoftwareProject: false,
          scrollContainer: null,
        }),
      { wrapper }
    );

    const columnIds = result.current.visibleColumns.map(col => col.id);
    expect(columnIds).toContain('dragHandle');
    expect(columnIds).toContain('checkbox');
    expect(columnIds).toContain('title');
  });

  it('excludes checkbox column and filters backlog columns in backlog mode', () => {
    const { result } = renderHook(
      () =>
        useTaskListColumns({
          projectId,
          isBacklogMode: true,
          isSoftwareProject: false,
          scrollContainer: null,
        }),
      { wrapper }
    );

    const columnIds = result.current.visibleColumns.map(col => col.id);
    expect(columnIds).not.toContain('checkbox');
    expect(columnIds).toContain('dragHandle');
    expect(columnIds).toContain('title');
  });

  it('allows updating column widths and persists to localStorage', () => {
    const { result } = renderHook(
      () =>
        useTaskListColumns({
          projectId,
          isBacklogMode: false,
          isSoftwareProject: false,
          scrollContainer: null,
        }),
      { wrapper }
    );

    act(() => {
      result.current.setColumnWidths(prev => ({
        ...prev,
        title: '420px',
      }));
    });

    expect(result.current.columnWidths.title).toBe('420px');
    const stored = localStorage.getItem(`worklenz.taskList.columnWidths.${projectId}`);
    expect(stored).toContain('420px');
  });

  it('updates activeColumnId on column drag start', () => {
    const { result } = renderHook(
      () =>
        useTaskListColumns({
          projectId,
          isBacklogMode: false,
          isSoftwareProject: false,
          scrollContainer: null,
        }),
      { wrapper }
    );

    act(() => {
      result.current.handleColumnDragStart({ active: { id: 'priority' } } as any);
    });

    expect(result.current.activeColumnId).toBe('priority');
  });

  it('keeps the table key separate from the UUID used for column settings', () => {
    const id = '4203921e-1b19-440f-a262-f8aee8830023';
    const key = 'P0o-LRyE8wyox0jLHnGvv';
    localStorage.setItem(`worklenz.taskList.columnOrder.${projectId}`, JSON.stringify([key]));
    const store = createTestStore();
    store.dispatch(addCustomColumn({ id, key, name: 'Example', pinned: true, custom_column: true }));
    const { result } = renderHook(
      () => useTaskListColumns({ projectId, isBacklogMode: false, isSoftwareProject: false, scrollContainer: null }),
      { wrapper: ({ children }) => <Provider store={store}>{children}</Provider> }
    );
    const customColumn = result.current.visibleColumns.find(column => column.key === key);
    expect(customColumn).toMatchObject({ id: key, key, uuid: id });
    expect(result.current.visibleColumns.filter(column => column.key === key)).toHaveLength(1);
    act(() => result.current.handleCustomColumnSettings(key));
    expect(store.getState().customColumns.customColumnId).toBe(id);
  });
});
