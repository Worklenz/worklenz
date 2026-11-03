import React from 'react';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { ConfigProvider, Modal, theme } from 'antd';
import reducer from '@/features/projects/singleProject/task-list-custom-columns/task-list-custom-columns-slice';
import type { ITaskCustomColumn } from '@/types/tasks/task.types';
import CustomColumnFormContent from './custom-column-form-content';

const mocks = vi.hoisted(() => ({ dispatch: vi.fn(), updateColumn: vi.fn() }));
let state: {
  taskListCustomColumnsReducer: ReturnType<typeof reducer>;
  taskManagement: { customColumns: ITaskCustomColumn[] };
};
vi.mock('@/hooks/useAppDispatch', () => ({ useAppDispatch: () => mocks.dispatch }));
vi.mock('@/hooks/useAppSelector', () => ({
  useAppSelector: (selector: (input: typeof state) => unknown) => selector(state),
}));
vi.mock('@/socket/socketContext', () => ({ useSocket: () => ({ socket: null }) }));
vi.mock('@/hooks/useCustomColumnVisibility', () => ({
  useCustomColumnVisibility: () => ({ isHidden: () => false, toggleVisibility: vi.fn() }),
}));
vi.mock('@/shared/antd-imports', async () => ({ ...(await import('antd')), ...(await import('@ant-design/icons')) }));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key }),
}));
vi.mock('@/features/projects/singleProject/taskListColumns/taskColumnsSlice', () => ({ deleteCustomColumn: vi.fn() }));
vi.mock('@/features/task-management/task-management.slice', () => ({
  fetchTasksV3: vi.fn(), fetchTaskListColumns: vi.fn(), addCustomColumn: vi.fn(),
  deleteCustomColumn: vi.fn(), toggleColumnVisibility: vi.fn(),
}));
vi.mock('@/features/tasks/tasks.slice', () => ({ toggleColumnVisibility: vi.fn(), updateCustomColumnPinned: vi.fn() }));
vi.mock('@/api/tasks/tasks-custom-columns.service', () => ({
  tasksCustomColumnsService: { updateCustomColumn: mocks.updateColumn },
}));
vi.mock('../custom-column-header/custom-column-header', () => ({ default: () => null }));
vi.mock('./number-type-column/number-type-column', () => ({ default: () => null }));
vi.mock('./formula-type-column/formula-type-column', () => ({ default: () => null }));
vi.mock('./key-type-column/key-type-column', () => ({ default: () => null }));
vi.mock('./label-type-column/label-type-column', () => ({ default: () => null }));
vi.mock('./selection-type-column/selection-type-column', () => ({ default: () => null }));
vi.mock('./dependent-selection-type-column/dependent-selection-type-column', () => ({ DependentSelectionTypeColumn: () => null }));
vi.mock('./dependent-selection-type-column/new-parent-field-editor', () => ({ NewParentFieldEditor: () => null }));

beforeEach(() => {
  mocks.dispatch.mockClear();
  mocks.updateColumn.mockReset().mockResolvedValue({ done: true });
  state = {
    taskListCustomColumnsReducer: { ...reducer(undefined, { type: 'init' }), canChangeColumnType: true },
    taskManagement: { customColumns: [] },
  };
});
afterEach(() => {
  Modal.destroyAll();
  cleanup();
});

for (const [mode, algorithm] of [['light', theme.defaultAlgorithm], ['dark', theme.darkAlgorithm]] as const) {
  it(`allows creating the first parent field in ${mode} theme`, async () => {
    render(<ConfigProvider theme={{ algorithm }}><CustomColumnFormContent projectId="project" onDone={vi.fn()} /></ConfigProvider>);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    const option = await screen.findByText('+ Create new parent field');
    fireEvent.click(option);
    expect(mocks.dispatch).toHaveBeenCalledWith(expect.objectContaining({
      type: 'taskListCustomColumnsReducer/setParentColumnId', payload: '__new_parent__',
    }));
  });

  it(`disables the parent-field selector for a field with dependents in ${mode} theme`, () => {
    const parent: ITaskCustomColumn = { id: 'parent', key: 'parent', name: 'Parent', custom_column_obj: { fieldType: 'selection' } };
    state.taskManagement.customColumns = [parent,
      { id: 'child', key: 'child', name: 'Child', custom_column_obj: { fieldType: 'selection', parentColumnId: 'parent' } },
      { id: 'other', key: 'other', name: 'Other', custom_column_obj: { fieldType: 'selection' } },
    ];
    Object.assign(state.taskListCustomColumnsReducer, {
      customColumnModalType: 'edit', customColumnId: 'parent', currentColumnData: parent,
    });
    render(<ConfigProvider theme={{ algorithm }}><CustomColumnFormContent projectId="project" onDone={vi.fn()} /></ConfigProvider>);
    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it(`requires both confirmations before changing a column type in ${mode} theme`, async () => {
    const column: ITaskCustomColumn = {
      id: 'column', key: 'column', name: 'Details', custom_column_obj: { fieldType: 'text' },
    };
    state.taskManagement.customColumns = [column];
    Object.assign(state.taskListCustomColumnsReducer, {
      customColumnModalType: 'edit', customColumnId: 'column', currentColumnData: column,
    });
    render(<ConfigProvider theme={{ algorithm }}><CustomColumnFormContent projectId="project" onDone={vi.fn()} /></ConfigProvider>);
    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('customColumns.fieldTypes.number'));
    expect(mocks.updateColumn).not.toHaveBeenCalled();
    fireEvent.click(await screen.findByRole('button', { name: 'Change type' }));
    fireEvent.click(screen.getByRole('button', { name: 'customColumns.modal.updateButton' }));
    const confirmSave = await screen.findByRole('button', { name: 'Update and delete' });
    expect(mocks.updateColumn).not.toHaveBeenCalled();
    fireEvent.click(confirmSave);
    await waitFor(() => expect(mocks.updateColumn).toHaveBeenCalledWith('column', expect.objectContaining({
      field_type: 'number', configuration: expect.objectContaining({ field_type: 'number' }),
    })));
  });
}
