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
vi.mock('@/shared/antd-imports', async () => ({
  ...(await import('antd')),
  ...(await import('@ant-design/icons')),
}));
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, options?: { defaultValue?: string }) => options?.defaultValue || key,
  }),
}));
vi.mock('@/features/projects/singleProject/taskListColumns/taskColumnsSlice', () => ({
  deleteCustomColumn: vi.fn(),
}));
vi.mock('@/features/task-management/task-management.slice', () => ({
  fetchTasksV3: vi.fn(),
  fetchTaskListColumns: vi.fn(),
  addCustomColumn: vi.fn(),
  deleteCustomColumn: vi.fn(),
  toggleColumnVisibility: vi.fn(),
}));
vi.mock('@/features/tasks/tasks.slice', () => ({
  toggleColumnVisibility: vi.fn(),
  updateCustomColumnPinned: vi.fn(),
}));
vi.mock('@/api/tasks/tasks-custom-columns.service', () => ({
  tasksCustomColumnsService: { updateCustomColumn: mocks.updateColumn },
}));
vi.mock('../custom-column-header/custom-column-header', () => ({ default: () => null }));
vi.mock('./number-type-column/number-type-column', () => ({ default: () => null }));
vi.mock('./formula-type-column/formula-type-column', () => ({ default: () => null }));
vi.mock('./key-type-column/key-type-column', () => ({ default: () => null }));
vi.mock('./label-type-column/label-type-column', () => ({ default: () => null }));
vi.mock('./selection-type-column/selection-type-column', () => ({ default: () => null }));
vi.mock('./dependent-selection-type-column/dependent-selection-type-column', () => ({
  DependentSelectionTypeColumn: () => (
    <div data-testid="dependent-selection-editor">dependent-editor</div>
  ),
}));
vi.mock('./dependent-selection-type-column/new-parent-field-editor', () => ({
  NewParentFieldEditor: () => <div data-testid="new-parent-editor">new-parent-editor</div>,
}));

beforeEach(() => {
  mocks.dispatch.mockClear();
  mocks.updateColumn.mockReset().mockResolvedValue({ done: true });
  state = {
    taskListCustomColumnsReducer: {
      ...reducer(undefined, { type: 'init' }),
      canChangeColumnType: true,
    },
    taskManagement: { customColumns: [] },
  };
});
afterEach(() => {
  Modal.destroyAll();
  cleanup();
});

for (const [mode, algorithm] of [
  ['light', theme.defaultAlgorithm],
  ['dark', theme.darkAlgorithm],
] as const) {
  it(`adds Dependent Selection type and reveals parent field in ${mode} theme`, async () => {
    render(
      <ConfigProvider theme={{ algorithm }}>
        <CustomColumnFormContent projectId="project" onDone={vi.fn()} />
      </ConfigProvider>
    );

    fireEvent.mouseDown(screen.getByRole('combobox'));
    fireEvent.click(await screen.findByText('Dependent Selection (NEW)'));

    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'taskListCustomColumnsReducer/setCustomFieldType',
        payload: 'dependent_selection',
      })
    );
    expect(mocks.dispatch).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'taskListCustomColumnsReducer/setParentColumnId',
        payload: '__new_parent__',
      })
    );
  });

  it(`shows parent field and grouped editor when Dependent Selection is active in ${mode} theme`, () => {
    Object.assign(state.taskListCustomColumnsReducer, {
      customFieldType: 'dependent_selection',
      parentColumnId: 'parent',
    });
    state.taskManagement.customColumns = [
      {
        id: 'parent',
        key: 'department',
        name: 'Department',
        custom_column_obj: {
          fieldType: 'selection',
          selectionsList: [
            { selection_id: 'eng', selection_name: 'Engineering', selection_color: '#1677ff' },
          ],
        },
      },
    ];

    render(
      <ConfigProvider theme={{ algorithm }}>
        <CustomColumnFormContent projectId="project" onDone={vi.fn()} />
      </ConfigProvider>
    );

    expect(screen.getByText('Parent field')).toBeInTheDocument();
    expect(screen.getByTestId('dependent-selection-editor')).toBeInTheDocument();
  });

  it(`shows new-parent editor when creating a parent inline in ${mode} theme`, () => {
    Object.assign(state.taskListCustomColumnsReducer, {
      customFieldType: 'dependent_selection',
      parentColumnId: '__new_parent__',
      newParentField: {
        name: 'Department',
        selections: [
          { selection_id: 'eng', selection_name: 'Engineering', selection_color: '#1677ff' },
        ],
      },
    });

    render(
      <ConfigProvider theme={{ algorithm }}>
        <CustomColumnFormContent projectId="project" onDone={vi.fn()} />
      </ConfigProvider>
    );

    expect(screen.getByTestId('new-parent-editor')).toBeInTheDocument();
    expect(screen.getByTestId('dependent-selection-editor')).toBeInTheDocument();
  });

  it(`disables the parent-field selector for a field with dependents in ${mode} theme`, () => {
    const parent: ITaskCustomColumn = {
      id: 'parent',
      key: 'parent',
      name: 'Parent',
      custom_column_obj: { fieldType: 'selection' },
    };
    state.taskManagement.customColumns = [
      parent,
      {
        id: 'child',
        key: 'child',
        name: 'Child',
        custom_column_obj: { fieldType: 'selection', parentColumnId: 'parent' },
      },
      {
        id: 'other',
        key: 'other',
        name: 'Other',
        custom_column_obj: { fieldType: 'selection' },
      },
    ];
    Object.assign(state.taskListCustomColumnsReducer, {
      customColumnModalType: 'edit',
      customColumnId: 'parent',
      currentColumnData: parent,
      customFieldType: 'selection',
    });
    render(
      <ConfigProvider theme={{ algorithm }}>
        <CustomColumnFormContent projectId="project" onDone={vi.fn()} />
      </ConfigProvider>
    );
    // Type is locked (read-only text), no Parent field for plain Selection parents.
    expect(screen.queryByText('Parent field')).not.toBeInTheDocument();
  });

  it(`saves Dependent Selection as selection with parent_column_id in ${mode} theme`, async () => {
    const parent: ITaskCustomColumn = {
      id: 'parent',
      key: 'department',
      name: 'Department',
      custom_column_obj: {
        fieldType: 'selection',
        selectionsList: [
          { selection_id: 'eng', selection_name: 'Engineering', selection_color: '#1677ff' },
        ],
      },
    };
    const child: ITaskCustomColumn = {
      id: 'child',
      key: 'team',
      name: 'Team',
      custom_column_obj: {
        fieldType: 'selection',
        fieldTitle: 'Team',
        parentColumnId: 'parent',
        selectionsList: [
          {
            selection_id: 'mobile',
            selection_name: 'Mobile',
            selection_color: '#1677ff',
            parent_selection_id: 'eng',
          },
        ],
      },
    };
    state.taskManagement.customColumns = [parent, child];
    Object.assign(state.taskListCustomColumnsReducer, {
      customColumnModalType: 'edit',
      customColumnId: 'child',
      currentColumnData: child,
      customFieldType: 'dependent_selection',
      parentColumnId: 'parent',
      selectionsList: child.custom_column_obj!.selectionsList,
      canChangeColumnType: true,
    });

    render(
      <ConfigProvider theme={{ algorithm }}>
        <CustomColumnFormContent projectId="project" onDone={vi.fn()} />
      </ConfigProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'customColumns.modal.updateButton' }));

    await waitFor(() =>
      expect(mocks.updateColumn).toHaveBeenCalledWith(
        'child',
        expect.objectContaining({
          field_type: 'selection',
          configuration: expect.objectContaining({
            field_type: 'selection',
            parent_column_id: 'parent',
          }),
        })
      )
    );
  });
}
