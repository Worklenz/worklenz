import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { CustomTableColumnsType } from '../taskListColumns/taskColumnsSlice';
import { LabelType } from '../../../../pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/label-type-column/label-type-column';
import { SelectionType } from '../../../../pages/projects/projectView/taskList/task-list-table/custom-columns/custom-column-modal/selection-type-column/selection-type-column';

export type CustomFieldsTypes =
  | 'people'
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
  currentColumnData: any | null; // Store the current column data for editing

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
};

const initialState: TaskListCustomColumnsState = {
  isCustomColumnModalOpen: false,
  customColumnModalType: 'create',
  customColumnId: null,
  currentColumnData: null,

  customFieldType: 'people',
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
    resetCustomFieldValues: state => {
      // Reset all field values to initial state while keeping modal state
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
  resetCustomFieldValues,
} = taskListCustomColumnsSlice.actions;
export default taskListCustomColumnsSlice.reducer;
