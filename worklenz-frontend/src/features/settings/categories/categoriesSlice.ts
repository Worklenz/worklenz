import { createSlice, createAsyncThunk, PayloadAction } from '@reduxjs/toolkit';
import { IProjectCategory } from '@/types/project/projectCategory.types';
import { categoriesApiService } from '@/api/settings/categories/categories.api.service';
import logger from '@/utils/errorLogger';

type CategoriesState = {
  categoriesList: IProjectCategory[];
  loading: boolean;
  error: string | null;
};

const initialState: CategoriesState = {
  categoriesList: [],
  loading: false,
  error: null,
};

// Async thunk for deleting a category
export const deleteCategoryAsync = createAsyncThunk(
  'categories/deleteCategory',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await categoriesApiService.deleteCategory(id);
      if (response.done) {
        return id;
      }
      return rejectWithValue('Failed to delete category');
    } catch (error) {
      logger.error('Delete Category', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to delete category');
    }
  }
);

const categoriesSlice = createSlice({
  name: 'categoriesReducer',
  initialState,
  reducers: {
    // action for add category
    addCategory: (state, action: PayloadAction<IProjectCategory>) => {
      state.categoriesList.push(action.payload);
    },
    // action for delete category (local state only)
    deleteCategory: (state, action: PayloadAction<string>) => {
      state.categoriesList = state.categoriesList.filter(
        category => category.id !== action.payload
      );
    },
    // clear error
    clearError: state => {
      state.error = null;
    },
  },
  extraReducers: builder => {
    builder
      // Delete category async
      .addCase(deleteCategoryAsync.pending, state => {
        state.loading = true;
        state.error = null;
      })
      .addCase(deleteCategoryAsync.fulfilled, (state, action) => {
        state.loading = false;
        state.categoriesList = state.categoriesList.filter(
          category => category.id !== action.payload
        );
      })
      .addCase(deleteCategoryAsync.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload as string;
      });
  },
});

export const { addCategory, deleteCategory, clearError } = categoriesSlice.actions;
export default categoriesSlice.reducer;
