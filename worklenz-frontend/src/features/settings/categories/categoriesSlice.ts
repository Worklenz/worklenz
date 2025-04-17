import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { IProjectCategory } from '@/types/project/projectCategory.types';

type CategoriesState = {
  categoriesList: IProjectCategory[];
};

const initialState: CategoriesState = {
  categoriesList: [],
};

const categoriesSlice = createSlice({
  name: 'categoriesReducer',
  initialState,
  reducers: {
    // action for add category
    addCategory: (state, action: PayloadAction<IProjectCategory>) => {
      state.categoriesList.push(action.payload);
    },
    // action for delete category
    deleteCategory: (state, action: PayloadAction<string>) => {
      state.categoriesList = state.categoriesList.filter(
        category => category.id !== action.payload
      );
    },
  },
});

export const { addCategory, deleteCategory } = categoriesSlice.actions;
export default categoriesSlice.reducer;
