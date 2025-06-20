import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { LabelType } from '../../../types/label.type';

type LabelState = {
  labelList: LabelType[];
};

const initialState: LabelState = {
  labelList: [
    { labelId: 'label1', labelName: 'Bug', labelColor: '#ff9c3c' },
    { labelId: 'label2', labelName: 'Test', labelColor: '#905b39' },
    {
      labelId: 'label3',
      labelName: 'Documentation',
      labelColor: '#cbbc78',
    },
    {
      labelId: 'label4',
      labelName: 'Template',
      labelColor: '#154c9b',
    },
    {
      labelId: 'label5',
      labelName: 'UI',
      labelColor: '#f37070',
    },
  ],
};

const labelSlice = createSlice({
  name: 'labelReducer',
  initialState,
  reducers: {
    // action for add label
    addLabel: (state, action: PayloadAction<LabelType>) => {
      state.labelList.push(action.payload);
    },
    // action for delete label
    deleteLabel: (state, action: PayloadAction<string>) => {
      state.labelList = state.labelList.filter(label => label.labelId !== action.payload);
    },
  },
});

export const { addLabel, deleteLabel } = labelSlice.actions;
export default labelSlice.reducer;
