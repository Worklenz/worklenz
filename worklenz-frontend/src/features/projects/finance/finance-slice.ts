import { rateCardApiService } from '@/api/settings/rate-cards/rate-cards.api.service';
import { RatecardType } from '@/types/project/ratecard.types';
import logger from '@/utils/errorLogger';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

type financeState = {
  isRatecardDrawerOpen: boolean;
  isFinanceDrawerOpen: boolean;
  isImportRatecardsDrawerOpen: boolean;
  currency: string;
  isRatecardsLoading?: boolean;
  isFinanceDrawerloading?: boolean;
  drawerRatecard?: RatecardType | null;
  ratecardsList?: RatecardType[] | null;
  selectedTask?: any | null;
};

const initialState: financeState = {
  isRatecardDrawerOpen: false,
  isFinanceDrawerOpen: false,
  isImportRatecardsDrawerOpen: false,
  currency: 'USD',
  isRatecardsLoading: false,
  isFinanceDrawerloading: false,
  drawerRatecard: null,
  ratecardsList: null,
  selectedTask: null,
};
interface FetchRateCardsParams {
  index: number;
  size: number;
  field: string | null;
  order: string | null;
  search: string | null;
}
// Async thunks
export const fetchRateCards = createAsyncThunk(
  'ratecards/fetchAll',
  async (params: FetchRateCardsParams, { rejectWithValue }) => {
    try {
      const response = await rateCardApiService.getRateCards(
        params.index,
        params.size,
        params.field,
        params.order,
        params.search
      );
      return response.body;
    } catch (error) {
      logger.error('Fetch RateCards', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch rate cards');
    }
  }
);

export const fetchRateCardById = createAsyncThunk(
  'ratecard/fetchById',
  async (id: string, { rejectWithValue }) => {
    try {
      const response = await rateCardApiService.getRateCardById(id);
      return response.body;
    } catch (error) {
      logger.error('Fetch RateCardById', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to fetch rate card');
    }
  }
);

export const createRateCard = createAsyncThunk(
  'ratecards/create',
  async (body: RatecardType, { rejectWithValue }) => {
    try {
      const response = await rateCardApiService.createRateCard(body);
      return response.body;
    } catch (error) {
      logger.error('Create RateCard', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to create rate card');
    }
  }
);

export const updateRateCard = createAsyncThunk(
  'ratecards/update',
  async ({ id, body }: { id: string; body: RatecardType }, { rejectWithValue }) => {
    try {
      const response = await rateCardApiService.updateRateCard(id, body);
      return response.body;
    } catch (error) {
      logger.error('Update RateCard', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to update rate card');
    }
  }
);

export const deleteRateCard = createAsyncThunk(
  'ratecards/delete',
  async (id: string, { rejectWithValue }) => {
    try {
      await rateCardApiService.deleteRateCard(id);
      return id;
    } catch (error) {
      logger.error('Delete RateCard', error);
      if (error instanceof Error) {
        return rejectWithValue(error.message);
      }
      return rejectWithValue('Failed to delete rate card');
    }
  }
);

const financeSlice = createSlice({
  name: 'financeReducer',
  initialState,
  reducers: {
    toggleRatecardDrawer: state => {
      state.isRatecardDrawerOpen = !state.isRatecardDrawerOpen;
    },
    toggleFinanceDrawer: state => {
      state.isFinanceDrawerOpen = !state.isFinanceDrawerOpen;
    },
    openFinanceDrawer: (state, action: PayloadAction<any>) => {
      state.isFinanceDrawerOpen = true;
      state.selectedTask = action.payload;
    },
    closeFinanceDrawer: state => {
      state.isFinanceDrawerOpen = false;
      state.selectedTask = null;
    },
    setSelectedTask: (state, action: PayloadAction<any>) => {
      state.selectedTask = action.payload;
    },
    toggleImportRatecardsDrawer: state => {
      state.isImportRatecardsDrawerOpen = !state.isImportRatecardsDrawerOpen;
    },
    changeCurrency: (state, action: PayloadAction<string>) => {
      state.currency = action.payload;
    },
    ratecardDrawerLoading: (state, action: PayloadAction<boolean>) => {
      state.isFinanceDrawerloading = action.payload;
    },
    clearDrawerRatecard: state => {
      state.drawerRatecard = null;
    },
  },
  extraReducers: builder => {
    builder
      .addCase(fetchRateCards.pending, state => {
        state.isRatecardsLoading = true;
      })
      .addCase(fetchRateCards.fulfilled, (state, action) => {
        state.isRatecardsLoading = false;
        state.ratecardsList = Array.isArray(action.payload.data)
          ? action.payload.data
          : Array.isArray(action.payload)
            ? action.payload
            : [];
      })
      .addCase(fetchRateCards.rejected, state => {
        state.isRatecardsLoading = false;
        state.ratecardsList = [];
      })
      .addCase(fetchRateCardById.pending, state => {
        state.isFinanceDrawerloading = true;
        state.drawerRatecard = null;
      })
      .addCase(fetchRateCardById.fulfilled, (state, action) => {
        state.isFinanceDrawerloading = false;
        state.drawerRatecard = action.payload;
      })
      .addCase(fetchRateCardById.rejected, state => {
        state.isFinanceDrawerloading = false;
        state.drawerRatecard = null;
      })
      // Create rate card
      .addCase(createRateCard.pending, state => {
        state.isFinanceDrawerloading = true;
      })
      .addCase(createRateCard.fulfilled, (state, action) => {
        state.isFinanceDrawerloading = false;
        if (state.ratecardsList) {
          state.ratecardsList.push(action.payload);
        } else {
          state.ratecardsList = [action.payload];
        }
      })
      .addCase(createRateCard.rejected, state => {
        state.isFinanceDrawerloading = false;
      })
      // Update rate card
      .addCase(updateRateCard.pending, state => {
        state.isFinanceDrawerloading = true;
      })
      .addCase(updateRateCard.fulfilled, (state, action) => {
        state.isFinanceDrawerloading = false;
        // Update the drawerRatecard with the new data
        state.drawerRatecard = action.payload;
        // Update the rate card in the list if it exists
        if (state.ratecardsList && action.payload?.id) {
          const index = state.ratecardsList.findIndex(rc => rc.id === action.payload.id);
          if (index !== -1) {
            state.ratecardsList[index] = action.payload;
          }
        }
      })
      .addCase(updateRateCard.rejected, state => {
        state.isFinanceDrawerloading = false;
      })
      // Delete rate card
      .addCase(deleteRateCard.pending, state => {
        state.isFinanceDrawerloading = true;
      })
      .addCase(deleteRateCard.fulfilled, (state, action) => {
        state.isFinanceDrawerloading = false;
        // Remove the deleted rate card from the list
        if (state.ratecardsList) {
          state.ratecardsList = state.ratecardsList.filter(rc => rc.id !== action.payload);
        }
        // Clear drawer rate card if it was the deleted one
        if (state.drawerRatecard?.id === action.payload) {
          state.drawerRatecard = null;
        }
      })
      .addCase(deleteRateCard.rejected, state => {
        state.isFinanceDrawerloading = false;
      });
  },
});

export const {
  toggleRatecardDrawer,
  toggleFinanceDrawer,
  openFinanceDrawer,
  closeFinanceDrawer,
  setSelectedTask,
  toggleImportRatecardsDrawer,
  changeCurrency,
  ratecardDrawerLoading,
  clearDrawerRatecard,
} = financeSlice.actions;
export default financeSlice.reducer;
