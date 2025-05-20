import { rateCardApiService } from '@/api/settings/rate-cards/rate-cards.api.service';
import { RatecardType } from '@/types/project/ratecard.types';
import logger from '@/utils/errorLogger';
import { createAsyncThunk, createSlice, PayloadAction } from '@reduxjs/toolkit';

type financeState = {
  isRatecardDrawerOpen: boolean;
  isFinanceDrawerOpen: boolean;
  isImportRatecardsDrawerOpen: boolean;
  currency: string;
  isFinanceDrawerloading?: boolean;
  drawerRatecard?: RatecardType | null;
};

const initialState: financeState = {
  isRatecardDrawerOpen: false,
  isFinanceDrawerOpen: false,
  isImportRatecardsDrawerOpen: false,
  currency: 'LKR',
  isFinanceDrawerloading: false,
  drawerRatecard: null,
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
      console.log('response', response);
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
    toggleRatecardDrawer: (state) => {
      state.isRatecardDrawerOpen = !state.isRatecardDrawerOpen;
    },
    toggleFinanceDrawer: (state) => {
      state.isFinanceDrawerOpen = !state.isFinanceDrawerOpen;
    },
    toggleImportRatecardsDrawer: (state) => {
      state.isImportRatecardsDrawerOpen = !state.isImportRatecardsDrawerOpen;
    },
    changeCurrency: (state, action: PayloadAction<string>) => {
      state.currency = action.payload;
    },
    ratecardDrawerLoading: (state, action: PayloadAction<boolean>) => {
      state.isFinanceDrawerloading = action.payload;
    },
    clearDrawerRatecard: (state) => {
      state.drawerRatecard = null;
    },
  },
  extraReducers: (builder) => {
    builder
      // ...other cases...
      .addCase(fetchRateCardById.pending, (state) => {
        state.isFinanceDrawerloading = true;
        state.drawerRatecard = null;
      })
      .addCase(fetchRateCardById.fulfilled, (state, action) => {
        state.isFinanceDrawerloading = false;
        state.drawerRatecard = action.payload;
      })
      .addCase(fetchRateCardById.rejected, (state) => {
        state.isFinanceDrawerloading = false;
        state.drawerRatecard = null;
      });
  },
});

export const {
  toggleRatecardDrawer,
  toggleFinanceDrawer,
  toggleImportRatecardsDrawer,
  changeCurrency,
  ratecardDrawerLoading,
} = financeSlice.actions;
export default financeSlice.reducer;
