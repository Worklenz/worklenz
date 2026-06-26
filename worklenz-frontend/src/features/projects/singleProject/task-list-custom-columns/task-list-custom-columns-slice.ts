import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CustomTableColumnsType } from '../taskListColumns/taskColumnsSlice';
import { LabelType } from '../../../../pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/label-type-column/label-type-column';
import { SelectionType } from '../../../../pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/selection-type-column/selection-type-column';

export type CustomFieldsTypes =
  | 'people'
  | 'text'
  | 'number'
  | 'date'
  | 'selection'
  | 'checkbox'
  | 'labels'
  | 'key'
  | 'formula';

export type CustomFieldNumberTypes = 'formatted' | 'unformatted' | 'percentage' | 'withLabel';

export type ExpressionType = 'add' | 'substract' | 'divide' | 'multiply';

type TaskListCustomColumnsState = {
  isCustomColumnModalOpen: boolean;
  customColumnModalType: 'create' | 'edit';
  customColumnId: string | null;
  currentColumnData: any | null;

  customFieldType: CustomFieldsTypes;
  customFieldNumberType: CustomFieldNumberTypes;
  decimals: number;
  label: string;
  labelPosition: 'left' | 'right';
  previewValue: number;
  expression: ExpressionType;
  firstNumericColumn: CustomTableColumnsType | null;
  secondNumericColumn: CustomTableColumnsType | null;
  labelsList: LabelType[];
  selectionsList: SelectionType[];
  hiddenCustomColumnIds: string[]; // IDs of custom columns the user has hidden
};

const initialState: TaskListCustomColumnsState = {
  isCustomColumnModalOpen: false,
  customColumnModalType: 'create',
  customColumnId: null,
  currentColumnData: null,

  customFieldType: 'text',
  customFieldNumberType: 'formatted',
  decimals: 0,
  label: 'LKR',
  labelPosition: 'left',
  previewValue: 100,
  expression: 'add',
  firstNumericColumn: null,
  secondNumericColumn: null,
  labelsList: [],
  selectionsList: [],
  hiddenCustomColumnIds: [], // empty = all custom columns visible by default
};

const taskListCustomColumnsSlice = createSlice({
  name: 'taskListCustomColumnsReducer',
  initialState,
  reducers: {
    toggleCustomColumnModalOpen: (state, action: PayloadAction<boolean>) => {
      state.isCustomColumnModalOpen = action.payload;
    },
    setCustomColumnModalAttributes: (
      state,
      action: PayloadAction<{
        modalType: 'create' | 'edit';
        columnId: string | null;
        columnData?: any;
      }>
    ) => {
      state.customColumnModalType = action.payload.modalType;
      state.customColumnId = action.payload.columnId;
      state.currentColumnData = action.payload.columnData || null;
    },
    setCustomFieldType: (state, action: PayloadAction<CustomFieldsTypes>) => {
      state.customFieldType = action.payload;
    },
    setCustomFieldNumberType: (state, action: PayloadAction<CustomFieldNumberTypes>) => {
      state.customFieldNumberType = action.payload;
    },
    setDecimals: (state, action: PayloadAction<number>) => {
      state.decimals = action.payload;
    },
    setLabel: (state, action: PayloadAction<string>) => {
      state.label = action.payload;
    },
    setLabelPosition: (state, action: PayloadAction<'left' | 'right'>) => {
      state.labelPosition = action.payload;
    },
    setExpression: (state, action: PayloadAction<ExpressionType>) => {
      state.expression = action.payload;
    },
    setFirstNumericColumn: (state, action: PayloadAction<CustomTableColumnsType>) => {
      state.firstNumericColumn = action.payload;
    },
    setSecondNumericColumn: (state, action: PayloadAction<CustomTableColumnsType>) => {
      state.secondNumericColumn = action.payload;
    },
    setLabelsList: (state, action: PayloadAction<LabelType[]>) => {
      state.labelsList = action.payload;
    },
    setSelectionsList: (state, action: PayloadAction<SelectionType[]>) => {
      state.selectionsList = action.payload;
    },
    // Toggles a single custom column hidden/visible by its ID
    toggleCustomColumnVisibility: (state, action: PayloadAction<string>) => {
      const id = action.payload;
      const idx = state.hiddenCustomColumnIds.indexOf(id);
      if (idx === -1) {
        state.hiddenCustomColumnIds.push(id); // hide it
      } else {
        state.hiddenCustomColumnIds.splice(idx, 1); // show it again
      }
    },
    // Bulk-set hidden IDs (used when loading persisted state from localStorage)
    setHiddenCustomColumnIds: (state, action: PayloadAction<string[]>) => {
      state.hiddenCustomColumnIds = action.payload;
    },
    resetCustomFieldValues: state => {
      state.customFieldType = initialState.customFieldType;
      state.customFieldNumberType = initialState.customFieldNumberType;
      state.decimals = initialState.decimals;
      state.label = initialState.label;
      state.labelPosition = initialState.labelPosition;
      state.previewValue = initialState.previewValue;
      state.expression = initialState.expression;
      state.firstNumericColumn = initialState.firstNumericColumn;
      state.secondNumericColumn = initialState.secondNumericColumn;
      state.labelsList = initialState.labelsList;
      state.selectionsList = initialState.selectionsList;
      state.currentColumnData = initialState.currentColumnData;
    },
  },
});

export const {
  toggleCustomColumnModalOpen,
  setCustomColumnModalAttributes,
  setCustomFieldType,
  setCustomFieldNumberType,
  setDecimals,
  setLabel,
  setLabelPosition,
  setExpression,
  setFirstNumericColumn,
  setSecondNumericColumn,
  setLabelsList,
  setSelectionsList,
  toggleCustomColumnVisibility,
  setHiddenCustomColumnIds,
  resetCustomFieldValues,
} = taskListCustomColumnsSlice.actions;
export default taskListCustomColumnsSlice.reducer;